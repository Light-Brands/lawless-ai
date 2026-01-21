'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import {
  GlobeIcon,
  CodeIcon,
  DatabaseIcon,
  RocketIcon,
  ActivityIcon,
  SettingsIcon,
} from '../Icons';
import { ideEvents } from '../../lib/eventBus';

// Main pane configuration - these appear in the top viewing area
type MainPaneId = 'preview' | 'editor' | 'database' | 'deployments' | 'activity' | 'settings';

interface PaneConfig {
  id: MainPaneId;
  label: string;
  icon: React.ReactNode;
}

const MAIN_PANES: PaneConfig[] = [
  { id: 'preview', label: 'Preview', icon: <GlobeIcon size={22} /> },
  { id: 'editor', label: 'Code', icon: <CodeIcon size={22} /> },
  { id: 'database', label: 'DB', icon: <DatabaseIcon size={22} /> },
  { id: 'deployments', label: 'Deploy', icon: <RocketIcon size={22} /> },
  { id: 'activity', label: 'Activity', icon: <ActivityIcon size={22} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={22} /> },
];

// Pane-specific options for long-press menu
const PANE_OPTIONS: Record<MainPaneId, Array<{ label: string; action: string; icon?: string }>> = {
  preview: [
    { label: 'Refresh', action: 'refresh', icon: '↻' },
    { label: 'Open in Browser', action: 'external', icon: '↗' },
    { label: 'Fullscreen', action: 'fullscreen', icon: '⛶' },
  ],
  editor: [
    { label: 'New File', action: 'new-file', icon: '+' },
    { label: 'Find in Files', action: 'search', icon: '🔍' },
    { label: 'Fullscreen', action: 'fullscreen', icon: '⛶' },
  ],
  database: [
    { label: 'Refresh Tables', action: 'refresh', icon: '↻' },
    { label: 'SQL Editor', action: 'sql', icon: '>' },
    { label: 'Fullscreen', action: 'fullscreen', icon: '⛶' },
  ],
  deployments: [
    { label: 'Refresh', action: 'refresh', icon: '↻' },
    { label: 'Redeploy', action: 'redeploy', icon: '🚀' },
    { label: 'Fullscreen', action: 'fullscreen', icon: '⛶' },
  ],
  activity: [
    { label: 'Clear History', action: 'clear', icon: '🗑' },
    { label: 'Filter', action: 'filter', icon: '⚙' },
    { label: 'Fullscreen', action: 'fullscreen', icon: '⛶' },
  ],
  settings: [
    { label: 'Reset to Defaults', action: 'reset', icon: '↺' },
    { label: 'Export Settings', action: 'export', icon: '↓' },
  ],
};

// Haptic feedback helper
const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const durations = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(durations[style]);
  }
};

export function MobileBottomNav() {
  const { mobile, setMobileMainPane, setMobileBottomZoneHeight } = useIDEStore();
  const activePane = mobile.mainPane;

  // Long-press state
  const [showOptions, setShowOptions] = useState(false);
  const [optionsPane, setOptionsPane] = useState<MainPaneId | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePaneClick = useCallback((paneId: MainPaneId) => {
    haptic('light');
    setMobileMainPane(paneId);
  }, [setMobileMainPane]);

  // Long-press handlers
  const handleTouchStart = useCallback((paneId: MainPaneId) => {
    longPressTimerRef.current = setTimeout(() => {
      haptic('heavy');
      setOptionsPane(paneId);
      setShowOptions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle option selection
  const handleOptionSelect = useCallback((action: string) => {
    haptic('medium');
    setShowOptions(false);

    // Emit events for pane-specific actions
    switch (action) {
      case 'fullscreen':
        setMobileBottomZoneHeight('fullscreen');
        break;
      case 'refresh':
        ideEvents.emit('pane:action', { pane: optionsPane, action: 'refresh' });
        break;
      case 'external':
        ideEvents.emit('pane:action', { pane: optionsPane, action: 'external' });
        break;
      case 'new-file':
        ideEvents.emit('pane:action', { pane: 'editor', action: 'new-file' });
        break;
      case 'search':
        ideEvents.emit('pane:action', { pane: 'editor', action: 'search' });
        break;
      case 'sql':
        ideEvents.emit('pane:action', { pane: 'database', action: 'sql-editor' });
        break;
      default:
        ideEvents.emit('pane:action', { pane: optionsPane, action });
    }
  }, [optionsPane, setMobileBottomZoneHeight]);

  return (
    <>
      <nav className="mobile-bottom-nav">
        {MAIN_PANES.map((pane) => {
          const isActive = activePane === pane.id;

          return (
            <button
              key={pane.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handlePaneClick(pane.id)}
              onTouchStart={() => handleTouchStart(pane.id)}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              aria-label={pane.label}
              aria-selected={isActive}
            >
              <span className="mobile-nav-icon">{pane.icon}</span>
              <span className="mobile-nav-label">{pane.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Long-press Options Menu */}
      {showOptions && optionsPane && (
        <>
          <div className="nav-options-backdrop" onClick={() => setShowOptions(false)} />
          <div className="nav-options-menu">
            <div className="nav-options-header">
              {MAIN_PANES.find(p => p.id === optionsPane)?.label} Options
            </div>
            {PANE_OPTIONS[optionsPane].map((option, idx) => (
              <button
                key={idx}
                className="nav-option-item"
                onClick={() => handleOptionSelect(option.action)}
              >
                {option.icon && <span className="nav-option-icon">{option.icon}</span>}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
