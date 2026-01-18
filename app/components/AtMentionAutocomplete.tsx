'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  DictionaryItem,
  commandDictionary,
  agentColorMap,
} from '@/app/data/command-dictionary';

interface AtMentionAutocompleteProps {
  searchTerm: string;
  isVisible: boolean;
  onSelect: (item: DictionaryItem) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}

// Get only agents from the dictionary
const agents = commandDictionary.filter(item => item.type === 'agent');

// Filter agents by search term
function filterAgents(searchTerm: string): DictionaryItem[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return agents;

  return agents.filter(
    (item) =>
      item.name.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
  );
}

// Agent icon based on color/category
function AgentIcon({ color }: { color?: string }) {
  const iconColor = color ? agentColorMap[color] : '#ec4899';
  return (
    <span
      className="agent-icon"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        background: `${iconColor}20`,
        color: iconColor,
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      @
    </span>
  );
}

export default function AtMentionAutocomplete({
  searchTerm,
  isVisible,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange,
}: AtMentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Filter agents based on search term (remove leading @)
  const filteredAgents = filterAgents(
    searchTerm.startsWith('@') ? searchTerm.slice(1) : searchTerm
  ).slice(0, 8); // Max 8 items

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('.at-mention-item');
      const selectedItem = items[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelectedIndexChange(Math.min(selectedIndex + 1, filteredAgents.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelectedIndexChange(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredAgents[selectedIndex]) {
            onSelect(filteredAgents[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          if (filteredAgents[selectedIndex]) {
            e.preventDefault();
            onSelect(filteredAgents[selectedIndex]);
          }
          break;
      }
    },
    [isVisible, selectedIndex, filteredAgents, onSelect, onClose, onSelectedIndexChange]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isVisible || filteredAgents.length === 0) {
    return null;
  }

  return (
    <div className="at-mention-autocomplete">
      <div className="at-mention-header">
        <span className="at-mention-title">@ Mention an Agent</span>
        <span className="at-mention-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> navigate, <kbd>Enter</kbd> select
        </span>
      </div>
      <div className="at-mention-list" ref={listRef}>
        {filteredAgents.map((agent, index) => (
          <button
            key={agent.name}
            className={`at-mention-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(agent)}
            onMouseEnter={() => onSelectedIndexChange(index)}
          >
            <AgentIcon color={agent.color} />
            <div className="at-mention-item-content">
              <div className="at-mention-item-main">
                <span className="at-mention-item-name">@{agent.name}</span>
                <span
                  className="at-mention-item-category"
                  style={{
                    color: agent.color ? agentColorMap[agent.color] : '#8b949e',
                  }}
                >
                  {agent.category}
                </span>
              </div>
              <span className="at-mention-item-description">{agent.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
