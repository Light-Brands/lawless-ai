'use client';

import { useState, ReactNode } from 'react';

export type ToolType = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'Task' | 'TodoWrite';
export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

interface ToolCardProps {
  tool: ToolType;
  title: string;
  subtitle?: string;
  status: ToolStatus;
  defaultExpanded?: boolean;
  children: ReactNode;
}

const toolIcons: Record<ToolType, string> = {
  Read: '📖',
  Write: '📝',
  Edit: '✏️',
  Bash: '💻',
  Glob: '🔍',
  Grep: '🔎',
  Task: '🤖',
  TodoWrite: '📋',
};

const toolLabels: Record<ToolType, string> = {
  Read: 'Read',
  Write: 'Write',
  Edit: 'Edit',
  Bash: 'Bash',
  Glob: 'Glob',
  Grep: 'Grep',
  Task: 'Task',
  TodoWrite: 'Todo',
};

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 200ms ease',
    }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function StatusIndicator({ status }: { status: ToolStatus }) {
  return (
    <span className={`tool-card-status ${status}`}>
      {status === 'running' && <span className="tool-card-spinner" />}
      {status === 'success' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {status === 'error' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </span>
  );
}

export default function ToolCard({
  tool,
  title,
  subtitle,
  status,
  defaultExpanded = true,
  children,
}: ToolCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`tool-card ${status} ${expanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="tool-card-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="tool-card-header-left">
          <span className="tool-card-icon">{toolIcons[tool]}</span>
          <span className="tool-card-label">{toolLabels[tool]}</span>
          <StatusIndicator status={status} />
        </div>
        <div className="tool-card-header-right">
          <span className="tool-card-title">{title}</span>
          {subtitle && <span className="tool-card-subtitle">{subtitle}</span>}
          <ChevronIcon expanded={expanded} />
        </div>
      </button>
      {expanded && (
        <div className="tool-card-body">
          {children}
        </div>
      )}
    </div>
  );
}
