'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import Link from 'next/link';

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const RepoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v2"/>
    <path d="M12 21v2"/>
    <path d="m4.2 4.2 1.4 1.4"/>
    <path d="m18.4 18.4 1.4 1.4"/>
    <path d="M1 12h2"/>
    <path d="M21 12h2"/>
    <path d="m4.2 19.8 1.4-1.4"/>
    <path d="m18.4 5.6 1.4-1.4"/>
  </svg>
);

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <img
          src={user.avatar}
          alt={user.login}
          className="user-menu-avatar"
        />
        <span className="user-menu-name">{user.login}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <img
              src={user.avatar}
              alt={user.login}
              className="user-menu-header-avatar"
            />
            <div className="user-menu-header-info">
              <span className="user-menu-header-name">{user.name}</span>
              <span className="user-menu-header-login">@{user.login}</span>
            </div>
          </div>

          <div className="user-menu-divider" />

          <Link
            href="/repos"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <RepoIcon />
            <span>Your Repositories</span>
          </Link>

          <Link
            href="/integrations"
            className="user-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <SettingsIcon />
            <span>Integrations</span>
          </Link>

          <div className="user-menu-divider" />

          <button
            className="user-menu-item user-menu-item-danger"
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
          >
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .user-menu {
          position: relative;
        }

        .user-menu-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--color-surface-glass, rgba(255, 255, 255, 0.03));
          border: 1px solid var(--color-surface-glass-border, rgba(255, 255, 255, 0.08));
          border-radius: var(--radius-full, 9999px);
          color: var(--color-text-secondary, #d1d5db);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all var(--transition-fast, 150ms);
        }

        .user-menu-trigger:hover {
          background: var(--color-surface-glass-hover, rgba(255, 255, 255, 0.05));
          border-color: var(--color-surface-glass-border-hover, rgba(255, 255, 255, 0.12));
        }

        .user-menu-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }

        .user-menu-name {
          font-weight: 500;
        }

        .user-menu-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 220px;
          background: var(--color-bg-elevated, #1f1f28);
          border: 1px solid var(--color-surface-glass-border, rgba(255, 255, 255, 0.08));
          border-radius: var(--radius-lg, 14px);
          box-shadow: var(--shadow-xl, 0 16px 48px rgba(0, 0, 0, 0.6));
          z-index: 1000;
          overflow: hidden;
          animation: user-menu-appear 150ms ease-out;
        }

        @keyframes user-menu-appear {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-menu-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }

        .user-menu-header-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }

        .user-menu-header-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-menu-header-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-primary, #f9fafb);
        }

        .user-menu-header-login {
          font-size: 0.8125rem;
          color: var(--color-text-tertiary, #9ca3af);
        }

        .user-menu-divider {
          height: 1px;
          background: var(--color-surface-glass-border, rgba(255, 255, 255, 0.08));
          margin: 4px 0;
        }

        .user-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: var(--color-text-secondary, #d1d5db);
          font-size: 0.875rem;
          text-decoration: none;
          cursor: pointer;
          transition: background var(--transition-fast, 150ms);
        }

        .user-menu-item:hover {
          background: var(--color-bg-hover, #2a2a35);
        }

        .user-menu-item-danger {
          color: var(--color-error, #ef4444);
        }

        .user-menu-item-danger:hover {
          background: var(--color-error-soft, rgba(239, 68, 68, 0.15));
        }

        @media (max-width: 640px) {
          .user-menu-name {
            display: none;
          }

          .user-menu-trigger {
            padding: 4px;
            background: transparent;
            border: none;
          }

          .user-menu-trigger:hover {
            background: transparent;
          }

          .user-menu-avatar {
            width: 32px;
            height: 32px;
          }

          .user-menu-trigger svg {
            display: none;
          }

          .user-menu-dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            min-width: 100%;
            border-radius: var(--radius-xl, 20px) var(--radius-xl, 20px) 0 0;
            animation: user-menu-slide-up 200ms ease-out;
          }

          @keyframes user-menu-slide-up {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </div>
  );
}
