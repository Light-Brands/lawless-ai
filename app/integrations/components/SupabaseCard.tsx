'use client';

import { useState } from 'react';
import Link from 'next/link';
import TokenInputModal from './TokenInputModal';

interface SupabaseCardProps {
  connected: boolean;
  projectCount?: number;
  onDisconnect: () => void;
  onRefresh: () => void;
}

const SupabaseIcon = () => (
  <svg viewBox="0 0 109 113" width="32" height="32" fill="none">
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear_supabase)"/>
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear_supabase)" fillOpacity="0.2"/>
    <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
    <defs>
      <linearGradient id="paint0_linear_supabase" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
        <stop stopColor="#249361"/>
        <stop offset="1" stopColor="#3ECF8E"/>
      </linearGradient>
      <linearGradient id="paint1_linear_supabase" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
        <stop/>
        <stop offset="1" stopOpacity="0"/>
      </linearGradient>
    </defs>
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

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
    <path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);

export default function SupabaseCard({ connected, projectCount, onDisconnect, onRefresh }: SupabaseCardProps) {
  const [showTokenModal, setShowTokenModal] = useState(false);

  async function handleTokenSubmit(token: string) {
    try {
      const res = await fetch('/api/auth/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setShowTokenModal(false);
      onRefresh();
    } catch (error) {
      throw error;
    }
  }

  return (
    <>
      <div className={`integration-card ${connected ? 'connected' : ''}`}>
        <div className="integration-card-header">
          <div className="integration-card-icon supabase">
            <SupabaseIcon />
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
          <h3>Supabase</h3>
          {connected ? (
            <div className="integration-card-stats">
              <div className="integration-stat">
                <DatabaseIcon />
                <span>{projectCount || 0} project{projectCount !== 1 ? 's' : ''} connected</span>
              </div>
            </div>
          ) : (
            <p className="integration-card-description">
              Connect Supabase to browse tables, execute queries, and manage data
            </p>
          )}
        </div>

        <div className="integration-card-actions">
          {connected ? (
            <>
              <Link href="/integrations/supabase" className="integration-btn primary">
                <span>Browse Database</span>
                <ArrowRightIcon />
              </Link>
              <button onClick={onDisconnect} className="integration-btn danger">
                <DisconnectIcon />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowTokenModal(true)}
              className="integration-btn connect supabase"
            >
              <SupabaseIcon />
              <span>Connect Supabase</span>
            </button>
          )}
        </div>
      </div>

      {showTokenModal && (
        <TokenInputModal
          service="supabase"
          onSubmit={handleTokenSubmit}
          onClose={() => setShowTokenModal(false)}
        />
      )}
    </>
  );
}
