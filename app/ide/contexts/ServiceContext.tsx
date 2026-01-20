'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useIDEContext } from './IDEContext';

// Connection status types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Service connection interfaces
export interface SupabaseConnection {
  status: ConnectionStatus;
  projectRef: string | null;
  error?: string;
}

export interface VercelConnection {
  status: ConnectionStatus;
  projectId: string | null;
  teamId?: string | null;
  error?: string;
}

export interface GitHubConnection {
  status: ConnectionStatus;
  error?: string;
}

export interface WorktreeConnection {
  status: ConnectionStatus;
  path: string | null;
  branchName: string | null;
  error?: string;
}

export interface TerminalConnection {
  status: ConnectionStatus;
  sessionId: string | null;
  error?: string;
}

// Service context value
export interface ServiceContextValue {
  // Overall initialization state
  isInitializing: boolean;
  initProgress: number;
  initStep: string;

  // Individual service connections
  supabase: SupabaseConnection;
  vercel: VercelConnection;
  github: GitHubConnection;
  worktree: WorktreeConnection;
  terminal: TerminalConnection;

  // Actions
  refreshIntegrations: () => Promise<void>;
  initializeWorktree: () => Promise<void>;
  initializeTerminal: () => Promise<void>;
}

const defaultServiceContext: ServiceContextValue = {
  isInitializing: true,
  initProgress: 0,
  initStep: 'Initializing...',

  supabase: { status: 'disconnected', projectRef: null },
  vercel: { status: 'disconnected', projectId: null },
  github: { status: 'disconnected' },
  worktree: { status: 'disconnected', path: null, branchName: null },
  terminal: { status: 'disconnected', sessionId: null },

  refreshIntegrations: async () => {},
  initializeWorktree: async () => {},
  initializeTerminal: async () => {},
};

const ServiceContext = createContext<ServiceContextValue>(defaultServiceContext);

interface ServiceProviderProps {
  children: ReactNode;
  sessionId?: string | null;
}

export function ServiceProvider({ children, sessionId }: ServiceProviderProps) {
  const { owner, repo, repoFullName } = useIDEContext();

  // Overall initialization state
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState(0);
  const [initStep, setInitStep] = useState('Starting initialization...');

  // Service states
  const [supabase, setSupabase] = useState<SupabaseConnection>({
    status: 'disconnected',
    projectRef: null,
  });

  const [vercel, setVercel] = useState<VercelConnection>({
    status: 'disconnected',
    projectId: null,
  });

  const [github, setGithub] = useState<GitHubConnection>({
    status: 'disconnected',
  });

  const [worktree, setWorktree] = useState<WorktreeConnection>({
    status: 'disconnected',
    path: null,
    branchName: null,
  });

  const [terminal, setTerminal] = useState<TerminalConnection>({
    status: 'disconnected',
    sessionId: null,
  });

  // Fetch integrations from API
  const fetchIntegrations = useCallback(async () => {
    if (!repoFullName) return;

    setInitStep('Fetching repository integrations...');
    setInitProgress(10);

    try {
      const response = await fetch(`/api/repos/integrations?repo=${encodeURIComponent(repoFullName)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      setInitProgress(30);

      // Update Supabase connection
      if (data.integrations?.supabase?.projectRef) {
        setSupabase({
          status: 'connected',
          projectRef: data.integrations.supabase.projectRef,
        });
      } else {
        setSupabase({
          status: 'disconnected',
          projectRef: null,
        });
      }

      // Update Vercel connection
      if (data.integrations?.vercel?.projectId) {
        setVercel({
          status: 'connected',
          projectId: data.integrations.vercel.projectId,
          teamId: data.integrations.vercel.teamId,
        });
      } else {
        setVercel({
          status: 'disconnected',
          projectId: null,
        });
      }

    } catch (err) {
      console.error('Failed to fetch integrations:', err);
      setSupabase(prev => ({ ...prev, status: 'error', error: 'Failed to fetch integrations' }));
      setVercel(prev => ({ ...prev, status: 'error', error: 'Failed to fetch integrations' }));
    }
  }, [repoFullName]);

  // Initialize GitHub connection (validate we can access the repo)
  const initializeGitHub = useCallback(async () => {
    if (!owner || !repo) return;

    setInitStep('Connecting to GitHub...');
    setGithub({ status: 'connecting' });

    try {
      const response = await fetch(`/api/github/tree?owner=${owner}&repo=${repo}`);

      if (!response.ok) {
        throw new Error('Failed to access repository');
      }

      setGithub({ status: 'connected' });
      setInitProgress(50);
    } catch (err) {
      console.error('Failed to connect to GitHub:', err);
      setGithub({ status: 'error', error: 'Failed to access repository' });
    }
  }, [owner, repo]);

  // Initialize worktree for the session
  const initializeWorktree = useCallback(async () => {
    if (!owner || !repo || !sessionId) {
      setWorktree({ status: 'disconnected', path: null, branchName: null });
      return;
    }

    setInitStep('Setting up worktree...');
    setWorktree(prev => ({ ...prev, status: 'connecting' }));

    try {
      // Check if session has a worktree
      const response = await fetch(`/api/workspace/session/${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to get session');
      }

      const data = await response.json();

      if (data.session?.worktreePath) {
        setWorktree({
          status: 'connected',
          path: data.session.worktreePath,
          branchName: data.session.branchName || 'main',
        });
      } else {
        // Session exists but no worktree yet - that's okay for now
        setWorktree({
          status: 'disconnected',
          path: null,
          branchName: data.session?.branchName || 'main',
        });
      }

      setInitProgress(70);
    } catch (err) {
      console.error('Failed to initialize worktree:', err);
      setWorktree({ status: 'error', path: null, branchName: null, error: 'Failed to setup worktree' });
    }
  }, [owner, repo, sessionId]);

  // Initialize terminal connection (just check if terminal service is available)
  const initializeTerminal = useCallback(async () => {
    if (!sessionId) {
      setTerminal({ status: 'disconnected', sessionId: null });
      return;
    }

    setInitStep('Preparing terminal...');
    setTerminal(prev => ({ ...prev, status: 'connecting' }));

    // Terminal is ready when we have a session ID - actual WebSocket connection
    // happens when the TerminalPane is opened
    setTerminal({
      status: 'connected',
      sessionId,
    });

    setInitProgress(90);
  }, [sessionId]);

  // Refresh integrations action
  const refreshIntegrations = useCallback(async () => {
    setSupabase(prev => ({ ...prev, status: 'connecting' }));
    setVercel(prev => ({ ...prev, status: 'connecting' }));
    await fetchIntegrations();
  }, [fetchIntegrations]);

  // Run initialization sequence when component mounts or dependencies change
  useEffect(() => {
    if (!repoFullName) return;

    const initialize = async () => {
      setIsInitializing(true);
      setInitProgress(0);
      setInitStep('Starting initialization...');

      try {
        // Step 1: Fetch integrations
        await fetchIntegrations();

        // Step 2: Initialize GitHub (in parallel with other services)
        await Promise.all([
          initializeGitHub(),
          initializeWorktree(),
          initializeTerminal(),
        ]);

        setInitStep('Ready');
        setInitProgress(100);
      } catch (err) {
        console.error('Initialization failed:', err);
        setInitStep('Initialization failed');
      } finally {
        // Small delay to show completion
        setTimeout(() => {
          setIsInitializing(false);
        }, 300);
      }
    };

    initialize();
  }, [repoFullName, sessionId, fetchIntegrations, initializeGitHub, initializeWorktree, initializeTerminal]);

  const value: ServiceContextValue = {
    isInitializing,
    initProgress,
    initStep,
    supabase,
    vercel,
    github,
    worktree,
    terminal,
    refreshIntegrations,
    initializeWorktree,
    initializeTerminal,
  };

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServiceContext() {
  const context = useContext(ServiceContext);
  return context;
}

// Convenience hooks for individual services
export function useSupabaseConnection() {
  const { supabase, refreshIntegrations } = useServiceContext();
  return { ...supabase, refresh: refreshIntegrations };
}

export function useVercelConnection() {
  const { vercel, refreshIntegrations } = useServiceContext();
  return { ...vercel, refresh: refreshIntegrations };
}

export function useGitHubConnection() {
  const { github } = useServiceContext();
  return github;
}

export function useWorktreeConnection() {
  const { worktree, initializeWorktree } = useServiceContext();
  return { ...worktree, initialize: initializeWorktree };
}

export function useTerminalConnection() {
  const { terminal, initializeTerminal } = useServiceContext();
  return { ...terminal, initialize: initializeTerminal };
}
