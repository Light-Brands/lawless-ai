'use client';

import ToolCard, { ToolStatus } from './ToolCard';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

interface GrepToolProps {
  pattern: string;
  matches?: GrepMatch[];
  status: ToolStatus;
  path?: string;
  fileType?: string;
}

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const FileTypeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);

export default function GrepTool({
  pattern,
  matches = [],
  status,
  path,
  fileType,
}: GrepToolProps) {
  const matchCount = matches.length;

  // Group matches by file
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.file]) {
      acc[match.file] = [];
    }
    acc[match.file].push(match);
    return acc;
  }, {} as Record<string, GrepMatch[]>);

  const fileCount = Object.keys(groupedMatches).length;

  return (
    <ToolCard
      tool="Grep"
      title={pattern}
      subtitle={matchCount > 0 ? `${matchCount} matches` : undefined}
      status={status}
      defaultExpanded={status === 'success' && matchCount > 0}
    >
      <div className="grep-tool-content">
        {/* Always show search details */}
        <div className="grep-tool-details">
          <div className="grep-tool-search-info">
            <div className="grep-tool-pattern-row">
              <SearchIcon />
              <span className="grep-tool-label">Pattern:</span>
              <code className="grep-tool-pattern-value">{pattern}</code>
            </div>
            {path && (
              <div className="grep-tool-path-row">
                <FolderIcon />
                <span className="grep-tool-label">Directory:</span>
                <span className="grep-tool-path-value">{path}</span>
              </div>
            )}
            {fileType && (
              <div className="grep-tool-type-row">
                <FileTypeIcon />
                <span className="grep-tool-label">File type:</span>
                <span className="grep-tool-type-value">{fileType}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status-specific content */}
        {status === 'running' && (
          <div className="tool-content-loading">
            <span className="tool-loading-spinner" />
            Searching file contents...
          </div>
        )}

        {status === 'success' && (
          <div className="grep-tool-results">
            <div className="grep-tool-count">
              {matchCount} match{matchCount !== 1 ? 'es' : ''} in {fileCount} file{fileCount !== 1 ? 's' : ''}
            </div>
            {matchCount > 0 && (
              <div className="grep-tool-file-groups">
                {Object.entries(groupedMatches).map(([file, fileMatches]) => (
                  <div key={file} className="grep-tool-file-group">
                    <div className="grep-tool-filename">{file}</div>
                    <div className="grep-tool-matches">
                      {fileMatches.map((match, idx) => (
                        <div key={idx} className="grep-tool-match">
                          <span className="grep-tool-line-num">{match.line}</span>
                          <span className="grep-tool-line-content">{match.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {matchCount === 0 && (
              <div className="grep-tool-empty">
                No matches found for this pattern
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
