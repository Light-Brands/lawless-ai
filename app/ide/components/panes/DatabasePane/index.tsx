'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useSupabaseConnection } from '../../../contexts/ServiceContext';

interface TableInfo {
  table_name: string;
  table_schema: string;
  columns?: ColumnInfo[];
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key?: boolean;
}

interface QueryResult {
  results: Record<string, unknown>[];
  rowCount: number;
  error?: string;
}

export function DatabasePane() {
  // Get Supabase connection from ServiceContext (single source of truth)
  const supabase = useSupabaseConnection();
  const projectRef = supabase.projectRef;
  const connected = supabase.status === 'connected';

  const { pendingMigrations, autoApplyMigrations, setAutoApplyMigrations } = useIDEStore();
  const [activeTab, setActiveTab] = useState<'migrations' | 'query' | 'schema'>('schema');
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');

  // Local state for tables and queries (not from context)
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch tables when project ref is available
  useEffect(() => {
    if (!projectRef) return;

    const fetchTables = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/integrations/supabase/projects/${projectRef}/tables`);
        if (!response.ok) {
          throw new Error('Failed to fetch tables');
        }
        const data = await response.json();
        setTables(data.tables || []);
      } catch (err) {
        console.error('Failed to fetch tables:', err);
        setError('Failed to load database schema');
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, [projectRef, refreshKey]);

  // Fetch columns for a table
  const fetchTableColumns = useCallback(async (tableName: string) => {
    if (!projectRef) return;

    try {
      const query = `
        SELECT column_name, data_type, is_nullable, column_default,
          (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage kcu
           JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
           WHERE tc.constraint_type = 'PRIMARY KEY'
           AND kcu.table_name = c.table_name
           AND kcu.column_name = c.column_name) as is_primary_key
        FROM information_schema.columns c
        WHERE table_name = '${tableName}' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      const response = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setTables(prev => prev.map(t =>
          t.table_name === tableName
            ? { ...t, columns: data.results }
            : t
        ));
      }
    } catch (err) {
      console.error('Failed to fetch columns:', err);
    }
  }, [projectRef]);

  // Run SQL query
  const runQuery = useCallback(async () => {
    if (!projectRef || !query.trim()) return;

    setQueryLoading(true);
    setQueryResults(null);
    try {
      const response = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (!response.ok) {
        setQueryResults({ results: [], rowCount: 0, error: data.error || 'Query failed' });
      } else {
        setQueryResults({ results: data.results || [], rowCount: data.rowCount || 0 });
      }
    } catch (err) {
      setQueryResults({ results: [], rowCount: 0, error: 'Failed to execute query' });
    } finally {
      setQueryLoading(false);
    }
  }, [projectRef, query]);

  // Toggle table expansion to show columns
  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
      // Fetch columns if not already loaded
      const table = tables.find(t => t.table_name === tableName);
      if (table && !table.columns) {
        fetchTableColumns(tableName);
      }
    }
    setExpandedTables(newExpanded);
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="database-pane">
        <div className="db-not-connected">
          <div className="not-connected-icon">🗄️</div>
          <h3>No Database Connected</h3>
          <p>Link a Supabase project to this repository to view and manage your database.</p>
          <a href="/integrations/supabase" className="connect-btn">
            Connect Supabase
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="database-pane">
      {/* Tabs */}
      <div className="db-tabs">
        <button
          className={`db-tab ${activeTab === 'schema' ? 'active' : ''}`}
          onClick={() => setActiveTab('schema')}
        >
          Schema
        </button>
        <button
          className={`db-tab ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          Query
        </button>
        <button
          className={`db-tab ${activeTab === 'migrations' ? 'active' : ''}`}
          onClick={() => setActiveTab('migrations')}
        >
          Migrations
          {pendingMigrations.length > 0 && (
            <span className="badge">{pendingMigrations.length}</span>
          )}
        </button>
      </div>

      <div className="db-content">
        {activeTab === 'schema' && (
          <div className="schema-content">
            <div className="schema-header">
              <span>Tables ({tables.length})</span>
              <button
                className="refresh-btn"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
              >
                {loading ? '...' : 'Refresh'}
              </button>
            </div>
            {loading ? (
              <div className="schema-loading">Loading schema...</div>
            ) : error ? (
              <div className="schema-error">{error}</div>
            ) : tables.length === 0 ? (
              <div className="schema-empty">No tables found</div>
            ) : (
              <div className="schema-tree">
                {tables.map((table) => {
                  const isExpanded = expandedTables.has(table.table_name);
                  return (
                    <React.Fragment key={table.table_name}>
                      <div
                        className="table-item"
                        onClick={() => toggleTable(table.table_name)}
                      >
                        <span className="table-expand">{isExpanded ? '▼' : '▶'}</span>
                        <span className="table-icon">📋</span>
                        <span className="table-name">{table.table_name}</span>
                      </div>
                      {isExpanded && table.columns && (
                        <div className="columns-list">
                          {table.columns.map((col, idx) => (
                            <div key={col.column_name} className="column-item">
                              <span>
                                {idx === table.columns!.length - 1 ? '└─' : '├─'} {col.column_name}
                                <span className="column-type"> ({col.data_type}
                                  {col.is_primary_key ? ', PK' : ''}
                                  {col.is_nullable === 'NO' ? ', NOT NULL' : ''})
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isExpanded && !table.columns && (
                        <div className="columns-loading">Loading columns...</div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'query' && (
          <div className="query-content">
            <div className="query-editor">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter SQL query..."
                className="query-input"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runQuery();
                  }
                }}
              />
              <button
                className="run-query-btn"
                onClick={runQuery}
                disabled={queryLoading || !query.trim()}
              >
                {queryLoading ? '...' : 'Run ▶'}
              </button>
            </div>
            <div className="query-results">
              {queryResults ? (
                <>
                  <div className="results-header">
                    {queryResults.error ? (
                      <span className="results-error">Error: {queryResults.error}</span>
                    ) : (
                      <span>Results ({queryResults.rowCount} rows)</span>
                    )}
                    {!queryResults.error && queryResults.results.length > 0 && (
                      <button className="export-btn">Export</button>
                    )}
                  </div>
                  {!queryResults.error && queryResults.results.length > 0 && (
                    <div className="results-table">
                      <table>
                        <thead>
                          <tr>
                            {Object.keys(queryResults.results[0]).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.results.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((val, vIdx) => (
                                <td key={vIdx}>
                                  {val === null ? <em>null</em> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!queryResults.error && queryResults.results.length === 0 && (
                    <div className="results-empty">Query executed successfully. No rows returned.</div>
                  )}
                </>
              ) : (
                <div className="results-placeholder">
                  <p>Run a query to see results</p>
                  <p className="hint">Press ⌘+Enter to execute</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'migrations' && (
          <div className="migrations-content">
            {/* Pending migration alert */}
            {pendingMigrations.length > 0 && (
              <div className="migration-alert">
                <div className="alert-header">
                  <span>🔔 New Migration Detected</span>
                  <button className="apply-btn">Apply</button>
                </div>
                <div className="alert-file">{pendingMigrations[0]}</div>
                <div className="auto-apply">
                  <label>
                    <input
                      type="checkbox"
                      checked={autoApplyMigrations}
                      onChange={(e) => setAutoApplyMigrations(e.target.checked)}
                    />
                    Auto-apply
                  </label>
                </div>
              </div>
            )}

            {/* Migration list - placeholder for now */}
            <div className="migration-list">
              <div className="migration-list-header">
                <span>Migrations</span>
                <button className="new-migration-btn">+ New</button>
              </div>
              <div className="migrations-placeholder">
                <p>Migration tracking coming soon</p>
                <p className="hint">Use the Query tab to run SQL directly</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
