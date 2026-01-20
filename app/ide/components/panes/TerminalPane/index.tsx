'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTerminal, TERMINAL_KEYS } from '../../../hooks/useTerminal';
import { useIDEContext } from '../../../contexts/IDEContext';
import { useIDEStore, TerminalTab } from '../../../stores/ideStore';
import { ideEvents } from '../../../lib/eventBus';
import '@xterm/xterm/css/xterm.css';

// Icons
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const DisconnectIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const ConnectIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const ClearIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const GitBranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export function TerminalPane() {
  const { sessionId } = useIDEContext();
  const {
    setServerStatus,
    setServerPort,
    addPort,
    terminalTabs,
    activeTabId,
    addTerminalTab,
    removeTerminalTab,
    setActiveTab,
    setTerminalTabs,
  } = useIDEStore();

  const [error, setError] = useState<string | null>(null);
  const [showNewTabDialog, setShowNewTabDialog] = useState(false);
  const [branches, setBranches] = useState<string[]>(['main']);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreatingTab, setIsCreatingTab] = useState(false);

  // Get current active tab
  const currentTab = terminalTabs.find(t => t.tabId === activeTabId);
  const currentTabId = activeTabId || 'main';

  // Fetch branches for new tab creation
  const fetchBranches = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingBranches(true);
    try {
      const res = await fetch(`/api/git/branches?sessionId=${sessionId}`);
      const data = await res.json();
      setBranches(data.branches || ['main']);
    } catch (e) {
      console.error('Failed to fetch branches:', e);
      setBranches(['main']);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [sessionId]);

  // Load tabs from backend on mount
  useEffect(() => {
    if (!sessionId) return;

    const loadTabs = async () => {
      try {
        const res = await fetch(`/api/terminal/tabs/${sessionId}`);
        const data = await res.json();
        if (data.tabs && data.tabs.length > 0) {
          const tabs: TerminalTab[] = data.tabs.map((t: any) => ({
            tabId: t.tab_id,
            name: t.name,
            index: t.tab_index,
            worktreePath: t.worktree_path,
            branchName: t.branch_name,
            baseBranch: t.base_branch,
          }));
          setTerminalTabs(tabs);
          if (!activeTabId && tabs.length > 0) {
            setActiveTab(tabs[0].tabId);
          }
        }
      } catch (e) {
        console.error('Failed to load terminal tabs:', e);
      }
    };

    loadTabs();
  }, [sessionId, setTerminalTabs, setActiveTab, activeTabId]);

  const handleConnected = useCallback(() => {
    ideEvents.emit('terminal:connected', { sessionId: sessionId || '' });
    ideEvents.emit('toast:show', {
      message: 'Terminal connected',
      type: 'success',
    });
  }, [sessionId]);

  const handleDisconnected = useCallback((code: number) => {
    if (code !== 1000) {
      setError(`Disconnected (code: ${code})`);
    }
    setServerStatus('stopped');
    setServerPort(null);
  }, [setServerStatus, setServerPort]);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    ideEvents.emit('toast:show', {
      message: errorMsg,
      type: 'error',
    });
  }, []);

  // Server detection handlers - now uses multi-port store
  const handleServerDetected = useCallback((port: number, label?: string) => {
    addPort(port, 'terminal', label, currentTabId);
    setServerStatus('running');
    ideEvents.emit('toast:show', {
      message: `Dev server detected on port ${port}`,
      type: 'success',
    });
  }, [addPort, setServerStatus, currentTabId]);

  const handleServerStopped = useCallback(() => {
    setServerStatus('stopped');
  }, [setServerStatus]);

  const {
    containerRef,
    isConnected,
    isInitialized,
    isReconnecting,
    reconnectAttempt,
    branchName,
    tabId: connectedTabId,
    connect,
    disconnect,
    restart,
    sendKey,
    clear,
    fit,
    cancelReconnect,
  } = useTerminal({
    tabId: currentTabId,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleError,
    onServerDetected: handleServerDetected,
    onServerStopped: handleServerStopped,
    autoReconnect: true,
    persistOutput: true,
  });

  // Create new tab
  const handleCreateNewTab = useCallback(async (baseBranch: string) => {
    if (!sessionId || isCreatingTab) return;

    setIsCreatingTab(true);
    try {
      const tabId = `tab_${Date.now()}`;
      const response = await fetch('/api/terminal/tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          tabId,
          name: `${baseBranch.split('/').pop()} (${terminalTabs.length + 1})`,
          baseBranch,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        addTerminalTab({
          tabId: data.tabId,
          name: data.name,
          index: data.index,
          worktreePath: data.worktreePath,
          branchName: data.branchName,
          baseBranch: data.baseBranch,
        });
        setActiveTab(data.tabId);
        setShowNewTabDialog(false);
        ideEvents.emit('toast:show', {
          message: `Created new terminal on branch ${baseBranch}`,
          type: 'success',
        });
      } else {
        throw new Error(data.error || 'Failed to create tab');
      }
    } catch (e: any) {
      console.error('Failed to create terminal tab:', e);
      ideEvents.emit('toast:show', {
        message: e.message || 'Failed to create terminal tab',
        type: 'error',
      });
    } finally {
      setIsCreatingTab(false);
    }
  }, [sessionId, terminalTabs.length, addTerminalTab, setActiveTab, isCreatingTab]);

  // Close tab
  const handleCloseTab = useCallback(async (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (terminalTabs.length <= 1) return;

    try {
      await fetch(`/api/terminal/tabs/${sessionId}/${tabId}`, { method: 'DELETE' });
      removeTerminalTab(tabId);
      ideEvents.emit('toast:show', {
        message: 'Terminal tab closed',
        type: 'info',
      });
    } catch (e) {
      console.error('Failed to close tab:', e);
    }
  }, [sessionId, terminalTabs.length, removeTerminalTab]);

  // Open new tab dialog
  const handleNewTab = useCallback(() => {
    fetchBranches();
    setShowNewTabDialog(true);
  }, [fetchBranches]);

  // Refit when pane becomes visible
  useEffect(() => {
    const handlePaneFocus = ({ paneId }: { paneId: number }) => {
      if (paneId === 7 && isInitialized) {
        setTimeout(() => fit(), 100);
      }
    };

    const unsubscribe = ideEvents.on('pane:focus', handlePaneFocus);
    return () => unsubscribe();
  }, [fit, isInitialized]);

  // No session state
  if (!sessionId) {
    return (
      <div className="terminal-pane">
        <div className="terminal-not-connected">
          <div className="not-connected-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" x2="20" y1="19" y2="19" />
            </svg>
          </div>
          <h3>No Session</h3>
          <p>Create or select a session to use the terminal.</p>
        </div>

        <style jsx>{`
          .terminal-pane {
            height: 100%;
            display: flex;
            flex-direction: column;
            background: var(--bg-primary, #0d1117);
          }

          .terminal-not-connected {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 2rem;
            gap: 0.75rem;
          }

          .not-connected-icon {
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-secondary, #21262d);
            border-radius: 12px;
            color: var(--text-secondary, #8b949e);
          }

          .terminal-not-connected h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary, #c9d1d9);
          }

          .terminal-not-connected p {
            margin: 0;
            font-size: 0.875rem;
            color: var(--text-secondary, #8b949e);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="terminal-pane">
      {/* Tab bar */}
      <div className="terminal-tabs-bar">
        {terminalTabs.map((tab) => (
          <div
            key={tab.tabId}
            className={`terminal-tab ${activeTabId === tab.tabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.tabId)}
            title={`Branch: ${tab.branchName}\nWorktree: ${tab.worktreePath}`}
          >
            <GitBranchIcon />
            <span className="tab-name">{tab.name}</span>
            <span className="tab-branch">{tab.branchName.split('/').pop()}</span>
            {terminalTabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => handleCloseTab(tab.tabId, e)}
                title="Close tab"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
        <button
          className="new-tab-btn"
          onClick={handleNewTab}
          title="New terminal with isolated worktree"
        >
          <PlusIcon />
        </button>
      </div>

      {/* New tab dialog */}
      {showNewTabDialog && (
        <div className="new-tab-dialog-overlay" onClick={() => setShowNewTabDialog(false)}>
          <div className="new-tab-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Create New Terminal</h4>
            <p>Select base branch for isolated worktree:</p>
            {isLoadingBranches ? (
              <div className="loading-branches">Loading branches...</div>
            ) : (
              <div className="branch-list">
                {branches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => handleCreateNewTab(branch)}
                    disabled={isCreatingTab}
                    className="branch-option"
                  >
                    <GitBranchIcon />
                    {branch}
                  </button>
                ))}
              </div>
            )}
            <button className="cancel-btn" onClick={() => setShowNewTabDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Terminal header */}
      <div className="terminal-header">
        <div className="terminal-header-left">
          <span className={`connection-status ${isConnected ? 'connected' : isReconnecting ? 'reconnecting' : 'disconnected'}`}>
            <span className="status-dot" />
            {isConnected ? 'Connected' : isReconnecting ? `Reconnecting (${reconnectAttempt}/10)` : 'Disconnected'}
          </span>
          {(branchName || currentTab?.branchName) && (
            <span className="branch-badge">
              <GitBranchIcon />
              {branchName || currentTab?.branchName}
            </span>
          )}
        </div>
        <div className="terminal-header-right">
          {error && <span className="error-badge">{error}</span>}
          <button
            className="terminal-action-btn"
            onClick={clear}
            title="Clear terminal"
            disabled={!isInitialized}
          >
            <ClearIcon />
          </button>
          {isConnected ? (
            <>
              <button
                className="terminal-action-btn"
                onClick={restart}
                title="Restart Claude"
              >
                <RefreshIcon />
              </button>
              <button
                className="terminal-action-btn danger"
                onClick={disconnect}
                title="Disconnect"
              >
                <DisconnectIcon />
              </button>
            </>
          ) : isReconnecting ? (
            <button
              className="terminal-action-btn danger"
              onClick={cancelReconnect}
              title="Cancel reconnect"
            >
              <DisconnectIcon />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              className="terminal-action-btn primary"
              onClick={connect}
              title="Connect"
              disabled={!isInitialized}
            >
              <ConnectIcon />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal container */}
      <div className="terminal-container">
        {!isInitialized && (
          <div className="terminal-loading">
            <div className="loading-spinner" />
            <span>Initializing terminal...</span>
          </div>
        )}
        <div
          ref={containerRef}
          className="terminal-wrapper"
          style={{ display: isInitialized ? 'block' : 'none' }}
        />
      </div>

      {/* Mobile keyboard toolbar */}
      <div className="terminal-mobile-toolbar">
        <button onClick={() => sendKey('TAB')} disabled={!isConnected}>Tab</button>
        <button onClick={() => sendKey('ESCAPE')} disabled={!isConnected}>Esc</button>
        <button onClick={() => sendKey('CTRL_C')} disabled={!isConnected}>Ctrl+C</button>
        <button onClick={() => sendKey('CTRL_D')} disabled={!isConnected}>Ctrl+D</button>
        <button onClick={() => sendKey('CTRL_L')} disabled={!isConnected}>Clear</button>
        <button onClick={() => sendKey('ARROW_UP')} disabled={!isConnected}>↑</button>
        <button onClick={() => sendKey('ARROW_DOWN')} disabled={!isConnected}>↓</button>
      </div>

      <style jsx>{`
        .terminal-pane {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #0d0d0f;
          overflow: hidden;
        }

        .terminal-tabs-bar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px 4px 0;
          background: #0a0a0c;
          border-bottom: 1px solid #1a1a1f;
          flex-shrink: 0;
          overflow-x: auto;
        }

        .terminal-tab {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          background: #0d0d0f;
          border: 1px solid #1a1a1f;
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          color: #666;
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .terminal-tab:hover {
          background: #1a1a1f;
          color: #888;
        }

        .terminal-tab.active {
          background: #0d0d0f;
          border-color: #2a2a2f;
          color: #c9d1d9;
          position: relative;
        }

        .terminal-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: #0d0d0f;
        }

        .tab-name {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tab-branch {
          font-size: 0.65rem;
          color: #7c3aed;
          opacity: 0.7;
        }

        .tab-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          margin-left: 2px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: #666;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s;
        }

        .terminal-tab:hover .tab-close {
          opacity: 1;
        }

        .tab-close:hover {
          background: rgba(248, 81, 73, 0.2);
          color: #f85149;
        }

        .new-tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          background: transparent;
          border: 1px dashed #2a2a2f;
          border-radius: 4px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s;
          margin-left: 4px;
        }

        .new-tab-btn:hover {
          background: #1a1a1f;
          border-style: solid;
          color: #888;
        }

        .new-tab-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .new-tab-dialog {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 320px;
          width: 90%;
        }

        .new-tab-dialog h4 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: #c9d1d9;
        }

        .new-tab-dialog p {
          margin: 0 0 1rem;
          font-size: 0.875rem;
          color: #8b949e;
        }

        .loading-branches {
          padding: 1rem;
          text-align: center;
          color: #8b949e;
          font-size: 0.875rem;
        }

        .branch-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 240px;
          overflow-y: auto;
        }

        .branch-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.625rem 0.75rem;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 8px;
          color: #c9d1d9;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }

        .branch-option:hover:not(:disabled) {
          background: #30363d;
          border-color: #8b949e;
        }

        .branch-option:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .cancel-btn {
          width: 100%;
          margin-top: 1rem;
          padding: 0.5rem;
          background: transparent;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cancel-btn:hover {
          background: #21262d;
          color: #c9d1d9;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #0a0a0c;
          border-bottom: 1px solid #1a1a1f;
          flex-shrink: 0;
        }

        .terminal-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .terminal-header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #888;
        }

        .connection-status.connected {
          color: #4ade80;
        }

        .connection-status.reconnecting {
          color: #f59e0b;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #888;
        }

        .connection-status.connected .status-dot {
          background: #4ade80;
        }

        .connection-status.reconnecting .status-dot {
          background: #f59e0b;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .branch-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #1a1a1f;
          border-radius: 12px;
          font-size: 0.7rem;
          color: #7c3aed;
        }

        .error-badge {
          font-size: 0.7rem;
          color: #f85149;
          padding: 2px 6px;
          background: rgba(248, 81, 73, 0.15);
          border-radius: 4px;
        }

        .terminal-action-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: #1a1a1f;
          border: 1px solid #2a2a2f;
          border-radius: 4px;
          color: #888;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .terminal-action-btn:hover:not(:disabled) {
          background: #2a2a2f;
          color: #e0e0e0;
          border-color: #3a3a3f;
        }

        .terminal-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .terminal-action-btn.primary {
          background: #238636;
          border-color: #238636;
          color: white;
        }

        .terminal-action-btn.primary:hover:not(:disabled) {
          background: #2ea043;
        }

        .terminal-action-btn.danger:hover:not(:disabled) {
          background: rgba(248, 81, 73, 0.15);
          border-color: #f85149;
          color: #f85149;
        }

        .terminal-container {
          flex: 1 1 0;
          position: relative;
          overflow: hidden;
          min-height: 0;
          background: #0d0d0f;
        }

        .terminal-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: #0d0d0f;
          color: #888;
          font-size: 0.875rem;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #2a2a2f;
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .terminal-wrapper {
          width: 100%;
          height: 100%;
          padding: 0.5rem;
        }

        .terminal-wrapper :global(.xterm) {
          height: 100% !important;
        }

        .terminal-wrapper :global(.xterm-viewport) {
          overflow-y: scroll !important;
          scrollbar-width: thin;
          scrollbar-color: #3a3a3f transparent;
        }

        .terminal-wrapper :global(.xterm-viewport::-webkit-scrollbar) {
          width: 10px;
        }

        .terminal-wrapper :global(.xterm-viewport::-webkit-scrollbar-track) {
          background: #1a1a1f;
        }

        .terminal-wrapper :global(.xterm-viewport::-webkit-scrollbar-thumb) {
          background: #3a3a3f;
          border-radius: 5px;
          border: 2px solid #1a1a1f;
        }

        .terminal-wrapper :global(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
          background: #4a4a4f;
        }

        .terminal-mobile-toolbar {
          display: none;
        }

        @media (max-width: 768px) {
          .terminal-mobile-toolbar {
            display: flex;
            gap: 0.5rem;
            padding: 0.5rem;
            background: #0a0a0c;
            border-top: 1px solid #1a1a1f;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .terminal-mobile-toolbar button {
            padding: 0.5rem 0.75rem;
            background: #1a1a1f;
            border: 1px solid #2a2a2f;
            border-radius: 6px;
            color: #e0e0e0;
            font-family: monospace;
            font-size: 0.8rem;
            white-space: nowrap;
            cursor: pointer;
            flex-shrink: 0;
          }

          .terminal-mobile-toolbar button:active {
            background: #2a2a2f;
          }
        }
      `}</style>
    </div>
  );
}
