'use client';

import { useState, useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  requireTypedConfirmation?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
);

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel = 'Delete',
  variant = 'danger',
  requireTypedConfirmation = true,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationModalProps) {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedValue('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const isConfirmEnabled = !requireTypedConfirmation || typedValue === confirmText;

  return (
    <div className="confirmation-modal-overlay" onClick={isLoading ? undefined : onCancel}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="confirmation-modal-close"
          onClick={onCancel}
          disabled={isLoading}
        >
          <XIcon />
        </button>

        <div className={`confirmation-modal-icon ${variant}`}>
          <AlertIcon />
        </div>

        <h2 className="confirmation-modal-title">{title}</h2>
        <p className="confirmation-modal-message">{message}</p>

        {requireTypedConfirmation && (
          <div className="confirmation-modal-input-section">
            <label className="confirmation-modal-label">
              Type <strong>{confirmText}</strong> to confirm:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              className="confirmation-modal-input"
              placeholder={confirmText}
              disabled={isLoading}
              autoFocus
            />
          </div>
        )}

        <div className="confirmation-modal-actions">
          <button
            className="confirmation-modal-btn cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className={`confirmation-modal-btn confirm ${variant}`}
            onClick={onConfirm}
            disabled={!isConfirmEnabled || isLoading}
          >
            {isLoading ? (
              <span className="confirmation-modal-spinner"></span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
