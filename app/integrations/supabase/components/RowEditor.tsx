'use client';

import { useState } from 'react';

interface Column {
  name: string;
  type: string;
}

interface RowEditorProps {
  columns: Column[];
  row: Record<string, any> | null;
  onSave: (row: Record<string, any>) => Promise<void>;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/>
    <line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

function parseValue(value: string, type: string): any {
  if (value === '' || value === 'null') return null;

  switch (type) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? value : num;
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'object':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function RowEditor({ columns, row, onSave, onClose }: RowEditorProps) {
  const isEditing = row !== null;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    columns.forEach((col) => {
      initial[col.name] = row ? formatValue(row[col.name]) : '';
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const parsedRow: Record<string, any> = {};
      columns.forEach((col) => {
        // Skip empty values for new rows unless it's the id column
        if (!isEditing && values[col.name] === '' && col.name !== 'id') {
          return;
        }
        parsedRow[col.name] = parseValue(values[col.name], col.type);
      });

      await onSave(parsedRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save row');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(columnName: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [columnName]: value,
    }));
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content row-editor-modal">
        <div className="row-editor-header">
          <h2>{isEditing ? 'Edit Row' : 'Add Row'}</h2>
          <button onClick={onClose} className="modal-close">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="row-editor-form">
          <div className="row-editor-fields">
            {columns.map((column) => (
              <div key={column.name} className="row-editor-field">
                <label>
                  <span className="field-name">{column.name}</span>
                  <span className="field-type">{column.type}</span>
                </label>
                {column.type === 'object' || values[column.name]?.includes('\n') ? (
                  <textarea
                    value={values[column.name]}
                    onChange={(e) => handleChange(column.name, e.target.value)}
                    placeholder={`Enter ${column.name}...`}
                    rows={4}
                  />
                ) : (
                  <input
                    type={column.type === 'number' ? 'text' : 'text'}
                    value={values[column.name]}
                    onChange={(e) => handleChange(column.name, e.target.value)}
                    placeholder={`Enter ${column.name}...`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && <div className="row-editor-error">{error}</div>}

          <div className="row-editor-actions">
            <button type="button" onClick={onClose} className="modal-btn secondary">
              Cancel
            </button>
            <button type="submit" className="modal-btn primary" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Insert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
