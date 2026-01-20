'use client';

import React from 'react';
import type { ThinkingBlock } from '../../types/chat';

interface ThinkingBlockRendererProps {
  block: ThinkingBlock;
  onToggle: () => void;
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 200ms',
    }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function ThinkingBlockRenderer({ block, onToggle }: ThinkingBlockRendererProps) {
  return (
    <div className={`thinking-block ${block.collapsed ? 'collapsed' : ''}`}>
      <button className="thinking-block-header" onClick={onToggle}>
        <span className="thinking-block-icon">💭</span>
        <span className="thinking-block-label">Thinking</span>
        <ChevronIcon expanded={!block.collapsed} />
      </button>
      {!block.collapsed && (
        <div className="thinking-block-content">{block.content}</div>
      )}

      <style jsx>{`
        .thinking-block {
          background: var(--bg-secondary, #161b22);
          border-radius: 8px;
          overflow: hidden;
          margin: 0.5rem 0;
        }

        .thinking-block-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: transparent;
          border: none;
          color: var(--text-secondary, #8b949e);
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .thinking-block-header:hover {
          background: var(--bg-tertiary, #21262d);
        }

        .thinking-block-icon {
          font-size: 1rem;
        }

        .thinking-block-label {
          flex: 1;
          text-align: left;
        }

        .thinking-block-content {
          padding: 0.75rem;
          font-size: 0.85rem;
          color: var(--text-secondary, #8b949e);
          white-space: pre-wrap;
          border-top: 1px solid var(--border-color, #30363d);
          max-height: 300px;
          overflow-y: auto;
        }

        .thinking-block.collapsed .thinking-block-content {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default ThinkingBlockRenderer;
