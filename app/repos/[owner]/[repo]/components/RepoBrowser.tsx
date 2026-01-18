'use client';

import RepoHeader from './RepoHeader';
import FileTree from './FileTree';
import DirectoryView from './DirectoryView';
import FileViewer from './FileViewer';
import ReadmePreview from './ReadmePreview';

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

interface RepoBrowserProps {
  repo: RepoData;
  tree: TreeNode[];
  contents: ContentItem[];
  fileData: FileData | null;
  readme: ReadmeData | null;
  currentPath: string;
  view: string;
  selectedBranch: string;
  branches: Branch[];
  contentsLoading: boolean;
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

export default function RepoBrowser({
  repo,
  tree,
  contents,
  fileData,
  readme,
  currentPath,
  view,
  selectedBranch,
  branches,
  contentsLoading,
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
}: RepoBrowserProps) {
  const isViewingFile = view === 'blob' && fileData;

  return (
    <main className="repo-browser-main">
      <RepoHeader
        repo={repo}
        currentPath={currentPath}
        selectedBranch={selectedBranch}
        branches={branches}
        onNavigate={onNavigate}
        onOpenWorkspace={onOpenWorkspace}
        onBranchChange={onBranchChange}
        vercelConnected={vercelConnected}
        supabaseConnected={supabaseConnected}
        vercelProjects={vercelProjects}
        supabaseProjects={supabaseProjects}
        selectedVercelProject={selectedVercelProject}
        selectedSupabaseProject={selectedSupabaseProject}
        onVercelProjectChange={onVercelProjectChange}
        onSupabaseProjectChange={onSupabaseProjectChange}
        creatingVercel={creatingVercel}
        creatingSupabase={creatingSupabase}
        onDeleteRepo={onDeleteRepo}
        onToggleVisibility={onToggleVisibility}
        isTogglingVisibility={isTogglingVisibility}
      />

      <div className="repo-browser-content">
        {/* File tree sidebar */}
        <aside className="repo-browser-sidebar">
          <div className="repo-browser-sidebar-header">
            <span className="repo-browser-sidebar-title">Files</span>
          </div>
          <FileTree
            tree={tree}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        </aside>

        {/* Main content area */}
        <div className="repo-browser-main-content">
          {contentsLoading ? (
            <div className="repo-browser-content-loading">
              <div className="repo-browser-loading-spinner small"></div>
              <span>Loading...</span>
            </div>
          ) : isViewingFile ? (
            <FileViewer file={fileData} onNavigate={onNavigate} />
          ) : (
            <>
              <DirectoryView
                contents={contents}
                currentPath={currentPath}
                onNavigate={onNavigate}
              />
              {!currentPath && readme && (
                <ReadmePreview readme={readme} />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
