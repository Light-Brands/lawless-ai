'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/app/components/Header';

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

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
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
        <Header />
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

      <Header />

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
