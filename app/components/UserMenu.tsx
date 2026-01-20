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

    </div>
  );
}
