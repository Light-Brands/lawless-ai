'use client';

import ToolCard, { ToolStatus } from './ToolCard';

interface GlobToolProps {
  pattern: string;
  files?: string[];
  status: ToolStatus;
  path?: string;
}

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

export default function GlobTool({
  pattern,
  files = [],
  status,
  path,
}: GlobToolProps) {
  const subtitle = path ? `in ${path}` : undefined;
  const matchCount = files.length;

  return (
    <ToolCard
      tool="Glob"
      title={pattern}
      subtitle={subtitle}
      status={status}
      defaultExpanded={status === 'success' && matchCount > 0}
    >
      {status === 'running' && (
        <div className="tool-content-loading">
          Searching for files...
        </div>
      )}
      {status === 'success' && (
        <div className="glob-tool-content">
          <div className="glob-tool-count">
            {matchCount} file{matchCount !== 1 ? 's' : ''} found
          </div>
          {matchCount > 0 && (
            <div className="glob-tool-files">
              {files.map((file, idx) => (
                <div key={idx} className="glob-tool-file">
                  <FileIcon />
                  <span className="glob-tool-filepath">{file}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {status === 'error' && (
        <div className="tool-content-error">
          Search failed
        </div>
      )}
    </ToolCard>
  );
}
