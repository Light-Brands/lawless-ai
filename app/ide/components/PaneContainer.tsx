'use client';

import React from 'react';

interface PaneContainerProps {
  id: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onCollapse: () => void;
  headerActions?: React.ReactNode;
}

export function PaneContainer({
  id,
  title,
  icon,
  children,
  onCollapse,
  headerActions,
}: PaneContainerProps) {
  return (
    <div className="pane-container">
      <div className="pane-header">
        <div className="pane-title">
          <span className="pane-icon">{icon}</span>
          <span className="pane-name">{title}</span>
        </div>
        <div className="pane-actions">
          {headerActions}
          <button
            className="pane-collapse-btn"
            onClick={onCollapse}
            title={`Collapse ${title} (Cmd+${id})`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5l3 3 3-3" />
            </svg>
          </button>
        </div>
      </div>
      <div className="pane-content">
        {children}
      </div>
    </div>
  );
}
