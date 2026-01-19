'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import Header from '@/app/components/Header';

interface Repo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
  htmlUrl: string;
}

// Language colors matching GitHub
const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#239120',
  Shell: '#89e051',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

const RepoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export default function ReposPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRepos();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredRepos(
        repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredRepos(repos);
    }
  }, [searchQuery, repos]);

  async function loadRepos() {
    try {
      const reposRes = await fetch('/api/github/repos');
      const reposData = await reposRes.json();

      if (reposData.error) {
        setError(reposData.error);
      } else {
        setRepos(reposData.repos);
        setFilteredRepos(reposData.repos);

        // Sync repos to database for persistence across devices
        fetch('/api/user/repos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repos: reposData.repos }),
        }).catch(console.error);
      }
    } catch (err) {
      setError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectRepo(repo: Repo) {
    // Mark repo as accessed in database
    fetch('/api/user/repos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId: repo.id, markAccessed: true }),
    }).catch(console.error);

    // Navigate to the file browser for this repo
    const [owner, repoName] = repo.fullName.split('/');
    router.push(`/repos/${owner}/${repoName}`);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="repos-page">
        <div className="repos-loading">
          <div className="repos-loading-spinner"></div>
          <p>Loading your repositories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="repos-page">
      {/* Ambient background */}
      <div className="repos-ambient"></div>

      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="repos-main">
        {/* Hero section */}
        <div className="repos-hero">
          <div className="repos-hero-icon">
            <RepoIcon />
          </div>
          <h1>Your Repositories</h1>
          <p>Select a repository to start coding with Claude</p>
        </div>

        {/* Search and New Project */}
        <div className="repos-search-container">
          <div className="repos-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="repos-search-right">
            <div className="repos-count">
              {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}
            </div>
            <Link href="/projects/new" className="repos-new-project-btn">
              <PlusIcon />
              <span>New Project</span>
            </Link>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="repos-error">
            <span>⚠️</span>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Repository grid */}
        <div className="repos-grid">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => handleSelectRepo(repo)}
              className="repo-card"
            >
              <div className="repo-card-header">
                <div className="repo-card-title">
                  <RepoIcon />
                  <h3>{repo.name}</h3>
                  {repo.private && (
                    <span className="repo-private-badge">
                      <LockIcon />
                      Private
                    </span>
                  )}
                </div>
                <div className="repo-card-arrow">
                  <ArrowRightIcon />
                </div>
              </div>

              <p className="repo-card-description">
                {repo.description || 'No description provided'}
              </p>

              <div className="repo-card-footer">
                {repo.language && (
                  <div className="repo-language">
                    <span
                      className="repo-language-dot"
                      style={{ backgroundColor: languageColors[repo.language] || '#8b8b8b' }}
                    ></span>
                    {repo.language}
                  </div>
                )}
                <div className="repo-updated">
                  Updated {formatDate(repo.updatedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredRepos.length === 0 && !error && (
          <div className="repos-empty">
            <RepoIcon />
            <h3>No repositories found</h3>
            <p>
              {searchQuery
                ? 'Try a different search term'
                : 'Create a repository on GitHub to get started'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
