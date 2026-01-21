'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useVercelConnection, useTerminalConnection } from '../../../contexts/ServiceContext';
import { useIDEContext } from '../../../contexts/IDEContext';
import { usePortScanner } from '../../../hooks/usePortScanner';
import { useMobileDetection } from '../../../hooks/useMobileDetection';
import { PullToRefresh } from '../../mobile/PullToRefresh';

interface Deployment {
  id: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'READY' | 'CANCELED' | 'QUEUED' | 'INITIALIZING';
  target: 'production' | 'preview' | null;
  createdAt: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitMessage?: string;
    githubCommitSha?: string;
  };
}

// Icons
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" x2="21" y1="14" y2="3"/>
  </svg>
);

export function PreviewPane() {
  const {
    previewMode,
    setPreviewMode,
    activePorts,
    selectedPort,
    setSelectedPort
  } = useIDEStore();
  const vercel = useVercelConnection();
  const terminal = useTerminalConnection();
  const { sessionId: contextSessionId } = useIDEContext();
  const isMobile = useMobileDetection();

  // Detect if we're running inside an iframe (nested preview)
  const [isInIframe, setIsInIframe] = useState(false);
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Use terminal.sessionId if available, fall back to context sessionId
  const effectiveSessionId = terminal.sessionId || contextSessionId;

  // Port scanner toggle - disabled by default to prevent session errors
  const [scannerEnabled, setScannerEnabled] = useState(false);

  // Enable port scanning only when:
  // - Not in iframe (nested preview would cause recursive API calls)
  // - Manually enabled
  // - Terminal session is connected
  const { scanNow } = usePortScanner({
    enabled: !isInIframe && scannerEnabled && terminal.status === 'connected'
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Convert activePorts to sorted array
  const portsArray = Object.values(activePorts).sort((a, b) => a.port - b.port);
  const hasActivePorts = portsArray.length > 0;

  // Deployments state
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  // Console logs state
  const [consoleLogs, setConsoleLogs] = useState<{ time: string; message: string }[]>([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), message: 'Ready' }
  ]);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'logs' | 'network'>('logs');

  // Get unique branches from deployments
  const branches = React.useMemo(() => {
    const branchSet = new Set<string>();
    deployments.forEach(d => {
      if (d.meta?.githubCommitRef) {
        branchSet.add(d.meta.githubCommitRef);
      }
    });
    return Array.from(branchSet).sort();
  }, [deployments]);

  // Filter deployments by branch
  const filteredDeployments = React.useMemo(() => {
    if (selectedBranch === 'all') return deployments;
    return deployments.filter(d => d.meta?.githubCommitRef === selectedBranch);
  }, [deployments, selectedBranch]);

  // Get the latest ready deployment for current filter
  const latestDeployment = React.useMemo(() => {
    return filteredDeployments.find(d => d.state === 'READY') || filteredDeployments[0];
  }, [filteredDeployments]);

  // Fetch Vercel deployments
  const fetchDeployments = useCallback(async () => {
    if (!vercel.projectId || vercel.status !== 'connected') return;

    setDeploymentsLoading(true);
    try {
      const response = await fetch(`/api/integrations/vercel/deployments?projectId=${vercel.projectId}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments || []);
      }
    } catch (err) {
      console.error('Failed to fetch deployments:', err);
    } finally {
      setDeploymentsLoading(false);
    }
  }, [vercel.projectId, vercel.status]);

  // Fetch deployments on mount and when vercel connects
  useEffect(() => {
    if (vercel.status === 'connected' && vercel.projectId) {
      fetchDeployments();
    }
  }, [vercel.status, vercel.projectId, fetchDeployments]);

  // Build preview URL using dedicated subdomain with port
  // Format: preview-{sessionId}-{port}.dev.lightbrands.ai
  // Each port gets a unique subdomain for clean isolation
  const getLocalPreviewUrl = useCallback(() => {
    const port = selectedPort || 3000;
    const previewHost = `preview-${effectiveSessionId}-${port}.dev.lightbrands.ai`;
    return `https://${previewHost}`;
  }, [effectiveSessionId, selectedPort]);

  // Refresh iframe
  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    if (previewMode === 'deployed') {
      fetchDeployments();
    } else {
      // Rescan ports in local mode
      scanNow();
    }
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setConsoleLogs(prev => [...prev, { time: now, message: 'Refreshed' }]);
  }, [previewMode, fetchDeployments, scanNow]);

  // Clear console
  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  // Get deployed URL - use backend proxy to bypass X-Frame-Options
  const getDeployedUrl = useCallback(() => {
    if (latestDeployment?.url) {
      // Proxy through our backend to strip X-Frame-Options header
      // This serves from dev.lightbrands.ai which we control
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://dev.lightbrands.ai';
      return `${backendUrl}/preview/vercel?url=${encodeURIComponent(latestDeployment.url)}`;
    }
    return null;
  }, [latestDeployment]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setBranchDropdownOpen(false);
    if (branchDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [branchDropdownOpen]);

  return (
    <div className="preview-pane">
      {/* Mode toggle */}
      <div className="preview-header">
        <div className="preview-mode-toggle">
          <button
            className={`preview-mode-btn ${previewMode === 'local' ? 'active' : ''}`}
            onClick={() => setPreviewMode('local')}
          >
            Local
            {hasActivePorts && <span className="status-indicator running" />}
          </button>
          <button
            className={`preview-mode-btn ${previewMode === 'deployed' ? 'active' : ''}`}
            onClick={() => setPreviewMode('deployed')}
          >
            Deployed
            {latestDeployment?.state === 'BUILDING' && <span className="status-indicator building" />}
            {latestDeployment?.state === 'READY' && <span className="status-indicator ready" />}
          </button>
        </div>

        <div className="preview-header-actions">
          {/* Branch dropdown for deployed mode */}
          {previewMode === 'deployed' && branches.length > 0 && (
            <div className="preview-branch-dropdown" onClick={(e) => e.stopPropagation()}>
              <button
                className="preview-branch-btn"
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              >
                <span>{selectedBranch === 'all' ? 'All branches' : selectedBranch}</span>
                <ChevronDownIcon />
              </button>
              {branchDropdownOpen && (
                <div className="preview-branch-menu">
                  <button
                    className={`preview-branch-option ${selectedBranch === 'all' ? 'active' : ''}`}
                    onClick={() => { setSelectedBranch('all'); setBranchDropdownOpen(false); }}
                  >
                    All branches
                  </button>
                  {branches.map(branch => (
                    <button
                      key={branch}
                      className={`preview-branch-option ${selectedBranch === branch ? 'active' : ''}`}
                      onClick={() => { setSelectedBranch(branch); setBranchDropdownOpen(false); }}
                    >
                      {branch}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Port Scanner Toggle - only show in local mode */}
          {previewMode === 'local' && (
            <button
              className={`preview-scanner-btn ${scannerEnabled ? 'active' : ''}`}
              title={scannerEnabled ? 'Disable port scanner' : 'Enable port scanner'}
              onClick={() => setScannerEnabled(!scannerEnabled)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="scanner-label">{scannerEnabled ? 'Scanner ON' : 'Scanner OFF'}</span>
            </button>
          )}

          <button className="preview-refresh-btn" title="Refresh" onClick={handleRefresh}>
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Port pills bar for local mode */}
      {previewMode === 'local' && hasActivePorts && (
        <div className="preview-ports-bar">
          {portsArray.map((info) => (
            <button
              key={info.port}
              className={`port-pill ${selectedPort === info.port ? 'active' : ''}`}
              onClick={() => setSelectedPort(info.port)}
              title={`Source: ${info.source}${info.tabId ? ` (Tab: ${info.tabId})` : ''}`}
            >
              <span className="port-dot" />
              <span className="port-number">{info.port}</span>
              {info.label && <span className="port-label">{info.label}</span>}
            </button>
          ))}
        </div>
      )}

      {/* URL bar */}
      <div className="preview-url-bar">
        {previewMode === 'local' ? (
          <div className="preview-url-local">
            {hasActivePorts && effectiveSessionId ? (
              <>
                <span>{`preview-${effectiveSessionId}-${selectedPort || 3000}.dev.lightbrands.ai`}</span>
                <a
                  href={getLocalPreviewUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-external-link"
                  title="Open in new tab"
                >
                  <ExternalLinkIcon />
                </a>
              </>
            ) : (
              <span>Scanning for dev servers...</span>
            )}
          </div>
        ) : (
          <div className="preview-url-deployed">
            {deploymentsLoading ? (
              <span>Loading...</span>
            ) : latestDeployment ? (
              <>
                <span>{latestDeployment.url}</span>
                <a
                  href={`https://${latestDeployment.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-external-link"
                  title="Open in new tab"
                >
                  <ExternalLinkIcon />
                </a>
              </>
            ) : (
              <span>No deployments found</span>
            )}
          </div>
        )}
      </div>

      {/* Preview iframe */}
      {isMobile ? (
        <PullToRefresh onRefresh={handleRefresh} className="preview-content">
          {isInIframe ? (
            <div className="preview-placeholder">
              <p>Preview disabled in nested view</p>
              <p className="preview-hint">Open in a new window to use preview</p>
            </div>
          ) : previewMode === 'local' ? (
            hasActivePorts && selectedPort && effectiveSessionId ? (
              <iframe
                ref={iframeRef}
                src={getLocalPreviewUrl()}
                className="preview-iframe"
                title="Local Preview"
              />
            ) : (
              <div className="preview-placeholder">
                <div className="server-status scanning">
                  <div className="scanning-animation" />
                  <span>{effectiveSessionId ? 'Scanning for dev servers' : 'Connecting to session...'}</span>
                </div>
                <p className="preview-hint">Start a dev server in the terminal</p>
                <p className="preview-ports-hint">Monitoring ports 3000-3999</p>
              </div>
            )
          ) : (
            deploymentsLoading ? (
              <div className="preview-placeholder">
                <div className="loading-spinner" />
                <p>Loading deployments...</p>
              </div>
            ) : latestDeployment ? (
              latestDeployment.state === 'READY' ? (
                <iframe
                  ref={iframeRef}
                  src={getDeployedUrl() || ''}
                  className="preview-iframe"
                  title="Deployed Preview"
                />
              ) : (
                <div className="preview-placeholder">
                  <div className={`deployment-status-indicator ${latestDeployment.state.toLowerCase()}`}>
                    {latestDeployment.state === 'BUILDING' && <div className="loading-spinner" />}
                    <span>{latestDeployment.state}</span>
                  </div>
                  {latestDeployment.meta?.githubCommitMessage && (
                    <p className="preview-commit-message">{latestDeployment.meta.githubCommitMessage}</p>
                  )}
                  {latestDeployment.meta?.githubCommitRef && (
                    <p className="preview-branch-info">Branch: {latestDeployment.meta.githubCommitRef}</p>
                  )}
                </div>
              )
            ) : vercel.status !== 'connected' ? (
              <div className="preview-placeholder">
                <p>Connect Vercel to view deployments</p>
                <a href="/integrations/vercel" className="connect-vercel-btn">Connect Vercel</a>
              </div>
            ) : (
              <div className="preview-placeholder">
                <p>No deployments found</p>
                <p className="preview-hint">Push to your repository to trigger a deployment</p>
              </div>
            )
          )}
        </PullToRefresh>
      ) : (
        <div className="preview-content">
          {isInIframe ? (
            <div className="preview-placeholder">
              <p>Preview disabled in nested view</p>
              <p className="preview-hint">Open in a new window to use preview</p>
            </div>
          ) : previewMode === 'local' ? (
            hasActivePorts && selectedPort && effectiveSessionId ? (
              <iframe
                ref={iframeRef}
                src={getLocalPreviewUrl()}
                className="preview-iframe"
                title="Local Preview"
              />
            ) : (
              <div className="preview-placeholder">
                <div className="server-status scanning">
                  <div className="scanning-animation" />
                  <span>{effectiveSessionId ? 'Scanning for dev servers' : 'Connecting to session...'}</span>
                </div>
                <p className="preview-hint">Start a dev server in the terminal</p>
                <p className="preview-ports-hint">Monitoring ports 3000-3999</p>
              </div>
            )
          ) : (
            deploymentsLoading ? (
              <div className="preview-placeholder">
                <div className="loading-spinner" />
                <p>Loading deployments...</p>
              </div>
            ) : latestDeployment ? (
              latestDeployment.state === 'READY' ? (
                <iframe
                  ref={iframeRef}
                  src={getDeployedUrl() || ''}
                  className="preview-iframe"
                  title="Deployed Preview"
                />
              ) : (
                <div className="preview-placeholder">
                  <div className={`deployment-status-indicator ${latestDeployment.state.toLowerCase()}`}>
                    {latestDeployment.state === 'BUILDING' && <div className="loading-spinner" />}
                    <span>{latestDeployment.state}</span>
                  </div>
                  {latestDeployment.meta?.githubCommitMessage && (
                    <p className="preview-commit-message">{latestDeployment.meta.githubCommitMessage}</p>
                  )}
                  {latestDeployment.meta?.githubCommitRef && (
                    <p className="preview-branch-info">Branch: {latestDeployment.meta.githubCommitRef}</p>
                  )}
                </div>
              )
            ) : vercel.status !== 'connected' ? (
              <div className="preview-placeholder">
                <p>Connect Vercel to view deployments</p>
                <a href="/integrations/vercel" className="connect-vercel-btn">Connect Vercel</a>
              </div>
            ) : (
              <div className="preview-placeholder">
                <p>No deployments found</p>
                <p className="preview-hint">Push to your repository to trigger a deployment</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Console */}
      <div className="preview-console">
        <div className="console-tabs">
          <button
            className={`console-tab ${activeConsoleTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveConsoleTab('logs')}
          >
            Logs
          </button>
          <button
            className={`console-tab ${activeConsoleTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveConsoleTab('network')}
          >
            Network
          </button>
          <button className="console-tab-action" onClick={handleClearConsole}>Clear</button>
        </div>
        <div className="console-content">
          {consoleLogs.map((log, idx) => (
            <div key={idx} className="console-line">
              <span className="console-time">{log.time}</span>
              <span className="console-message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
