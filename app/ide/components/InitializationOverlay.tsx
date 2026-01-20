'use client';

import React from 'react';
import { useServiceContext, ConnectionStatus } from '../contexts/ServiceContext';

interface ServiceStatusIndicatorProps {
  name: string;
  status: ConnectionStatus;
  optional?: boolean;
}

function ServiceStatusIndicator({ name, status, optional }: ServiceStatusIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <span className="init-spinner" />;
      case 'connected':
        return <span className="init-check">✓</span>;
      case 'error':
        return <span className="init-error">✗</span>;
      case 'disconnected':
        return optional ? <span className="init-skip">—</span> : <span className="init-pending" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Failed';
      case 'disconnected':
        return optional ? 'Not configured' : 'Waiting...';
    }
  };

  return (
    <div className={`init-service-item ${status}`}>
      <span className="init-service-icon">{getStatusIcon()}</span>
      <span className="init-service-name">{name}</span>
      <span className="init-service-status">{getStatusText()}</span>
    </div>
  );
}

export function InitializationOverlay() {
  const {
    isInitializing,
    initProgress,
    initStep,
    github,
    supabase,
    vercel,
    worktree,
    terminal,
  } = useServiceContext();

  if (!isInitializing) {
    return null;
  }

  return (
    <div className="init-overlay">
      <div className="init-container">
        <div className="init-header">
          <div className="init-logo">
            <span className="init-logo-text">Lawless AI</span>
          </div>
          <h2 className="init-title">Initializing Workspace</h2>
        </div>

        <div className="init-progress-container">
          <div className="init-progress-bar">
            <div
              className="init-progress-fill"
              style={{ width: `${initProgress}%` }}
            />
          </div>
          <div className="init-progress-text">
            <span>{initStep}</span>
            <span>{initProgress}%</span>
          </div>
        </div>

        <div className="init-services">
          <ServiceStatusIndicator name="GitHub" status={github.status} />
          <ServiceStatusIndicator name="Supabase" status={supabase.status} optional />
          <ServiceStatusIndicator name="Vercel" status={vercel.status} optional />
          <ServiceStatusIndicator name="Worktree" status={worktree.status} />
          <ServiceStatusIndicator name="Terminal" status={terminal.status} />
        </div>
      </div>

      <style jsx>{`
        .init-overlay {
          position: fixed;
          inset: 0;
          background: var(--bg-primary, #0d0d0f);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .init-container {
          width: 100%;
          max-width: 400px;
          padding: 32px;
        }

        .init-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .init-logo {
          margin-bottom: 16px;
        }

        .init-logo-text {
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .init-title {
          font-size: 18px;
          font-weight: 500;
          color: var(--text-secondary, #888);
          margin: 0;
        }

        .init-progress-container {
          margin-bottom: 32px;
        }

        .init-progress-bar {
          height: 4px;
          background: var(--bg-tertiary, #1a1a1f);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .init-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #7c3aed 0%, #ec4899 100%);
          border-radius: 2px;
          transition: width 0.3s ease-out;
        }

        .init-progress-text {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .init-services {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .init-service-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--bg-secondary, #141417);
          border-radius: 8px;
          border: 1px solid var(--border-color, #2a2a2f);
        }

        .init-service-item.connected {
          border-color: rgba(34, 197, 94, 0.3);
        }

        .init-service-item.error {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .init-service-item.connecting {
          border-color: rgba(124, 58, 237, 0.3);
        }

        .init-service-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .init-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid var(--bg-tertiary, #2a2a2f);
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .init-check {
          color: #22c55e;
          font-weight: 600;
        }

        .init-error {
          color: #ef4444;
          font-weight: 600;
        }

        .init-skip {
          color: var(--text-secondary, #666);
        }

        .init-pending {
          width: 8px;
          height: 8px;
          background: var(--bg-tertiary, #2a2a2f);
          border-radius: 50%;
        }

        .init-service-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #fff);
        }

        .init-service-status {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .init-service-item.connected .init-service-status {
          color: #22c55e;
        }

        .init-service-item.error .init-service-status {
          color: #ef4444;
        }

        .init-service-item.connecting .init-service-status {
          color: #7c3aed;
        }
      `}</style>
    </div>
  );
}
