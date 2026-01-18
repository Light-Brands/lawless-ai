'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GitHubCard from './components/GitHubCard';
import VercelCard from './components/VercelCard';
import SupabaseCard from './components/SupabaseCard';
import WorkersCard from './components/WorkersCard';
import './integrations.css';

interface User {
  login: string;
  name: string;
  avatar: string;
}

interface IntegrationStatus {
  github: {
    connected: boolean;
    user?: {
      login: string;
      name: string;
      avatar: string;
    };
  };
  vercel: {
    connected: boolean;
    user?: {
      name: string;
      email: string;
      avatar?: string;
    };
  };
  supabase: {
    connected: boolean;
    projectCount?: number;
  };
}

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const RepoListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const IntegrationsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4"/>
    <path d="m6.8 15-3.5 2"/>
    <path d="m20.7 17-3.5-2"/>
    <path d="M6.8 9 3.3 7"/>
    <path d="m20.7 7-3.5 2"/>
    <path d="m9 22 3-8 3 8"/>
    <path d="M8 6a4 4 0 1 0 8 0"/>
  </svg>
);

const ComponentsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="14" y="3" rx="1"/>
    <rect width="7" height="7" x="14" y="14" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
  </svg>
);

export default function IntegrationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  async function loadIntegrationStatus() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
      }

      setIntegrations({
        github: {
          connected: data.authenticated,
          user: data.user,
        },
        vercel: {
          connected: data.vercel?.connected || false,
          user: data.vercel?.user,
        },
        supabase: {
          connected: data.supabase?.connected || false,
          projectCount: data.supabase?.projectCount,
        },
      });
    } catch (error) {
      console.error('Failed to load integration status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  async function handleDisconnect(service: 'github' | 'vercel' | 'supabase') {
    try {
      await fetch(`/api/integrations/${service}/disconnect`, { method: 'POST' });
      await loadIntegrationStatus();
      if (service === 'github') {
        router.push('/');
      }
    } catch (error) {
      console.error(`Failed to disconnect ${service}:`, error);
    }
  }

  if (loading) {
    return (
      <div className="integrations-page">
        <div className="integrations-loading">
          <div className="integrations-loading-spinner"></div>
          <p>Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="integrations-page">
      {/* Ambient background */}
      <div className="integrations-ambient"></div>

      {/* Header */}
      <header className="integrations-header">
        <div className="integrations-header-content">
          <div className="integrations-header-left">
            <Link href="/" className="integrations-logo">
              <div className="integrations-logo-icon">
                <LightningIcon />
              </div>
              <span className="integrations-logo-text">Lawless AI</span>
            </Link>
          </div>

          {user && (
            <div className="integrations-header-right">
              <Link href="/" className="integrations-nav-btn">
                <HomeIcon />
                <span>Chat</span>
              </Link>
              <Link href="/repos" className="integrations-nav-btn">
                <RepoListIcon />
                <span>Repos</span>
              </Link>
              <Link href="/demo/tools" className="integrations-nav-btn demo-btn">
                <ComponentsIcon />
                <span>Demo</span>
              </Link>
              <div className="integrations-user">
                <img src={user.avatar} alt={user.login} className="integrations-avatar" />
                <span className="integrations-username">{user.login}</span>
              </div>
              <button onClick={handleLogout} className="integrations-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="integrations-main">
        {/* Hero section */}
        <div className="integrations-hero">
          <div className="integrations-hero-icon">
            <IntegrationsIcon />
          </div>
          <h1>Integrations</h1>
          <p>Connect your services to unlock the full power of Lawless AI</p>
        </div>

        {/* Integration cards grid */}
        <div className="integrations-grid">
          <GitHubCard
            connected={integrations?.github.connected || false}
            user={integrations?.github.user}
            onDisconnect={() => handleDisconnect('github')}
          />
          <VercelCard
            connected={integrations?.vercel.connected || false}
            user={integrations?.vercel.user}
            onDisconnect={() => handleDisconnect('vercel')}
            onRefresh={loadIntegrationStatus}
          />
          <SupabaseCard
            connected={integrations?.supabase.connected || false}
            projectCount={integrations?.supabase.projectCount}
            onDisconnect={() => handleDisconnect('supabase')}
            onRefresh={loadIntegrationStatus}
          />
        </div>

        {/* Infrastructure section */}
        <div className="integrations-section-header">
          <h2>Infrastructure</h2>
          <p>Monitor your backend services and worker instances</p>
        </div>
        <div className="integrations-infrastructure">
          <WorkersCard />
        </div>

        {/* Integration capabilities */}
        <div className="integrations-capabilities">
          <h2>What can Lawless AI do with these integrations?</h2>
          <div className="capabilities-grid">
            <div className="capability-card">
              <div className="capability-icon github">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <h3>GitHub</h3>
              <ul>
                <li>Browse and search repositories</li>
                <li>View and analyze code</li>
                <li>Access file contents</li>
              </ul>
            </div>

            <div className="capability-card">
              <div className="capability-icon vercel">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M24 22.525H0l12-21.05 12 21.05z"/>
                </svg>
              </div>
              <h3>Vercel</h3>
              <ul>
                <li>View deployment status</li>
                <li>Read build and runtime logs</li>
                <li>Trigger redeploys</li>
                <li>Cancel in-progress builds</li>
              </ul>
            </div>

            <div className="capability-card">
              <div className="capability-icon supabase">
                <svg viewBox="0 0 109 113" width="24" height="24" fill="none">
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
                  <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
                  <defs>
                    <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#249361"/>
                      <stop offset="1" stopColor="#3ECF8E"/>
                    </linearGradient>
                    <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                      <stop/>
                      <stop offset="1" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3>Supabase</h3>
              <ul>
                <li>Browse database tables</li>
                <li>View and edit data</li>
                <li>Execute SQL queries</li>
                <li>View database logs</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
