'use client';

interface WorkerInfo {
  id: string;
  name: string;
  type: 'oracle' | 'aws' | 'gcp' | 'local';
  url: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  version: string;
  commit: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  nodeVersion: string;
  lastChecked: string;
  region?: string;
  features?: string[];
  error?: string;
}

interface WorkerDetailModalProps {
  worker: WorkerInfo;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

const ServerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
    <line x1="6" x2="6.01" y1="6" y2="6"/>
    <line x1="6" x2="6.01" y1="18" y2="18"/>
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const MemoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 19v-3"/>
    <path d="M10 19v-3"/>
    <path d="M14 19v-3"/>
    <path d="M18 19v-3"/>
    <path d="M8 11V9"/>
    <path d="M16 11V9"/>
    <path d="M12 11V9"/>
    <path d="M2 15h20"/>
    <path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z"/>
  </svg>
);

const CpuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="16" x="4" y="4" rx="2"/>
    <rect width="6" height="6" x="9" y="9" rx="1"/>
    <path d="M15 2v2"/>
    <path d="M15 20v2"/>
    <path d="M2 15h2"/>
    <path d="M2 9h2"/>
    <path d="M20 15h2"/>
    <path d="M20 9h2"/>
    <path d="M9 2v2"/>
    <path d="M9 20v2"/>
  </svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const GitCommitIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <line x1="3" x2="9" y1="12" y2="12"/>
    <line x1="15" x2="21" y1="12" y2="12"/>
  </svg>
);

const TagIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" x2="12" y1="8" y2="12"/>
    <line x1="12" x2="12.01" y1="16" y2="16"/>
  </svg>
);

const OracleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.059 10.655a1.345 1.345 0 1 0 0 2.69h9.882a1.345 1.345 0 1 0 0-2.69zm9.882-2.587H7.06A3.932 3.932 0 0 0 3.13 12a3.932 3.932 0 0 0 3.929 3.932h9.882A3.932 3.932 0 0 0 20.87 12a3.932 3.932 0 0 0-3.929-3.932z"/>
  </svg>
);

export default function WorkerDetailModal({ worker, onClose }: WorkerDetailModalProps) {
  function formatUptime(seconds: number): string {
    if (seconds === 0) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && days === 0) parts.push(`${secs}s`);

    return parts.join(' ') || '< 1s';
  }

  function formatMemory(bytes: number): string {
    if (bytes === 0) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }

  function formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function getStatusClass(status: string): string {
    switch (status) {
      case 'online':
        return 'status-online';
      case 'degraded':
        return 'status-degraded';
      case 'offline':
        return 'status-offline';
      default:
        return 'status-unknown';
    }
  }

  function getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getProviderName(type: string): string {
    switch (type) {
      case 'oracle':
        return 'Oracle Cloud Infrastructure';
      case 'aws':
        return 'Amazon Web Services';
      case 'gcp':
        return 'Google Cloud Platform';
      case 'local':
        return 'Local Development';
      default:
        return type;
    }
  }

  function getProviderIcon(type: string) {
    switch (type) {
      case 'oracle':
        return <OracleIcon />;
      default:
        return <ServerIcon />;
    }
  }

  // Calculate memory usage percentage
  const memoryUsagePercent = worker.memory.heapTotal > 0
    ? ((worker.memory.heapUsed / worker.memory.heapTotal) * 100).toFixed(1)
    : 0;

  return (
    <div className="worker-modal-overlay" onClick={onClose}>
      <div className="worker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="worker-modal-header">
          <div className="worker-modal-title">
            <div className={`worker-modal-icon ${worker.type}`}>
              {getProviderIcon(worker.type)}
            </div>
            <div>
              <h2>{worker.name}</h2>
              <span className="worker-modal-provider">{getProviderName(worker.type)}</span>
            </div>
          </div>
          <div className="worker-modal-header-right">
            <span className={`worker-modal-status ${getStatusClass(worker.status)}`}>
              <span className="status-dot"></span>
              {getStatusLabel(worker.status)}
            </span>
            <button className="worker-modal-close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="worker-modal-content">
          {worker.error && (
            <div className="worker-modal-error">
              <AlertIcon />
              <span>{worker.error}</span>
            </div>
          )}

          {/* Connection Info */}
          <div className="worker-modal-section">
            <h3>Connection</h3>
            <div className="worker-modal-info-grid">
              <div className="worker-modal-info-item">
                <LinkIcon />
                <span className="info-label">Endpoint</span>
                <span className="info-value mono">{worker.url}</span>
              </div>
              {worker.region && (
                <div className="worker-modal-info-item">
                  <GlobeIcon />
                  <span className="info-label">Region</span>
                  <span className="info-value">{worker.region}</span>
                </div>
              )}
              <div className="worker-modal-info-item">
                <ClockIcon />
                <span className="info-label">Last Checked</span>
                <span className="info-value">{formatDate(worker.lastChecked)}</span>
              </div>
            </div>
          </div>

          {/* Version Info */}
          <div className="worker-modal-section">
            <h3>Version</h3>
            <div className="worker-modal-info-grid">
              <div className="worker-modal-info-item">
                <TagIcon />
                <span className="info-label">Version</span>
                <span className="info-value mono">{worker.version || 'N/A'}</span>
              </div>
              <div className="worker-modal-info-item">
                <GitCommitIcon />
                <span className="info-label">Commit</span>
                <span className="info-value mono">{worker.commit || 'N/A'}</span>
              </div>
              <div className="worker-modal-info-item">
                <CpuIcon />
                <span className="info-label">Node.js</span>
                <span className="info-value mono">{worker.nodeVersion || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="worker-modal-section">
            <h3>Performance</h3>
            <div className="worker-modal-stats">
              <div className="worker-modal-stat">
                <ClockIcon />
                <div className="stat-content">
                  <span className="stat-label">Uptime</span>
                  <span className="stat-value">{formatUptime(worker.uptime)}</span>
                </div>
              </div>
              <div className="worker-modal-stat">
                <MemoryIcon />
                <div className="stat-content">
                  <span className="stat-label">Heap Used</span>
                  <span className="stat-value">{formatMemory(worker.memory.heapUsed)}</span>
                  <span className="stat-secondary">{memoryUsagePercent}% of heap</span>
                </div>
              </div>
              <div className="worker-modal-stat">
                <MemoryIcon />
                <div className="stat-content">
                  <span className="stat-label">Heap Total</span>
                  <span className="stat-value">{formatMemory(worker.memory.heapTotal)}</span>
                </div>
              </div>
              <div className="worker-modal-stat">
                <MemoryIcon />
                <div className="stat-content">
                  <span className="stat-label">RSS Memory</span>
                  <span className="stat-value">{formatMemory(worker.memory.rss)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          {worker.features && worker.features.length > 0 && (
            <div className="worker-modal-section">
              <h3>Capabilities</h3>
              <div className="worker-modal-features">
                {worker.features.map((feature, idx) => (
                  <span key={idx} className="worker-modal-feature">{feature}</span>
                ))}
              </div>
            </div>
          )}

          {/* Technical Details */}
          <div className="worker-modal-section">
            <h3>Technical Details</h3>
            <div className="worker-modal-technical">
              <div className="technical-row">
                <span className="technical-label">Worker ID</span>
                <span className="technical-value mono">{worker.id}</span>
              </div>
              <div className="technical-row">
                <span className="technical-label">Type</span>
                <span className="technical-value">{worker.type}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
