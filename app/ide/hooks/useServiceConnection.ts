'use client';

import { useServiceContext, ConnectionStatus } from '../contexts/ServiceContext';

/**
 * Hook to get overall service connection status and initialization state
 */
export function useServiceConnection() {
  const {
    isInitializing,
    initProgress,
    initStep,
    github,
    supabase,
    vercel,
    worktree,
    terminal,
    refreshIntegrations,
  } = useServiceContext();

  // Compute overall status
  const isAllConnected =
    github.status === 'connected' &&
    terminal.status === 'connected';

  const hasErrors =
    github.status === 'error' ||
    supabase.status === 'error' ||
    vercel.status === 'error' ||
    worktree.status === 'error' ||
    terminal.status === 'error';

  const isAnyConnecting =
    github.status === 'connecting' ||
    supabase.status === 'connecting' ||
    vercel.status === 'connecting' ||
    worktree.status === 'connecting' ||
    terminal.status === 'connecting';

  // Summary status for header indicators
  const getSummaryStatus = (): ConnectionStatus => {
    if (isInitializing) return 'connecting';
    if (hasErrors) return 'error';
    if (isAnyConnecting) return 'connecting';
    if (isAllConnected) return 'connected';
    return 'disconnected';
  };

  // Get status color for UI
  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '#22c55e'; // green
      case 'connecting':
        return '#f59e0b'; // amber
      case 'error':
        return '#ef4444'; // red
      case 'disconnected':
        return '#6b7280'; // gray
    }
  };

  return {
    isInitializing,
    initProgress,
    initStep,
    isAllConnected,
    hasErrors,
    isAnyConnecting,
    summaryStatus: getSummaryStatus(),
    getStatusColor,
    services: {
      github,
      supabase,
      vercel,
      worktree,
      terminal,
    },
    refresh: refreshIntegrations,
  };
}
