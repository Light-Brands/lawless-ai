'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Breadcrumb from './Breadcrumb';

interface RepoData {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  stargazersCount: number;
  forksCount: number;
  htmlUrl: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}

interface Branch {
  name: string;
  protected: boolean;
}

interface VercelProject {
  id: string;
  name: string;
}

interface SupabaseProject {
  id: string;
  name: string;
  ref: string;
}

interface RepoHeaderProps {
  repo: RepoData;
  currentPath: string;
  selectedBranch: string;
  branches: Branch[];
  onNavigate: (path: string, isFile?: boolean) => void;
  onOpenWorkspace: () => void;
  onBranchChange: (branch: string) => void;
  vercelConnected: boolean;
  supabaseConnected: boolean;
  vercelProjects: VercelProject[];
  supabaseProjects: SupabaseProject[];
  selectedVercelProject: { projectId: string; projectName: string } | null;
  selectedSupabaseProject: { projectRef: string; projectName: string } | null;
  onVercelProjectChange: (projectId: string) => void;
  onSupabaseProjectChange: (projectRef: string) => void;
  creatingVercel: boolean;
  creatingSupabase: boolean;
  onDeleteRepo: () => void;
  onToggleVisibility: () => void;
  isTogglingVisibility: boolean;
}

const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const ForkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="18" r="3"/>
    <circle cx="6" cy="6" r="3"/>
    <circle cx="18" cy="6" r="3"/>
    <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
    <path d="M12 12v3"/>
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" x2="21" y1="14" y2="3"/>
  </svg>
);

const BranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

const VercelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 19.5h20L12 2z"/>
  </svg>
);

const SupabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4"/>
    <path d="m6.8 15-3.5 2"/>
    <path d="m20.7 17-3.5-2"/>
    <path d="M6.8 9 3.3 7"/>
    <path d="m20.7 7-3.5 2"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const TerminalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" x2="20" y1="19" y2="19"/>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    <line x1="10" x2="10" y1="11" y2="17"/>
    <line x1="14" x2="14" y1="11" y2="17"/>
  </svg>
);

const UnlockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
);

export default function RepoHeader({
  repo,
  currentPath,
  selectedBranch,
  branches,
  onNavigate,
  onOpenWorkspace,
  onBranchChange,
  vercelConnected,
  supabaseConnected,
  vercelProjects,
  supabaseProjects,
  selectedVercelProject,
  selectedSupabaseProject,
  onVercelProjectChange,
  onSupabaseProjectChange,
  creatingVercel,
  creatingSupabase,
  onDeleteRepo,
  onToggleVisibility,
  isTogglingVisibility,
}: RepoHeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="repo-header">
      <div className="repo-header-top">
        <div className="repo-header-info">
          <div className="repo-header-title">
            <img
              src={repo.owner.avatarUrl}
              alt={repo.owner.login}
              className="repo-owner-avatar"
            />
            <span className="repo-owner-name">{repo.owner.login}</span>
            <span className="repo-separator">/</span>
            <span className="repo-name">{repo.name}</span>
            {repo.private && (
              <span className="repo-private-badge">
                <LockIcon />
                Private
              </span>
            )}
          </div>
          {repo.description && (
            <p className="repo-description">{repo.description}</p>
          )}
        </div>

        <div className="repo-header-actions">
          <div className="repo-stats">
            <span className="repo-stat">
              <StarIcon />
              {repo.stargazersCount.toLocaleString()}
            </span>
            <span className="repo-stat">
              <ForkIcon />
              {repo.forksCount.toLocaleString()}
            </span>
          </div>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="repo-github-link"
          >
            <ExternalLinkIcon />
            GitHub
          </a>
          <button onClick={onOpenWorkspace} className="repo-workspace-btn">
            <PlayIcon />
            Open in Workspace
          </button>
          <Link href={`/terminal/${repo.fullName}`} className="repo-terminal-btn">
            <TerminalIcon />
            Terminal
          </Link>

          {/* Settings dropdown */}
          <div className="repo-settings-dropdown" ref={settingsRef}>
            <button
              className="repo-settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="Repository settings"
            >
              <SettingsIcon />
            </button>

            {showSettings && (
              <div className="repo-settings-menu">
                <button
                  className="repo-settings-item"
                  onClick={() => {
                    onToggleVisibility();
                    setShowSettings(false);
                  }}
                  disabled={isTogglingVisibility}
                >
                  {repo.private ? <GlobeIcon /> : <LockIcon />}
                  <span>
                    {isTogglingVisibility
                      ? 'Changing...'
                      : repo.private
                        ? 'Make public'
                        : 'Make private'}
                  </span>
                </button>
                <div className="repo-settings-divider" />
                <button
                  className="repo-settings-item danger"
                  onClick={() => {
                    onDeleteRepo();
                    setShowSettings(false);
                  }}
                >
                  <TrashIcon />
                  <span>Delete repository</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="repo-header-nav">
        <div className="repo-branch-selector">
          <BranchIcon />
          <select
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="repo-branch-select"
          >
            {branches.length > 0 ? (
              branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}{branch.name === repo.defaultBranch ? ' (default)' : ''}
                </option>
              ))
            ) : (
              <option value={repo.defaultBranch}>{repo.defaultBranch}</option>
            )}
          </select>
        </div>

        {vercelConnected && (
          <div className={`repo-integration-selector ${selectedVercelProject ? 'has-selection' : ''} ${creatingVercel ? 'creating' : ''}`}>
            <VercelIcon />
            {creatingVercel ? (
              <span className="repo-integration-creating">Creating...</span>
            ) : (
              <select
                value={selectedVercelProject?.projectId || ''}
                onChange={(e) => onVercelProjectChange(e.target.value)}
                className="repo-integration-select"
                disabled={creatingVercel}
              >
                <option value="">No Vercel project</option>
                <option value="__create_new__">+ Create & link new...</option>
                {vercelProjects.length > 0 && <option disabled>───────────</option>}
                {vercelProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {supabaseConnected && (
          <div className={`repo-integration-selector ${selectedSupabaseProject ? 'has-selection' : ''} ${creatingSupabase ? 'creating' : ''}`}>
            <SupabaseIcon />
            {creatingSupabase ? (
              <span className="repo-integration-creating">Creating...</span>
            ) : (
              <select
                value={selectedSupabaseProject?.projectRef || ''}
                onChange={(e) => onSupabaseProjectChange(e.target.value)}
                className="repo-integration-select"
                disabled={creatingSupabase}
              >
                <option value="">No Supabase database</option>
                <option value="__create_new__">+ Create & link new...</option>
                {supabaseProjects.length > 0 && <option disabled>───────────</option>}
                {supabaseProjects.map((project) => (
                  <option key={project.ref} value={project.ref}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <Breadcrumb
          repoName={repo.name}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
