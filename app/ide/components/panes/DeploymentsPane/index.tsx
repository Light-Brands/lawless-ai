'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useVercelConnection } from '../../../contexts/ServiceContext';
import { RocketIcon } from '../../Icons';

interface Deployment {
  id: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'READY' | 'CANCELED' | 'QUEUED' | 'INITIALIZING';
  target: 'production' | 'preview' | null;
  createdAt: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitMessage?: string;
    githubCommitSha?: string;
    githubCommitAuthorName?: string;
  };
  creator?: {
    username: string;
  };
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
  target: ('production' | 'preview' | 'development')[];
  type: 'plain' | 'encrypted' | 'secret';
}

// Icons
const LogsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" x2="8" y1="13" y2="13"/>
    <line x1="16" x2="8" y1="17" y2="17"/>
  </svg>
);

const RedeployIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

const CancelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" x2="21" y1="14" y2="3"/>
  </svg>
);

const GitBranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

// Helpers
function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getStatusBadgeClass(state: string): string {
  switch (state?.toUpperCase()) {
    case 'READY': return 'success';
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED': return 'warning';
    case 'ERROR': return 'error';
    case 'CANCELED': return 'muted';
    default: return 'default';
  }
}

export function DeploymentsPane() {
  const vercel = useVercelConnection();
  const projectId = vercel.projectId;
  const connected = vercel.status === 'connected';

  const { deploymentStatus, setDeploymentStatus } = useIDEStore();
  const [activeTab, setActiveTab] = useState<'deployments' | 'env'>('deployments');

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [envLoading, setEnvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [redeploying, setRedeploying] = useState<string | null>(null);

  // Fetch deployments
  const fetchDeployments = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/vercel/deployments?projectId=${projectId}&limit=15`);
      if (!response.ok) throw new Error('Failed to fetch deployments');
      const data = await response.json();
      setDeployments(data.deployments || []);

      if (data.deployments?.length > 0) {
        const latest = data.deployments[0];
        if (latest.state === 'ERROR') setDeploymentStatus('failed');
        else if (latest.state === 'BUILDING') setDeploymentStatus('building');
        else if (latest.state === 'READY') setDeploymentStatus('ready');
      }
    } catch (err) {
      console.error('Failed to fetch deployments:', err);
      setError('Failed to load deployments');
    } finally {
      setLoading(false);
    }
  }, [projectId, setDeploymentStatus]);

  useEffect(() => {
    if (projectId) fetchDeployments();
  }, [projectId, fetchDeployments]);

  // Fetch env vars
  const fetchEnvVars = useCallback(async () => {
    if (!projectId) return;
    setEnvLoading(true);
    try {
      const response = await fetch(`/api/integrations/vercel/projects/${projectId}/env`);
      if (response.ok) {
        const data = await response.json();
        setEnvVars(data.envs || []);
      }
    } catch (err) {
      console.error('Failed to fetch env vars:', err);
    } finally {
      setEnvLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && activeTab === 'env') fetchEnvVars();
  }, [projectId, activeTab, fetchEnvVars]);

  // Fetch logs
  const fetchLogs = useCallback(async (deploymentId: string) => {
    setLogsLoading(true);
    setDeploymentLogs([]);
    try {
      const response = await fetch(`/api/integrations/vercel/deployments/${deploymentId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setDeploymentLogs(data.logs?.map((l: { text: string }) => l.text) || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setDeploymentLogs(['Failed to load logs']);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Redeploy
  const handleRedeploy = useCallback(async (deployment: Deployment) => {
    if (!projectId) return;
    setRedeploying(deployment.id);
    try {
      const response = await fetch(`/api/integrations/vercel/deployments/${deployment.id}/redeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (response.ok) {
        // Refresh deployments after a short delay
        setTimeout(fetchDeployments, 1000);
      }
    } catch (err) {
      console.error('Failed to redeploy:', err);
    } finally {
      setRedeploying(null);
    }
  }, [projectId, fetchDeployments]);

  // Cancel deployment
  const handleCancel = useCallback(async (deployment: Deployment) => {
    try {
      const response = await fetch(`/api/integrations/vercel/deployments/${deployment.id}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        setTimeout(fetchDeployments, 1000);
      }
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  }, [fetchDeployments]);

  // View logs
  const handleViewLogs = useCallback((deployment: Deployment) => {
    setSelectedDeployment(deployment);
    fetchLogs(deployment.id);
  }, [fetchLogs]);

  if (!connected) {
    return (
      <div className="deployments-pane">
        <div className="deploy-not-connected">
          <div className="not-connected-icon"><RocketIcon size={32} /></div>
          <h3>No Deployment Service Connected</h3>
          <p>Link a Vercel project to this repository to view and manage deployments.</p>
          <a href="/integrations/vercel" className="connect-btn">Connect Vercel</a>
        </div>
      </div>
    );
  }

  return (
    <div className="deployments-pane">
      <div className="deploy-tabs">
        <button className={`deploy-tab ${activeTab === 'deployments' ? 'active' : ''}`} onClick={() => setActiveTab('deployments')}>
          Deployments
        </button>
        <button className={`deploy-tab ${activeTab === 'env' ? 'active' : ''}`} onClick={() => setActiveTab('env')}>
          Env Vars
        </button>
      </div>

      <div className="deploy-content">
        {activeTab === 'deployments' && (
          <div className="deployments-list-content">
            <div className="deployments-list-header">
              <h2>Deployments</h2>
              <div className="deployments-header-right">
                <span className="deployments-count">{deployments.length} deployments</span>
                <button className="refresh-deployments-btn" onClick={fetchDeployments} disabled={loading}>
                  {loading ? '...' : '↻'}
                </button>
              </div>
            </div>

            {loading && deployments.length === 0 ? (
              <div className="deployments-loading">Loading deployments...</div>
            ) : error ? (
              <div className="deployments-error">{error}</div>
            ) : deployments.length === 0 ? (
              <div className="deployments-empty">No deployments found</div>
            ) : (
              <div className="deployment-items">
                {deployments.map((deploy) => {
                  const isBuilding = ['BUILDING', 'INITIALIZING', 'QUEUED'].includes(deploy.state?.toUpperCase());
                  return (
                    <div key={deploy.id} className="deployment-card">
                      {/* Top row: badges left, time + actions right */}
                      <div className="deployment-card-top">
                        <div className="deployment-badges">
                          <span className={`deployment-status-badge ${getStatusBadgeClass(deploy.state)}`}>
                            <span className="status-dot" />
                            {deploy.state}
                          </span>
                          {deploy.target === 'production' && (
                            <span className="deployment-env-badge">Production</span>
                          )}
                        </div>
                        <div className="deployment-actions-row">
                          <span className="deployment-time">{getTimeAgo(deploy.createdAt)}</span>
                          <button
                            className="deployment-action-btn"
                            onClick={() => handleViewLogs(deploy)}
                            title="View Logs"
                          >
                            <LogsIcon />
                            <span>Logs</span>
                          </button>
                          {isBuilding ? (
                            <button
                              className="deployment-action-btn danger"
                              onClick={() => handleCancel(deploy)}
                              title="Cancel Build"
                            >
                              <CancelIcon />
                              <span>Cancel</span>
                            </button>
                          ) : (
                            <button
                              className="deployment-action-btn"
                              onClick={() => handleRedeploy(deploy)}
                              disabled={redeploying === deploy.id}
                              title="Redeploy"
                            >
                              <RedeployIcon />
                              <span>{redeploying === deploy.id ? '...' : 'Redeploy'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Commit message */}
                      {deploy.meta?.githubCommitMessage && (
                        <p className="deployment-commit-message">{deploy.meta.githubCommitMessage}</p>
                      )}

                      {/* Branch and SHA */}
                      {deploy.meta?.githubCommitRef && (
                        <div className="deployment-branch">
                          <GitBranchIcon />
                          <span>{deploy.meta.githubCommitRef}</span>
                          {deploy.meta.githubCommitSha && (
                            <code className="deployment-sha">{deploy.meta.githubCommitSha.substring(0, 7)}</code>
                          )}
                        </div>
                      )}

                      {/* URL */}
                      {deploy.url && (
                        <a
                          href={`https://${deploy.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="deployment-url"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {deploy.url}
                          <ExternalLinkIcon />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'env' && (
          <div className="env-vars-content">
            <div className="env-header">
              <span>Environment Variables ({envVars.length})</span>
              <button className="add-env-btn">+ Add</button>
            </div>

            {envLoading ? (
              <div className="env-loading">Loading environment variables...</div>
            ) : envVars.length === 0 ? (
              <div className="env-empty">No environment variables configured</div>
            ) : (
              <>
                <div className="env-section">
                  <div className="env-section-title">Production</div>
                  {envVars.filter(env => env.target.includes('production')).map((env) => (
                    <div key={env.id} className="env-item">
                      <span className="env-name">{env.key}</span>
                      <span className="env-value masked">••••••••••••</span>
                      <div className="env-actions">
                        <button className="edit-btn">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="env-section">
                  <div className="env-section-title">Preview</div>
                  {envVars.filter(env => env.target.includes('preview')).map((env) => (
                    <div key={env.id} className="env-item">
                      <span className="env-name">{env.key}</span>
                      <span className="env-value masked">••••••••••••</span>
                      <div className="env-actions">
                        <button className="edit-btn">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {selectedDeployment && (
        <div className="deployment-logs-modal">
          <div className="logs-modal-header">
            <div className="logs-modal-title">
              <span>Build Logs</span>
              <span className={`deployment-status-badge ${getStatusBadgeClass(selectedDeployment.state)}`}>
                <span className="status-dot" />
                {selectedDeployment.state}
              </span>
            </div>
            <button className="logs-modal-close" onClick={() => setSelectedDeployment(null)}>
              <CloseIcon />
            </button>
          </div>
          <div className="logs-modal-meta">
            {selectedDeployment.meta?.githubCommitRef && (
              <span className="logs-meta-branch">
                <GitBranchIcon /> {selectedDeployment.meta.githubCommitRef}
              </span>
            )}
            {selectedDeployment.url && (
              <a href={`https://${selectedDeployment.url}`} target="_blank" rel="noopener noreferrer" className="logs-meta-url">
                {selectedDeployment.url} <ExternalLinkIcon />
              </a>
            )}
          </div>
          <div className="logs-modal-content">
            {logsLoading ? (
              <div className="logs-loading">Loading logs...</div>
            ) : deploymentLogs.length === 0 ? (
              <div className="logs-empty">No logs available</div>
            ) : (
              deploymentLogs.map((log, idx) => <div key={idx} className="log-line">{log}</div>)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
