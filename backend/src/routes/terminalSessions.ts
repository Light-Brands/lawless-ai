import { Router, Request, Response } from 'express';
import * as pty from 'node-pty';
import { db } from '../config/database';
import { authenticateApiKey } from '../middleware/auth';
import {
  getMainRepoPath,
  getSessionInfo,
  createSessionWorktree,
  deleteSessionWorktree,
  isSessionWorktreeValid,
  migrateWorkspaceIfNeeded,
  TerminalSessionInfo,
} from '../utils/workspace';

const router = Router();

// Store active terminal sessions (exported for WebSocket to use)
export const terminalSessions = new Map<string, pty.IPty>();

// Create a new terminal session with worktree
router.post('/api/terminal/session/create', authenticateApiKey, (req: Request, res: Response) => {
  const { repoFullName, sessionId, baseBranch = 'main' } = req.body;

  if (!repoFullName || !sessionId) {
    res.status(400).json({ error: 'Repository name and session ID required' });
    return;
  }

  // Auto-migrate legacy workspace structure if needed
  const migrated = migrateWorkspaceIfNeeded(repoFullName);
  const mainRepoPath = getMainRepoPath(repoFullName);

  const fs = require('fs');
  if (!migrated && !fs.existsSync(mainRepoPath)) {
    res.status(400).json({ error: 'Workspace not found. Please set up the repository first.' });
    return;
  }

  try {
    // Check if session already exists
    const existingSession = getSessionInfo(sessionId);
    if (existingSession) {
      // Session already exists, return its info
      res.json({
        sessionId: existingSession.session_id,
        branchName: existingSession.branch_name,
        baseBranch: existingSession.base_branch,
        baseCommit: existingSession.base_commit,
        worktreePath: existingSession.worktree_path,
        isExisting: true
      });
      return;
    }

    // Create new session worktree
    const sessionInfo = createSessionWorktree(repoFullName, sessionId, baseBranch);

    res.json({
      sessionId: sessionInfo.session_id,
      branchName: sessionInfo.branch_name,
      baseBranch: sessionInfo.base_branch,
      baseCommit: sessionInfo.base_commit,
      worktreePath: sessionInfo.worktree_path,
      isExisting: false
    });
  } catch (error: any) {
    console.error('Error creating terminal session:', error);
    res.status(500).json({ error: `Failed to create session: ${error.message}` });
  }
});

// Delete a terminal session and its worktree
router.delete('/api/terminal/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { repoFullName } = req.query;

  if (!repoFullName) {
    res.status(400).json({ error: 'Repository name required' });
    return;
  }

  try {
    // Kill active PTY if running
    const ptySession = terminalSessions.get(sessionId);
    if (ptySession) {
      ptySession.kill();
      terminalSessions.delete(sessionId);
    }

    // Delete worktree and branch
    const success = deleteSessionWorktree(repoFullName as string, sessionId);

    if (success) {
      res.json({ success: true, message: 'Session deleted' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error: any) {
    console.error('Error deleting terminal session:', error);
    res.status(500).json({ error: `Failed to delete session: ${error.message}` });
  }
});

// List all terminal sessions for a repo
router.get('/api/terminal/sessions/:owner/:repo', authenticateApiKey, (req: Request, res: Response) => {
  const repoFullName = `${req.params.owner}/${req.params.repo}`;

  try {
    const rows = db.prepare(`
      SELECT * FROM terminal_sessions
      WHERE repo_full_name = ?
      ORDER BY last_accessed_at DESC
    `).all(repoFullName) as TerminalSessionInfo[];

    res.json({
      sessions: rows.map(row => ({
        sessionId: row.session_id,
        branchName: row.branch_name,
        baseBranch: row.base_branch,
        baseCommit: row.base_commit,
        worktreePath: row.worktree_path,
        createdAt: row.created_at,
        lastAccessedAt: row.last_accessed_at,
        isValid: isSessionWorktreeValid(row.session_id)
      }))
    });
  } catch (error: any) {
    console.error('Error listing terminal sessions:', error);
    res.status(500).json({ error: `Failed to list sessions: ${error.message}` });
  }
});

export default router;
