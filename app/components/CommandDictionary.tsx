'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  type DictionaryItem,
  commandDictionary,
  categories,
  filterDictionary,
  groupByCategory,
  groupByType,
  getTypeIcon,
  agentColorMap,
} from '@/app/data/command-dictionary';

interface CommandDictionaryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (item: DictionaryItem) => void;
}

// Icons
const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
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

// Section component
function DictionarySection({
  title,
  items,
  categoryOrder,
  expandedItem,
  onItemClick,
  typeColor,
}: {
  title: string;
  items: DictionaryItem[];
  categoryOrder: string[];
  expandedItem: string | null;
  onItemClick: (name: string) => void;
  typeColor: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const grouped = groupByCategory(items);

  // Sort categories by order
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className="dictionary-section">
      <button className="dictionary-section-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="dictionary-section-title">
          <span className="dictionary-section-icon" style={{ color: typeColor }}>
            {getTypeIcon(items[0]?.type || 'command')}
          </span>
          {title}
          <span className="dictionary-section-count">({items.length})</span>
        </span>
        <ChevronIcon expanded={isExpanded} />
      </button>

      {isExpanded && (
        <div className="dictionary-section-content">
          {sortedCategories.map((category) => (
            <div key={category} className="dictionary-category">
              <div className="dictionary-category-header">{category}</div>
              <div className="dictionary-category-items">
                {grouped[category].map((item) => (
                  <DictionaryItemCard
                    key={item.name}
                    item={item}
                    isExpanded={expandedItem === item.name}
                    onClick={() => onItemClick(item.name)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Individual item component
function DictionaryItemCard({
  item,
  isExpanded,
  onClick,
}: {
  item: DictionaryItem;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const agentColor = item.color ? agentColorMap[item.color] : undefined;

  return (
    <button
      className={`dictionary-item ${isExpanded ? 'expanded' : ''}`}
      onClick={onClick}
      style={
        agentColor
          ? ({ '--agent-color': agentColor } as React.CSSProperties)
          : ({ '--agent-color': '#a855f7' } as React.CSSProperties)
      }
    >
      <div className="dictionary-item-header">
        <span className="dictionary-item-name">
          {getTypeIcon(item.type)}
          {item.name}
        </span>
        {item.color && (
          <span
            className="dictionary-item-color-dot"
            style={{ background: agentColor }}
            title={item.color}
          />
        )}
      </div>
      <p className="dictionary-item-description">{item.description}</p>

      {isExpanded && item.usage && (
        <div className="dictionary-item-details">
          <div className="dictionary-item-usage">
            <span className="dictionary-item-usage-label">Usage:</span>
            <code>{item.usage}</code>
          </div>
        </div>
      )}
    </button>
  );
}

export default function CommandDictionary({ isOpen, onClose, onSelect }: CommandDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Filter items based on search
  const filteredItems = filterDictionary(commandDictionary, searchTerm);
  const byType = groupByType(filteredItems);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Clear state on close
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setExpandedItem(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle item click
  const handleItemClick = useCallback((name: string) => {
    setExpandedItem((prev) => (prev === name ? null : name));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="dictionary-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="dictionary-popup">
        <div className="dictionary-header">
          <h2 className="dictionary-title">Command Dictionary</h2>
          <button className="dictionary-close" onClick={onClose} aria-label="Close dictionary">
            <CloseIcon />
          </button>
        </div>

        <div className="dictionary-search">
          <SearchIcon />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commands, skills, agents..."
            className="dictionary-search-input"
          />
          {searchTerm && (
            <button className="dictionary-search-clear" onClick={() => setSearchTerm('')}>
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="dictionary-content">
          {filteredItems.length === 0 ? (
            <div className="dictionary-empty">
              <p>No results found for "{searchTerm}"</p>
            </div>
          ) : (
            <>
              {byType.command && byType.command.length > 0 && (
                <DictionarySection
                  title="Commands"
                  items={byType.command}
                  categoryOrder={categories.commands}
                  expandedItem={expandedItem}
                  onItemClick={handleItemClick}
                  typeColor="#c084fc"
                />
              )}

              {byType.skill && byType.skill.length > 0 && (
                <DictionarySection
                  title="Skills"
                  items={byType.skill}
                  categoryOrder={categories.skills}
                  expandedItem={expandedItem}
                  onItemClick={handleItemClick}
                  typeColor="#22d3ee"
                />
              )}

              {byType.agent && byType.agent.length > 0 && (
                <DictionarySection
                  title="Agents"
                  items={byType.agent}
                  categoryOrder={categories.agents}
                  expandedItem={expandedItem}
                  onItemClick={handleItemClick}
                  typeColor="#ec4899"
                />
              )}
            </>
          )}
        </div>

        <div className="dictionary-footer">
          <span className="dictionary-footer-hint">
            Type <kbd>/</kbd> in chat for quick autocomplete
          </span>
        </div>
      </div>
    </div>
  );
}
