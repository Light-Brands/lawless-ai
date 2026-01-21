'use client';

import React, { useCallback } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import {
  GlobeIcon,
  CodeIcon,
  DatabaseIcon,
  RocketIcon,
  ActivityIcon,
  SettingsIcon,
} from '../Icons';

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

// Haptic feedback helper
const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const durations = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(durations[style]);
  }
};

export function MobileBottomNav() {
  const { mobile, setMobileMainPane } = useIDEStore();
  const activePane = mobile.mainPane;

  const handlePaneClick = useCallback((paneId: MainPaneId) => {
    haptic('light');
    setMobileMainPane(paneId);
  }, [setMobileMainPane]);

  return (
    <nav className="mobile-bottom-nav">
      {MAIN_PANES.map((pane) => {
        const isActive = activePane === pane.id;

        return (
          <button
            key={pane.id}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => handlePaneClick(pane.id)}
            aria-label={pane.label}
            aria-selected={isActive}
          >
            <span className="mobile-nav-icon">{pane.icon}</span>
            <span className="mobile-nav-label">{pane.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
