'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  DictionaryItem,
  commandDictionary,
  filterDictionary,
  getTypeIcon,
  agentColorMap,
} from '@/app/data/command-dictionary';

interface SlashAutocompleteProps {
  searchTerm: string;
  isVisible: boolean;
  onSelect: (item: DictionaryItem) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}

// Type badge component
function TypeBadge({ type, color }: { type: DictionaryItem['type']; color?: string }) {
  const badgeColors = {
    command: { bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' },
    skill: { bg: 'rgba(6, 182, 212, 0.2)', text: '#22d3ee' },
    agent: { bg: color ? `${color}20` : 'rgba(236, 72, 153, 0.2)', text: color || '#ec4899' },
  };

  const { bg, text } = badgeColors[type];

  return (
    <span
      className="autocomplete-type-badge"
      style={{
        background: bg,
        color: text,
      }}
    >
      {getTypeIcon(type)} {type}
    </span>
  );
}

export default function SlashAutocomplete({
  searchTerm,
  isVisible,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange,
}: SlashAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on search term (remove leading slash)
  const filteredItems = filterDictionary(
    commandDictionary,
    searchTerm.startsWith('/') ? searchTerm.slice(1) : searchTerm
  ).slice(0, 8); // Max 8 items

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('.autocomplete-item');
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
          onSelectedIndexChange(Math.min(selectedIndex + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelectedIndexChange(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          if (filteredItems[selectedIndex]) {
            e.preventDefault();
            onSelect(filteredItems[selectedIndex]);
          }
          break;
      }
    },
    [isVisible, selectedIndex, filteredItems, onSelect, onClose, onSelectedIndexChange]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isVisible || filteredItems.length === 0) {
    return null;
  }

  return (
    <div className="slash-autocomplete">
      <div className="autocomplete-header">
        <span className="autocomplete-title">Commands & Skills</span>
        <span className="autocomplete-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select
        </span>
      </div>
      <div className="autocomplete-list" ref={listRef}>
        {filteredItems.map((item, index) => (
          <button
            key={`${item.type}-${item.name}`}
            className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onSelectedIndexChange(index)}
          >
            <div className="autocomplete-item-main">
              <span className="autocomplete-item-name">/{item.name}</span>
              <TypeBadge
                type={item.type}
                color={item.color ? agentColorMap[item.color] : undefined}
              />
            </div>
            <span className="autocomplete-item-description">{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
