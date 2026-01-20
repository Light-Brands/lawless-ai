'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useIDEStore } from '../stores/ideStore';
import { useServiceConnection } from '../hooks/useServiceConnection';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Session {
  sessionId: string;
  name: string;
  branchName: string;
  baseBranch: string;
  createdAt: string;
  messageCount?: number;
}

interface Repo {
  repo_full_name: string;
  repo_name: string;
  is_favorite?: boolean;
  last_accessed_at?: string;
}

interface IDEHeaderProps {
  repoFullName?: string;
  repos?: Repo[];
  sessions?: Session[];
  activeSessionId?: string | null;
  onSessionChange?: (sessionId: string) => void;
  onNewSession?: () => void;
  onDeleteSession?: (sessionId: string) => void;
  onReposRefresh?: (repos: Repo[]) => void;
}

export function IDEHeader({
  repoFullName,
  repos = [],
  sessions = [],
  activeSessionId,
  onSessionChange,
  onNewSession,
  onDeleteSession,
  onReposRefresh,
}: IDEHeaderProps) {
  const router = useRouter();
  const { activeSession, setCommandPaletteOpen } = useIDEStore();
  const { services, getStatusColor } = useServiceConnection();
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find((s) => s.sessionId === activeSessionId);
  const [owner, repoName] = (repoFullName || '').split('/');

  // Sort repos: favorites first, then by last accessed
  const sortedRepos = [...repos].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    const aTime = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
    const bTime = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
    return bTime - aTime;
  });

  // Filter repos by search query
  const filteredRepos = sortedRepos.filter((repo) => {
    if (!repoSearch.trim()) return true;
    const query = repoSearch.toLowerCase();
    return (
      repo.repo_name.toLowerCase().includes(query) ||
      repo.repo_full_name.toLowerCase().includes(query)
    );
  });

  const repoMenuRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (repoMenuOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!repoMenuOpen) {
      setRepoSearch('');
    }
  }, [repoMenuOpen]);

  // Refresh repos from GitHub
  const handleRefreshRepos = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/github/repos');
      const data = await response.json();
      if (data.repos && onReposRefresh) {
        // Transform to match the Repo interface
        const transformedRepos = data.repos.map((repo: {
          id: number;
          fullName: string;
          name: string;
        }) => ({
          repo_full_name: repo.fullName,
          repo_name: repo.name,
          repo_id: repo.id,
        }));
        onReposRefresh(transformedRepos);
      } else if (data.error) {
        console.error('Failed to refresh repos:', data.error);
      }
    } catch (err) {
      console.error('Failed to refresh repos:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (repoMenuRef.current && !repoMenuRef.current.contains(event.target as Node)) {
        setRepoMenuOpen(false);
      }
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(event.target as Node)) {
        setSessionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRepoSelect = (repo: Repo) => {
    setRepoMenuOpen(false);
    if (repo.repo_full_name !== repoFullName) {
      router.push(`/ide/${repo.repo_full_name}`);
    }
  };

  return (
    <header className="ide-header">
      <div className="ide-header-left">
        <Link href="/" className="ide-logo">
          <Image
            src="/logo.png"
            alt="Lawless AI"
            width={28}
            height={28}
            className="ide-logo-image"
            priority
          />
          <span className="logo-text">Lawless AI</span>
        </Link>

        {/* Repo selector */}
        <div className="repo-selector-wrapper" ref={repoMenuRef}>
          <button
            className="repo-selector"
            onClick={() => {
              setRepoMenuOpen(!repoMenuOpen);
              setSessionMenuOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="repo-icon">
              <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
            </svg>
            <span className="repo-name">{repoName || 'Select repo'}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="dropdown-arrow">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>

          {repoMenuOpen && (
            <div className="repo-menu">
              <div className="repo-menu-header">
                <span>Repositories</span>
                <button
                  className={`repo-sync-btn ${isSyncing ? 'syncing' : ''}`}
                  onClick={handleRefreshRepos}
                  disabled={isSyncing}
                  title="Refresh repos"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={isSyncing ? 'spin' : ''}>
                    <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
                    <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966a.25.25 0 010 .384L8.41 4.658A.25.25 0 018 4.466z"/>
                  </svg>
                </button>
              </div>
              <div className="repo-search-wrapper">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="repo-search-icon">
                  <circle cx="6" cy="6" r="4" />
                  <path d="M10 10l3 3" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="repo-search-input"
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="repo-menu-list">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.repo_full_name}
                    className={`repo-menu-item ${repo.repo_full_name === repoFullName ? 'active' : ''}`}
                    onClick={() => handleRepoSelect(repo)}
                  >
                    {repo.is_favorite && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="favorite-star">
                        <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/>
                      </svg>
                    )}
                    <span className="repo-menu-item-name">{repo.repo_name}</span>
                    <span className="repo-menu-item-owner">{repo.repo_full_name.split('/')[0]}</span>
                  </button>
                ))}
                {repos.length === 0 && (
                  <div className="repo-menu-empty">
                    <p>No repositories found</p>
                    <button className="repo-menu-sync-btn" onClick={handleRefreshRepos} disabled={isSyncing}>
                      {isSyncing ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                )}
                {repos.length > 0 && filteredRepos.length === 0 && (
                  <div className="repo-menu-empty">No matching repos</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Session selector */}
        <div className="session-selector-wrapper" ref={sessionMenuRef}>
          <button
            className="session-selector"
            onClick={() => {
              setSessionMenuOpen(!sessionMenuOpen);
              setRepoMenuOpen(false);
            }}
          >
            {repoFullName ? (
              <>
                <span className="session-repo">{repoName}</span>
                <span className="session-branch">
                  {currentSession?.branchName || activeSession?.branch || 'main'}
                </span>
              </>
            ) : activeSession ? (
              <>
                <span className="session-repo">{activeSession.repo}</span>
                <span className="session-branch">{activeSession.branch}</span>
              </>
            ) : (
              <span className="session-placeholder">Select a session...</span>
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>

          {sessionMenuOpen && (
            <div className="session-menu">
              <div className="session-menu-header">
                <span>Sessions</span>
                {onNewSession && (
                  <button
                    className="new-session-btn"
                    onClick={() => {
                      onNewSession();
                      setSessionMenuOpen(false);
                    }}
                  >
                    + New
                  </button>
                )}
              </div>
              <div className="session-menu-list">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className={`session-menu-item ${session.sessionId === activeSessionId ? 'active' : ''}`}
                  >
                    <button
                      className="session-menu-item-main"
                      onClick={() => {
                        onSessionChange?.(session.sessionId);
                        setSessionMenuOpen(false);
                      }}
                    >
                      <span className="session-name">{session.name}</span>
                      <span className="session-branch-small">{session.branchName}</span>
                    </button>
                    {onDeleteSession && (
                      <button
                        className="session-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete session "${session.name}"?`)) {
                            onDeleteSession(session.sessionId);
                          }
                        }}
                        title="Delete session"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M6 6v4M8 6v4M4 3.5l.5 8a1 1 0 001 1h3a1 1 0 001-1l.5-8" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="session-menu-empty">No sessions yet</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ide-header-center">
        {/* Command palette trigger */}
        <button className="command-palette-trigger" onClick={() => setCommandPaletteOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="4" />
            <path d="M10 10l3 3" />
          </svg>
          <span>Search or run command...</span>
          <kbd>⌘P</kbd>
        </button>
      </div>

      <div className="ide-header-right">
        {/* Status indicators */}
        <div className="status-indicators">
          <span
            className={`status-dot ${services.terminal.status}`}
            style={{ backgroundColor: getStatusColor(services.terminal.status) }}
            title={`Terminal ${services.terminal.status}`}
          />
          <span
            className={`status-dot ${services.github.status}`}
            style={{ backgroundColor: getStatusColor(services.github.status) }}
            title={`GitHub ${services.github.status}`}
          />
          <span
            className={`status-dot ${services.supabase.status}`}
            style={{ backgroundColor: getStatusColor(services.supabase.status) }}
            title={`Supabase ${services.supabase.status}`}
          />
          <span
            className={`status-dot ${services.vercel.status}`}
            style={{ backgroundColor: getStatusColor(services.vercel.status) }}
            title={`Vercel ${services.vercel.status}`}
          />
        </div>

        {/* Quick links */}
        <div className="ide-quick-links">
          <button
            className="ide-quick-link-btn github"
            onClick={() => window.open('https://github.com/orgs/Light-Brands/repositories', '_blank')}
            title="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </button>
          <button
            className="ide-quick-link-btn vercel"
            onClick={() => window.open('https://vercel.com/autod3vs-projects/~/deployments', '_blank')}
            title="Vercel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 22.525H0l12-21.05 12 21.05z"/>
            </svg>
          </button>
          <button
            className="ide-quick-link-btn supabase"
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            title="Supabase"
          >
            <svg width="18" height="18" viewBox="0 0 109 113" fill="currentColor">
              <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fillOpacity="0.6"/>
              <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"/>
              <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"/>
            </svg>
          </button>
          <button
            className="ide-quick-link-btn remote"
            onClick={() => window.open('https://remotedesktop.google.com/access', '_blank')}
            title="Chrome Remote Desktop"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
        </div>

        {/* Settings */}
        <button className="ide-settings-btn" title="Settings">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 11a2 2 0 100-4 2 2 0 000 4z" />
            <path d="M14.5 9a5.5 5.5 0 01-11 0 5.5 5.5 0 0111 0z" />
          </svg>
        </button>

        {/* User menu */}
        <button className="ide-user-btn">
          <div className="user-avatar">
            <span>U</span>
          </div>
        </button>
      </div>
    </header>
  );
}
