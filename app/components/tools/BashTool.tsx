'use client';

import ToolCard, { ToolStatus } from './ToolCard';

interface BashToolProps {
  command: string;
  output?: string;
  status: ToolStatus;
  exitCode?: number;
  description?: string;
}

export default function BashTool({
  command,
  output,
  status,
  exitCode,
  description,
}: BashToolProps) {
  return (
    <ToolCard
      tool="Bash"
      title={command.length > 60 ? command.substring(0, 60) + '...' : command}
      subtitle={description}
      status={status}
      defaultExpanded={true}
    >
      <div className="bash-tool-content">
        <div className="bash-tool-command">
          <span className="bash-tool-prompt">$</span>
          <code className="bash-tool-cmd">{command}</code>
        </div>
        {status === 'running' && (
          <div className="bash-tool-running">
            <span className="bash-tool-cursor" />
          </div>
        )}
        {output && (
          <div className="bash-tool-output">
            <pre>{output}</pre>
          </div>
        )}
        {status === 'success' && exitCode !== undefined && exitCode !== 0 && (
          <div className="bash-tool-exit-code warning">
            Exit code: {exitCode}
          </div>
        )}
        {status === 'error' && (
          <div className="bash-tool-exit-code error">
            Command failed
          </div>
        )}
      </div>
    </ToolCard>
  );
}
