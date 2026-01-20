'use client';

import React, { createContext, useContext, ReactNode } from 'react';

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
  const value: IDEContextValue = {
    owner,
    repo,
    sessionId,
    repoFullName: `${owner}/${repo}`,
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
