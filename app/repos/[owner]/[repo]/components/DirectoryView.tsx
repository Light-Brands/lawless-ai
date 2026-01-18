'use client';

import { getFileIcon } from './fileIcons';

interface ContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
}

interface DirectoryViewProps {
  contents: ContentItem[];
  currentPath: string;
  onNavigate: (path: string, isFile?: boolean) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export default function DirectoryView({
  contents,
  currentPath,
  onNavigate,
}: DirectoryViewProps) {
  const handleItemClick = (item: ContentItem) => {
    onNavigate(item.path, item.type === 'file');
  };

  if (contents.length === 0) {
    return (
      <div className="directory-view-empty">
        <p>This directory is empty</p>
      </div>
    );
  }

  return (
    <div className="directory-view">
      <table className="directory-table">
        <thead>
          <tr>
            <th className="directory-th-name">Name</th>
            <th className="directory-th-size">Size</th>
          </tr>
        </thead>
        <tbody>
          {currentPath && (
            <tr
              className="directory-row directory-row-parent"
              onClick={() => {
                const parentPath = currentPath.split('/').slice(0, -1).join('/');
                onNavigate(parentPath, false);
              }}
            >
              <td className="directory-cell-name">
                <span className="directory-icon">
                  {getFileIcon('..', true)}
                </span>
                <span className="directory-name">..</span>
              </td>
              <td className="directory-cell-size">-</td>
            </tr>
          )}
          {contents.map((item) => (
            <tr
              key={item.path}
              className={`directory-row ${item.type === 'dir' ? 'directory-row-folder' : 'directory-row-file'}`}
              onClick={() => handleItemClick(item)}
            >
              <td className="directory-cell-name">
                <span className="directory-icon">
                  {getFileIcon(item.name, item.type === 'dir')}
                </span>
                <span className="directory-name">{item.name}</span>
              </td>
              <td className="directory-cell-size">
                {item.type === 'file' ? formatSize(item.size) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
