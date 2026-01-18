'use client';

import ToolCard, { ToolStatus } from './ToolCard';
import CodeBlock from '../code/CodeBlock';

interface WriteToolProps {
  filePath: string;
  content?: string;
  status: ToolStatus;
}

export default function WriteTool({
  filePath,
  content,
  status,
}: WriteToolProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <ToolCard
      tool="Write"
      title={filePath}
      subtitle={lineCount > 0 ? `${lineCount} lines` : undefined}
      status={status}
      defaultExpanded={status === 'success'}
    >
      {status === 'running' && (
        <div className="tool-content-loading">
          Writing file...
        </div>
      )}
      {status === 'success' && content && (
        <div className="write-tool-content">
          <div className="write-tool-badge">
            <span className="write-tool-badge-icon">+</span>
            New file created
          </div>
          <CodeBlock
            code={content}
            fileName={fileName}
            showLineNumbers={true}
            maxLines={20}
          />
        </div>
      )}
      {status === 'error' && (
        <div className="tool-content-error">
          Failed to write file
        </div>
      )}
    </ToolCard>
  );
}
