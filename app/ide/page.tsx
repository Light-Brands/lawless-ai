'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FolderIcon, BooksIcon, SparklesIcon, ArrowRightIcon } from './components/Icons';

interface RecentRepo {
  owner: string;
  repo: string;
  lastAccessed: string;
}

export default function IDELandingPage() {
  const router = useRouter();
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user's recent repos
    const fetchRepos = async () => {
      try {
        const response = await fetch('/api/user/repos');
        if (response.ok) {
          const data = await response.json();
          // Get first 5 repos
          const repos = (data.repos || []).slice(0, 5).map((repo: { full_name: string; pushed_at: string }) => {
            const [owner, repoName] = repo.full_name.split('/');
            return {
              owner,
              repo: repoName,
              lastAccessed: repo.pushed_at,
            };
          });
          setRecentRepos(repos);
        }
      } catch (err) {
        console.error('Failed to fetch repos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  return (
    <div className="ide-landing">
      <div className="ide-landing-content">
        <div className="ide-landing-header">
          <h1>Lawless AI IDE</h1>
          <p>Select a repository to open in the IDE</p>
        </div>

        <div className="ide-landing-sections">
          {/* Recent Repos */}
          <div className="ide-landing-section">
            <h2>Recent Repositories</h2>
            {loading ? (
              <div className="ide-landing-loading">Loading...</div>
            ) : recentRepos.length > 0 ? (
              <div className="repo-list">
                {recentRepos.map((repo) => (
                  <Link
                    key={`${repo.owner}/${repo.repo}`}
                    href={`/ide/${repo.owner}/${repo.repo}`}
                    className="repo-card"
                  >
                    <span className="repo-icon"><FolderIcon size={18} /></span>
                    <div className="repo-info">
                      <span className="repo-name">{repo.repo}</span>
                      <span className="repo-owner">{repo.owner}</span>
                    </div>
                    <span className="repo-arrow"><ArrowRightIcon size={16} /></span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ide-landing-empty">
                <p>No recent repositories</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="ide-landing-section">
            <h2>Get Started</h2>
            <div className="action-buttons">
              <Link href="/repos" className="action-btn primary">
                <span className="action-icon"><BooksIcon size={18} /></span>
                <span>Browse All Repos</span>
              </Link>
              <Link href="/projects/new" className="action-btn">
                <span className="action-icon"><SparklesIcon size={18} /></span>
                <span>Create New Project</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
