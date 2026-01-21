'use client';

import React, { useState } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import {
  ChatIcon,
  CodeIcon,
  GlobeIcon,
  DatabaseIcon,
  RocketIcon,
  ActivityIcon,
  TerminalIcon,
} from '../Icons';

// Pane configuration with icons and labels
const PANE_CONFIG: Record<number, { label: string; icon: React.ReactNode }> = {
  1: { label: 'Chat', icon: <ChatIcon size={20} /> },
  2: { label: 'Code', icon: <CodeIcon size={20} /> },
  7: { label: 'Term', icon: <TerminalIcon size={20} /> },
  3: { label: 'Preview', icon: <GlobeIcon size={20} /> },
  4: { label: 'DB', icon: <DatabaseIcon size={20} /> },
  5: { label: 'Deploy', icon: <RocketIcon size={20} /> },
  6: { label: 'Activity', icon: <ActivityIcon size={20} /> },
};

// Primary tabs shown in the bar (first 4 + More)
const PRIMARY_PANES = [1, 2, 7, 3];
const OVERFLOW_PANES = [4, 5, 6];

export function MobileTabBar() {
  const { activeMobilePane, setActiveMobilePane, mobileTabOrder } = useIDEStore();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleTabClick = (paneId: number) => {
    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setActiveMobilePane(paneId);
  };

  const handleMoreClick = () => {
    setMoreMenuOpen(!moreMenuOpen);
  };

  const handleOverflowItemClick = (paneId: number) => {
    setMoreMenuOpen(false);
    handleTabClick(paneId);
  };

  const isOverflowActive = OVERFLOW_PANES.includes(activeMobilePane);

  return (
    <>
      {/* Backdrop for more menu */}
      {moreMenuOpen && (
        <div
          className="mobile-more-backdrop"
          onClick={() => setMoreMenuOpen(false)}
        />
      )}

      <nav className="mobile-tab-bar">
        {/* Primary tabs */}
        {PRIMARY_PANES.map((paneId) => {
          const config = PANE_CONFIG[paneId];
          const isActive = activeMobilePane === paneId;

          return (
            <button
              key={paneId}
              className={`mobile-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(paneId)}
              aria-label={config.label}
              aria-selected={isActive}
            >
              <span className="mobile-tab-icon">{config.icon}</span>
              <span className="mobile-tab-label">{config.label}</span>
            </button>
          );
        })}

        {/* More button */}
        <button
          className={`mobile-tab more-btn ${isOverflowActive ? 'active' : ''}`}
          onClick={handleMoreClick}
          aria-label="More options"
          aria-expanded={moreMenuOpen}
        >
          <span className="mobile-tab-icon">
            <MoreIcon />
          </span>
          <span className="mobile-tab-label">More</span>

          {/* More menu popup */}
          {moreMenuOpen && (
            <div className="mobile-more-menu">
              {OVERFLOW_PANES.map((paneId) => {
                const config = PANE_CONFIG[paneId];
                const isActive = activeMobilePane === paneId;

                return (
                  <button
                    key={paneId}
                    className={`mobile-more-menu-item ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOverflowItemClick(paneId);
                    }}
                  >
                    <span className="mobile-more-menu-item-icon">{config.icon}</span>
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </button>
      </nav>
    </>
  );
}

// More icon (three dots)
function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}
