'use client';

import React from 'react';
import type { ToolUseBlock } from '../../types/chat';
import { ReadTool, WriteTool, EditTool, BashTool, GlobTool, GrepTool, TaskTool } from '../tools';

interface ToolCardRendererProps {
  block: ToolUseBlock;
}

export function ToolCardRenderer({ block }: ToolCardRendererProps) {
  const { tool, input, status, output } = block;

  switch (tool) {
    case 'Read':
      return (
        <ReadTool
          filePath={(input.file_path as string) || 'unknown'}
          content={output}
          status={status}
          startLine={input.offset as number}
          endLine={input.limit as number}
        />
      );

    case 'Write':
      return (
        <WriteTool
          filePath={(input.file_path as string) || 'unknown'}
          content={(input.content as string) || output}
          status={status}
        />
      );

    case 'Edit':
      return (
        <EditTool
          filePath={(input.file_path as string) || 'unknown'}
          oldContent={(input.old_string as string) || ''}
          newContent={(input.new_string as string) || ''}
          status={status}
        />
      );

    case 'Bash':
      return (
        <BashTool
          command={(input.command as string) || ''}
          output={output}
          status={status}
          description={input.description as string}
        />
      );

    case 'Glob':
      return (
        <GlobTool
          pattern={(input.pattern as string) || ''}
          path={input.path as string}
          files={output ? output.split('\n').filter(Boolean) : []}
          status={status}
        />
      );

    case 'Grep': {
      // Parse grep output into matches
      const matches = output
        ? output
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const match = line.match(/^(.+?):(\d+):(.*)$/);
              if (match) {
                return { file: match[1], line: parseInt(match[2]), content: match[3] };
              }
              return { file: 'unknown', line: 0, content: line };
            })
        : [];

      return (
        <GrepTool
          pattern={(input.pattern as string) || ''}
          path={input.path as string}
          fileType={input.type as string}
          matches={matches}
          status={status}
        />
      );
    }

    case 'Task':
      return (
        <TaskTool
          description={(input.description as string) || ''}
          agentType={input.subagent_type as string}
          status={status}
          result={output}
        />
      );

    default:
      // Generic tool display
      return (
        <div className="chat-tool-card generic">
          <div className="chat-tool-card-header">
            <span className="chat-tool-card-icon">🔧</span>
            <span className="chat-tool-card-label">{tool}</span>
            <span className={`chat-tool-card-status ${status}`}>{status}</span>
          </div>
          {Object.keys(input).length > 0 && (
            <div className="chat-tool-card-input">
              <pre>{JSON.stringify(input, null, 2)}</pre>
            </div>
          )}
          {output && (
            <div className="chat-tool-card-body">
              <pre>{output}</pre>
            </div>
          )}

          <style jsx>{`
            .chat-tool-card.generic {
              background: var(--bg-secondary, #161b22);
              border-radius: 8px;
              overflow: hidden;
              margin: 0.5rem 0;
              border: 1px solid var(--border-color, #30363d);
            }

            .chat-tool-card-header {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.5rem 0.75rem;
              background: var(--bg-tertiary, #21262d);
              font-size: 0.8rem;
            }

            .chat-tool-card-icon {
              font-size: 1rem;
            }

            .chat-tool-card-label {
              flex: 1;
              font-weight: 500;
              color: var(--text-primary, #c9d1d9);
            }

            .chat-tool-card-status {
              font-size: 0.7rem;
              padding: 2px 6px;
              border-radius: 4px;
              text-transform: capitalize;
            }

            .chat-tool-card-status.running {
              background: rgba(88, 166, 255, 0.15);
              color: #58a6ff;
            }

            .chat-tool-card-status.success {
              background: rgba(63, 185, 80, 0.15);
              color: #3fb950;
            }

            .chat-tool-card-status.error {
              background: rgba(248, 81, 73, 0.15);
              color: #f85149;
            }

            .chat-tool-card-input,
            .chat-tool-card-body {
              padding: 0.5rem 0.75rem;
              font-size: 0.8rem;
              border-top: 1px solid var(--border-color, #30363d);
            }

            .chat-tool-card-input pre,
            .chat-tool-card-body pre {
              margin: 0;
              font-family: 'JetBrains Mono', 'Fira Code', monospace;
              font-size: 0.75rem;
              white-space: pre-wrap;
              word-break: break-all;
              color: var(--text-secondary, #8b949e);
              max-height: 200px;
              overflow-y: auto;
            }
          `}</style>
        </div>
      );
  }
}

export default ToolCardRenderer;
