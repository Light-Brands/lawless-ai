'use client';

import React from 'react';
import { useIDEStore } from '../../../stores/ideStore';

export function PreviewPane() {
  const { previewMode, setPreviewMode, serverStatus, serverPort } = useIDEStore();

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
            {serverStatus === 'running' && <span className="status-indicator running" />}
          </button>
          <button
            className={`preview-mode-btn ${previewMode === 'deployed' ? 'active' : ''}`}
            onClick={() => setPreviewMode('deployed')}
          >
            Deployed
          </button>
        </div>
        <button className="preview-refresh-btn" title="Refresh">
          ↻
        </button>
      </div>

      {/* URL bar */}
      <div className="preview-url-bar">
        {previewMode === 'local' ? (
          <span>
            {serverStatus === 'running'
              ? `http://localhost:${serverPort || 3000}`
              : 'Server not running'}
          </span>
        ) : (
          <span>https://your-app.vercel.app</span>
        )}
      </div>

      {/* Preview iframe */}
      <div className="preview-content">
        {previewMode === 'local' ? (
          serverStatus === 'running' ? (
            <iframe
              src={`http://localhost:${serverPort || 3000}`}
              className="preview-iframe"
              title="Local Preview"
            />
          ) : (
            <div className="preview-placeholder">
              <div className="server-status">
                <span className={`status-icon ${serverStatus}`} />
                <span>Server {serverStatus}</span>
              </div>
              {serverStatus === 'stopped' && (
                <button className="start-server-btn">Start Dev Server</button>
              )}
              {serverStatus === 'starting' && <div className="loading-spinner" />}
            </div>
          )
        ) : (
          <div className="preview-placeholder">
            <p>Vercel preview will load here</p>
            <p className="preview-status">Building...</p>
          </div>
        )}
      </div>

      {/* Console */}
      <div className="preview-console">
        <div className="console-tabs">
          <button className="console-tab active">Logs</button>
          <button className="console-tab">Network</button>
          <button className="console-tab-action">Clear</button>
        </div>
        <div className="console-content">
          <div className="console-line">
            <span className="console-time">10:45:32</span>
            <span className="console-message">Ready on http://localhost:3000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
