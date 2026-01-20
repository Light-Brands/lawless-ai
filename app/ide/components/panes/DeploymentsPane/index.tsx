'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useVercelConnection } from '../../../contexts/ServiceContext';

interface Deployment {
  id: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'READY' | 'CANCELED' | 'QUEUED';
  target: 'production' | 'preview' | null;
  createdAt: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitMessage?: string;
    githubCommitSha?: string;
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

export function DeploymentsPane() {
  // Get Vercel connection from ServiceContext (single source of truth)
  const vercel = useVercelConnection();
  const projectId = vercel.projectId;
  const connected = vercel.status === 'connected';

  const { deploymentStatus, setDeploymentStatus } = useIDEStore();
  const [activeTab, setActiveTab] = useState<'deployments' | 'env'>('deployments');

  // Local state for deployments and env vars (not from context)
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [envLoading, setEnvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch deployments when project ID is available
  const fetchDeployments = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/vercel/deployments?projectId=${projectId}&limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch deployments');
      }
      const data = await response.json();
      setDeployments(data.deployments || []);

      // Update deployment status in store based on latest deployment
      if (data.deployments?.length > 0) {
        const latest = data.deployments[0];
        if (latest.state === 'ERROR') {
          setDeploymentStatus('failed');
        } else if (latest.state === 'BUILDING') {
          setDeploymentStatus('building');
        } else if (latest.state === 'READY') {
          setDeploymentStatus('ready');
        }
      }
    } catch (err) {
      console.error('Failed to fetch deployments:', err);
      setError('Failed to load deployments');
    } finally {
      setLoading(false);
    }
  }, [projectId, setDeploymentStatus]);

  useEffect(() => {
    if (projectId) {
      fetchDeployments();
    }
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
    if (projectId && activeTab === 'env') {
      fetchEnvVars();
    }
  }, [projectId, activeTab, fetchEnvVars]);

  // Fetch deployment logs
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

  // Helper functions
  const getStateIcon = (state: string) => {
    switch (state) {
      case 'READY': return '✅';
      case 'ERROR': return '❌';
      case 'BUILDING': return '🔄';
      case 'QUEUED': return '⏳';
      case 'CANCELED': return '⏹️';
      default: return '❓';
    }
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="deployments-pane">
        <div className="deploy-not-connected">
          <div className="not-connected-icon">🚀</div>
          <h3>No Deployment Service Connected</h3>
          <p>Link a Vercel project to this repository to view and manage deployments.</p>
          <a href="/integrations/vercel" className="connect-btn">
            Connect Vercel
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="deployments-pane">
      {/* Tabs */}
      <div className="deploy-tabs">
        <button
          className={`deploy-tab ${activeTab === 'deployments' ? 'active' : ''}`}
          onClick={() => setActiveTab('deployments')}
        >
          Deployments
        </button>
        <button
          className={`deploy-tab ${activeTab === 'env' ? 'active' : ''}`}
          onClick={() => setActiveTab('env')}
        >
          Env Vars
        </button>
      </div>

      <div className="deploy-content">
        {activeTab === 'deployments' && (
          <div className="deployments-content">
            {/* Failed deployment alert */}
            {deploymentStatus === 'failed' && deployments[0]?.state === 'ERROR' && (
              <div className="deploy-alert error">
                <div className="alert-icon">❌</div>
                <div className="alert-content">
                  <div className="alert-title">Deployment Failed</div>
                  {deployments[0]?.meta?.githubCommitRef && (
                    <div className="alert-details">Branch: {deployments[0].meta.githubCommitRef}</div>
                  )}
                  <div className="alert-error">View logs for details</div>
                </div>
                <button
                  className="fix-it-btn"
                  onClick={() => {
                    setSelectedDeployment(deployments[0].id);
                    fetchLogs(deployments[0].id);
                  }}
                >
                  View Logs
                </button>
              </div>
            )}

            {/* Deployment list */}
            <div className="deployment-list">
              <div className="list-header">
                <span>Recent Deployments</span>
                <button
                  className="deploy-now-btn"
                  onClick={fetchDeployments}
                  disabled={loading}
                >
                  {loading ? '...' : 'Refresh'}
                </button>
              </div>

              {loading && deployments.length === 0 ? (
                <div className="deployments-loading">Loading deployments...</div>
              ) : error ? (
                <div className="deployments-error">{error}</div>
              ) : deployments.length === 0 ? (
                <div className="deployments-empty">No deployments found</div>
              ) : (
                deployments.map((deploy) => (
                  <div
                    key={deploy.id}
                    className={`deployment-item ${deploy.state.toLowerCase()}`}
                    onClick={() => {
                      setSelectedDeployment(selectedDeployment === deploy.id ? null : deploy.id);
                      if (selectedDeployment !== deploy.id) {
                        fetchLogs(deploy.id);
                      }
                    }}
                  >
                    <span className="deploy-status">{getStateIcon(deploy.state)}</span>
                    <span className="deploy-env">{deploy.target || 'Preview'}</span>
                    <span className="deploy-id">{deploy.id.slice(0, 8)}</span>
                    <span className="deploy-time">{getTimeAgo(deploy.createdAt)}</span>
                    <button
                      className="logs-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDeployment(deploy.id);
                        fetchLogs(deploy.id);
                      }}
                    >
                      Logs
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Deployment logs */}
            {selectedDeployment && (
              <div className="deployment-logs">
                <div className="logs-header">
                  <span>Logs: {selectedDeployment.slice(0, 8)}</span>
                  <button className="close-logs-btn" onClick={() => setSelectedDeployment(null)}>×</button>
                </div>
                <div className="logs-content">
                  {logsLoading ? (
                    <div className="logs-loading">Loading logs...</div>
                  ) : deploymentLogs.length === 0 ? (
                    <div className="logs-empty">No logs available</div>
                  ) : (
                    deploymentLogs.map((log, idx) => (
                      <div key={idx} className="log-line">{log}</div>
                    ))
                  )}
                </div>
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
                {/* Production env vars */}
                <div className="env-section">
                  <div className="env-section-title">Production</div>
                  {envVars
                    .filter(env => env.target.includes('production'))
                    .map((env) => (
                      <div key={env.id} className="env-item">
                        <span className="env-name">{env.key}</span>
                        <span className="env-value masked">••••••••••••</span>
                        <div className="env-actions">
                          <button className="edit-btn">Edit</button>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Preview env vars */}
                <div className="env-section">
                  <div className="env-section-title">Preview</div>
                  {envVars
                    .filter(env => env.target.includes('preview'))
                    .map((env) => (
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
    </div>
  );
}
