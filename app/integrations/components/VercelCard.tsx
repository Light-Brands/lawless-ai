'use client';

import Link from 'next/link';

interface VercelCardProps {
  connected: boolean;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onDisconnect: () => void;
  onRefresh: () => void;
}

const VercelIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
    <path d="M24 22.525H0l12-21.05 12 21.05z"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/>
    <path d="m12 5 7 7-7 7"/>
  </svg>
);

const DisconnectIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/>
    <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/>
    <line x1="8" x2="8" y1="2" y2="5"/>
    <line x1="2" x2="5" y1="8" y2="8"/>
    <line x1="16" x2="16" y1="19" y2="22"/>
    <line x1="19" x2="22" y1="16" y2="16"/>
  </svg>
);

export default function VercelCard({ connected, user, onDisconnect, onRefresh }: VercelCardProps) {
  // OAuth is handled server-side via /api/auth/vercel
  const authUrl = '/api/auth/vercel';

  return (
    <div className={`integration-card ${connected ? 'connected' : ''}`}>
      <div className="integration-card-header">
        <div className="integration-card-icon vercel">
          <VercelIcon />
        </div>
        <div className="integration-card-status">
          {connected ? (
            <span className="status-badge connected">
              <span className="status-dot"></span>
              Connected
            </span>
          ) : (
            <span className="status-badge disconnected">Not connected</span>
          )}
        </div>
      </div>

      <div className="integration-card-content">
        <h3>Vercel</h3>
        {connected && user ? (
          <div className="integration-card-user">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="integration-user-avatar" />
            ) : (
              <div className="integration-user-avatar-placeholder">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="integration-user-info">
              <span className="integration-user-name">{user.name}</span>
              <span className="integration-user-handle">{user.email}</span>
            </div>
          </div>
        ) : (
          <p className="integration-card-description">
            Connect Vercel to view deployments, logs, and trigger redeploys
          </p>
        )}
      </div>

      <div className="integration-card-actions">
        {connected ? (
          <>
            <Link href="/integrations/vercel" className="integration-btn primary">
              <span>View Deployments</span>
              <ArrowRightIcon />
            </Link>
            <button onClick={onDisconnect} className="integration-btn danger">
              <DisconnectIcon />
              <span>Disconnect</span>
            </button>
          </>
        ) : (
          <a href={authUrl} className="integration-btn connect vercel">
            <VercelIcon />
            <span>Connect Vercel</span>
          </a>
        )}
      </div>
    </div>
  );
}
