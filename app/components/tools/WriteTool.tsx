'use client';

import ToolCard, { ToolStatus } from './ToolCard';
import CodeBlock from '../code/CodeBlock';

interface WriteToolProps {
  filePath: string;
  content?: string;
  status: ToolStatus;
}

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export default function WriteTool({
  filePath,
  content,
  status,
}: WriteToolProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const lineCount = content ? content.split('\n').length : 0;
  const charCount = content ? content.length : 0;

  return (
    <ToolCard
      tool="Write"
      title={fileName}
      subtitle={lineCount > 0 ? `${lineCount} lines` : undefined}
      status={status}
      defaultExpanded={status === 'success'}
    >
      <div className="write-tool-wrapper">
        {/* Always show file details */}
        <div className="write-tool-details">
          <div className="write-tool-file-row">
            <FileIcon />
            <span className="write-tool-filepath">{filePath}</span>
          </div>
        </div>

        {/* Status-specific content */}
        {status === 'running' && (
          <div className="tool-content-loading">
            <span className="tool-loading-spinner" />
            Writing file contents...
          </div>
        )}

        {status === 'success' && content && (
          <div className="write-tool-content">
            <div className="write-tool-badge">
              <PlusIcon />
              <span className="write-tool-badge-text">New file created</span>
              <span className="write-tool-badge-stats">{lineCount} lines, {charCount.toLocaleString()} characters</span>
            </div>
            <CodeBlock
              code={content}
              fileName={fileName}
              showLineNumbers={true}
              maxLines={20}
            />
          </div>
        )}

        {status === 'success' && !content && (
          <div className="write-tool-empty">
            File written (content not available for preview)
          </div>
        )}

        {status === 'error' && (
          <div className="tool-content-error">
            Failed to write file
          </div>
        )}
      </div>
    </ToolCard>
  );
}
