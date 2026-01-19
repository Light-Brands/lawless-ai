'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SQLEditorPanelProps {
  projectRef: string;
  tables: { name: string; schema: string }[];
}

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  success: boolean;
  rowCount?: number;
  executionTime?: number;
}

interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const TableIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18"/>
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M3 15h18"/>
  </svg>
);

const sqlKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'ORDER', 'BY',
  'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
  'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'PRIMARY',
  'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'NULL', 'DEFAULT', 'CASCADE',
  'ASC', 'DESC', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'EXISTS', 'TRUE', 'FALSE',
  'IS', 'COALESCE', 'NULLIF', 'CAST', 'RETURNING'
];

function highlightSQL(sql: string): string {
  let highlighted = sql;

  // Escape HTML
  highlighted = highlighted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight strings (single quotes)
  highlighted = highlighted.replace(
    /'([^'\\]|\\.)*'/g,
    '<span class="sql-string">$&</span>'
  );

  // Highlight numbers
  highlighted = highlighted.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="sql-number">$1</span>'
  );

  // Highlight keywords (case insensitive)
  const keywordPattern = new RegExp(
    `\\b(${sqlKeywords.join('|')})\\b`,
    'gi'
  );
  highlighted = highlighted.replace(
    keywordPattern,
    '<span class="sql-keyword">$1</span>'
  );

  // Highlight comments
  highlighted = highlighted.replace(
    /--.*$/gm,
    '<span class="sql-comment">$&</span>'
  );

  return highlighted;
}

export default function SQLEditorPanel({ projectRef, tables }: SQLEditorPanelProps) {
  const [query, setQuery] = useState('SELECT * FROM ');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // Load history from database
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/sql/history?projectRef=${encodeURIComponent(projectRef)}`);
        if (res.ok) {
          const data = await res.json();
          setHistory((data.history || []).map((item: any) => ({
            id: item.id,
            query: item.query,
            timestamp: new Date(item.created_at),
            success: item.success,
            rowCount: item.row_count,
            executionTime: item.execution_time_ms,
          })));
        }
      } catch {
        // Ignore errors
      }
    }
    loadHistory();
  }, [projectRef]);

  // Save history item to database
  const saveHistoryItem = useCallback(async (item: QueryHistoryItem) => {
    try {
      await fetch('/api/sql/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectRef,
          query: item.query,
          success: item.success,
          rowCount: item.rowCount,
          executionTimeMs: item.executionTime,
        }),
      });
    } catch {
      // Ignore save errors
    }
  }, [projectRef]);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  async function handleExecute() {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const startTime = performance.now();

    try {
      const res = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      const executionTime = Math.round(performance.now() - startTime);

      if (data.error) {
        let errorMsg = data.error;
        if (data.hint) {
          errorMsg += `\n\nHint: ${data.hint}`;
        }
        setError(errorMsg);

        // Add to history as failed
        const historyItem: QueryHistoryItem = {
          id: crypto.randomUUID(),
          query: query.trim(),
          timestamp: new Date(),
          success: false,
          executionTime,
        };
        setHistory(prev => [historyItem, ...prev]);
        saveHistoryItem(historyItem);
        return;
      }

      const rows = data.results || [];
      setResults({
        rows,
        rowCount: rows.length,
        executionTime,
      });

      // Add to history as successful
      const historyItem: QueryHistoryItem = {
        id: crypto.randomUUID(),
        query: query.trim(),
        timestamp: new Date(),
        success: true,
        rowCount: rows.length,
        executionTime,
      };
      setHistory(prev => [historyItem, ...prev]);
      saveHistoryItem(historyItem);
    } catch (err) {
      setError('Failed to execute query');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }

    // Handle Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = query.substring(0, start) + '  ' + query.substring(end);
        setQuery(newValue);
        // Set cursor position after indent
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  }

  function handleHistorySelect(item: QueryHistoryItem) {
    setQuery(item.query);
    textareaRef.current?.focus();
  }

  async function handleClearHistory() {
    setHistory([]);
    try {
      await fetch(`/api/sql/history?projectRef=${encodeURIComponent(projectRef)}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore errors
    }
  }

  function handleDeleteHistoryItem(id: string) {
    // For now, just remove from local state
    // Individual item deletion would require an additional API endpoint
    setHistory(prev => prev.filter(item => item.id !== id));
  }

  async function handleCopyResults() {
    if (!results) return;
    try {
      const text = results.rows.map(row =>
        Object.values(row).map(v => v === null ? 'null' : String(v)).join('\t')
      ).join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  }

  function insertTableName(tableName: string) {
    setQuery(prev => prev + tableName + ' ');
    textareaRef.current?.focus();
  }

  function formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="sql-editor-panel">
      {/* History Sidebar */}
      {showHistory && (
        <aside className="sql-history-sidebar">
          <div className="sql-history-header">
            <div className="sql-history-title">
              <HistoryIcon />
              <span>History</span>
            </div>
            {history.length > 0 && (
              <button
                className="sql-history-clear"
                onClick={handleClearHistory}
                title="Clear history"
              >
                <TrashIcon />
              </button>
            )}
          </div>

          {/* Tables quick insert */}
          <div className="sql-tables-section">
            <div className="sql-tables-header">Tables</div>
            <div className="sql-tables-list">
              {tables.map(table => (
                <button
                  key={table.name}
                  className="sql-table-item"
                  onClick={() => insertTableName(table.name)}
                  title={`Insert "${table.name}"`}
                >
                  <TableIcon />
                  <span>{table.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Query history */}
          <div className="sql-history-list">
            {history.length === 0 ? (
              <div className="sql-history-empty">No queries yet</div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className={`sql-history-item ${item.success ? 'success' : 'error'}`}
                >
                  <button
                    className="sql-history-item-main"
                    onClick={() => handleHistorySelect(item)}
                  >
                    <code className="sql-history-query">{item.query}</code>
                    <div className="sql-history-meta">
                      <span className="sql-history-time">{formatTimestamp(item.timestamp)}</span>
                      {item.success && item.rowCount !== undefined && (
                        <span className="sql-history-rows">{item.rowCount} rows</span>
                      )}
                      {item.executionTime !== undefined && (
                        <span className="sql-history-duration">{item.executionTime}ms</span>
                      )}
                    </div>
                  </button>
                  <button
                    className="sql-history-item-delete"
                    onClick={() => handleDeleteHistoryItem(item.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Main Editor Area */}
      <div className="sql-editor-main">
        {/* Query Input */}
        <div className="sql-editor-input-section">
          <div className="sql-editor-toolbar">
            <button
              className="sql-history-toggle"
              onClick={() => setShowHistory(!showHistory)}
              title={showHistory ? 'Hide sidebar' : 'Show sidebar'}
            >
              <HistoryIcon />
            </button>
            <div className="sql-editor-title">SQL Editor</div>
            <div className="sql-editor-actions">
              <span className="sql-editor-hint">
                <kbd>⌘</kbd> + <kbd>Enter</kbd> to run
              </span>
              <button
                onClick={handleExecute}
                className="sql-execute-btn"
                disabled={loading || !query.trim()}
              >
                <PlayIcon />
                <span>{loading ? 'Running...' : 'Run'}</span>
              </button>
            </div>
          </div>

          <div className="sql-editor-textarea-wrapper">
            <pre
              ref={highlightRef}
              className="sql-editor-highlight"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightSQL(query) + '\n' }}
            />
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              placeholder="Enter your SQL query..."
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>

        {/* Results Section */}
        <div className="sql-editor-results-section">
          {error && (
            <div className="sql-editor-error">
              <div className="sql-editor-error-header">Error</div>
              <pre className="sql-editor-error-message">{error}</pre>
            </div>
          )}

          {results && (
            <div className="sql-editor-results">
              <div className="sql-editor-results-header">
                <div className="sql-editor-results-info">
                  <span className="sql-editor-results-count">
                    {results.rowCount} row{results.rowCount !== 1 ? 's' : ''}
                  </span>
                  <span className="sql-editor-results-time">
                    {results.executionTime}ms
                  </span>
                </div>
                <button
                  className="sql-editor-copy-btn"
                  onClick={handleCopyResults}
                  title="Copy results"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {results.rowCount === 0 ? (
                <div className="sql-editor-results-empty">
                  Query executed successfully. No rows returned.
                </div>
              ) : (
                <div className="sql-editor-results-table-wrapper">
                  <table className="sql-editor-results-table">
                    <thead>
                      <tr>
                        <th className="sql-row-number">#</th>
                        {Object.keys(results.rows[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.rows.map((row, index) => (
                        <tr key={index}>
                          <td className="sql-row-number">{index + 1}</td>
                          {Object.values(row).map((value, colIndex) => (
                            <td key={colIndex}>
                              {value === null ? (
                                <span className="sql-null-value">NULL</span>
                              ) : typeof value === 'object' ? (
                                <code className="sql-json-value">
                                  {JSON.stringify(value)}
                                </code>
                              ) : typeof value === 'boolean' ? (
                                <span className={`sql-bool-value ${value ? 'true' : 'false'}`}>
                                  {String(value)}
                                </span>
                              ) : (
                                String(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!error && !results && !loading && (
            <div className="sql-editor-placeholder">
              <div className="sql-editor-placeholder-icon">
                <PlayIcon />
              </div>
              <p>Run a query to see results</p>
            </div>
          )}

          {loading && (
            <div className="sql-editor-loading">
              <div className="sql-editor-loading-spinner" />
              <p>Executing query...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
