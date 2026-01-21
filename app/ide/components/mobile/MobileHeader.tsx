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

// Pane titles and icons
const PANE_CONFIG: Record<number, { title: string; icon: React.ReactNode }> = {
  1: { title: 'AI Chat', icon: <ChatIcon size={16} /> },
  2: { title: 'Editor', icon: <CodeIcon size={16} /> },
  7: { title: 'Terminal', icon: <TerminalIcon size={16} /> },
  3: { title: 'Preview', icon: <GlobeIcon size={16} /> },
  4: { title: 'Database', icon: <DatabaseIcon size={16} /> },
  5: { title: 'Deployments', icon: <RocketIcon size={16} /> },
  6: { title: 'Activity', icon: <ActivityIcon size={16} /> },
};

interface MobileHeaderProps {
  repoFullName?: string;
  branchName?: string;
  onRepoSelectorClick?: () => void;
  onSettingsClick?: () => void;
}

export function MobileHeader({
  repoFullName,
  branchName = 'main',
  onRepoSelectorClick,
  onSettingsClick,
}: MobileHeaderProps) {
  const { activeMobilePane, setCommandPaletteOpen } = useIDEStore();
  const [, repoName] = (repoFullName || '').split('/');

  const activeConfig = PANE_CONFIG[activeMobilePane] || PANE_CONFIG[1];

  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        {/* Repo/branch selector */}
        <button
          className="mobile-repo-selector"
          onClick={onRepoSelectorClick}
          aria-label="Select repository"
        >
          <RepoIcon />
          <span className="mobile-repo-name">{repoName || 'Select repo'}</span>
          <span className="mobile-branch-name">/{branchName}</span>
          <ChevronDownIcon />
        </button>
      </div>

      <div className="mobile-header-right">
        {/* Status indicator */}
        <div className="mobile-status-indicator" title="Connected" />

        {/* Search/command palette */}
        <button
          className="mobile-header-btn"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search"
        >
          <SearchIcon />
        </button>

        {/* Settings */}
        <button
          className="mobile-header-btn"
          onClick={onSettingsClick}
          aria-label="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}

// Icons
function RepoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mobile-repo-icon">
      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="mobile-repo-chevron">
      <path d="M3 5l3 3 3-3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="5" />
      <path d="M13 13l3 3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="2" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M3.5 14.5l1.4-1.4M13.1 4.9l1.4-1.4" />
    </svg>
  );
}
