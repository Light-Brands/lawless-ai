'use client';

import ToolCard, { ToolStatus } from './ToolCard';
import CodeBlock from '../code/CodeBlock';

interface ReadToolProps {
  filePath: string;
  content?: string;
  status: ToolStatus;
  lineCount?: number;
  startLine?: number;
  endLine?: number;
}

export default function ReadTool({
  filePath,
  content,
  status,
  lineCount,
  startLine,
  endLine,
}: ReadToolProps) {
  const fileName = filePath.split('/').pop() || filePath;

  // Build subtitle with line info
  let subtitle = '';
  if (startLine && endLine) {
    subtitle = `Lines ${startLine}-${endLine}`;
  } else if (lineCount) {
    subtitle = `${lineCount} lines`;
  }

  return (
    <ToolCard
      tool="Read"
      title={filePath}
      subtitle={subtitle}
      status={status}
      defaultExpanded={status === 'success'}
    >
      {status === 'running' && (
        <div className="tool-content-loading">
          Reading file...
        </div>
      )}
      {status === 'success' && content && (
        <CodeBlock
          code={content}
          fileName={fileName}
          startLine={startLine || 1}
          showLineNumbers={true}
          maxLines={25}
        />
      )}
      {status === 'error' && (
        <div className="tool-content-error">
          Failed to read file
        </div>
      )}
    </ToolCard>
  );
}
