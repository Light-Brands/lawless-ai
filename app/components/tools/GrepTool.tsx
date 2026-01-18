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

export default function GrepTool({
  pattern,
  matches = [],
  status,
  path,
  fileType,
}: GrepToolProps) {
  let subtitle = '';
  if (path) subtitle += `in ${path}`;
  if (fileType) subtitle += subtitle ? `, ${fileType} files` : `${fileType} files`;

  const matchCount = matches.length;

  // Group matches by file
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.file]) {
      acc[match.file] = [];
    }
    acc[match.file].push(match);
    return acc;
  }, {} as Record<string, GrepMatch[]>);

  return (
    <ToolCard
      tool="Grep"
      title={pattern}
      subtitle={subtitle || undefined}
      status={status}
      defaultExpanded={status === 'success' && matchCount > 0}
    >
      {status === 'running' && (
        <div className="tool-content-loading">
          Searching content...
        </div>
      )}
      {status === 'success' && (
        <div className="grep-tool-content">
          <div className="grep-tool-count">
            {matchCount} match{matchCount !== 1 ? 'es' : ''} in {Object.keys(groupedMatches).length} file{Object.keys(groupedMatches).length !== 1 ? 's' : ''}
          </div>
          {matchCount > 0 && (
            <div className="grep-tool-results">
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
