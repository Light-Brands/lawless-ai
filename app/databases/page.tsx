'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SupabaseProject {
  id: string;
  ref: string;
  name: string;
  organizationId?: string;
  region?: string;
  createdAt?: string;
  status?: string;
  url?: string;
}

interface User {
  login: string;
  name: string;
  avatar: string;
}

// Region display names
const regionNames: Record<string, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'eu-west-1': 'EU (Ireland)',
  'eu-west-2': 'EU (London)',
  'eu-west-3': 'EU (Paris)',
  'eu-central-1': 'EU (Frankfurt)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'sa-east-1': 'South America (São Paulo)',
};

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
    <path d="M3 12a9 3 0 0 0 18 0"/>
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

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const VercelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 19.5h20L12 2z"/>
  </svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
);

export default function DatabasesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<SupabaseProject[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    checkAuthAndLoadProjects();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredProjects(
        projects.filter((project) =>
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.ref.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredProjects(projects);
    }
  }, [searchQuery, projects]);

  async function checkAuthAndLoadProjects() {
    try {
      // Check GitHub auth for user info
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();

      if (authData.authenticated) {
        setUser(authData.user);
      }

      // Check Supabase connection
      const supabaseRes = await fetch('/api/integrations/supabase/projects');

      if (supabaseRes.status === 401) {
        setConnected(false);
        setLoading(false);
        return;
      }

      const supabaseData = await supabaseRes.json();

      if (supabaseData.error) {
        setError(supabaseData.error);
      } else {
        setConnected(true);
        setProjects(supabaseData.projects || []);
        setFilteredProjects(supabaseData.projects || []);
      }
    } catch (err) {
      setError('Failed to load databases');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectProject(project: SupabaseProject) {
    router.push(`/integrations/supabase?project=${project.ref}`);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getStatusClass(status: string | undefined): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE_HEALTHY':
        return 'status-active';
      case 'ACTIVE_UNHEALTHY':
        return 'status-unhealthy';
      case 'COMING_UP':
      case 'GOING_DOWN':
      case 'RESTORING':
        return 'status-starting';
      case 'PAUSED':
      case 'INACTIVE':
        return 'status-paused';
      default:
        return 'status-unknown';
    }
  }

  function getStatusLabel(status: string | undefined): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE_HEALTHY':
        return 'Active';
      case 'ACTIVE_UNHEALTHY':
        return 'Unhealthy';
      case 'COMING_UP':
        return 'Starting';
      case 'GOING_DOWN':
        return 'Stopping';
      case 'RESTORING':
        return 'Restoring';
      case 'PAUSED':
      case 'INACTIVE':
        return 'Paused';
      default:
        return status || 'Unknown';
    }
  }

  if (loading) {
    return (
      <div className="databases-page">
        <div className="databases-loading">
          <div className="databases-loading-spinner"></div>
          <p>Loading your databases...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="databases-page">
        <div className="databases-ambient"></div>
        <header className="databases-header">
          <div className="databases-header-content">
            <div className="databases-header-left">
              <Link href="/" className="databases-logo">
                <div className="databases-logo-icon">
                  <LightningIcon />
                </div>
                <span className="databases-logo-text">Lawless AI</span>
              </Link>
            </div>
            {user && (
              <div className="databases-header-right">
                <Link href="/" className="databases-nav-btn">
                  <HomeIcon />
                  <span>Chat</span>
                </Link>
                <Link href="/repos" className="databases-nav-btn">
                  <RepoIcon />
                  <span>Repos</span>
                </Link>
                <Link href="/deployments" className="databases-nav-btn">
                  <VercelIcon />
                  <span>Deployments</span>
                </Link>
                <Link href="/integrations" className="databases-nav-btn">
                  <IntegrationsIcon />
                  <span>Integrations</span>
                </Link>
                <div className="databases-user">
                  <img src={user.avatar} alt={user.login} className="databases-avatar" />
                  <span className="databases-username">{user.login}</span>
                </div>
                <button onClick={handleLogout} className="databases-logout-btn">
                  <LogoutIcon />
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="databases-main">
          <div className="databases-connect">
            <div className="databases-connect-icon">
              <DatabaseIcon />
            </div>
            <h2>Connect Supabase</h2>
            <p>Connect your Supabase account to view and manage your databases.</p>
            <Link href="/integrations" className="databases-connect-btn">
              Go to Integrations
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="databases-page">
      <div className="databases-ambient"></div>

      <header className="databases-header">
        <div className="databases-header-content">
          <div className="databases-header-left">
            <Link href="/" className="databases-logo">
              <div className="databases-logo-icon">
                <LightningIcon />
              </div>
              <span className="databases-logo-text">Lawless AI</span>
            </Link>
          </div>

          {user && (
            <div className="databases-header-right">
              <Link href="/" className="databases-nav-btn">
                <HomeIcon />
                <span>Chat</span>
              </Link>
              <Link href="/repos" className="databases-nav-btn">
                <RepoIcon />
                <span>Repos</span>
              </Link>
              <Link href="/deployments" className="databases-nav-btn">
                <VercelIcon />
                <span>Deployments</span>
              </Link>
              <Link href="/integrations" className="databases-nav-btn">
                <IntegrationsIcon />
                <span>Integrations</span>
              </Link>
              <div className="databases-user">
                <img src={user.avatar} alt={user.login} className="databases-avatar" />
                <span className="databases-username">{user.login}</span>
              </div>
              <button onClick={handleLogout} className="databases-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="databases-main">
        <div className="databases-hero">
          <div className="databases-hero-icon">
            <DatabaseIcon />
          </div>
          <h1>Your Databases</h1>
          <p>Manage your Supabase projects and databases</p>
        </div>

        <div className="databases-search-container">
          <div className="databases-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search databases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="databases-search-right">
            <div className="databases-count">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'database' : 'databases'}
            </div>
            <Link href="/integrations/supabase" className="databases-new-btn">
              <PlusIcon />
              <span>New Database</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="databases-error">
            <span>⚠️</span>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="databases-grid">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="database-card"
            >
              <div className="database-card-header">
                <div className="database-card-title">
                  <div className="database-icon">
                    <DatabaseIcon />
                  </div>
                  <h3>{project.name}</h3>
                  {project.status && (
                    <span className={`database-status-badge ${getStatusClass(project.status)}`}>
                      <span className="status-dot"></span>
                      {getStatusLabel(project.status)}
                    </span>
                  )}
                </div>
                <div className="database-card-arrow">
                  <ArrowRightIcon />
                </div>
              </div>

              {project.region && (
                <p className="database-card-region">
                  <GlobeIcon />
                  {regionNames[project.region] || project.region}
                </p>
              )}

              <div className="database-card-footer">
                <code className="database-ref">{project.ref}</code>
                <div className="database-created">
                  {project.createdAt ? `Created ${formatDate(project.createdAt)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProjects.length === 0 && !error && (
          <div className="databases-empty">
            <DatabaseIcon />
            <h3>No databases found</h3>
            <p>
              {searchQuery
                ? 'Try a different search term'
                : 'Create a project on Supabase to get started'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
