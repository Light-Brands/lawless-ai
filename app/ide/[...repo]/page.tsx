'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useIDEStore } from '../stores/ideStore';
import { IDELayout } from '../components/IDELayout';
import { IDEHeader } from '../components/IDEHeader';
import { CommandPalette } from '../components/CommandPalette';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ideEvents } from '../lib/eventBus';

interface WorkspaceSession {
  sessionId: string;
  name: string;
  branchName: string;
  baseBranch: string;
  baseCommit: string;
  createdAt: string;
  lastAccessedAt: string;
  messageCount?: number;
  isValid?: boolean;
}

export default function IDERepoPage() {
  const params = useParams();
  const router = useRouter();
  const repoFullName = Array.isArray(params.repo) ? params.repo.join('/') : params.repo;
  const [owner, repoName] = (repoFullName || '').split('/');

  const {
    setActiveSession,
    addSession,
  } = useIDEStore();

  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Fetch existing sessions for this repo
  const fetchSessions = useCallback(async () => {
    if (!owner || !repoName) return;

    try {
      const response = await fetch(`/api/workspace/sessions/${owner}/${repoName}`);
      const data = await response.json();

      if (data.sessions) {
        setSessions(data.sessions);
        // If there's a most recent session, use it
        if (data.sessions.length > 0) {
          const mostRecent = data.sessions[0];
          setActiveSessionId(mostRecent.sessionId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [owner, repoName]);

  // Create a new session
  const createSession = useCallback(async (name?: string) => {
    if (!owner || !repoName) return;

    try {
      const response = await fetch('/api/workspace/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo: repoName,
          name: name || `Session ${new Date().toLocaleDateString()}`,
        }),
      });

      const data = await response.json();

      if (data.sessionId) {
        const newSession: WorkspaceSession = {
          sessionId: data.sessionId,
          name: data.name || name || 'New Session',
          branchName: data.branchName || 'main',
          baseBranch: data.baseBranch || 'main',
          baseCommit: data.baseCommit || '',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: 0,
        };

        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(data.sessionId);

        // Update IDE store
        addSession({
          id: data.sessionId,
          user_id: '',
          repo: `${owner}/${repoName}`,
          branch: data.branchName || 'main',
          worktree_path: data.worktreePath || '',
          port: 3000,
          created_at: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          notes: '',
          state: {
            pane_order: [1, 2, 3, 4, 5, 6],
            pane_visibility: { 1: true, 2: true, 3: false, 4: false, 5: false, 6: false },
            pane_widths: { 1: 350, 2: 500, 3: 400, 4: 350, 5: 350, 6: 300 },
            active_file: null,
            open_files: [],
            split_view: false,
          },
        });

        ideEvents.emit('toast:show', {
          message: 'Session created',
          type: 'success',
        });

        return data.sessionId;
      }
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create session');
    }
  }, [owner, repoName, addSession]);

  // Initialize on mount
  useEffect(() => {
    if (!owner || !repoName) {
      setError('Invalid repository path');
      setLoading(false);
      return;
    }

    const init = async () => {
      setLoading(true);
      await fetchSessions();

      // If no sessions exist, create one
      if (sessions.length === 0) {
        await createSession();
      }

      setLoading(false);
    };

    init();
  }, [owner, repoName]);

  // Update active session in store when it changes
  useEffect(() => {
    if (activeSessionId && sessions.length > 0) {
      const session = sessions.find((s) => s.sessionId === activeSessionId);
      if (session) {
        setActiveSession({
          id: session.sessionId,
          user_id: '',
          repo: `${owner}/${repoName}`,
          branch: session.branchName,
          worktree_path: '',
          port: 3000,
          created_at: new Date(session.createdAt),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          notes: session.name,
          state: {
            pane_order: [1, 2, 3, 4, 5, 6],
            pane_visibility: { 1: true, 2: true, 3: false, 4: false, 5: false, 6: false },
            pane_widths: { 1: 350, 2: 500, 3: 400, 4: 350, 5: 350, 6: 300 },
            active_file: null,
            open_files: [],
            split_view: false,
          },
        });
      }
    }
  }, [activeSessionId, sessions, owner, repoName, setActiveSession]);

  if (loading) {
    return (
      <div className="ide-loading">
        <div className="ide-loading-spinner" />
        <p>Loading workspace for {repoFullName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ide-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/repos')}>Back to Repos</button>
      </div>
    );
  }

  return (
    <div className="ide-container">
      <IDEHeader
        repoFullName={repoFullName || ''}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionChange={setActiveSessionId}
        onNewSession={() => createSession()}
      />
      <IDELayout
        owner={owner}
        repo={repoName}
        sessionId={activeSessionId}
      />
      <CommandPalette />
    </div>
  );
}
