'use client';

import { getFileIcon } from './fileIcons';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

interface FileTreeItemProps {
  node: TreeNode;
  currentPath: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string, isFile?: boolean) => void;
  depth: number;
}

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export default function FileTreeItem({
  node,
  currentPath,
  expandedPaths,
  onToggle,
  onNavigate,
  depth,
}: FileTreeItemProps) {
  const isDirectory = node.type === 'dir';
  const isExpanded = expandedPaths.has(node.path);
  const isActive = currentPath === node.path;
  const isInActivePath = currentPath.startsWith(node.path + '/');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      onToggle(node.path);
      onNavigate(node.path, false);
    } else {
      onNavigate(node.path, true);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.path);
  };

  return (
    <li className="file-tree-item">
      <div
        className={`file-tree-item-row ${isActive ? 'active' : ''} ${isInActivePath ? 'in-path' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory ? (
          <button className="file-tree-toggle" onClick={handleToggle}>
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
        ) : (
          <span className="file-tree-toggle-spacer" />
        )}
        <span className="file-tree-icon">{getFileIcon(node.name, isDirectory)}</span>
        <span className="file-tree-name">{node.name}</span>
      </div>
      {isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <ul className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              currentPath={currentPath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
