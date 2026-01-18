'use client';

import ToolCard, { ToolStatus } from './ToolCard';

interface TaskToolProps {
  description: string;
  agentType?: string;
  status: ToolStatus;
  result?: string;
}

const RobotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/>
    <line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const TaskIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function TaskTool({
  description,
  agentType,
  status,
  result,
}: TaskToolProps) {
  return (
    <ToolCard
      tool="Task"
      title={description.length > 50 ? description.substring(0, 50) + '...' : description}
      subtitle={agentType ? agentType : undefined}
      status={status}
      defaultExpanded={true}
    >
      <div className="task-tool-content">
        {/* Always show task details */}
        <div className="task-tool-details">
          <div className="task-tool-description-row">
            <TaskIcon />
            <span className="task-tool-label">Task:</span>
            <span className="task-tool-description">{description}</span>
          </div>
          {agentType && (
            <div className="task-tool-agent-row">
              <RobotIcon />
              <span className="task-tool-label">Agent:</span>
              <span className="task-tool-agent-type">{agentType}</span>
            </div>
          )}
        </div>

        {/* Status-specific content */}
        {status === 'running' && (
          <div className="task-tool-running">
            <div className="task-tool-status">
              <span className="task-tool-spinner" />
              <span className="task-tool-status-text">
                {agentType ? `${agentType} agent is working...` : 'Agent is working...'}
              </span>
            </div>
          </div>
        )}

        {status === 'success' && result && (
          <div className="task-tool-result">
            <div className="task-tool-result-header">
              <span className="task-tool-result-label">Result:</span>
            </div>
            <pre className="task-tool-result-content">{result}</pre>
          </div>
        )}

        {status === 'success' && !result && (
          <div className="task-tool-empty">
            Task completed (no output returned)
          </div>
        )}

        {status === 'error' && (
          <div className="tool-content-error">
            Task failed
          </div>
        )}
      </div>
    </ToolCard>
  );
}
