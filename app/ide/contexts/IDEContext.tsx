'use client';

import React, { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { useIDEStore } from '../stores/ideStore';

interface IDEContextValue {
  owner: string;
  repo: string;
  sessionId: string | null;
  repoFullName: string;
}

const IDEContext = createContext<IDEContextValue | null>(null);

interface IDEProviderProps {
  owner: string;
  repo: string;
  sessionId: string | null;
  children: ReactNode;
}

export function IDEProvider({ owner, repo, sessionId, children }: IDEProviderProps) {
  const { resetProjectState } = useIDEStore();
  const previousRepoRef = useRef<string | null>(null);
  const repoFullName = `${owner}/${repo}`;

  // CRITICAL: Safety check - reset state if repo changes
  // This catches any repo switches that bypass the normal header flow
  useEffect(() => {
    if (previousRepoRef.current !== null && previousRepoRef.current !== repoFullName) {
      console.log(`[IDEContext] Repo changed from ${previousRepoRef.current} to ${repoFullName} - resetting state`);
      resetProjectState();
    }
    previousRepoRef.current = repoFullName;
  }, [repoFullName, resetProjectState]);

  const value: IDEContextValue = {
    owner,
    repo,
    sessionId,
    repoFullName,
  };

  return <IDEContext.Provider value={value}>{children}</IDEContext.Provider>;
}

export function useIDEContext() {
  const context = useContext(IDEContext);
  if (!context) {
    // Return defaults for standalone IDE usage
    return {
      owner: '',
      repo: '',
      sessionId: null,
      repoFullName: '',
    };
  }
  return context;
}
