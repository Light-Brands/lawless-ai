'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProjectTree from './components/ProjectTree';
import DeploymentList from './components/DeploymentList';
import BuildLogsViewer from './components/BuildLogsViewer';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import '../integrations.css';

interface User {
  login: string;
  name: string;
  avatar: string;
}

interface VercelUser {
  name: string;
  email: string;
  avatar?: string;
}

interface Project {
  id: string;
  name: string;
  framework: string | null;
  createdAt: number;
  updatedAt: number;
  latestDeployment: {
    id: string;
    url: string;
    state: string;
    createdAt: number;
  } | null;
}

interface Deployment {
  id: string;
  name: string;
  url: string;
  state: string;
  createdAt: number;
  target: string;
  meta: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
  };
}

interface LogEntry {
  id: string;
  timestamp: number;
  type: string;
  text: string;
  level?: string;
}

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7"/>
    <path d="M19 12H5"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

function VercelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [vercelUser, setVercelUser] = useState<VercelUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    try {
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();

      if (!authData.authenticated) {
        router.push('/');
        return;
      }

      setUser(authData.user);

      if (!authData.vercel?.connected) {
        router.push('/integrations');
        return;
      }

      setVercelUser(authData.vercel.user);

      // Load projects
      const projectsRes = await fetch('/api/integrations/vercel/projects');
      const projectsData = await projectsRes.json();

      if (projectsData.error) {
        setError(projectsData.error);
        return;
      }

      setProjects(projectsData.projects || []);

      // Select project from URL param, or first project by default
      if (projectsData.projects?.length > 0) {
        const projectId = searchParams.get('project');
        const targetProject = projectId
          ? projectsData.projects.find((p: Project) => p.id === projectId) || projectsData.projects[0]
          : projectsData.projects[0];
        setSelectedProject(targetProject);
        await loadDeployments(targetProject.id);
      }
    } catch (err) {
      setError('Failed to load Vercel data');
    } finally {
      setLoading(false);
    }
  }

  async function loadDeployments(projectId: string) {
    setDeploymentsLoading(true);
    try {
      const res = await fetch(`/api/integrations/vercel/deployments?projectId=${projectId}&limit=20`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setDeployments(data.deployments || []);
    } catch (err) {
      setError('Failed to load deployments');
    } finally {
      setDeploymentsLoading(false);
    }
  }

  async function loadLogs(deploymentId: string, type: 'build' | 'runtime' = 'build') {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/integrations/vercel/deployments/${deploymentId}/logs?type=${type}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setLogs(data.logs || []);
      setShowLogs(true);
    } catch (err) {
      setError('Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  }

  const handleSelectProject = useCallback(async (project: Project) => {
    setSelectedProject(project);
    setSelectedDeployment(null);
    setShowLogs(false);
    await loadDeployments(project.id);
  }, []);

  const handleViewLogs = useCallback(async (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    await loadLogs(deployment.id);
  }, []);

  const handleRedeploy = useCallback(async (deployment: Deployment) => {
    if (!selectedProject) return;

    try {
      const res = await fetch(`/api/integrations/vercel/projects/${selectedProject.id}/redeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId: deployment.id,
          target: deployment.target,
        }),
      });

      const data = await res.json();

      if (data.error) {
        alert(`Redeploy failed: ${data.error}`);
        return;
      }

      alert('Redeploy triggered successfully!');
      await loadDeployments(selectedProject.id);
    } catch (err) {
      alert('Failed to trigger redeploy');
    }
  }, [selectedProject]);

  const handleCancel = useCallback(async (deployment: Deployment) => {
    if (!confirm('Are you sure you want to cancel this deployment?')) return;

    try {
      const res = await fetch(`/api/integrations/vercel/deployments/${deployment.id}/cancel`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.error) {
        alert(`Cancel failed: ${data.error}`);
        return;
      }

      if (selectedProject) {
        await loadDeployments(selectedProject.id);
      }
    } catch (err) {
      alert('Failed to cancel deployment');
    }
  }, [selectedProject]);

  async function handleRefresh() {
    if (selectedProject) {
      await loadDeployments(selectedProject.id);
    }
  }

  async function handleDeleteProject() {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/integrations/vercel/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));

        // Clear selection if it was the deleted project
        if (selectedProject?.id === projectToDelete.id) {
          setSelectedProject(null);
          setDeployments([]);
        }
      } else {
        const data = await res.json();
        alert(`Failed to delete project: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Failed to delete project');
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) {
    return (
      <div className="vercel-page">
        <div className="vercel-loading">
          <div className="vercel-loading-spinner"></div>
          <p>Loading Vercel...</p>
        </div>
      </div>
    );
  }

  if (error && !projects.length) {
    return (
      <div className="vercel-page">
        <div className="vercel-error">
          <h2>Error</h2>
          <p>{error}</p>
          <Link href="/integrations" className="vercel-back-btn">
            Back to Integrations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="vercel-page">
      <div className="vercel-ambient"></div>

      {/* Header */}
      <header className="vercel-header">
        <div className="vercel-header-content">
          <div className="vercel-header-left">
            <Link href="/integrations" className="vercel-back-link">
              <BackIcon />
              <span>Back</span>
            </Link>
            <div className="vercel-header-divider"></div>
            <Link href="/" className="vercel-logo">
              <div className="vercel-logo-icon">
                <LightningIcon />
              </div>
              <span className="vercel-logo-text">Lawless AI</span>
            </Link>
          </div>

          <div className="vercel-header-center">
            <div className="vercel-service-badge">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M24 22.525H0l12-21.05 12 21.05z"/>
              </svg>
              <span>Vercel</span>
            </div>
            {selectedProject && (
              <span className="vercel-project-name">{selectedProject.name}</span>
            )}
          </div>

          {user && (
            <div className="vercel-header-right">
              <button onClick={handleRefresh} className="vercel-action-btn" title="Refresh">
                <RefreshIcon />
              </button>
              <Link href="/" className="vercel-nav-btn">
                <HomeIcon />
              </Link>
              <div className="vercel-user">
                <img src={user.avatar} alt={user.login} className="vercel-avatar" />
              </div>
              <button onClick={handleLogout} className="vercel-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="vercel-main">
        <div className="vercel-content">
          {/* Projects sidebar */}
          <aside className="vercel-sidebar">
            <div className="vercel-sidebar-header">
              <span className="vercel-sidebar-title">Projects</span>
              <span className="vercel-sidebar-count">{projects.length}</span>
            </div>
            <ProjectTree
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={handleSelectProject}
              onDeleteProject={setProjectToDelete}
            />
          </aside>

          {/* Main panel */}
          <div className="vercel-main-panel">
            {showLogs && selectedDeployment ? (
              <BuildLogsViewer
                deployment={selectedDeployment}
                logs={logs}
                loading={logsLoading}
                onClose={() => setShowLogs(false)}
                onLoadLogs={(type) => loadLogs(selectedDeployment.id, type)}
              />
            ) : (
              <DeploymentList
                deployments={deployments}
                loading={deploymentsLoading}
                selectedProject={selectedProject}
                onViewLogs={handleViewLogs}
                onRedeploy={handleRedeploy}
                onCancel={handleCancel}
              />
            )}
          </div>
        </div>
      </main>

      {/* Delete Project Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!projectToDelete}
        title="Delete Vercel Project"
        message={`This will permanently delete the project "${projectToDelete?.name}" and all its deployments. This action cannot be undone.`}
        confirmText={projectToDelete?.name || ''}
        confirmLabel="Delete Project"
        variant="danger"
        requireTypedConfirmation={true}
        onConfirm={handleDeleteProject}
        onCancel={() => setProjectToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}

export default function VercelPage() {
  return (
    <Suspense fallback={<div className="integration-page"><div className="loading">Loading...</div></div>}>
      <VercelPageContent />
    </Suspense>
  );
}
