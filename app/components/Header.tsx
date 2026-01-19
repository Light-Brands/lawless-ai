'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import UserMenu from './UserMenu';

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

const RepoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

const VercelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 19.5h20L12 2z"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
    <path d="M3 12a9 3 0 0 0 18 0"/>
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

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Chat', icon: <HomeIcon /> },
  { href: '/repos', label: 'Repos', icon: <RepoIcon /> },
  { href: '/deployments', label: 'Deployments', icon: <VercelIcon /> },
  { href: '/databases', label: 'Databases', icon: <DatabaseIcon /> },
  { href: '/integrations', label: 'Integrations', icon: <IntegrationsIcon /> },
];

interface HeaderProps {
  showNav?: boolean;
}

export default function Header({ showNav = true }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-content">
        <div className="app-header-left">
          <Link href="/" className="app-logo">
            <div className="app-logo-icon">
              <LightningIcon />
            </div>
            <span className="app-logo-text">Lawless AI</span>
          </Link>
        </div>

        {user && showNav && (
          <nav className="app-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`app-nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="app-header-right">
          {user && <UserMenu />}
        </div>
      </div>

      <style jsx>{`
        .app-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--color-bg-primary, #0a0a0f);
          border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
          backdrop-filter: blur(12px);
        }

        .app-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1400px;
          margin: 0 auto;
          padding: 12px 24px;
          gap: 24px;
        }

        .app-header-left {
          display: flex;
          align-items: center;
        }

        .app-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: inherit;
        }

        .app-logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--color-accent, #6366f1) 0%, var(--color-accent-secondary, #8b5cf6) 100%);
          border-radius: 10px;
          color: white;
        }

        .app-logo-text {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary, #f9fafb);
          letter-spacing: -0.02em;
        }

        .app-nav {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .app-nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-md, 8px);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary, #9ca3af);
          text-decoration: none;
          transition: all var(--transition-fast, 150ms);
        }

        .app-nav-link:hover {
          color: var(--color-text-primary, #f9fafb);
          background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
        }

        .app-nav-link.active {
          color: var(--color-text-primary, #f9fafb);
          background: var(--color-bg-elevated, rgba(255, 255, 255, 0.08));
        }

        .app-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Hide nav labels on tablet */
        @media (max-width: 1024px) {
          .app-nav-link span {
            display: none;
          }

          .app-nav-link {
            padding: 10px;
          }
        }

        /* Hide nav on mobile - use bottom nav instead */
        @media (max-width: 768px) {
          .app-nav {
            display: none;
          }

          .app-header-content {
            padding: 10px 16px;
          }

          .app-logo-text {
            font-size: 1rem;
          }

          .app-logo-icon {
            width: 32px;
            height: 32px;
          }

          .app-logo-icon svg {
            width: 18px;
            height: 18px;
          }
        }
      `}</style>
    </header>
  );
}
