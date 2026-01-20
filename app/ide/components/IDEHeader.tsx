'use client';

import React, { useState } from 'react';
import { useIDEStore } from '../stores/ideStore';
import Link from 'next/link';

interface Session {
  sessionId: string;
  name: string;
  branchName: string;
  baseBranch: string;
  createdAt: string;
  messageCount?: number;
}

interface IDEHeaderProps {
  repoFullName?: string;
  sessions?: Session[];
  activeSessionId?: string | null;
  onSessionChange?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function IDEHeader({
  repoFullName,
  sessions = [],
  activeSessionId,
  onSessionChange,
  onNewSession,
}: IDEHeaderProps) {
  const { activeSession, setCommandPaletteOpen } = useIDEStore();
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);

  const currentSession = sessions.find((s) => s.sessionId === activeSessionId);
  const [owner, repoName] = (repoFullName || '').split('/');

  return (
    <header className="ide-header">
      <div className="ide-header-left">
        <Link href="/" className="ide-logo">
          <span className="logo-text">Lawless AI</span>
        </Link>

        {/* Session selector */}
        <div className="session-selector-wrapper">
          <button
            className="session-selector"
            onClick={() => setSessionMenuOpen(!sessionMenuOpen)}
          >
            {repoFullName ? (
              <>
                <span className="session-repo">{repoName}</span>
                <span className="session-branch">
                  {currentSession?.branchName || activeSession?.branch || 'main'}
                </span>
              </>
            ) : activeSession ? (
              <>
                <span className="session-repo">{activeSession.repo}</span>
                <span className="session-branch">{activeSession.branch}</span>
              </>
            ) : (
              <span className="session-placeholder">Select a session...</span>
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>

          {sessionMenuOpen && (
            <div className="session-menu">
              <div className="session-menu-header">
                <span>Sessions</span>
                {onNewSession && (
                  <button
                    className="new-session-btn"
                    onClick={() => {
                      onNewSession();
                      setSessionMenuOpen(false);
                    }}
                  >
                    + New
                  </button>
                )}
              </div>
              <div className="session-menu-list">
                {sessions.map((session) => (
                  <button
                    key={session.sessionId}
                    className={`session-menu-item ${session.sessionId === activeSessionId ? 'active' : ''}`}
                    onClick={() => {
                      onSessionChange?.(session.sessionId);
                      setSessionMenuOpen(false);
                    }}
                  >
                    <span className="session-name">{session.name}</span>
                    <span className="session-branch-small">{session.branchName}</span>
                  </button>
                ))}
                {sessions.length === 0 && (
                  <div className="session-menu-empty">No sessions yet</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ide-header-center">
        {/* Command palette trigger */}
        <button className="command-palette-trigger" onClick={() => setCommandPaletteOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="4" />
            <path d="M10 10l3 3" />
          </svg>
          <span>Search or run command...</span>
          <kbd>⌘P</kbd>
        </button>
      </div>

      <div className="ide-header-right">
        {/* Status indicators */}
        <div className="status-indicators">
          <span className="status-dot connected" title="Claude connected" />
          <span className="status-dot connected" title="GitHub connected" />
          <span className="status-dot connected" title="Supabase connected" />
          <span className="status-dot connected" title="Vercel connected" />
        </div>

        {/* Settings */}
        <button className="ide-settings-btn" title="Settings">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 11a2 2 0 100-4 2 2 0 000 4z" />
            <path d="M14.5 9a5.5 5.5 0 01-11 0 5.5 5.5 0 0111 0z" />
          </svg>
        </button>

        {/* User menu */}
        <button className="ide-user-btn">
          <div className="user-avatar">
            <span>U</span>
          </div>
        </button>
      </div>
    </header>
  );
}
