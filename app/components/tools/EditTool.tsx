'use client';

import ToolCard, { ToolStatus } from './ToolCard';
import DiffView from '../code/DiffView';

interface EditToolProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  status: ToolStatus;
  description?: string;
}

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

export default function EditTool({
  filePath,
  oldContent,
  newContent,
  status,
  description,
}: EditToolProps) {
  const fileName = filePath.split('/').pop() || filePath;

  // Calculate diff stats
  const oldLines = oldContent ? oldContent.split('\n').length : 0;
  const newLines = newContent ? newContent.split('\n').length : 0;
  const linesDiff = newLines - oldLines;

  return (
    <ToolCard
      tool="Edit"
      title={fileName}
      subtitle={linesDiff !== 0 ? `${linesDiff > 0 ? '+' : ''}${linesDiff} lines` : undefined}
      status={status}
      defaultExpanded={status === 'success'}
    >
      <div className="edit-tool-content">
        {/* Always show file details */}
        <div className="edit-tool-details">
          <div className="edit-tool-file-row">
            <FileIcon />
            <span className="edit-tool-filepath">{filePath}</span>
          </div>
          {description && (
            <div className="edit-tool-description-row">
              <EditIcon />
              <span className="edit-tool-description">{description}</span>
            </div>
          )}
        </div>

        {/* Status-specific content */}
        {status === 'running' && (
          <div className="tool-content-loading">
            <span className="tool-loading-spinner" />
            Applying changes to file...
          </div>
        )}

        {status === 'success' && oldContent && newContent && (
          <div className="edit-tool-diff">
            <div className="edit-tool-diff-header">
              <span className="edit-tool-diff-label">Changes:</span>
              <span className="edit-tool-diff-stats">
                <span className="edit-tool-additions">+{newLines}</span>
                <span className="edit-tool-deletions">-{oldLines}</span>
              </span>
            </div>
            <DiffView
              oldContent={oldContent}
              newContent={newContent}
              fileName={fileName}
            />
          </div>
        )}

        {status === 'success' && (!oldContent || !newContent) && (
          <div className="edit-tool-no-diff">
            Edit completed (diff not available)
          </div>
        )}

        {status === 'error' && (
          <div className="tool-content-error">
            Failed to edit file
          </div>
        )}
      </div>
    </ToolCard>
  );
}
