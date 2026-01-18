'use client';

import ToolCard, { ToolStatus } from './ToolCard';

interface TaskToolProps {
  description: string;
  agentType?: string;
  status: ToolStatus;
  result?: string;
}

export default function TaskTool({
  description,
  agentType,
  status,
  result,
}: TaskToolProps) {
  return (
    <ToolCard
      tool="Task"
      title={description}
      subtitle={agentType ? `Agent: ${agentType}` : undefined}
      status={status}
      defaultExpanded={true}
    >
      {status === 'running' && (
        <div className="task-tool-running">
          <div className="task-tool-status">
            <span className="task-tool-spinner" />
            Agent is working...
          </div>
        </div>
      )}
      {status === 'success' && result && (
        <div className="task-tool-result">
          <pre>{result}</pre>
        </div>
      )}
      {status === 'error' && (
        <div className="tool-content-error">
          Task failed
        </div>
      )}
    </ToolCard>
  );
}
