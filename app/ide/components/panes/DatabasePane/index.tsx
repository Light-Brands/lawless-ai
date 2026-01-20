'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIDEStore, MigrationFile, MigrationRunResult } from '../../../stores/ideStore';
import { useSupabaseConnection } from '../../../contexts/ServiceContext';
import { useIDEContext } from '../../../contexts/IDEContext';
import { TableIcon, BellIcon } from '../../Icons';

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

interface TableData {
  table: {
    name: string;
    columns: { name: string; type: string }[];
    rowCount: number;
  };
  rows: Record<string, unknown>[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
}

// Postgres types for add column modal
const POSTGRES_TYPES = [
  { value: 'text', label: 'text', description: 'Variable-length string' },
  { value: 'varchar(255)', label: 'varchar(255)', description: 'Variable-length string with limit' },
  { value: 'integer', label: 'integer', description: '4-byte signed integer' },
  { value: 'bigint', label: 'bigint', description: '8-byte signed integer' },
  { value: 'boolean', label: 'boolean', description: 'True or false' },
  { value: 'uuid', label: 'uuid', description: 'Universally unique identifier' },
  { value: 'timestamptz', label: 'timestamptz', description: 'Date and time with timezone' },
  { value: 'jsonb', label: 'jsonb', description: 'Binary JSON data' },
];

// Icons
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

// Helper functions
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function truncateValue(value: string, maxLength = 50): string {
  return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
}

export function DatabasePane() {
  // Get Supabase connection from ServiceContext (single source of truth)
  const supabase = useSupabaseConnection();
  const projectRef = supabase.projectRef;
  const connected = supabase.status === 'connected';

  // Get repo context for migrations
  const { owner, repo } = useIDEContext();

  const {
    pendingMigrations,
    autoApplyMigrations,
    setAutoApplyMigrations,
    migrations,
    migrationsLoading,
    migrationsSummary,
    migrationRunResults,
    setMigrations,
    setMigrationsLoading,
    setMigrationRunResult,
    clearMigrationRunResult,
  } = useIDEStore();
  const [activeTab, setActiveTab] = useState<'tables' | 'schema' | 'query' | 'migrations'>('tables');
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');

  // Local state for tables and queries
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Table browser state
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [paginationOffset, setPaginationOffset] = useState(0);

  // Modal state
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  // Fetch tables when project ref is available
  useEffect(() => {
    if (!projectRef) return;

    const fetchTables = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/integrations/supabase/projects/${projectRef}/tables`);
        if (!response.ok) throw new Error('Failed to fetch tables');
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

  // Fetch migrations when owner/repo is available
  const fetchMigrations = useCallback(async () => {
    if (!owner || !repo) return;

    setMigrationsLoading(true);
    try {
      const params = new URLSearchParams({ owner, repo });
      if (projectRef) {
        params.set('projectRef', projectRef);
      }

      const response = await fetch(`/api/ide/migrations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch migrations');

      const data = await response.json();
      setMigrations(data.migrations || [], data.summary || { total: 0, applied: 0, pending: 0 });
    } catch (err) {
      console.error('Failed to fetch migrations:', err);
    } finally {
      setMigrationsLoading(false);
    }
  }, [owner, repo, projectRef, setMigrations, setMigrationsLoading]);

  useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations]);

  // State for tracking which migration is being run
  const [runningMigration, setRunningMigration] = useState<string | null>(null);

  // Run a specific migration
  const runMigration = useCallback(async (migration: MigrationFile) => {
    if (!owner || !repo || !projectRef) {
      setMigrationRunResult({
        version: migration.version,
        success: false,
        message: 'Supabase project must be connected to run migrations',
        error: 'Not connected',
        timestamp: Date.now(),
      });
      return;
    }

    // Clear any previous result for this migration
    clearMigrationRunResult(migration.version);
    setRunningMigration(migration.version);

    try {
      const response = await fetch('/api/ide/migrations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          projectRef,
          migrationPath: migration.path,
          migrationVersion: migration.version,
        }),
      });

      const data = await response.json();

      // Store the result
      setMigrationRunResult({
        version: migration.version,
        success: data.success === true,
        message: data.message || (data.success ? 'Migration applied successfully' : 'Migration failed'),
        error: data.error,
        alreadyApplied: data.alreadyApplied,
        timestamp: Date.now(),
      });

      // If successful or already applied, refresh the list
      if (data.success || data.alreadyApplied) {
        await fetchMigrations();
      }
    } catch (err) {
      console.error('Failed to run migration:', err);
      setMigrationRunResult({
        version: migration.version,
        success: false,
        message: 'Failed to run migration',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
      });
    } finally {
      setRunningMigration(null);
    }
  }, [owner, repo, projectRef, fetchMigrations, setMigrationRunResult, clearMigrationRunResult]);

  // Mark migration as applied without running (for already-applied migrations)
  const markMigrationApplied = useCallback(async (migration: MigrationFile) => {
    if (!projectRef) return;

    setRunningMigration(migration.version);
    try {
      // Just record it in the schema_migrations table
      const response = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
            VALUES ('${migration.version}', ARRAY[]::text[], '${migration.name.replace(/'/g, "''")}')
            ON CONFLICT (version) DO NOTHING
          `,
        }),
      });

      if (response.ok) {
        setMigrationRunResult({
          version: migration.version,
          success: true,
          message: 'Migration marked as applied',
          timestamp: Date.now(),
        });
        await fetchMigrations();
      }
    } catch (err) {
      console.error('Failed to mark migration:', err);
    } finally {
      setRunningMigration(null);
    }
  }, [projectRef, fetchMigrations, setMigrationRunResult]);

  // Fetch table data when a table is selected
  const fetchTableData = useCallback(async (tableName: string, offset = 0) => {
    if (!projectRef) return;

    setTableDataLoading(true);
    try {
      // First get columns
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = '${tableName}' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      const columnsRes = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: columnsQuery }),
      });
      const columnsData = await columnsRes.json();
      const columns = (columnsData.results || []).map((c: { column_name: string; data_type: string }) => ({
        name: c.column_name,
        type: c.data_type,
      }));

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
      const countRes = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: countQuery }),
      });
      const countData = await countRes.json();
      const total = parseInt(countData.results?.[0]?.count || '0', 10);

      // Get rows with pagination
      const rowsQuery = `SELECT * FROM "${tableName}" LIMIT 50 OFFSET ${offset}`;
      const rowsRes = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rowsQuery }),
      });
      const rowsData = await rowsRes.json();

      setTableData({
        table: { name: tableName, columns, rowCount: total },
        rows: rowsData.results || [],
        pagination: { limit: 50, offset, total },
      });
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      setTableDataLoading(false);
    }
  }, [projectRef]);

  // Handle table selection
  const handleSelectTable = useCallback((table: TableInfo) => {
    setSelectedTable(table);
    setPaginationOffset(0);
    fetchTableData(table.table_name, 0);
  }, [fetchTableData]);

  // Handle pagination
  const handlePageChange = useCallback((offset: number) => {
    if (!selectedTable) return;
    setPaginationOffset(offset);
    fetchTableData(selectedTable.table_name, offset);
  }, [selectedTable, fetchTableData]);

  // Handle row operations
  const handleSaveRow = useCallback(async (row: Record<string, unknown>) => {
    if (!projectRef || !selectedTable || !tableData) return;

    const columns = tableData.table.columns;
    const isUpdate = editingRow !== null;

    let sql: string;
    if (isUpdate) {
      // Find primary key (assume first column or 'id')
      const pkColumn = columns[0]?.name || 'id';
      const pkValue = editingRow[pkColumn];
      const setClauses = columns
        .filter(c => c.name !== pkColumn)
        .map(c => `"${c.name}" = ${formatSqlValue(row[c.name])}`)
        .join(', ');
      sql = `UPDATE "${selectedTable.table_name}" SET ${setClauses} WHERE "${pkColumn}" = ${formatSqlValue(pkValue)}`;
    } else {
      const colNames = Object.keys(row).map(k => `"${k}"`).join(', ');
      const values = Object.values(row).map(formatSqlValue).join(', ');
      sql = `INSERT INTO "${selectedTable.table_name}" (${colNames}) VALUES (${values})`;
    }

    await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });

    setEditingRow(null);
    setIsAddingRow(false);
    fetchTableData(selectedTable.table_name, paginationOffset);
  }, [projectRef, selectedTable, tableData, editingRow, paginationOffset, fetchTableData]);

  const handleDeleteRow = useCallback(async (filter: Record<string, unknown>) => {
    if (!projectRef || !selectedTable) return;
    if (!confirm('Are you sure you want to delete this row?')) return;

    const whereClause = Object.entries(filter)
      .map(([k, v]) => `"${k}" = ${formatSqlValue(v)}`)
      .join(' AND ');
    const sql = `DELETE FROM "${selectedTable.table_name}" WHERE ${whereClause}`;

    await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });

    fetchTableData(selectedTable.table_name, paginationOffset);
  }, [projectRef, selectedTable, paginationOffset, fetchTableData]);

  const handleAddColumn = useCallback(async (column: ColumnDefinition) => {
    if (!projectRef || !selectedTable) return;

    let sql = `ALTER TABLE "${selectedTable.table_name}" ADD COLUMN "${column.name}" ${column.type}`;
    if (!column.nullable) sql += ' NOT NULL';
    if (column.defaultValue) sql += ` DEFAULT ${column.defaultValue}`;

    await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });

    setIsAddingColumn(false);
    fetchTableData(selectedTable.table_name, paginationOffset);
  }, [projectRef, selectedTable, paginationOffset, fetchTableData]);

  // Fetch columns for schema view
  const fetchTableColumns = useCallback(async (tableName: string) => {
    if (!projectRef) return;

    try {
      const q = `
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
        body: JSON.stringify({ query: q }),
      });

      if (response.ok) {
        const data = await response.json();
        setTables(prev => prev.map(t =>
          t.table_name === tableName ? { ...t, columns: data.results } : t
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
    } catch {
      setQueryResults({ results: [], rowCount: 0, error: 'Failed to execute query' });
    } finally {
      setQueryLoading(false);
    }
  }, [projectRef, query]);

  // Toggle table expansion in schema view
  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
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
          <a href="/integrations/supabase" className="connect-btn">Connect Supabase</a>
        </div>
      </div>
    );
  }

  return (
    <div className="database-pane">
      {/* Tabs */}
      <div className="db-tabs">
        <button className={`db-tab ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>
          Tables
        </button>
        <button className={`db-tab ${activeTab === 'schema' ? 'active' : ''}`} onClick={() => setActiveTab('schema')}>
          Schema
        </button>
        <button className={`db-tab ${activeTab === 'query' ? 'active' : ''}`} onClick={() => setActiveTab('query')}>
          Query
        </button>
        <button className={`db-tab ${activeTab === 'migrations' ? 'active' : ''}`} onClick={() => setActiveTab('migrations')}>
          Migrations
          {pendingMigrations.length > 0 && <span className="badge">{pendingMigrations.length}</span>}
        </button>
      </div>

      <div className="db-content">
        {/* Tables Tab - Table Browser */}
        {activeTab === 'tables' && (
          <div className="tables-browser-content">
            <div className="tables-browser-layout">
              {/* Table list sidebar */}
              <div className="tables-list-sidebar">
                <div className="tables-list-header">
                  <span>Tables ({tables.length})</span>
                  <button className="refresh-btn-sm" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
                    ↻
                  </button>
                </div>
                <div className="tables-list">
                  {loading ? (
                    <div className="tables-loading">Loading...</div>
                  ) : tables.length === 0 ? (
                    <div className="tables-empty">No tables</div>
                  ) : (
                    tables.map(table => (
                      <div
                        key={table.table_name}
                        className={`table-list-item ${selectedTable?.table_name === table.table_name ? 'selected' : ''}`}
                        onClick={() => handleSelectTable(table)}
                      >
                        <span className="table-icon-sm"><TableIcon size={12} /></span>
                        <span className="table-name-sm">{table.table_name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Table data browser */}
              <div className="table-data-area">
                {!selectedTable ? (
                  <div className="table-data-empty">
                    <p>Select a table to view data</p>
                  </div>
                ) : tableDataLoading ? (
                  <div className="table-data-loading">
                    <div className="loading-spinner" />
                    <span>Loading data...</span>
                  </div>
                ) : !tableData || tableData.rows.length === 0 ? (
                  <div className="table-data-empty">
                    <p>No data in {selectedTable.table_name}</p>
                    <button className="add-row-btn" onClick={() => setIsAddingRow(true)}>
                      <PlusIcon /> Add Row
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="table-data-header">
                      <div className="table-data-info">
                        <h3>{tableData.table.name}</h3>
                        <span className="row-count">{tableData.pagination.total} rows</span>
                      </div>
                      <button className="add-row-btn" onClick={() => setIsAddingRow(true)}>
                        <PlusIcon /> Add Row
                      </button>
                    </div>
                    <div className="table-data-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {tableData.table.columns.map(col => (
                              <th key={col.name}>
                                <span className="col-name">{col.name}</span>
                                <span className="col-type">{col.type}</span>
                              </th>
                            ))}
                            <th className="add-col-header">
                              <button className="add-col-btn" onClick={() => setIsAddingColumn(true)} title="Add Column">
                                <PlusIcon />
                              </button>
                            </th>
                            <th className="actions-header">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.rows.map((row, idx) => {
                            const pkCol = tableData.table.columns[0]?.name || 'id';
                            const pkVal = row[pkCol];
                            return (
                              <tr key={String(pkVal) || idx}>
                                {tableData.table.columns.map(col => (
                                  <td key={col.name}>
                                    <span className={`cell-val ${row[col.name] === null ? 'null-val' : ''}`} title={formatCellValue(row[col.name])}>
                                      {truncateValue(formatCellValue(row[col.name]))}
                                    </span>
                                  </td>
                                ))}
                                <td className="add-col-spacer" />
                                <td className="actions-cell">
                                  <button className="row-action edit" onClick={() => setEditingRow(row)} title="Edit">
                                    <EditIcon />
                                  </button>
                                  <button className="row-action delete" onClick={() => handleDeleteRow({ [pkCol]: pkVal })} title="Delete">
                                    <DeleteIcon />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {tableData.pagination.total > 50 && (
                      <div className="table-pagination">
                        <button
                          disabled={tableData.pagination.offset === 0}
                          onClick={() => handlePageChange(Math.max(0, tableData.pagination.offset - 50))}
                        >
                          ← Prev
                        </button>
                        <span>
                          {Math.floor(tableData.pagination.offset / 50) + 1} / {Math.ceil(tableData.pagination.total / 50)}
                        </span>
                        <button
                          disabled={tableData.pagination.offset + 50 >= tableData.pagination.total}
                          onClick={() => handlePageChange(tableData.pagination.offset + 50)}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schema Tab */}
        {activeTab === 'schema' && (
          <div className="schema-content">
            <div className="schema-header">
              <span>Tables ({tables.length})</span>
              <button className="refresh-btn" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
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
                {tables.map(table => {
                  const isExpanded = expandedTables.has(table.table_name);
                  return (
                    <React.Fragment key={table.table_name}>
                      <div className="table-item" onClick={() => toggleTable(table.table_name)}>
                        <span className="table-expand">{isExpanded ? '▼' : '▶'}</span>
                        <span className="table-icon"><TableIcon size={16} /></span>
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
                      {isExpanded && !table.columns && <div className="columns-loading">Loading columns...</div>}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="query-content">
            <div className="query-editor">
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Enter SQL query..."
                className="query-input"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runQuery();
                  }
                }}
              />
              <button className="run-query-btn" onClick={runQuery} disabled={queryLoading || !query.trim()}>
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
                  </div>
                  {!queryResults.error && queryResults.results.length > 0 && (
                    <div className="results-table">
                      <table>
                        <thead>
                          <tr>
                            {Object.keys(queryResults.results[0]).map(key => <th key={key}>{key}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.results.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((val, vIdx) => (
                                <td key={vIdx}>{val === null ? <em>null</em> : String(val)}</td>
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

        {/* Migrations Tab */}
        {activeTab === 'migrations' && (
          <div className="migrations-content">
            {pendingMigrations.length > 0 && (
              <div className="migration-alert">
                <div className="alert-header">
                  <span><BellIcon size={14} /> {pendingMigrations.length} Pending Migration{pendingMigrations.length > 1 ? 's' : ''}</span>
                </div>
                <div className="auto-apply">
                  <label>
                    <input type="checkbox" checked={autoApplyMigrations} onChange={e => setAutoApplyMigrations(e.target.checked)} />
                    Auto-apply migrations on push
                  </label>
                </div>
              </div>
            )}
            <div className="migration-list">
              <div className="migration-list-header">
                <span>
                  Migrations
                  {migrationsSummary && (
                    <span className="migrations-count">
                      ({migrationsSummary.applied}/{migrationsSummary.total} applied)
                    </span>
                  )}
                </span>
                <button className="refresh-btn-sm" onClick={fetchMigrations} disabled={migrationsLoading}>
                  ↻
                </button>
              </div>
              {migrationsLoading ? (
                <div className="migrations-loading">
                  <div className="loading-spinner" />
                  <span>Loading migrations...</span>
                </div>
              ) : migrations.length === 0 ? (
                <div className="migrations-empty">
                  <div className="empty-icon">📁</div>
                  <p>No migrations found</p>
                  <p className="hint">Migration files should be in supabase/migrations/</p>
                </div>
              ) : (
                <div className="migrations-list-items">
                  {migrations.map((migration) => (
                    <MigrationItem
                      key={migration.version}
                      migration={migration}
                      onRun={runMigration}
                      onMarkApplied={markMigrationApplied}
                      onDismissResult={() => clearMigrationRunResult(migration.version)}
                      isRunning={runningMigration === migration.version}
                      canRun={connected}
                      runResult={migrationRunResults[migration.version]}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row Editor Modal */}
      {(editingRow !== null || isAddingRow) && tableData && (
        <RowEditorModal
          columns={tableData.table.columns}
          row={editingRow}
          onSave={handleSaveRow}
          onClose={() => { setEditingRow(null); setIsAddingRow(false); }}
        />
      )}

      {/* Add Column Modal */}
      {isAddingColumn && selectedTable && (
        <AddColumnModal
          tableName={selectedTable.table_name}
          onAdd={handleAddColumn}
          onClose={() => setIsAddingColumn(false)}
        />
      )}
    </div>
  );
}

// Helper to format SQL values
function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Row Editor Modal Component
function RowEditorModal({
  columns,
  row,
  onSave,
  onClose,
}: {
  columns: { name: string; type: string }[];
  row: Record<string, unknown> | null;
  onSave: (row: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const isEditing = row !== null;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    columns.forEach(col => {
      initial[col.name] = row ? formatCellValue(row[col.name]) : '';
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const parsed: Record<string, unknown> = {};
      columns.forEach(col => {
        if (!isEditing && values[col.name] === '') return;
        const val = values[col.name];
        if (val === '' || val === 'null') {
          parsed[col.name] = null;
        } else if (col.type.includes('int') || col.type === 'numeric') {
          parsed[col.name] = Number(val);
        } else if (col.type === 'boolean') {
          parsed[col.name] = val.toLowerCase() === 'true';
        } else if (col.type.includes('json')) {
          try { parsed[col.name] = JSON.parse(val); } catch { parsed[col.name] = val; }
        } else {
          parsed[col.name] = val;
        }
      });
      await onSave(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content row-editor-modal">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Row' : 'Add Row'}</h2>
          <button onClick={onClose} className="modal-close"><CloseIcon /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-fields">
            {columns.map(col => (
              <div key={col.name} className="modal-field">
                <label>
                  <span className="field-name">{col.name}</span>
                  <span className="field-type">{col.type}</span>
                </label>
                <input
                  type="text"
                  value={values[col.name]}
                  onChange={e => setValues(prev => ({ ...prev, [col.name]: e.target.value }))}
                  placeholder={`Enter ${col.name}...`}
                />
              </div>
            ))}
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-btn secondary">Cancel</button>
            <button type="submit" className="modal-btn primary" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Update' : 'Insert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Column Modal Component
function AddColumnModal({
  tableName,
  onAdd,
  onClose,
}: {
  tableName: string;
  onAdd: (column: ColumnDefinition) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [nullable, setNullable] = useState(true);
  const [defaultValue, setDefaultValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Column name is required');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim())) {
      setError('Invalid column name');
      return;
    }
    onAdd({ name: name.trim(), type, nullable, defaultValue: defaultValue.trim() });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-column-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Column to <span className="highlight">{tableName}</span></h3>
          <button onClick={onClose} className="modal-close"><CloseIcon /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-field">
            <label>Column Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. created_at" autoFocus />
          </div>
          <div className="modal-field">
            <label>Data Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {POSTGRES_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <span className="field-hint">{POSTGRES_TYPES.find(t => t.value === type)?.description}</span>
          </div>
          <div className="modal-field checkbox">
            <label>
              <input type="checkbox" checked={nullable} onChange={e => setNullable(e.target.checked)} />
              <span>Allow NULL values</span>
            </label>
          </div>
          <div className="modal-field">
            <label>Default Value (optional)</label>
            <input type="text" value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="e.g. NOW()" />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-btn secondary">Cancel</button>
            <button type="submit" className="modal-btn primary">Add Column</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Migration Item Component
function MigrationItem({
  migration,
  onRun,
  onMarkApplied,
  onDismissResult,
  isRunning,
  canRun,
  runResult,
}: {
  migration: MigrationFile;
  onRun: (migration: MigrationFile) => void;
  onMarkApplied: (migration: MigrationFile) => void;
  onDismissResult: () => void;
  isRunning: boolean;
  canRun: boolean;
  runResult?: MigrationRunResult;
}) {
  const isApplied = migration.status === 'applied';

  // Format timestamp for display
  const formatDate = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Extract readable name from filename
  const displayName = migration.name
    .replace(/^\d{14}_/, '') // Remove timestamp prefix
    .replace(/\.sql$/, '')   // Remove .sql extension
    .replace(/_/g, ' ');     // Replace underscores with spaces

  // Determine if we should show result feedback
  const showResult = runResult && (Date.now() - runResult.timestamp < 30000); // Show for 30 seconds

  return (
    <div className={`migration-item ${isApplied ? 'applied' : 'pending'} ${showResult ? (runResult.success ? 'result-success' : 'result-error') : ''}`}>
      <div className="migration-status">
        {isRunning ? (
          <span className="status-icon running">
            <span className="loading-spinner-sm" />
          </span>
        ) : isApplied ? (
          <span className="status-icon applied" title="Applied">✓</span>
        ) : (
          <span className="status-icon pending" title="Pending">○</span>
        )}
      </div>
      <div className="migration-info">
        <div className="migration-name" title={migration.name}>
          {displayName}
        </div>
        <div className="migration-meta">
          <span className="migration-version">{migration.version}</span>
          {migration.appliedAt && (
            <span className="migration-applied-at">Applied {formatDate(migration.appliedAt)}</span>
          )}
          {!isApplied && migration.timestamp && (
            <span className="migration-created">Created {formatDate(migration.timestamp)}</span>
          )}
        </div>

        {/* Inline result feedback */}
        {showResult && (
          <div className={`migration-result ${runResult.success ? 'success' : 'error'}`}>
            <span className="result-icon">{runResult.success ? '✓' : '✕'}</span>
            <span className="result-message">{runResult.message}</span>
            {runResult.error && !runResult.success && (
              <span className="result-error">{runResult.error}</span>
            )}
            <button className="result-dismiss" onClick={onDismissResult} title="Dismiss">×</button>
            {runResult.alreadyApplied && !isApplied && (
              <button
                className="mark-applied-btn"
                onClick={() => onMarkApplied(migration)}
                title="Mark this migration as applied in the database"
              >
                Mark as Applied
              </button>
            )}
          </div>
        )}
      </div>
      <div className="migration-actions">
        {!isApplied && !isRunning && !showResult && (
          <button
            className="run-migration-btn"
            onClick={() => onRun(migration)}
            disabled={!canRun}
            title={!canRun ? 'Connect Supabase to run migrations' : 'Run this migration'}
          >
            ▶ Run
          </button>
        )}
      </div>
    </div>
  );
}
