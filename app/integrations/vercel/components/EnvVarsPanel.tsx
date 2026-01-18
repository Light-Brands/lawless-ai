'use client';

import { useState, useEffect } from 'react';

interface EnvVar {
  id: string;
  key: string;
  value?: string;
  target: string[];
  type: string;
}

interface EnvVarsPanelProps {
  projectId: string;
  onClose: () => void;
}

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

export default function EnvVarsPanel({ projectId, onClose }: EnvVarsPanelProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVar, setEditingVar] = useState<EnvVar | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formTargets, setFormTargets] = useState<string[]>(['production', 'preview', 'development']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEnvVars();
  }, [projectId]);

  async function loadEnvVars() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/vercel/projects/${projectId}/env`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setEnvVars(data.envs || []);
    } catch (err) {
      setError('Failed to load environment variables');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formKey.trim()) {
      setError('Key is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/integrations/vercel/projects/${projectId}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: formKey,
          value: formValue,
          target: formTargets,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Reload env vars
      await loadEnvVars();
      resetForm();
    } catch (err) {
      setError('Failed to save environment variable');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(envVar: EnvVar) {
    if (!confirm(`Are you sure you want to delete ${envVar.key}?`)) return;

    try {
      const res = await fetch(`/api/integrations/vercel/projects/${projectId}/env`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envId: envVar.id }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      await loadEnvVars();
    } catch (err) {
      setError('Failed to delete environment variable');
    }
  }

  function handleEdit(envVar: EnvVar) {
    setEditingVar(envVar);
    setFormKey(envVar.key);
    setFormValue(''); // Value is encrypted, so we can't prefill it
    setFormTargets(envVar.target || ['production', 'preview', 'development']);
    setShowAddForm(true);
  }

  function resetForm() {
    setShowAddForm(false);
    setEditingVar(null);
    setFormKey('');
    setFormValue('');
    setFormTargets(['production', 'preview', 'development']);
  }

  function toggleTarget(target: string) {
    setFormTargets(prev =>
      prev.includes(target)
        ? prev.filter(t => t !== target)
        : [...prev, target]
    );
  }

  return (
    <div className="env-vars-panel">
      <div className="env-vars-header">
        <h3>Environment Variables</h3>
        <div className="env-vars-actions">
          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="env-add-btn">
              <PlusIcon /> Add Variable
            </button>
          )}
          <button onClick={onClose} className="env-close-btn">
            <CloseIcon />
          </button>
        </div>
      </div>

      {error && <div className="env-error">{error}</div>}

      {showAddForm && (
        <div className="env-form">
          <div className="env-form-row">
            <input
              type="text"
              placeholder="KEY_NAME"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value.toUpperCase())}
              disabled={!!editingVar}
              className="env-input"
            />
            <input
              type="text"
              placeholder="value"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="env-input env-input-value"
            />
          </div>
          <div className="env-form-targets">
            <span>Targets:</span>
            {['production', 'preview', 'development'].map(target => (
              <label key={target} className="env-target-checkbox">
                <input
                  type="checkbox"
                  checked={formTargets.includes(target)}
                  onChange={() => toggleTarget(target)}
                />
                {target}
              </label>
            ))}
          </div>
          <div className="env-form-actions">
            <button onClick={resetForm} className="env-cancel-btn" disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSave} className="env-save-btn" disabled={saving}>
              {saving ? 'Saving...' : (editingVar ? 'Update' : 'Add')}
            </button>
          </div>
        </div>
      )}

      <div className="env-vars-list">
        {loading ? (
          <div className="env-loading">Loading...</div>
        ) : envVars.length === 0 ? (
          <div className="env-empty">No environment variables configured</div>
        ) : (
          envVars.map(envVar => (
            <div key={envVar.id} className="env-var-item">
              <div className="env-var-info">
                <span className="env-var-key">{envVar.key}</span>
                <span className="env-var-value">
                  {envVar.type === 'encrypted' ? '••••••••' : (envVar.value || '(empty)')}
                </span>
                <div className="env-var-targets">
                  {envVar.target?.map(t => (
                    <span key={t} className={`env-target-badge env-target-${t}`}>
                      {t.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="env-var-actions">
                <button onClick={() => handleEdit(envVar)} className="env-action-btn" title="Edit">
                  <EditIcon />
                </button>
                <button onClick={() => handleDelete(envVar)} className="env-action-btn env-action-delete" title="Delete">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .env-vars-panel {
          background: rgba(20, 20, 25, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .env-vars-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .env-vars-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .env-vars-actions {
          display: flex;
          gap: 8px;
        }

        .env-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 6px;
          color: #818cf8;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .env-add-btn:hover {
          background: rgba(99, 102, 241, 0.3);
        }

        .env-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #888;
          cursor: pointer;
          transition: all 0.2s;
        }

        .env-close-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .env-error {
          padding: 10px 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .env-form {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .env-form-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .env-input {
          flex: 1;
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          font-family: monospace;
        }

        .env-input:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.5);
        }

        .env-input-value {
          flex: 2;
        }

        .env-form-targets {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          color: #888;
          font-size: 13px;
        }

        .env-target-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          color: #aaa;
        }

        .env-target-checkbox input {
          accent-color: #6366f1;
        }

        .env-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .env-cancel-btn,
        .env-save-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .env-cancel-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #888;
        }

        .env-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .env-save-btn {
          background: #6366f1;
          border: none;
          color: #fff;
        }

        .env-save-btn:hover {
          background: #5558e3;
        }

        .env-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .env-vars-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .env-loading,
        .env-empty {
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }

        .env-var-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .env-var-item:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .env-var-info {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .env-var-key {
          font-family: monospace;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
        }

        .env-var-value {
          font-family: monospace;
          font-size: 12px;
          color: #666;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .env-var-targets {
          display: flex;
          gap: 4px;
        }

        .env-target-badge {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }

        .env-target-production {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }

        .env-target-preview {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .env-target-development {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .env-var-actions {
          display: flex;
          gap: 4px;
        }

        .env-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 4px;
          color: #666;
          cursor: pointer;
          transition: all 0.2s;
        }

        .env-action-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .env-action-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
      `}</style>
    </div>
  );
}
