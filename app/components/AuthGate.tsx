'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/ide'];

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
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}
