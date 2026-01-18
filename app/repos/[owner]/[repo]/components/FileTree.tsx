'use client';

import { useState } from 'react';
import FileTreeItem from './FileTreeItem';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  currentPath: string;
  onNavigate: (path: string, isFile?: boolean) => void;
}

export default function FileTree({ tree, currentPath, onNavigate }: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Auto-expand paths leading to current path
    const expanded = new Set<string>();
    if (currentPath) {
      const parts = currentPath.split('/');
      let path = '';
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        expanded.add(path);
      }
    }
    return expanded;
  });

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (!tree || tree.length === 0) {
    return (
      <div className="file-tree-empty">
        <span>No files found</span>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <ul className="file-tree-list">
        {tree.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            currentPath={currentPath}
            expandedPaths={expandedPaths}
            onToggle={toggleExpanded}
            onNavigate={onNavigate}
            depth={0}
          />
        ))}
      </ul>
    </div>
  );
}
