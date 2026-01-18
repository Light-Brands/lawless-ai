'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

export default function AuthGate({ children }: AuthGateProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  useEffect(() => {
    // Only redirect if not loading and user is not authenticated
    if (!loading && !user && !isPublicRoute) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, isPublicRoute, pathname, router]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="auth-gate-loading">
        <div className="auth-gate-spinner" />
        <style jsx>{`
          .auth-gate-loading {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--color-bg-primary, #0a0a0f);
            z-index: 9999;
          }

          .auth-gate-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: auth-spin 1s linear infinite;
          }

          @keyframes auth-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // Public routes can render without authentication
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Protected routes: only render if authenticated
  if (!user) {
    // Redirect is happening via useEffect, show loading in the meantime
    return (
      <div className="auth-gate-loading">
        <div className="auth-gate-spinner" />
        <style jsx>{`
          .auth-gate-loading {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--color-bg-primary, #0a0a0f);
            z-index: 9999;
          }

          .auth-gate-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: auth-spin 1s linear infinite;
          }

          @keyframes auth-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}
