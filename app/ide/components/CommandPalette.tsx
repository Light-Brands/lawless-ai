'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useIDEStore } from '../stores/ideStore';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, togglePane } = useIDEStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Define available commands
  const commands: Command[] = [
    { id: 'new-session', label: 'New Session', shortcut: '⌘⇧N', category: 'Session', action: () => {} },
    { id: 'switch-session', label: 'Switch Session', shortcut: '⌘⇧S', category: 'Session', action: () => {} },
    { id: 'toggle-chat', label: 'Toggle AI Chat', shortcut: '⌘1', category: 'Panes', action: () => togglePane(1) },
    { id: 'toggle-editor', label: 'Toggle Editor', shortcut: '⌘2', category: 'Panes', action: () => togglePane(2) },
    { id: 'toggle-preview', label: 'Toggle Preview', shortcut: '⌘3', category: 'Panes', action: () => togglePane(3) },
    { id: 'toggle-database', label: 'Toggle Database', shortcut: '⌘4', category: 'Panes', action: () => togglePane(4) },
    { id: 'toggle-deployments', label: 'Toggle Deployments', shortcut: '⌘5', category: 'Panes', action: () => togglePane(5) },
    { id: 'toggle-activity', label: 'Toggle Activity', shortcut: '⌘6', category: 'Panes', action: () => togglePane(6) },
    { id: 'search-files', label: 'Search in Files', shortcut: '⌘⇧F', category: 'Search', action: () => {} },
    { id: 'open-file', label: 'Open File...', category: 'Files', action: () => {} },
    { id: 'save-file', label: 'Save File', shortcut: '⌘S', category: 'Files', action: () => {} },
    { id: 'commit', label: 'Commit Changes', category: 'Git', action: () => {} },
    { id: 'create-pr', label: 'Create Pull Request', category: 'Git', action: () => {} },
    { id: 'apply-migration', label: 'Apply Migration', category: 'Database', action: () => {} },
    { id: 'trigger-deploy', label: 'Trigger Deployment', category: 'Deploy', action: () => {} },
    { id: 'view-logs', label: 'View Deployment Logs', category: 'Deploy', action: () => {} },
    { id: 'settings', label: 'Open Settings', category: 'Settings', action: () => {} },
  ];

  // Filter commands based on query
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, filteredCommands, selectedIndex]);

  const executeCommand = (command: Command) => {
    command.action();
    setCommandPaletteOpen(false);
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="4" />
            <path d="M11 11l3 3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="command-palette-input"
          />
        </div>

        <div className="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="command-category">{cmd.category}</span>
                <span className="command-label">{cmd.label}</span>
                {cmd.shortcut && <kbd className="command-shortcut">{cmd.shortcut}</kbd>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
