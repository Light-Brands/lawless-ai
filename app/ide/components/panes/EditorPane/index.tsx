'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useIDEContext } from '../../../contexts/IDEContext';
import { useGitHubConnection } from '../../../contexts/ServiceContext';
import { CodeEditor } from '../../CodeEditor';
import { ideEvents } from '../../../lib/eventBus';

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
}

// API tree node structure
interface ApiTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: ApiTreeNode[];
}

// Convert API tree (dir/file) to our format (folder/file)
function convertApiTree(nodes: ApiTreeNode[]): FileTreeItem[] {
  return nodes.map(node => ({
    name: node.name,
    path: node.path,
    type: node.type === 'dir' ? 'folder' : 'file',
    children: node.children ? convertApiTree(node.children) : undefined,
  }));
}

export function EditorPane() {
  const { owner, repo } = useIDEContext();
  const github = useGitHubConnection();
  const { activeFile, openFiles, unsavedFiles, setActiveFile, closeFile, splitView, setSplitView, openFile, markFileUnsaved, markFileSaved } = useIDEStore();
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [originalContents, setOriginalContents] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Handle sidebar resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(150, Math.min(500, resizeRef.current.startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Fetch file tree from GitHub API (only when GitHub is connected via ServiceContext)
  useEffect(() => {
    if (!owner || !repo) return;
    // Wait for GitHub to be connected before fetching
    if (github.status !== 'connected') return;

    const fetchTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/github/tree?owner=${owner}&repo=${repo}`);
        if (!response.ok) {
          throw new Error('Failed to fetch file tree');
        }
        const data = await response.json();
        if (data.tree) {
          const tree = convertApiTree(data.tree);
          setFileTree(tree);
          // Auto-expand first level folders
          const firstLevelFolders = tree.filter(item => item.type === 'folder').map(item => item.path);
          setExpandedFolders(new Set(firstLevelFolders));
        }
      } catch (err) {
        console.error('Failed to fetch tree:', err);
        setError('Failed to load file tree');
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [owner, repo, github.status]);

  // Fetch file content when a file is opened
  const fetchFileContent = useCallback(async (path: string) => {
    if (!owner || !repo) return;
    if (fileContents[path]) return; // Already loaded

    setLoadingFile(path);
    try {
      const response = await fetch(`/api/github/contents?owner=${owner}&repo=${repo}&path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      const data = await response.json();

      // If this is a directory, don't try to load it as a file
      if (data.type === 'dir') {
        // Close this from open files since it's not a file
        closeFile(path);
        return;
      }

      // API returns { type: 'file', file: { content } } structure
      const base64Content = data.file?.content || data.content;
      if (base64Content) {
        // GitHub returns base64 encoded content
        const content = atob(base64Content);
        setFileContents(prev => ({ ...prev, [path]: content }));
        setOriginalContents(prev => ({ ...prev, [path]: content }));
      }
    } catch (err) {
      console.error('Failed to fetch file:', err);
      setFileContents(prev => ({ ...prev, [path]: `// Error loading file: ${path}` }));
    } finally {
      setLoadingFile(null);
    }
  }, [owner, repo, fileContents, closeFile]);

  const handleFileChange = useCallback((content: string) => {
    if (!activeFile) return;

    setFileContents((prev) => ({
      ...prev,
      [activeFile]: content,
    }));

    // Mark file as unsaved if content changed from original
    if (content !== originalContents[activeFile]) {
      markFileUnsaved(activeFile);
    } else {
      markFileSaved(activeFile);
    }
  }, [activeFile, originalContents, markFileUnsaved, markFileSaved]);

  const handleSave = useCallback(() => {
    if (!activeFile) return;

    // Emit save event
    ideEvents.emit('file:saved', { path: activeFile, branch: 'main' });
    markFileSaved(activeFile);
  }, [activeFile, markFileSaved]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleFileClick = useCallback((path: string) => {
    openFile(path);
    setActiveFile(path);
    fetchFileContent(path);
  }, [openFile, setActiveFile, fetchFileContent]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return '🔷';
      case 'js':
      case 'jsx':
        return '🟨';
      case 'css':
      case 'scss':
        return '🎨';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'html':
        return '🌐';
      case 'svg':
      case 'png':
      case 'jpg':
      case 'gif':
        return '🖼️';
      default:
        return '📄';
    }
  };

  const renderFileTree = (items: FileTreeItem[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isLoading = loadingFile === item.path;

      if (!matchesSearch && item.type === 'file') return null;

      return (
        <React.Fragment key={item.path}>
          <div
            className={`file-tree-item ${item.type} ${activeFile === item.path ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => item.type === 'folder' ? toggleFolder(item.path) : handleFileClick(item.path)}
          >
            <span className="file-icon">
              {item.type === 'folder' ? (isExpanded ? '📂' : '📁') : getFileIcon(item.name)}
            </span>
            <span className="file-name">{item.name}</span>
            {isLoading && <span className="file-loading">⏳</span>}
          </div>
          {item.type === 'folder' && isExpanded && item.children && renderFileTree(item.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const getLanguageFromFile = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'TypeScript';
      case 'js':
      case 'jsx':
        return 'JavaScript';
      case 'css':
        return 'CSS';
      case 'json':
        return 'JSON';
      case 'md':
        return 'Markdown';
      default:
        return 'Plain Text';
    }
  };

  return (
    <div className="editor-pane">
      {/* File tabs */}
      <div className="editor-tabs">
        <div className="tabs-list">
          {openFiles.map((file) => (
            <div
              key={file}
              className={`editor-tab ${activeFile === file ? 'active' : ''}`}
              onClick={() => setActiveFile(file)}
            >
              <span className="tab-name">
                {unsavedFiles.has(file) && <span className="unsaved-dot">●</span>}
                {file.split('/').pop()}
              </span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="editor-actions">
          <button
            className={`editor-action-btn ${splitView ? 'active' : ''}`}
            onClick={() => setSplitView(!splitView)}
            title="Split View"
          >
            Split
          </button>
          <button className="editor-action-btn" title="Diff View">
            Diff
          </button>
        </div>
      </div>

      {/* File tree sidebar */}
      <div className={`editor-layout ${isResizing ? 'resizing' : ''}`}>
        <div className="file-tree" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div className="file-tree-header">
            <input
              type="text"
              placeholder="Search files..."
              className="file-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="file-tree-content">
            {loading ? (
              <div className="file-tree-loading">Loading files...</div>
            ) : error ? (
              <div className="file-tree-error">{error}</div>
            ) : fileTree.length === 0 ? (
              <div className="file-tree-empty">No files found</div>
            ) : (
              renderFileTree(fileTree)
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />

        {/* Code editor area */}
        <div className="code-editor-container">
          {activeFile ? (
            loadingFile === activeFile ? (
              <div className="editor-loading-state">
                <div className="loading-spinner" />
                <p>Loading {activeFile.split('/').pop()}...</p>
              </div>
            ) : (
              <CodeEditor
                value={fileContents[activeFile] || '// Loading...'}
                onChange={handleFileChange}
                language={activeFile}
                className="editor-main"
              />
            )
          ) : (
            <div className="editor-empty-state">
              <p>Select a file to edit</p>
              <p className="hint">Use the file tree or Cmd+P to open files</p>
            </div>
          )}
        </div>

        {/* Split view (if enabled) */}
        {splitView && (
          <div className="code-editor-container split">
            <div className="editor-empty-state">
              <p>Drag a file here for split view</p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="editor-status-bar">
        {activeFile && (
          <>
            <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
            <span>{getLanguageFromFile(activeFile)}</span>
            <span>UTF-8</span>
            <span>Spaces: 2</span>
          </>
        )}
        <div className="status-bar-right">
          {unsavedFiles.has(activeFile || '') && (
            <button className="save-btn" onClick={handleSave}>Save</button>
          )}
          <button className="commit-btn">Commit</button>
        </div>
      </div>
    </div>
  );
}
