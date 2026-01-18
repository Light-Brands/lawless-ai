'use client';

import { useState } from 'react';

interface TokenInputModalProps {
  service: 'supabase' | 'vercel';
  onSubmit: (token: string) => Promise<void>;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18"/>
    <line x1="6" x2="18" y1="6" y2="18"/>
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5"/>
    <path d="m21 2-9.6 9.6"/>
    <path d="m15.5 7.5 3 3L22 7l-3-3"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" x2="21" y1="14" y2="3"/>
  </svg>
);

export default function TokenInputModal({ service, onSubmit, onClose }: TokenInputModalProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceConfig = {
    supabase: {
      title: 'Connect Supabase',
      description: 'Enter your Supabase Personal Access Token to connect your projects.',
      placeholder: 'sbp_xxxxxxxxxxxxxxxxxxxx',
      helpUrl: 'https://supabase.com/dashboard/account/tokens',
      helpText: 'Get your token from Supabase Dashboard',
    },
    vercel: {
      title: 'Connect Vercel',
      description: 'Enter your Vercel Personal Access Token to connect your deployments.',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
      helpUrl: 'https://vercel.com/account/tokens',
      helpText: 'Get your token from Vercel Dashboard',
    },
  };

  const config = serviceConfig[service];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(token.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect. Please check your token.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content token-modal">
        <button className="modal-close" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="modal-header">
          <div className={`modal-icon ${service}`}>
            <KeyIcon />
          </div>
          <h2>{config.title}</h2>
          <p>{config.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="token-form">
          <div className="form-field">
            <label htmlFor="token">Personal Access Token</label>
            <div className="token-input-wrapper">
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={config.placeholder}
                autoFocus
                autoComplete="off"
              />
            </div>
            {error && <span className="form-error">{error}</span>}
          </div>

          <a
            href={config.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="token-help-link"
          >
            {config.helpText}
            <ExternalLinkIcon />
          </a>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-btn secondary">
              Cancel
            </button>
            <button type="submit" className="modal-btn primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
