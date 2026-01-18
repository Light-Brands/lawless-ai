'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RepoBrowser from './components/RepoBrowser';

interface RepoData {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
  createdAt: string;
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  openIssuesCount: number;
  htmlUrl: string;
  cloneUrl: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

interface ContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
}

interface FileData {
  name: string;
  path: string;
  size: number;
  sha: string;
  content: string;
  encoding: string;
}

interface ReadmeData {
  name: string;
  path: string;
  content: string;
  htmlUrl: string;
}

interface User {
  login: string;
  name: string;
  avatar: string;
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

interface RepoIntegration {
  vercel?: { projectId: string; projectName: string };
  supabase?: { projectRef: string; projectName: string };
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

export default function RepoBrowserPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const owner = params.owner as string;
  const repo = params.repo as string;
  const currentPath = searchParams.get('path') || '';
  const view = searchParams.get('view') || 'tree'; // 'tree' or 'blob'
  const branch = searchParams.get('ref') || '';

  const [user, setUser] = useState<User | null>(null);
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [readme, setReadme] = useState<ReadmeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);

  // Integration state
  const [vercelConnected, setVercelConnected] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([]);
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseProject[]>([]);
  const [selectedVercelProject, setSelectedVercelProject] = useState<{ projectId: string; projectName: string } | null>(null);
  const [selectedSupabaseProject, setSelectedSupabaseProject] = useState<{ projectRef: string; projectName: string } | null>(null);
  const [creatingVercel, setCreatingVercel] = useState(false);
  const [creatingSupabase, setCreatingSupabase] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [owner, repo]);

  useEffect(() => {
    if (selectedBranch) {
      loadContents(currentPath);
    }
  }, [currentPath, selectedBranch, view]);

  async function checkAuthAndLoadData() {
    try {
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();

      if (!authData.authenticated) {
        router.push('/');
        return;
      }

      setUser(authData.user);

      // Check integration connections
      const vercelIsConnected = authData.vercel?.connected || false;
      const supabaseIsConnected = authData.supabase?.connected || false;
      setVercelConnected(vercelIsConnected);
      setSupabaseConnected(supabaseIsConnected);

      // Load existing repo integrations for this repo
      const repoFullName = `${owner}/${repo}`;
      const existingIntegrations = authData.repoIntegrations?.[repoFullName];
      if (existingIntegrations?.vercel) {
        setSelectedVercelProject(existingIntegrations.vercel);
      }
      if (existingIntegrations?.supabase) {
        setSelectedSupabaseProject(existingIntegrations.supabase);
      }

      // Load repo data, tree, branches, and initial contents in parallel
      const [repoRes, treeRes, contentsRes, readmeRes, branchesRes] = await Promise.all([
        fetch(`/api/github/repo?owner=${owner}&repo=${repo}`),
        fetch(`/api/github/tree?owner=${owner}&repo=${repo}`),
        fetch(`/api/github/contents?owner=${owner}&repo=${repo}&path=${currentPath}`),
        fetch(`/api/github/readme?owner=${owner}&repo=${repo}`),
        fetch(`/api/github/branches?repo=${owner}/${repo}`),
      ]);

      const [repoResult, treeResult, contentsResult, readmeResult, branchesResult] = await Promise.all([
        repoRes.json(),
        treeRes.json(),
        contentsRes.json(),
        readmeRes.json(),
        branchesRes.json(),
      ]);

      if (repoResult.error) {
        setError(repoResult.error);
        return;
      }

      setRepoData(repoResult.repo);
      setSelectedBranch('main');
      setBranches(branchesResult.branches || []);

      // Fetch Vercel projects if connected
      if (vercelIsConnected) {
        try {
          const vercelRes = await fetch('/api/integrations/vercel/projects');
          const vercelData = await vercelRes.json();
          if (vercelData.projects) {
            setVercelProjects(vercelData.projects.map((p: { id: string; name: string }) => ({
              id: p.id,
              name: p.name,
            })));
          }
        } catch (err) {
          console.error('Failed to load Vercel projects:', err);
        }
      }

      // Fetch Supabase projects if connected
      if (supabaseIsConnected) {
        try {
          const supabaseRes = await fetch('/api/integrations/supabase/projects');
          const supabaseData = await supabaseRes.json();
          if (supabaseData.projects) {
            setSupabaseProjects(supabaseData.projects.map((p: { id: string; name: string; ref?: string }) => ({
              id: p.id,
              name: p.name,
              ref: p.ref || p.id,
            })));
          }
        } catch (err) {
          console.error('Failed to load Supabase projects:', err);
        }
      }
      setTree(treeResult.tree || []);

      if (contentsResult.type === 'dir') {
        setContents(contentsResult.contents || []);
      } else if (contentsResult.type === 'file') {
        setFileData(contentsResult.file);
      }

      if (readmeResult.readme) {
        setReadme(readmeResult.readme);
      }
    } catch (err) {
      setError('Failed to load repository');
    } finally {
      setLoading(false);
    }
  }

  async function loadContents(path: string) {
    setContentsLoading(true);
    try {
      const ref = selectedBranch ? `&ref=${selectedBranch}` : '';
      const res = await fetch(`/api/github/contents?owner=${owner}&repo=${repo}&path=${path}${ref}`);
      const result = await res.json();

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.type === 'dir') {
        setContents(result.contents || []);
        setFileData(null);
      } else if (result.type === 'file') {
        setFileData(result.file);
        setContents([]);
      }
    } catch (err) {
      setError('Failed to load contents');
    } finally {
      setContentsLoading(false);
    }
  }

  const navigateTo = useCallback((path: string, isFile: boolean = false) => {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    if (isFile) params.set('view', 'blob');
    if (selectedBranch && repoData && selectedBranch !== repoData.defaultBranch) {
      params.set('ref', selectedBranch);
    }
    const queryString = params.toString();
    router.push(`/repos/${owner}/${repo}${queryString ? `?${queryString}` : ''}`);
  }, [owner, repo, selectedBranch, repoData, router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  function handleOpenWorkspace() {
    router.push(`/workspace/${owner}/${repo}`);
  }

  async function handleBranchChange(newBranch: string) {
    if (newBranch === selectedBranch) return;

    setSelectedBranch(newBranch);
    setContentsLoading(true);

    try {
      // Reload tree and contents for the new branch
      const [treeRes, contentsRes, readmeRes] = await Promise.all([
        fetch(`/api/github/tree?owner=${owner}&repo=${repo}&ref=${newBranch}`),
        fetch(`/api/github/contents?owner=${owner}&repo=${repo}&path=&ref=${newBranch}`),
        fetch(`/api/github/readme?owner=${owner}&repo=${repo}&ref=${newBranch}`),
      ]);

      const [treeResult, contentsResult, readmeResult] = await Promise.all([
        treeRes.json(),
        contentsRes.json(),
        readmeRes.json(),
      ]);

      setTree(treeResult.tree || []);

      if (contentsResult.type === 'dir') {
        setContents(contentsResult.contents || []);
        setFileData(null);
      }

      setReadme(readmeResult.readme || null);

      // Navigate to root of the new branch
      const params = new URLSearchParams();
      if (newBranch !== repoData?.defaultBranch) {
        params.set('ref', newBranch);
      }
      const queryString = params.toString();
      router.push(`/repos/${owner}/${repo}${queryString ? `?${queryString}` : ''}`);
    } catch (err) {
      setError('Failed to load branch');
    } finally {
      setContentsLoading(false);
    }
  }

  async function handleVercelProjectChange(projectId: string) {
    const repoFullName = `${owner}/${repo}`;

    if (!projectId) {
      // Clear selection
      setSelectedVercelProject(null);
      await fetch('/api/repos/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoFullName, vercel: null }),
      });
      return;
    }

    // Handle create new
    if (projectId === '__create_new__') {
      setCreatingVercel(true);
      try {
        // Create a new Vercel project linked to this repo
        const res = await fetch('/api/integrations/vercel/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: repo,
            framework: 'nextjs',
            gitRepository: { repo: repoFullName },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const newProject = { id: data.project.id, name: data.project.name };

          // Add to projects list
          setVercelProjects(prev => [...prev, newProject]);

          // Select and link it
          const selection = { projectId: newProject.id, projectName: newProject.name };
          setSelectedVercelProject(selection);
          await fetch('/api/repos/integrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo: repoFullName, vercel: selection }),
          });
        } else {
          const error = await res.json();
          alert(`Failed to create Vercel project: ${error.error || 'Unknown error'}`);
        }
      } catch (err) {
        alert('Failed to create Vercel project');
      } finally {
        setCreatingVercel(false);
      }
      return;
    }

    const project = vercelProjects.find(p => p.id === projectId);
    if (project) {
      const selection = { projectId: project.id, projectName: project.name };
      setSelectedVercelProject(selection);
      await fetch('/api/repos/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoFullName, vercel: selection }),
      });
    }
  }

  async function handleSupabaseProjectChange(projectRef: string) {
    const repoFullName = `${owner}/${repo}`;

    if (!projectRef) {
      // Clear selection
      setSelectedSupabaseProject(null);
      await fetch('/api/repos/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoFullName, supabase: null }),
      });
      return;
    }

    // Handle create new
    if (projectRef === '__create_new__') {
      setCreatingSupabase(true);
      try {
        // Create a new Supabase project
        const res = await fetch('/api/integrations/supabase/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: repo,
            region: 'us-east-1',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const newProject = {
            id: data.project.id,
            name: data.project.name,
            ref: data.project.ref,
          };

          // Show the database password to the user
          if (data.project.dbPassword) {
            alert(`Database created!\n\nIMPORTANT - Save your database password:\n${data.project.dbPassword}\n\nThis won't be shown again.`);
          }

          // Add to projects list
          setSupabaseProjects(prev => [...prev, newProject]);

          // Select and link it
          const selection = { projectRef: newProject.ref, projectName: newProject.name };
          setSelectedSupabaseProject(selection);
          await fetch('/api/repos/integrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo: repoFullName, supabase: selection }),
          });
        } else {
          const error = await res.json();
          alert(`Failed to create Supabase database: ${error.error || 'Unknown error'}`);
        }
      } catch (err) {
        alert('Failed to create Supabase database');
      } finally {
        setCreatingSupabase(false);
      }
      return;
    }

    const project = supabaseProjects.find(p => p.ref === projectRef);
    if (project) {
      const selection = { projectRef: project.ref, projectName: project.name };
      setSelectedSupabaseProject(selection);
      await fetch('/api/repos/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoFullName, supabase: selection }),
      });
    }
  }

  if (loading) {
    return (
      <div className="repo-browser-page">
        <div className="repo-browser-loading">
          <div className="repo-browser-loading-spinner"></div>
          <p>Loading repository...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="repo-browser-page">
        <div className="repo-browser-error">
          <h2>Error</h2>
          <p>{error}</p>
          <Link href="/repos" className="repo-browser-back-btn">
            Back to Repositories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-browser-page">
      <div className="repo-browser-ambient"></div>

      {/* Header */}
      <header className="repo-browser-header">
        <div className="repo-browser-header-content">
          <div className="repo-browser-header-left">
            <Link href="/" className="repo-browser-logo">
              <div className="repo-browser-logo-icon">
                <LightningIcon />
              </div>
              <span className="repo-browser-logo-text">Lawless AI</span>
            </Link>
          </div>

          {user && (
            <div className="repo-browser-header-right">
              <Link href="/" className="repo-browser-nav-btn">
                <HomeIcon />
                <span>Chat</span>
              </Link>
              <Link href="/repos" className="repo-browser-nav-btn">
                <RepoListIcon />
                <span>Repos</span>
              </Link>
              <Link href="/integrations" className="repo-browser-nav-btn">
                <IntegrationsIcon />
                <span>Integrations</span>
              </Link>
              <div className="repo-browser-user">
                <img src={user.avatar} alt={user.login} className="repo-browser-avatar" />
                <span className="repo-browser-username">{user.login}</span>
              </div>
              <button onClick={handleLogout} className="repo-browser-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      {repoData && (
        <RepoBrowser
          repo={repoData}
          tree={tree}
          contents={contents}
          fileData={fileData}
          readme={readme}
          currentPath={currentPath}
          view={view}
          selectedBranch={selectedBranch}
          branches={branches}
          contentsLoading={contentsLoading}
          onNavigate={navigateTo}
          onOpenWorkspace={handleOpenWorkspace}
          onBranchChange={handleBranchChange}
          vercelConnected={vercelConnected}
          supabaseConnected={supabaseConnected}
          vercelProjects={vercelProjects}
          supabaseProjects={supabaseProjects}
          selectedVercelProject={selectedVercelProject}
          selectedSupabaseProject={selectedSupabaseProject}
          onVercelProjectChange={handleVercelProjectChange}
          onSupabaseProjectChange={handleSupabaseProjectChange}
          creatingVercel={creatingVercel}
          creatingSupabase={creatingSupabase}
        />
      )}
    </div>
  );
}
