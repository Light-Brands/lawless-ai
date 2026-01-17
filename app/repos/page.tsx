'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

interface User {
  login: string;
  name: string;
  avatar: string;
}

export default function ReposPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    checkAuthAndLoadRepos();
  }, []);

  async function checkAuthAndLoadRepos() {
    try {
      // Check auth status
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();

      if (!authData.authenticated) {
        router.push('/');
        return;
      }

      setUser(authData.user);

      // Load repos
      const reposRes = await fetch('/api/github/repos');
      const reposData = await reposRes.json();

      if (reposData.error) {
        setError(reposData.error);
      } else {
        setRepos(reposData.repos);
      }
    } catch (err) {
      setError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectRepo(repo: Repo) {
    setSelectedRepo(repo.fullName);
    setCloning(true);

    try {
      // Clone/setup repo on backend
      const response = await fetch('/api/workspace/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: repo.fullName }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setCloning(false);
        return;
      }

      // Redirect to workspace chat
      router.push(`/workspace/${encodeURIComponent(repo.fullName)}`);
    } catch (err) {
      setError('Failed to setup workspace');
      setCloning(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading repositories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-400">Lawless AI</h1>
          {user && (
            <div className="flex items-center gap-4">
              <img
                src={user.avatar}
                alt={user.login}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-gray-300">{user.login}</span>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-white text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        <h2 className="text-xl font-semibold mb-6">Select a Repository</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {cloning && (
          <div className="bg-purple-900/50 border border-purple-500 text-purple-200 p-4 rounded-lg mb-6">
            Setting up workspace for {selectedRepo}...
          </div>
        )}

        <div className="grid gap-4">
          {repos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => !cloning && handleSelectRepo(repo)}
              className={`
                bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer
                hover:border-purple-500 hover:bg-gray-750 transition-colors
                ${selectedRepo === repo.fullName ? 'border-purple-500 bg-purple-900/20' : ''}
                ${cloning ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-purple-300">
                    {repo.name}
                    {repo.private && (
                      <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">
                        Private
                      </span>
                    )}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {repo.description || 'No description'}
                  </p>
                </div>
                {repo.language && (
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    {repo.language}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Updated {new Date(repo.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {repos.length === 0 && !error && (
          <div className="text-gray-400 text-center py-12">
            No repositories found. Create one on GitHub first.
          </div>
        )}
      </main>
    </div>
  );
}
