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

// File icon component
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

export default function ReadTool({
  filePath,
  content,
  status,
  lineCount,
  startLine,
  endLine,
}: ReadToolProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';

  // Build subtitle with line info
  let subtitle = '';
  if (startLine && endLine) {
    subtitle = `Lines ${startLine}-${endLine}`;
  } else if (lineCount) {
    subtitle = `${lineCount} lines`;
  }

  // Count lines in content
  const contentLineCount = content ? content.split('\n').length : 0;

  return (
    <ToolCard
      tool="Read"
      title={fileName}
      subtitle={subtitle}
      status={status}
      defaultExpanded={status === 'success'}
    >
      <div className="read-tool-content">
        {/* Always show file details */}
        <div className="read-tool-details">
          <div className="read-tool-path">
            <FileIcon />
            <span className="read-tool-filepath">{filePath}</span>
          </div>
          {startLine && endLine && (
            <div className="read-tool-range">
              Reading lines {startLine} to {endLine}
            </div>
          )}
        </div>

        {/* Status-specific content */}
        {status === 'running' && (
          <div className="tool-content-loading">
            <span className="tool-loading-spinner" />
            Reading file contents...
          </div>
        )}

        {status === 'success' && content && (
          <div className="read-tool-result">
            <div className="read-tool-stats">
              {contentLineCount} line{contentLineCount !== 1 ? 's' : ''} read
            </div>
            <CodeBlock
              code={content}
              fileName={fileName}
              startLine={startLine || 1}
              showLineNumbers={true}
              maxLines={25}
            />
          </div>
        )}

        {status === 'success' && !content && (
          <div className="read-tool-empty">
            File is empty or content not available
          </div>
        )}

        {status === 'error' && (
          <div className="tool-content-error">
            Failed to read file
          </div>
        )}
      </div>
    </ToolCard>
  );
}
