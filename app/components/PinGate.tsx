'use client';

import { useState, useEffect, useRef } from 'react';

interface PinGateProps {
  children: React.ReactNode;
}

export default function PinGate({ children }: PinGateProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if already verified on mount
  useEffect(() => {
    async function checkPinStatus() {
      try {
        const response = await fetch('/api/auth/pin');
        const data = await response.json();
        setIsVerified(data.verified);
      } catch {
        // If check fails, assume not verified
        setIsVerified(false);
      }
    }
    checkPinStatus();
  }, []);

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3 && newPin.every(d => d)) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, 4).split('');
        const newPin = ['', '', '', ''];
        digits.forEach((d, i) => {
          newPin[i] = d;
        });
        setPin(newPin);
        if (digits.length === 4) {
          handleSubmit(newPin.join(''));
        } else {
          inputRefs.current[digits.length]?.focus();
        }
      });
    }
  };

  const handleSubmit = async (pinValue: string) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue }),
      });

      const data = await response.json();

      if (data.verified) {
        setIsVerified(true);
      } else {
        setError('Invalid PIN');
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Verification failed. Please try again.');
      setPin(['', '', '', '']);
    } finally {
      setIsLoading(false);
    }
  };

  // Still checking status
  if (isVerified === null) {
    return (
      <div className="pin-gate-loading">
        <div className="pin-gate-spinner" />
      </div>
    );
  }

  // Verified - show children
  if (isVerified) {
    return <>{children}</>;
  }

  // Not verified - show PIN entry
  return (
    <div className="pin-gate">
      <style jsx>{`
        .pin-gate {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
          z-index: 9999;
        }

        .pin-gate-loading {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d1117;
          z-index: 9999;
        }

        .pin-gate-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #30363d;
          border-top-color: #a855f7;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .pin-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .pin-logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pin-logo-text {
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pin-card {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          max-width: 320px;
          width: 90%;
        }

        .pin-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #c9d1d9;
          margin-bottom: 0.5rem;
        }

        .pin-subtitle {
          font-size: 0.875rem;
          color: #8b949e;
          margin-bottom: 1.5rem;
        }

        .pin-inputs {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .pin-input {
          width: 56px;
          height: 64px;
          text-align: center;
          font-size: 1.5rem;
          font-weight: 600;
          background: #0d1117;
          border: 2px solid #30363d;
          border-radius: 12px;
          color: #c9d1d9;
          outline: none;
          transition: all 0.15s;
        }

        .pin-input:focus {
          border-color: #a855f7;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
        }

        .pin-input.filled {
          border-color: #a855f7;
        }

        .pin-error {
          color: #f85149;
          font-size: 0.875rem;
          margin-top: 1rem;
          min-height: 1.25rem;
        }

        .pin-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: #8b949e;
          font-size: 0.875rem;
          margin-top: 1rem;
        }

        .pin-loading-dot {
          width: 6px;
          height: 6px;
          background: #a855f7;
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite;
        }

        .pin-loading-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .pin-loading-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="pin-logo">
        <div className="pin-logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="pin-logo-text">Lawless AI</span>
      </div>

      <div className="pin-card">
        <h1 className="pin-title">Enter PIN</h1>
        <p className="pin-subtitle">Enter your 4-digit access code</p>

        <div className="pin-inputs">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`pin-input ${digit ? 'filled' : ''}`}
              disabled={isLoading}
              autoFocus={index === 0}
            />
          ))}
        </div>

        {isLoading ? (
          <div className="pin-loading">
            <span className="pin-loading-dot" />
            <span className="pin-loading-dot" />
            <span className="pin-loading-dot" />
            <span>Verifying...</span>
          </div>
        ) : (
          <div className="pin-error">{error}</div>
        )}
      </div>
    </div>
  );
}
