'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  createdAt: number;
  updatedAt: number;
  latestDeployment: {
    id: string;
    url: string;
    state: string;
    createdAt: number;
  } | null;
  link: {
    type: string;
    repo: string;
    org: string;
  } | null;
}

interface User {
  login: string;
  name: string;
  avatar: string;
}

// Framework icons
const frameworkIcons: Record<string, string> = {
  nextjs: 'N',
  nuxtjs: 'Nu',
  gatsby: 'G',
  remix: 'R',
  svelte: 'S',
  sveltekit: 'Sk',
  vue: 'V',
  react: 'Re',
  angular: 'A',
  astro: 'As',
  ember: 'E',
  hugo: 'H',
  jekyll: 'J',
  eleventy: '11',
  vite: 'Vi',
  create_react_app: 'CR',
  blitzjs: 'B',
  redwoodjs: 'Rw',
};

// Framework display names
const frameworkNames: Record<string, string> = {
  nextjs: 'Next.js',
  nuxtjs: 'Nuxt.js',
  gatsby: 'Gatsby',
  remix: 'Remix',
  svelte: 'Svelte',
  sveltekit: 'SvelteKit',
  vue: 'Vue.js',
  react: 'React',
  angular: 'Angular',
  astro: 'Astro',
  ember: 'Ember',
  hugo: 'Hugo',
  jekyll: 'Jekyll',
  eleventy: 'Eleventy',
  vite: 'Vite',
  create_react_app: 'Create React App',
  blitzjs: 'Blitz.js',
  redwoodjs: 'RedwoodJS',
};

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const VercelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 19.5h20L12 2z"/>
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

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
    <path d="M3 12a9 3 0 0 0 18 0"/>
  </svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

export default function DeploymentsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<VercelProject[]>([]);
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
          project.name.toLowerCase().includes(searchQuery.toLowerCase())
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

      // Check Vercel connection
      const vercelRes = await fetch('/api/integrations/vercel/projects');

      if (vercelRes.status === 401) {
        setConnected(false);
        setLoading(false);
        return;
      }

      const vercelData = await vercelRes.json();

      if (vercelData.error) {
        setError(vercelData.error);
      } else {
        setConnected(true);
        setProjects(vercelData.projects || []);
        setFilteredProjects(vercelData.projects || []);
      }
    } catch (err) {
      setError('Failed to load deployments');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectProject(project: VercelProject) {
    router.push(`/integrations/vercel?project=${project.id}`);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  function getStatusClass(state: string): string {
    switch (state?.toUpperCase()) {
      case 'READY':
        return 'status-ready';
      case 'BUILDING':
      case 'QUEUED':
      case 'INITIALIZING':
        return 'status-building';
      case 'ERROR':
        return 'status-error';
      case 'CANCELED':
        return 'status-canceled';
      default:
        return 'status-unknown';
    }
  }

  function getStatusLabel(state: string): string {
    if (!state) return 'No deployments';
    return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
  }

  if (loading) {
    return (
      <div className="deployments-page">
        <div className="deployments-loading">
          <div className="deployments-loading-spinner"></div>
          <p>Loading your deployments...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="deployments-page">
        <div className="deployments-ambient"></div>
        <header className="deployments-header">
          <div className="deployments-header-content">
            <div className="deployments-header-left">
              <Link href="/" className="deployments-logo">
                <div className="deployments-logo-icon">
                  <LightningIcon />
                </div>
                <span className="deployments-logo-text">Lawless AI</span>
              </Link>
            </div>
            {user && (
              <div className="deployments-header-right">
                <Link href="/" className="deployments-nav-btn">
                  <HomeIcon />
                  <span>Chat</span>
                </Link>
                <Link href="/repos" className="deployments-nav-btn">
                  <RepoIcon />
                  <span>Repos</span>
                </Link>
                <Link href="/databases" className="deployments-nav-btn">
                  <DatabaseIcon />
                  <span>Databases</span>
                </Link>
                <Link href="/integrations" className="deployments-nav-btn">
                  <IntegrationsIcon />
                  <span>Integrations</span>
                </Link>
                <div className="deployments-user">
                  <img src={user.avatar} alt={user.login} className="deployments-avatar" />
                  <span className="deployments-username">{user.login}</span>
                </div>
                <button onClick={handleLogout} className="deployments-logout-btn">
                  <LogoutIcon />
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="deployments-main">
          <div className="deployments-connect">
            <div className="deployments-connect-icon">
              <VercelIcon />
            </div>
            <h2>Connect Vercel</h2>
            <p>Connect your Vercel account to view and manage your deployments.</p>
            <Link href="/integrations" className="deployments-connect-btn">
              Go to Integrations
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="deployments-page">
      <div className="deployments-ambient"></div>

      <header className="deployments-header">
        <div className="deployments-header-content">
          <div className="deployments-header-left">
            <Link href="/" className="deployments-logo">
              <div className="deployments-logo-icon">
                <LightningIcon />
              </div>
              <span className="deployments-logo-text">Lawless AI</span>
            </Link>
          </div>

          {user && (
            <div className="deployments-header-right">
              <Link href="/" className="deployments-nav-btn">
                <HomeIcon />
                <span>Chat</span>
              </Link>
              <Link href="/repos" className="deployments-nav-btn">
                <RepoIcon />
                <span>Repos</span>
              </Link>
              <Link href="/databases" className="deployments-nav-btn">
                <DatabaseIcon />
                <span>Databases</span>
              </Link>
              <Link href="/integrations" className="deployments-nav-btn">
                <IntegrationsIcon />
                <span>Integrations</span>
              </Link>
              <div className="deployments-user">
                <img src={user.avatar} alt={user.login} className="deployments-avatar" />
                <span className="deployments-username">{user.login}</span>
              </div>
              <button onClick={handleLogout} className="deployments-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="deployments-main">
        <div className="deployments-hero">
          <div className="deployments-hero-icon">
            <VercelIcon />
          </div>
          <h1>Your Deployments</h1>
          <p>Manage your Vercel projects and deployments</p>
        </div>

        <div className="deployments-search-container">
          <div className="deployments-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="deployments-search-right">
            <div className="deployments-count">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            </div>
            <Link href="/integrations/vercel" className="deployments-new-btn">
              <PlusIcon />
              <span>New Project</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="deployments-error">
            <span>⚠️</span>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="deployments-grid">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="deployment-card"
            >
              <div className="deployment-card-header">
                <div className="deployment-card-title">
                  <div className="deployment-framework-icon">
                    {project.framework ? frameworkIcons[project.framework] || '?' : '?'}
                  </div>
                  <h3>{project.name}</h3>
                  {project.latestDeployment && (
                    <span className={`deployment-status-badge ${getStatusClass(project.latestDeployment.state)}`}>
                      <span className="status-dot"></span>
                      {getStatusLabel(project.latestDeployment.state)}
                    </span>
                  )}
                </div>
                <div className="deployment-card-arrow">
                  <ArrowRightIcon />
                </div>
              </div>

              {project.link && (
                <p className="deployment-card-repo">
                  <GitHubIcon />
                  {project.link.org}/{project.link.repo}
                </p>
              )}

              <div className="deployment-card-footer">
                <div className="deployment-framework">
                  {project.framework ? frameworkNames[project.framework] || project.framework : 'Unknown'}
                </div>
                <div className="deployment-updated">
                  {project.latestDeployment
                    ? `Deployed ${formatDate(project.latestDeployment.createdAt)}`
                    : 'No deployments'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProjects.length === 0 && !error && (
          <div className="deployments-empty">
            <VercelIcon />
            <h3>No projects found</h3>
            <p>
              {searchQuery
                ? 'Try a different search term'
                : 'Create a project on Vercel to get started'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
