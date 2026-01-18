'use client';

import { useState, useEffect, useCallback } from 'react';

interface CredentialsModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  credentials: { label: string; value: string }[];
  warningMessage?: string;
  onClose: () => void;
}

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5V19a9 3 0 0 0 18 0V5"/>
    <path d="M3 12a9 3 0 0 0 18 0"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
);

export default function CredentialsModal({
  isOpen,
  title,
  subtitle,
  credentials,
  warningMessage = "This information won't be shown again. Please save it securely.",
  onClose,
}: CredentialsModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleCopy = useCallback(async (value: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="credentials-modal-overlay" onClick={onClose}>
      <div className="credentials-modal" onClick={(e) => e.stopPropagation()}>
        <button className="credentials-modal-close" onClick={onClose}>
          <XIcon />
        </button>

        <div className="credentials-modal-icon">
          <DatabaseIcon />
        </div>

        <h2 className="credentials-modal-title">{title}</h2>
        {subtitle && <p className="credentials-modal-subtitle">{subtitle}</p>}

        <div className="credentials-modal-content">
          {credentials.map((cred, index) => (
            <div key={index} className="credentials-modal-field">
              <label className="credentials-modal-label">{cred.label}</label>
              <div className="credentials-modal-value-row">
                <code className="credentials-modal-value">{cred.value}</code>
                <button
                  className={`credentials-modal-copy-btn ${copiedIndex === index ? 'copied' : ''}`}
                  onClick={() => handleCopy(cred.value, index)}
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
                  <span>{copiedIndex === index ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {warningMessage && (
          <div className="credentials-modal-warning">
            <WarningIcon />
            <span>{warningMessage}</span>
          </div>
        )}

        <button className="credentials-modal-dismiss" onClick={onClose}>
          I've saved this information
        </button>
      </div>
    </div>
  );
}
