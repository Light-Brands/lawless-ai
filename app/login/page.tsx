'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import './login.css';

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const errorParam = searchParams.get('error');
  const nextParam = searchParams.get('next') || '/repos';

  useEffect(() => {
    // Check if user is already authenticated
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (data.authenticated) {
          // User is already logged in, redirect to next page
          router.replace(nextParam);
          return;
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [router, nextParam]);

  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_failed: 'GitHub authentication failed. Please try again.',
        no_code: 'No authorization code received from GitHub.',
        auth_failed: 'Failed to create session. Please try again.',
        no_session: 'Session could not be established.',
        access_denied: 'Access was denied. Please try again.',
      };
      setError(errorMessages[errorParam] || 'Authentication error. Please try again.');
    }
  }, [errorParam]);

  const handleGitHubLogin = () => {
    // Redirect to GitHub OAuth via our auth endpoint
    const authUrl = `/api/auth/github?next=${encodeURIComponent(nextParam)}`;
    window.location.href = authUrl;
  };

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-loading">
          <div className="login-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Ambient background effects */}
      <div className="login-ambient" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <LightningIcon />
          </div>
          <span className="login-logo-text">Lawless AI</span>
        </div>

        {/* Title */}
        <h1 className="login-title">Welcome</h1>
        <p className="login-subtitle">Sign in to access your AI-powered development workspace</p>

        {/* Error message */}
        {error && (
          <div className="login-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* GitHub Login Button */}
        <button onClick={handleGitHubLogin} className="login-github-btn">
          <GitHubIcon />
          <span>Continue with GitHub</span>
        </button>

        {/* Terms */}
        <p className="login-terms">
          By signing in, you agree to grant access to your GitHub repositories for code editing and analysis.
        </p>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <span>Powered by Claude</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-page">
        <div className="login-loading">
          <div className="login-spinner" />
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
