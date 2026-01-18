'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
}

interface User {
  login: string;
  name: string;
  avatar: string;
}

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const ServerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
    <line x1="6" x2="6.01" y1="6" y2="6"/>
    <line x1="6" x2="6.01" y1="18" y2="18"/>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/>
    <path d="m12 5 7 7-7 7"/>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const RepoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

const IntegrationsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4"/>
    <path d="m6.8 15-3.5 2"/>
    <path d="m20.7 17-3.5-2"/>
    <path d="M6.8 9 3.3 7"/>
    <path d="m20.7 7-3.5 2"/>
    <path d="m9 22 3-8 3 8"/>
    <path d="M8 6a4 4 0 1 0 8 0"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
    <path d="M3 12a9 3 0 0 0 18 0"/>
  </svg>
);

const DeploymentsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 19.5h20L12 2z"/>
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

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

// Provider icons
const OracleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.059 10.655a1.345 1.345 0 1 0 0 2.69h9.882a1.345 1.345 0 1 0 0-2.69zm9.882-2.587H7.06A3.932 3.932 0 0 0 3.13 12a3.932 3.932 0 0 0 3.929 3.932h9.882A3.932 3.932 0 0 0 20.87 12a3.932 3.932 0 0 0-3.929-3.932z"/>
  </svg>
);

export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<WorkerInfo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAuthAndLoadWorkers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredWorkers(
        workers.filter((worker) =>
          worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          worker.type.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredWorkers(workers);
    }
  }, [searchQuery, workers]);

  async function checkAuthAndLoadWorkers() {
    try {
      // Check GitHub auth for user info
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();

      if (authData.authenticated) {
        setUser(authData.user);
      }

      await loadWorkers();
    } catch (err) {
      setError('Failed to load workers');
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkers() {
    try {
      const res = await fetch('/api/workers/status');
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setWorkers(data.workers || []);
        setFilteredWorkers(data.workers || []);
      }
    } catch (err) {
      setError('Failed to fetch worker status');
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    await loadWorkers();
    setRefreshing(false);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function formatMemory(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  function formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffSeconds = Math.floor(diffTime / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return date.toLocaleTimeString();
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

  function getProviderIcon(type: string) {
    switch (type) {
      case 'oracle':
        return <OracleIcon />;
      default:
        return <ServerIcon />;
    }
  }

  function getProviderName(type: string): string {
    switch (type) {
      case 'oracle':
        return 'Oracle Cloud';
      case 'aws':
        return 'AWS';
      case 'gcp':
        return 'Google Cloud';
      case 'local':
        return 'Local';
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <div className="workers-page">
        <div className="workers-loading">
          <div className="workers-loading-spinner"></div>
          <p>Checking worker status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workers-page">
      <div className="workers-ambient"></div>

      <header className="workers-header">
        <div className="workers-header-content">
          <div className="workers-header-left">
            <Link href="/" className="workers-logo">
              <div className="workers-logo-icon">
                <LightningIcon />
              </div>
              <span className="workers-logo-text">Lawless AI</span>
            </Link>
          </div>

          {user && (
            <div className="workers-header-right">
              <Link href="/" className="workers-nav-btn">
                <HomeIcon />
                <span>Chat</span>
              </Link>
              <Link href="/repos" className="workers-nav-btn">
                <RepoIcon />
                <span>Repos</span>
              </Link>
              <Link href="/deployments" className="workers-nav-btn">
                <DeploymentsIcon />
                <span>Deployments</span>
              </Link>
              <Link href="/databases" className="workers-nav-btn">
                <DatabaseIcon />
                <span>Databases</span>
              </Link>
              <Link href="/integrations" className="workers-nav-btn">
                <IntegrationsIcon />
                <span>Integrations</span>
              </Link>
              <div className="workers-user">
                <img src={user.avatar} alt={user.login} className="workers-avatar" />
                <span className="workers-username">{user.login}</span>
              </div>
              <button onClick={handleLogout} className="workers-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="workers-main">
        <div className="workers-hero">
          <div className="workers-hero-icon">
            <ServerIcon />
          </div>
          <h1>Worker Agents</h1>
          <p>Monitor and manage your backend worker instances</p>
        </div>

        <div className="workers-search-container">
          <div className="workers-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search workers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="workers-search-right">
            <div className="workers-count">
              {filteredWorkers.filter(w => w.status === 'online').length} / {filteredWorkers.length} online
            </div>
            <button
              onClick={handleRefresh}
              className={`workers-refresh-btn ${refreshing ? 'refreshing' : ''}`}
              disabled={refreshing}
            >
              <RefreshIcon />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="workers-error">
            <span>Warning</span>
            {error}
            <button onClick={() => setError(null)}>x</button>
          </div>
        )}

        <div className="workers-grid">
          {filteredWorkers.map((worker) => (
            <div key={worker.id} className="worker-card">
              <div className="worker-card-header">
                <div className="worker-card-title">
                  <div className="worker-provider-icon">
                    {getProviderIcon(worker.type)}
                  </div>
                  <div className="worker-card-info">
                    <h3>{worker.name}</h3>
                    <span className="worker-provider">{getProviderName(worker.type)}</span>
                  </div>
                  <span className={`worker-status-badge ${getStatusClass(worker.status)}`}>
                    <span className="status-dot"></span>
                    {getStatusLabel(worker.status)}
                  </span>
                </div>
                <div className="worker-card-arrow">
                  <ArrowRightIcon />
                </div>
              </div>

              <div className="worker-card-stats">
                <div className="worker-stat">
                  <ClockIcon />
                  <span className="worker-stat-label">Uptime</span>
                  <span className="worker-stat-value">{formatUptime(worker.uptime)}</span>
                </div>
                <div className="worker-stat">
                  <MemoryIcon />
                  <span className="worker-stat-label">Memory</span>
                  <span className="worker-stat-value">{formatMemory(worker.memory.heapUsed)}</span>
                </div>
                <div className="worker-stat">
                  <CpuIcon />
                  <span className="worker-stat-label">Node</span>
                  <span className="worker-stat-value">{worker.nodeVersion}</span>
                </div>
              </div>

              <div className="worker-card-footer">
                <div className="worker-version">
                  v{worker.version} ({worker.commit})
                </div>
                <div className="worker-checked">
                  Checked {formatDate(worker.lastChecked)}
                </div>
              </div>

              {worker.features && worker.features.length > 0 && (
                <div className="worker-features">
                  {worker.features.map((feature, idx) => (
                    <span key={idx} className="worker-feature-tag">{feature}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredWorkers.length === 0 && !error && (
          <div className="workers-empty">
            <ServerIcon />
            <h3>No workers found</h3>
            <p>
              {searchQuery
                ? 'Try a different search term'
                : 'No worker agents are configured'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
