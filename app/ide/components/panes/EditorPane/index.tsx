'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { useIDEStore } from '../../../stores/ideStore';
import { useIDEContext } from '../../../contexts/IDEContext';
import { useGitHubConnection } from '../../../contexts/ServiceContext';
import { useMobileDetection } from '../../../hooks/useMobileDetection';
import { CodeEditor } from '../../CodeEditor';
import { ideEvents } from '../../../lib/eventBus';
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  FileTypeScriptIcon,
  FileJavaScriptIcon,
  FileCSSIcon,
  FileJSONIcon,
  FileMarkdownIcon,
  FileHTMLIcon,
  FileImageIcon,
  LoadingIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '../../Icons';
import { MarkdownRenderer } from '../../MarkdownRenderer';
import { MobileFileTreeSheet } from '../../mobile/MobileFileTreeSheet';

// Haptic feedback helper
const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const durations = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(durations[style]);
  }
};

// File type detection helpers
function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext);
}

function isBinaryFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const binaryExtensions = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'tar', 'gz', 'rar', '7z',
    'exe', 'dll', 'so', 'dylib',
    'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv',
    'ttf', 'otf', 'woff', 'woff2', 'eot',
  ];
  return binaryExtensions.includes(ext);
}

function isMarkdownFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['md', 'mdx', 'markdown'].includes(ext);
}

function getHighlightLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
    java: 'java', kt: 'kotlin', swift: 'swift',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    php: 'php', html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less',
    json: 'json', jsonc: 'json', xml: 'xml',
    yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', mdx: 'markdown',
    sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
    dockerfile: 'dockerfile', vue: 'html', svelte: 'html',
  };
  return languageMap[ext] || 'plaintext';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

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
  const isMobile = useMobileDetection();
  const { activeFile, openFiles, unsavedFiles, setActiveFile, closeFile, splitView, setSplitView, openFile, markFileUnsaved, markFileSaved, fileTreeCollapsed, setFileTreeCollapsed } = useIDEStore();
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [originalContents, setOriginalContents] = useState<Record<string, string>>({});
  const [rawBase64Contents, setRawBase64Contents] = useState<Record<string, string>>({});
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [renderedMarkdown, setRenderedMarkdown] = useState<string>('');
  const previewCodeRef = useRef<HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarPercent, setSidebarPercent] = useState(30); // 30% default for 30/70 split
  const [isResizing, setIsResizing] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startPercent: number; containerWidth: number } | null>(null);

  // Mobile file tree sheet state
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);

  // Handle sidebar resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = layoutRef.current;
    if (!container) return;

    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startPercent: sidebarPercent,
      containerWidth: container.getBoundingClientRect().width
    };
  }, [sidebarPercent]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startPercent, containerWidth } = resizeRef.current;
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newPercent = Math.max(10, Math.min(80, startPercent + deltaPercent));
      setSidebarPercent(newPercent);
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
          // Start with all folders collapsed
          setExpandedFolders(new Set());
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

      // API returns { type: 'file', file: { content, size } } structure
      const base64Content = data.file?.content || data.content;
      const fileSize = data.file?.size || data.size || 0;

      if (base64Content) {
        // Store raw base64 for images
        setRawBase64Contents(prev => ({ ...prev, [path]: base64Content }));
        setFileSizes(prev => ({ ...prev, [path]: fileSize }));

        // Decode for text files (not images or binary)
        const fileName = path.split('/').pop() || '';
        if (!isImageFile(fileName) && !isBinaryFile(fileName)) {
          const content = atob(base64Content);
          setFileContents(prev => ({ ...prev, [path]: content }));
          setOriginalContents(prev => ({ ...prev, [path]: content }));
        }
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Cmd+B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setFileTreeCollapsed(!fileTreeCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, fileTreeCollapsed, setFileTreeCollapsed]);

  // Syntax highlighting for preview mode
  useEffect(() => {
    if (viewMode === 'preview' && activeFile && previewCodeRef.current && fileContents[activeFile]) {
      const fileName = activeFile.split('/').pop() || '';
      if (!isMarkdownFile(fileName) && !isImageFile(fileName) && !isBinaryFile(fileName)) {
        hljs.highlightElement(previewCodeRef.current);
      }
    }
  }, [viewMode, activeFile, fileContents]);

  // Markdown rendering for preview mode with syntax highlighting
  useEffect(() => {
    if (viewMode === 'preview' && activeFile) {
      const fileName = activeFile.split('/').pop() || '';
      const content = fileContents[activeFile];
      if (isMarkdownFile(fileName) && content) {
        // Create custom renderer for code blocks with syntax highlighting
        const renderer = new marked.Renderer();
        renderer.code = (code: string, lang: string | undefined) => {
          let highlighted = code;
          if (lang && hljs.getLanguage(lang)) {
            try {
              highlighted = hljs.highlight(code, { language: lang }).value;
            } catch {
              // fallback to original
            }
          } else {
            try {
              highlighted = hljs.highlightAuto(code).value;
            } catch {
              // fallback to original
            }
          }
          const langClass = lang ? `language-${lang}` : '';
          return `<pre><code class="hljs ${langClass}">${highlighted}</code></pre>`;
        };

        // Configure marked with custom renderer
        marked.setOptions({
          gfm: true,
          breaks: true,
          renderer,
        });
        const rendered = marked(content);
        if (typeof rendered === 'string') {
          setRenderedMarkdown(rendered);
        } else {
          rendered.then(setRenderedMarkdown);
        }
      }
    }
  }, [viewMode, activeFile, fileContents]);

  const handleFileClick = useCallback((path: string) => {
    if (isMobile) haptic('light');
    openFile(path);
    setActiveFile(path);
    fetchFileContent(path);
  }, [isMobile, openFile, setActiveFile, fetchFileContent]);

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

  const getFileIcon = (filename: string): React.ReactNode => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return <FileTypeScriptIcon size={14} />;
      case 'js':
      case 'jsx':
        return <FileJavaScriptIcon size={14} />;
      case 'css':
      case 'scss':
        return <FileCSSIcon size={14} />;
      case 'json':
        return <FileJSONIcon size={14} />;
      case 'md':
        return <FileMarkdownIcon size={14} />;
      case 'html':
        return <FileHTMLIcon size={14} />;
      case 'svg':
      case 'png':
      case 'jpg':
      case 'gif':
        return <FileImageIcon size={14} />;
      default:
        return <FileIcon size={14} />;
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
              {item.type === 'folder' ? (isExpanded ? <FolderOpenIcon size={14} /> : <FolderIcon size={14} />) : getFileIcon(item.name)}
            </span>
            <span className="file-name">{item.name}</span>
            {isLoading && <span className="file-loading"><LoadingIcon size={12} /></span>}
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
          <div className="view-mode-toggle">
            <button
              className={`editor-action-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
              title="Edit Mode"
            >
              Edit
            </button>
            <button
              className={`editor-action-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              title="Preview Mode"
            >
              Preview
            </button>
          </div>
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

      {/* Mobile file selector - opens file tree sheet */}
      {isMobile && (
        <div className="mobile-file-selector">
          <button
            className="mobile-file-selector-btn"
            onClick={() => {
              haptic('light');
              setIsFileTreeOpen(true);
            }}
          >
            <span className="mobile-file-selector-icon">
              <FolderIcon size={18} />
            </span>
            <span className="mobile-file-selector-path">
              {activeFile ? activeFile.split('/').pop() : 'Select a file...'}
            </span>
            <span className="mobile-file-selector-chevron">
              <ChevronDownIcon size={16} />
            </span>
          </button>
        </div>
      )}

      {/* File tree sidebar */}
      <div ref={layoutRef} className={`editor-layout ${isResizing ? 'resizing' : ''} ${fileTreeCollapsed ? 'sidebar-collapsed' : ''}`}>
        {fileTreeCollapsed ? (
          /* Collapsed sidebar - thin bar with expand button */
          <div className="file-tree-collapsed">
            <button
              className="file-tree-expand-btn"
              onClick={() => setFileTreeCollapsed(false)}
              title="Expand file explorer (Cmd+B)"
            >
              <FolderIcon size={16} />
              <ChevronRightIcon size={12} />
            </button>
          </div>
        ) : (
          /* Expanded sidebar */
          <>
            <div className="file-tree" style={{ width: `${sidebarPercent}%`, minWidth: '100px', maxWidth: '80%' }}>
              <div className="file-tree-header">
                <input
                  type="text"
                  placeholder="Search files..."
                  className="file-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  className="file-tree-collapse-btn"
                  onClick={() => setFileTreeCollapsed(true)}
                  title="Collapse file explorer (Cmd+B)"
                >
                  <ChevronLeftIcon size={14} />
                </button>
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

            {/* Resize handle for file tree */}
            <div
              className="file-tree-resize-handle"
              onMouseDown={handleResizeStart}
              title="Drag to resize"
            />
          </>
        )}

        {/* Code editor area */}
        <div className="code-editor-container">
          {activeFile ? (
            loadingFile === activeFile ? (
              <div className="editor-loading-state">
                <div className="loading-spinner" />
                <p>Loading {activeFile.split('/').pop()}...</p>
              </div>
            ) : (() => {
              const fileName = activeFile.split('/').pop() || '';
              const isImage = isImageFile(fileName);
              const isBinary = isBinaryFile(fileName);
              const isMarkdown = isMarkdownFile(fileName);
              const content = fileContents[activeFile];
              const rawBase64 = rawBase64Contents[activeFile];
              const fileSize = fileSizes[activeFile] || 0;

              // Image preview (always show image, no edit mode for images)
              if (isImage && rawBase64) {
                const ext = fileName.split('.').pop()?.toLowerCase();
                const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                return (
                  <div className="file-preview-container">
                    <div className="file-preview-header">
                      <span className="file-preview-name">{fileName}</span>
                      <span className="file-preview-size">{formatFileSize(fileSize)}</span>
                    </div>
                    <div className="file-preview-image">
                      <img src={`data:image/${mimeType};base64,${rawBase64}`} alt={fileName} />
                    </div>
                  </div>
                );
              }

              // Binary file (no preview or edit)
              if (isBinary) {
                return (
                  <div className="file-preview-container">
                    <div className="file-preview-header">
                      <span className="file-preview-name">{fileName}</span>
                      <span className="file-preview-size">{formatFileSize(fileSize)}</span>
                    </div>
                    <div className="file-preview-binary">
                      <p>Binary file - preview not available</p>
                      <p className="binary-size">{formatFileSize(fileSize)}</p>
                    </div>
                  </div>
                );
              }

              // Preview mode for text files
              if (viewMode === 'preview') {
                const lines = (content || '').split('\n');
                const language = getHighlightLanguage(fileName);

                // Markdown preview with mermaid support
                if (isMarkdown) {
                  return (
                    <div className="file-preview-container">
                      <div className="file-preview-header">
                        <span className="file-preview-name">{fileName}</span>
                        <span className="file-preview-meta">{lines.length} lines · {formatFileSize(fileSize)}</span>
                      </div>
                      <div className="file-preview-markdown">
                        <MarkdownRenderer content={content || ''} />
                      </div>
                    </div>
                  );
                }

                // Syntax-highlighted code preview
                return (
                  <div className="file-preview-container">
                    <div className="file-preview-header">
                      <span className="file-preview-name">{fileName}</span>
                      <span className="file-preview-meta">{lines.length} lines · {formatFileSize(fileSize)}</span>
                    </div>
                    <div className="file-preview-code">
                      <div className="line-numbers">
                        {lines.map((_, i) => (
                          <span key={i} className="line-number">{i + 1}</span>
                        ))}
                      </div>
                      <pre className="code-content">
                        <code ref={previewCodeRef} className={`language-${language}`}>
                          {content || ''}
                        </code>
                      </pre>
                    </div>
                  </div>
                );
              }

              // Edit mode (default)
              return (
                <CodeEditor
                  value={content || '// Loading...'}
                  onChange={handleFileChange}
                  language={activeFile}
                  className="editor-main"
                />
              );
            })()
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

      {/* Mobile file tree bottom sheet */}
      {isMobile && (
        <MobileFileTreeSheet
          isOpen={isFileTreeOpen}
          onClose={() => setIsFileTreeOpen(false)}
          onFileSelect={handleFileClick}
        />
      )}
    </div>
  );
}
