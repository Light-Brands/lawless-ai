'use client';

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

interface RepoHeaderProps {
  repo: RepoData;
  currentPath: string;
  selectedBranch: string;
  onNavigate: (path: string, isFile?: boolean) => void;
  onOpenWorkspace: () => void;
  onBranchChange: (branch: string) => void;
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

export default function RepoHeader({
  repo,
  currentPath,
  selectedBranch,
  onNavigate,
  onOpenWorkspace,
  onBranchChange,
}: RepoHeaderProps) {
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
            <option value={repo.defaultBranch}>{repo.defaultBranch}</option>
          </select>
        </div>
        <Breadcrumb
          repoName={repo.name}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
