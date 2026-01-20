'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  type DictionaryItem,
  commandDictionary,
  categories,
  agentColorMap,
} from '../../data/command-dictionary';

interface QuickCommandsProps {
  onSelect: (item: DictionaryItem) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// Icons
const CommandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 16 4-4-4-4"/>
    <path d="m6 8-4 4 4 4"/>
    <path d="m14.5 4-5 16"/>
  </svg>
);

const SkillIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    <path d="M20 3v4"/>
    <path d="M22 5h-4"/>
  </svg>
);

const AgentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/>
    <rect width="16" height="12" x="4" y="8" rx="2"/>
    <path d="M2 14h2"/>
    <path d="M20 14h2"/>
    <path d="M15 13v2"/>
    <path d="M9 13v2"/>
  </svg>
);

const ChevronUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

type TabType = 'commands' | 'skills' | 'agents';

export function QuickCommands({ onSelect, isExpanded, onToggleExpand }: QuickCommandsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('commands');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Group items by type
  const itemsByType = useMemo(() => {
    const result: Record<TabType, DictionaryItem[]> = {
      commands: [],
      skills: [],
      agents: [],
    };

    commandDictionary.forEach(item => {
      if (item.type === 'command') result.commands.push(item);
      else if (item.type === 'skill') result.skills.push(item);
      else if (item.type === 'agent') result.agents.push(item);
    });

    return result;
  }, []);

  // Get categories for current tab
  const currentCategories = useMemo(() => {
    if (activeTab === 'commands') return categories.commands;
    if (activeTab === 'skills') return categories.skills;
    return categories.agents;
  }, [activeTab]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    const items = itemsByType[activeTab];
    if (!activeCategory) return items;
    return items.filter(item => item.category === activeCategory);
  }, [itemsByType, activeTab, activeCategory]);

  const handleItemClick = useCallback((item: DictionaryItem) => {
    onSelect(item);
  }, [onSelect]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setActiveCategory(null);
  }, []);

  return (
    <div className="quick-commands">
      {/* Toggle bar */}
      <button className="quick-commands-toggle" onClick={onToggleExpand}>
        <span className="toggle-label">
          {isExpanded ? 'Hide' : 'Show'} Commands
        </span>
        <span className="toggle-stats">
          <span className="stat">{itemsByType.commands.length} cmds</span>
          <span className="stat-sep">·</span>
          <span className="stat">{itemsByType.skills.length} skills</span>
          <span className="stat-sep">·</span>
          <span className="stat">{itemsByType.agents.length} agents</span>
        </span>
        {isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />}
      </button>

      {isExpanded && (
        <div className="quick-commands-content">
          {/* Tabs */}
          <div className="quick-commands-tabs">
            <button
              className={`quick-tab ${activeTab === 'commands' ? 'active' : ''}`}
              onClick={() => handleTabChange('commands')}
            >
              <CommandIcon />
              <span>Commands</span>
              <span className="tab-count">{itemsByType.commands.length}</span>
            </button>
            <button
              className={`quick-tab ${activeTab === 'skills' ? 'active' : ''}`}
              onClick={() => handleTabChange('skills')}
            >
              <SkillIcon />
              <span>Skills</span>
              <span className="tab-count">{itemsByType.skills.length}</span>
            </button>
            <button
              className={`quick-tab ${activeTab === 'agents' ? 'active' : ''}`}
              onClick={() => handleTabChange('agents')}
            >
              <AgentIcon />
              <span>Agents</span>
              <span className="tab-count">{itemsByType.agents.length}</span>
            </button>
          </div>

          {/* Category filters */}
          <div className="quick-commands-categories">
            <button
              className={`category-pill ${!activeCategory ? 'active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {currentCategories.map(cat => (
              <button
                key={cat}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="quick-commands-grid">
            {filteredItems.map(item => {
              const agentColor = item.color ? agentColorMap[item.color] : undefined;
              const prefix = item.type === 'agent' ? '@' : '/';

              return (
                <button
                  key={item.name}
                  className="quick-command-item"
                  onClick={() => handleItemClick(item)}
                  style={agentColor ? { '--item-color': agentColor } as React.CSSProperties : undefined}
                  title={item.description}
                >
                  {agentColor && (
                    <span className="item-color-dot" style={{ background: agentColor }} />
                  )}
                  <span className="item-prefix">{prefix}</span>
                  <span className="item-name">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .quick-commands {
          border-top: 1px solid var(--border-color, #2a2a2f);
          background: var(--bg-secondary, #141417);
        }

        .quick-commands-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: transparent;
          border: none;
          color: var(--text-secondary, #888);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .quick-commands-toggle:hover {
          background: var(--bg-tertiary, #1a1a1f);
          color: var(--text-primary, #fff);
        }

        .toggle-label {
          font-weight: 500;
        }

        .toggle-stats {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--text-tertiary, #666);
        }

        .stat-sep {
          opacity: 0.5;
        }

        .quick-commands-content {
          padding: 0.5rem;
          max-height: 280px;
          overflow-y: auto;
        }

        .quick-commands-tabs {
          display: flex;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
          padding: 0.125rem;
          background: var(--bg-primary, #0d0d0f);
          border-radius: 8px;
        }

        .quick-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.5rem;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary, #888);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .quick-tab:hover {
          background: var(--bg-tertiary, #1a1a1f);
          color: var(--text-primary, #fff);
        }

        .quick-tab.active {
          background: var(--bg-tertiary, #1a1a1f);
          color: var(--text-primary, #fff);
        }

        .tab-count {
          padding: 0.125rem 0.375rem;
          background: var(--bg-primary, #0d0d0f);
          border-radius: 10px;
          font-size: 0.65rem;
          color: var(--text-tertiary, #666);
        }

        .quick-tab.active .tab-count {
          background: var(--accent-color, #7c3aed);
          color: white;
        }

        .quick-commands-categories {
          display: flex;
          gap: 0.375rem;
          margin-bottom: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
          -webkit-overflow-scrolling: touch;
        }

        .category-pill {
          flex-shrink: 0;
          padding: 0.25rem 0.625rem;
          background: var(--bg-primary, #0d0d0f);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 12px;
          color: var(--text-secondary, #888);
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .category-pill:hover {
          border-color: var(--border-hover, #3a3a3f);
          color: var(--text-primary, #fff);
        }

        .category-pill.active {
          background: var(--accent-color, #7c3aed);
          border-color: var(--accent-color, #7c3aed);
          color: white;
        }

        .quick-commands-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .quick-command-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.375rem 0.625rem;
          background: var(--bg-primary, #0d0d0f);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 6px;
          color: var(--text-primary, #fff);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .quick-command-item:hover {
          background: var(--bg-tertiary, #1a1a1f);
          border-color: var(--item-color, var(--accent-color, #7c3aed));
          transform: translateY(-1px);
        }

        .item-color-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .item-prefix {
          color: var(--text-tertiary, #666);
          font-family: monospace;
        }

        .item-name {
          font-family: monospace;
          font-size: 0.7rem;
        }

        /* Scrollbar styling */
        .quick-commands-content::-webkit-scrollbar {
          width: 6px;
        }

        .quick-commands-content::-webkit-scrollbar-track {
          background: var(--bg-primary, #0d0d0f);
        }

        .quick-commands-content::-webkit-scrollbar-thumb {
          background: var(--border-color, #2a2a2f);
          border-radius: 3px;
        }

        .quick-commands-content::-webkit-scrollbar-thumb:hover {
          background: var(--border-hover, #3a3a3f);
        }

        .quick-commands-categories::-webkit-scrollbar {
          height: 4px;
        }

        .quick-commands-categories::-webkit-scrollbar-track {
          background: transparent;
        }

        .quick-commands-categories::-webkit-scrollbar-thumb {
          background: var(--border-color, #2a2a2f);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

export default QuickCommands;
