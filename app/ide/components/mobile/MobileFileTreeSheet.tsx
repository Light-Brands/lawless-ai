'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import { useIDEContext } from '../../contexts/IDEContext';
import { useGitHubConnection } from '../../contexts/ServiceContext';
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
  ChevronRightIcon,
  SearchIcon,
  CloseIcon,
} from '../Icons';

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
}

interface ApiTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: ApiTreeNode[];
}

function convertApiTree(nodes: ApiTreeNode[]): FileTreeItem[] {
  return nodes.map(node => ({
    name: node.name,
    path: node.path,
    type: node.type === 'dir' ? 'folder' : 'file',
    children: node.children ? convertApiTree(node.children) : undefined,
  }));
}

interface MobileFileTreeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (path: string) => void;
}

export function MobileFileTreeSheet({ isOpen, onClose, onFileSelect }: MobileFileTreeSheetProps) {
  const { owner, repo } = useIDEContext();
  const github = useGitHubConnection();
  const { activeFile } = useIDEStore();

  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch file tree
  useEffect(() => {
    if (!isOpen || !owner || !repo) return;
    if (github.status !== 'connected') return;
    if (fileTree.length > 0) return; // Already loaded

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
        }
      } catch (err) {
        console.error('Failed to fetch tree:', err);
        setError('Failed to load files');
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [isOpen, owner, repo, github.status, fileTree.length]);

  // Auto-expand folders containing active file
  useEffect(() => {
    if (activeFile && fileTree.length > 0) {
      const parts = activeFile.split('/');
      const foldersToExpand = new Set<string>();
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        foldersToExpand.add(currentPath);
      }
      setExpandedFolders(prev => new Set([...prev, ...foldersToExpand]));
    }
  }, [activeFile, fileTree]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleFileClick = useCallback((path: string) => {
    onFileSelect(path);
    onClose();
  }, [onFileSelect, onClose]);

  const getFileIcon = (filename: string): React.ReactNode => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const size = 16;
    switch (ext) {
      case 'ts':
      case 'tsx':
        return <FileTypeScriptIcon size={size} />;
      case 'js':
      case 'jsx':
        return <FileJavaScriptIcon size={size} />;
      case 'css':
      case 'scss':
        return <FileCSSIcon size={size} />;
      case 'json':
        return <FileJSONIcon size={size} />;
      case 'md':
        return <FileMarkdownIcon size={size} />;
      case 'html':
        return <FileHTMLIcon size={size} />;
      case 'svg':
      case 'png':
      case 'jpg':
      case 'gif':
        return <FileImageIcon size={size} />;
      default:
        return <FileIcon size={size} />;
    }
  };

  const filterTree = (items: FileTreeItem[], query: string): FileTreeItem[] => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();

    return items.reduce<FileTreeItem[]>((acc, item) => {
      if (item.type === 'folder' && item.children) {
        const filteredChildren = filterTree(item.children, query);
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren });
        }
      } else if (item.name.toLowerCase().includes(lowerQuery)) {
        acc.push(item);
      }
      return acc;
    }, []);
  };

  const renderFileTree = (items: FileTreeItem[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const isActive = activeFile === item.path;

      return (
        <React.Fragment key={item.path}>
          <button
            className={`mobile-file-tree-item ${item.type} ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: `${16 + depth * 20}px` }}
            onClick={() => item.type === 'folder' ? toggleFolder(item.path) : handleFileClick(item.path)}
          >
            {item.type === 'folder' && (
              <span className={`folder-arrow ${isExpanded ? 'expanded' : ''}`}>
                <ChevronRightIcon size={12} />
              </span>
            )}
            <span className="file-icon">
              {item.type === 'folder'
                ? (isExpanded ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />)
                : getFileIcon(item.name)
              }
            </span>
            <span className="file-name">{item.name}</span>
          </button>
          {item.type === 'folder' && isExpanded && item.children && (
            <div className="folder-children">
              {renderFileTree(item.children, depth + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  const filteredTree = filterTree(fileTree, searchQuery);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="mobile-sheet-backdrop" onClick={onClose} />

      {/* Sheet */}
      <div className="mobile-file-tree-sheet">
        {/* Header */}
        <div className="mobile-sheet-header">
          <div className="mobile-sheet-handle" />
          <div className="mobile-sheet-title-row">
            <h3>Files</h3>
            <button className="mobile-sheet-close" onClick={onClose}>
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mobile-file-search">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {/* File tree */}
        <div className="mobile-file-tree-content">
          {loading ? (
            <div className="mobile-file-tree-loading">
              <LoadingIcon size={24} />
              <p>Loading files...</p>
            </div>
          ) : error ? (
            <div className="mobile-file-tree-error">
              <p>{error}</p>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="mobile-file-tree-empty">
              <p>{searchQuery ? 'No files match your search' : 'No files found'}</p>
            </div>
          ) : (
            renderFileTree(filteredTree)
          )}
        </div>
      </div>
    </>
  );
}
