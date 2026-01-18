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

export default function EditTool({
  filePath,
  oldContent,
  newContent,
  status,
  description,
}: EditToolProps) {
  const fileName = filePath.split('/').pop() || filePath;

  return (
    <ToolCard
      tool="Edit"
      title={filePath}
      subtitle={description}
      status={status}
      defaultExpanded={status === 'success'}
    >
      {status === 'running' && (
        <div className="tool-content-loading">
          Applying changes...
        </div>
      )}
      {status === 'success' && (
        <DiffView
          oldContent={oldContent}
          newContent={newContent}
          fileName={fileName}
        />
      )}
      {status === 'error' && (
        <div className="tool-content-error">
          Failed to edit file
        </div>
      )}
    </ToolCard>
  );
}
