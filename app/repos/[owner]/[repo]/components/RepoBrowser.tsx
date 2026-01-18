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

interface RepoBrowserProps {
  repo: RepoData;
  tree: TreeNode[];
  contents: ContentItem[];
  fileData: FileData | null;
  readme: ReadmeData | null;
  currentPath: string;
  view: string;
  selectedBranch: string;
  contentsLoading: boolean;
  onNavigate: (path: string, isFile?: boolean) => void;
  onOpenWorkspace: () => void;
  onBranchChange: (branch: string) => void;
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
  contentsLoading,
  onNavigate,
  onOpenWorkspace,
  onBranchChange,
}: RepoBrowserProps) {
  const isViewingFile = view === 'blob' && fileData;

  return (
    <main className="repo-browser-main">
      <RepoHeader
        repo={repo}
        currentPath={currentPath}
        selectedBranch={selectedBranch}
        onNavigate={onNavigate}
        onOpenWorkspace={onOpenWorkspace}
        onBranchChange={onBranchChange}
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
