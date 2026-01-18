'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  login: string;
  name: string;
  avatar: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();

      if (data.authenticated && data.user) {
        setUser({
          id: data.user.id || '',
          login: data.user.login,
          name: data.user.name,
          avatar: data.user.avatar,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    await fetchAuthStatus();
  }, [fetchAuthStatus]);

  useEffect(() => {
    // Initial auth check
    fetchAuthStatus();

    // Listen for Supabase auth state changes
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Refresh auth status when user signs in
          await fetchAuthStatus();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAuthStatus]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
