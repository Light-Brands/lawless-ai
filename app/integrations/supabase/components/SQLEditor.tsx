'use client';

import { useState } from 'react';

interface SQLEditorProps {
  projectRef: string;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/>
    <line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

export default function SQLEditor({ projectRef, onClose }: SQLEditorProps) {
  const [query, setQuery] = useState('SELECT * FROM ');
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExecute() {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/integrations/supabase/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        if (data.hint) {
          setError(`${data.error}\n\nHint: ${data.hint}`);
        }
        return;
      }

      setResults(data.results || []);
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
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content sql-editor-modal">
        <div className="sql-editor-header">
          <h2>SQL Editor</h2>
          <button onClick={onClose} className="modal-close">
            <CloseIcon />
          </button>
        </div>

        <div className="sql-editor-content">
          <div className="sql-editor-input">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your SQL query..."
              spellCheck={false}
              autoFocus
            />
            <div className="sql-editor-actions">
              <span className="sql-editor-hint">Cmd/Ctrl + Enter to execute</span>
              <button
                onClick={handleExecute}
                className="sql-execute-btn"
                disabled={loading || !query.trim()}
              >
                <PlayIcon />
                <span>{loading ? 'Running...' : 'Run Query'}</span>
              </button>
            </div>
          </div>

          <div className="sql-editor-results">
            {error && (
              <div className="sql-error">
                <pre>{error}</pre>
              </div>
            )}

            {results && (
              <div className="sql-results">
                {results.length === 0 ? (
                  <div className="sql-results-empty">Query executed successfully. No results returned.</div>
                ) : (
                  <div className="sql-results-table-container">
                    <table className="sql-results-table">
                      <thead>
                        <tr>
                          {Object.keys(results[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, colIndex) => (
                              <td key={colIndex}>
                                {value === null ? (
                                  <span className="null-value">null</span>
                                ) : typeof value === 'object' ? (
                                  JSON.stringify(value)
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
                <div className="sql-results-count">{results.length} rows</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
