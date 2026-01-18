'use client';

interface Deployment {
  id: string;
  name: string;
  url: string;
  state: string;
  createdAt: number;
  target: string;
  meta: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
  };
}

interface Project {
  id: string;
  name: string;
}

interface DeploymentListProps {
  deployments: Deployment[];
  loading: boolean;
  selectedProject: Project | null;
  onViewLogs: (deployment: Deployment) => void;
  onRedeploy: (deployment: Deployment) => void;
  onCancel: (deployment: Deployment) => void;
}

const LogsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" x2="8" y1="13" y2="13"/>
    <line x1="16" x2="8" y1="17" y2="17"/>
  </svg>
);

const RedeployIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

const CancelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" x2="21" y1="14" y2="3"/>
  </svg>
);

const GitBranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function getStatusBadgeClass(state: string): string {
  switch (state?.toUpperCase()) {
    case 'READY':
      return 'success';
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED':
      return 'warning';
    case 'ERROR':
      return 'error';
    case 'CANCELED':
      return 'muted';
    default:
      return 'default';
  }
}

export default function DeploymentList({
  deployments,
  loading,
  selectedProject,
  onViewLogs,
  onRedeploy,
  onCancel,
}: DeploymentListProps) {
  if (loading) {
    return (
      <div className="deployment-list-loading">
        <div className="deployment-list-spinner"></div>
        <span>Loading deployments...</span>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="deployment-list-empty">
        <span>Select a project to view deployments</span>
      </div>
    );
  }

  if (!deployments.length) {
    return (
      <div className="deployment-list-empty">
        <span>No deployments found for {selectedProject.name}</span>
      </div>
    );
  }

  return (
    <div className="deployment-list">
      <div className="deployment-list-header">
        <h2>Deployments</h2>
        <span className="deployment-list-count">{deployments.length} deployments</span>
      </div>

      <div className="deployment-list-items">
        {deployments.map((deployment) => {
          const isBuilding = ['BUILDING', 'INITIALIZING', 'QUEUED'].includes(deployment.state?.toUpperCase());
          const isError = deployment.state?.toUpperCase() === 'ERROR';

          return (
            <div key={deployment.id} className="deployment-item">
              <div className="deployment-item-main">
                <div className="deployment-item-header">
                  <span className={`deployment-status-badge ${getStatusBadgeClass(deployment.state)}`}>
                    <span className="status-dot"></span>
                    {deployment.state}
                  </span>
                  <span className="deployment-target">{deployment.target}</span>
                  <span className="deployment-time">{formatTimeAgo(deployment.createdAt)}</span>
                </div>

                <div className="deployment-item-content">
                  {deployment.meta.githubCommitMessage && (
                    <p className="deployment-commit-message">
                      {deployment.meta.githubCommitMessage}
                    </p>
                  )}
                  {deployment.meta.githubCommitRef && (
                    <div className="deployment-branch">
                      <GitBranchIcon />
                      <span>{deployment.meta.githubCommitRef}</span>
                      {deployment.meta.githubCommitSha && (
                        <code className="deployment-sha">
                          {deployment.meta.githubCommitSha.substring(0, 7)}
                        </code>
                      )}
                    </div>
                  )}
                </div>

                {deployment.url && (
                  <a
                    href={`https://${deployment.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="deployment-url"
                  >
                    {deployment.url}
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>

              <div className="deployment-item-actions">
                <button
                  onClick={() => onViewLogs(deployment)}
                  className="deployment-action-btn"
                  title="View Logs"
                >
                  <LogsIcon />
                  <span>Logs</span>
                </button>

                {isBuilding ? (
                  <button
                    onClick={() => onCancel(deployment)}
                    className="deployment-action-btn danger"
                    title="Cancel Build"
                  >
                    <CancelIcon />
                    <span>Cancel</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onRedeploy(deployment)}
                    className="deployment-action-btn"
                    title="Redeploy"
                  >
                    <RedeployIcon />
                    <span>Redeploy</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
