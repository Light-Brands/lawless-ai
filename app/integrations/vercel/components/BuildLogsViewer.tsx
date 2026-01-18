'use client';

import { useState } from 'react';

interface Deployment {
  id: string;
  name: string;
  url: string;
  state: string;
  meta: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    githubCommitMessage?: string;
  };
}

interface LogEntry {
  id: string;
  timestamp: number;
  type: string;
  text: string;
  level?: string;
}

interface BuildLogsViewerProps {
  deployment: Deployment;
  logs: LogEntry[];
  loading: boolean;
  onClose: () => void;
  onLoadLogs: (type: 'build' | 'runtime') => void;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/>
    <line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getLogLineClass(type: string, level?: string): string {
  if (level === 'error' || type === 'stderr') return 'log-error';
  if (level === 'warning') return 'log-warning';
  if (type === 'stdout') return 'log-info';
  return '';
}

export default function BuildLogsViewer({
  deployment,
  logs,
  loading,
  onClose,
  onLoadLogs,
}: BuildLogsViewerProps) {
  const [activeTab, setActiveTab] = useState<'build' | 'runtime'>('build');
  const [copied, setCopied] = useState(false);

  function handleTabChange(tab: 'build' | 'runtime') {
    setActiveTab(tab);
    onLoadLogs(tab);
  }

  function handleCopyLogs() {
    const logText = logs.map((log) => log.text).join('\n');
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="logs-viewer">
      <div className="logs-viewer-header">
        <div className="logs-viewer-title">
          <h2>Deployment Logs</h2>
          <span className="logs-viewer-deployment-id">{deployment.id.substring(0, 8)}</span>
        </div>
        <div className="logs-viewer-actions">
          <button
            onClick={handleCopyLogs}
            className="logs-action-btn"
            disabled={!logs.length}
            title="Copy logs"
          >
            <CopyIcon />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button onClick={onClose} className="logs-close-btn" title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="logs-viewer-tabs">
        <button
          className={`logs-tab ${activeTab === 'build' ? 'active' : ''}`}
          onClick={() => handleTabChange('build')}
        >
          Build Logs
        </button>
        <button
          className={`logs-tab ${activeTab === 'runtime' ? 'active' : ''}`}
          onClick={() => handleTabChange('runtime')}
        >
          Runtime Logs
        </button>
      </div>

      <div className="logs-viewer-content">
        {loading ? (
          <div className="logs-loading">
            <div className="logs-loading-spinner"></div>
            <span>Loading logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="logs-empty">
            <span>No {activeTab} logs available</span>
          </div>
        ) : (
          <div className="logs-container">
            <pre className="logs-pre">
              {logs.map((log, index) => (
                <div
                  key={log.id || index}
                  className={`log-line ${getLogLineClass(log.type, log.level)}`}
                >
                  {log.timestamp && (
                    <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                  )}
                  <span className="log-text">{log.text}</span>
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
