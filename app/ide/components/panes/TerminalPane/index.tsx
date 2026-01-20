'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTerminal, TERMINAL_KEYS } from '../../../hooks/useTerminal';
import { useIDEContext } from '../../../contexts/IDEContext';
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

export function TerminalPane() {
  const { sessionId } = useIDEContext();
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    ideEvents.emit('toast:show', {
      message: errorMsg,
      type: 'error',
    });
  }, []);

  const {
    containerRef,
    isConnected,
    isInitialized,
    isReconnecting,
    reconnectAttempt,
    branchName,
    connect,
    disconnect,
    restart,
    sendKey,
    clear,
    fit,
    cancelReconnect,
  } = useTerminal({
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleError,
    autoReconnect: true,
    persistOutput: true,
  });

  // Refit when pane becomes visible
  useEffect(() => {
    const handlePaneFocus = ({ paneId }: { paneId: number }) => {
      // Terminal pane ID is 7
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
      {/* Terminal header */}
      <div className="terminal-header">
        <div className="terminal-header-left">
          <span className={`connection-status ${isConnected ? 'connected' : isReconnecting ? 'reconnecting' : 'disconnected'}`}>
            <span className="status-dot" />
            {isConnected ? 'Connected' : isReconnecting ? `Reconnecting (${reconnectAttempt}/10)` : 'Disconnected'}
          </span>
          {branchName && (
            <span className="branch-badge">
              <GitBranchIcon />
              {branchName}
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
