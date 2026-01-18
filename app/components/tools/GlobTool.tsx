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

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

export default function GlobTool({
  pattern,
  files = [],
  status,
  path,
}: GlobToolProps) {
  const matchCount = files.length;

  return (
    <ToolCard
      tool="Glob"
      title={pattern}
      subtitle={matchCount > 0 ? `${matchCount} files` : undefined}
      status={status}
      defaultExpanded={status === 'success' && matchCount > 0}
    >
      <div className="glob-tool-content">
        {/* Always show search details */}
        <div className="glob-tool-details">
          <div className="glob-tool-search-info">
            <div className="glob-tool-pattern-row">
              <SearchIcon />
              <span className="glob-tool-label">Pattern:</span>
              <code className="glob-tool-pattern-value">{pattern}</code>
            </div>
            {path && (
              <div className="glob-tool-path-row">
                <FolderIcon />
                <span className="glob-tool-label">Directory:</span>
                <span className="glob-tool-path-value">{path}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status-specific content */}
        {status === 'running' && (
          <div className="tool-content-loading">
            <span className="tool-loading-spinner" />
            Searching for matching files...
          </div>
        )}

        {status === 'success' && (
          <div className="glob-tool-results">
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
            {matchCount === 0 && (
              <div className="glob-tool-empty">
                No files match the pattern
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="tool-content-error">
            Search failed
          </div>
        )}
      </div>
    </ToolCard>
  );
}
