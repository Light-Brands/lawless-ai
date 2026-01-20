import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { db } from '../config/database';
import { authenticateApiKey } from '../middleware/auth';
import { isSupabaseAvailable } from '../lib/supabase';
import {
  createSupabaseWorkspaceSession,
  getSupabaseWorkspaceSession,
  listSupabaseWorkspaceSessions,
  updateSupabaseWorkspaceSession,
  deleteSupabaseWorkspaceSession,
  touchSupabaseWorkspaceSession,
} from '../services/workspaceSessionService';
import {
  getMainRepoPath,
  getWorktreesDir,
  getWorkspaceSessionInfo,
  isWorkspaceSessionWorktreeValid,
  migrateWorkspaceIfNeeded,
  WorkspaceSessionInfo,
} from '../utils/workspace';

const router = Router();

// Create a new workspace session worktree
async function createWorkspaceSessionWorktree(
  repoFullName: string,
  sessionId: string,
  sessionName: string,
  baseBranch: string = 'main',
  userId: string
): Promise<WorkspaceSessionInfo> {
  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);
  const worktreePath = path.join(worktreesDir, `ws_${sessionId}`);
  const branchName = `workspace/${sessionId}`;

  // Ensure worktrees directory exists
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  // Get current commit hash of base branch
  const baseCommit = execSync(`git rev-parse ${baseBranch}`, {
    cwd: mainRepoPath,
    encoding: 'utf-8'
  }).trim();

  // Create worktree with new branch
  execSync(`git worktree add -b "${branchName}" "${worktreePath}" ${baseBranch}`, {
    cwd: mainRepoPath
  });

  // Set git config for commits in the worktree
  execSync(`git config user.email "lawless-ai@localhost"`, { cwd: worktreePath });
  execSync(`git config user.name "Lawless AI"`, { cwd: worktreePath });

  // Save to Supabase (sole source of truth for session metadata)
  const supabaseSession = await createSupabaseWorkspaceSession({
    sessionId,
    userId,
    repoFullName,
    name: sessionName,
    branchName,
    baseBranch,
    baseCommit,
    worktreePath,
  });

  if (!supabaseSession) {
    // Cleanup worktree if Supabase save failed
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, { cwd: mainRepoPath });
      execSync(`git branch -D "${branchName}"`, { cwd: mainRepoPath });
    } catch (e) {
      console.error('Failed to cleanup worktree after Supabase error:', e);
    }
    throw new Error('Failed to save session to database');
  }

  console.log(`[Session Create] Created session ${sessionId} for user ${userId}`);

  return {
    session_id: sessionId,
    repo_full_name: repoFullName,
    name: sessionName,
    branch_name: branchName,
    worktree_path: worktreePath,
    base_branch: baseBranch,
    base_commit: baseCommit,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString()
  };
}

// Delete a workspace session worktree
async function deleteWorkspaceSessionWorktree(repoFullName: string, sessionId: string): Promise<boolean> {
  // Get session info from Supabase
  const sessionInfo = await getSupabaseWorkspaceSession(sessionId);
  if (!sessionInfo) {
    console.log(`[Session Delete] Session ${sessionId} not found in Supabase`);
    return false;
  }

  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);
  const worktreePath = path.join(worktreesDir, `ws_${sessionId}`);
  const branchName = sessionInfo.branch_name;

  try {
    // Remove worktree if it exists locally
    if (fs.existsSync(worktreePath)) {
      execSync(`git worktree remove --force "${worktreePath}"`, { cwd: mainRepoPath });
    }

    // Delete branch
    try {
      execSync(`git branch -D "${branchName}"`, { cwd: mainRepoPath });
    } catch (e) {
      // Branch might not exist, that's ok
    }

    // Prune worktrees
    execSync('git worktree prune', { cwd: mainRepoPath });

    // Delete from Supabase (sole source of truth)
    await deleteSupabaseWorkspaceSession(sessionId);

    console.log(`[Session Delete] Deleted session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('Error deleting workspace session worktree:', error);
    return false;
  }
}

// Create a new workspace session with worktree
router.post('/api/workspace/session/create', authenticateApiKey, async (req: Request, res: Response) => {
  const { repoFullName, sessionId, sessionName, baseBranch = 'main', userId } = req.body;

  if (!repoFullName || !sessionId || !sessionName) {
    res.status(400).json({ error: 'Repository name, session ID, and session name required' });
    return;
  }

  // Require userId for session creation
  if (!userId) {
    res.status(400).json({ error: 'User ID required for session creation' });
    return;
  }

  // Check if Supabase is available
  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Database service unavailable. Please try again later.' });
    return;
  }

  // Auto-migrate legacy workspace structure if needed
  const migrated = migrateWorkspaceIfNeeded(repoFullName);
  const mainRepoPath = getMainRepoPath(repoFullName);

  if (!migrated && !fs.existsSync(mainRepoPath)) {
    res.status(400).json({ error: 'Workspace not found. Please set up the repository first.' });
    return;
  }

  try {
    // Check if session already exists in Supabase (sole source of truth)
    const existingSession = await getSupabaseWorkspaceSession(sessionId);

    if (existingSession) {
      // Update last accessed time
      await touchSupabaseWorkspaceSession(sessionId);
      console.log(`[Session Create] Found existing session ${sessionId} in Supabase`);

      // Session already exists, return its info
      res.json({
        sessionId: existingSession.session_id,
        name: existingSession.name,
        branchName: existingSession.branch_name,
        baseBranch: existingSession.base_branch,
        baseCommit: existingSession.base_commit || '',
        worktreePath: '', // Worktree is local, will be resolved separately
        createdAt: existingSession.created_at,
        lastAccessedAt: existingSession.last_accessed_at,
        isExisting: true
      });
      return;
    }

    // Create new session worktree and save to Supabase
    const sessionInfo = await createWorkspaceSessionWorktree(repoFullName, sessionId, sessionName, baseBranch, userId);

    res.json({
      sessionId: sessionInfo.session_id,
      name: sessionInfo.name,
      branchName: sessionInfo.branch_name,
      baseBranch: sessionInfo.base_branch,
      baseCommit: sessionInfo.base_commit,
      worktreePath: sessionInfo.worktree_path,
      createdAt: sessionInfo.created_at,
      lastAccessedAt: sessionInfo.last_accessed_at,
      isExisting: false
    });
  } catch (error: any) {
    console.error('Error creating workspace session:', error);
    res.status(500).json({ error: `Failed to create session: ${error.message}` });
  }
});

// Delete a workspace session and its worktree
router.delete('/api/workspace/session/:sessionId', authenticateApiKey, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { repoFullName } = req.query;

  if (!repoFullName) {
    res.status(400).json({ error: 'Repository name required' });
    return;
  }

  try {
    // Delete worktree and branch (now also deletes from Supabase)
    const success = await deleteWorkspaceSessionWorktree(repoFullName as string, sessionId);

    if (success) {
      res.json({ success: true, message: 'Session deleted' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error: any) {
    console.error('Error deleting workspace session:', error);
    res.status(500).json({ error: `Failed to delete session: ${error.message}` });
  }
});

// List all workspace sessions for a repo
router.get('/api/workspace/sessions/:owner/:repo', authenticateApiKey, async (req: Request, res: Response) => {
  const repoFullName = `${req.params.owner}/${req.params.repo}`;
  const userId = req.query.userId as string | undefined;

  try {
    // Require userId for session listing
    if (!userId) {
      res.status(400).json({ error: 'User ID required for session listing' });
      return;
    }

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      res.status(503).json({ error: 'Database service unavailable. Please try again later.' });
      return;
    }

    // Get sessions from Supabase (sole source of truth)
    const supabaseSessions = await listSupabaseWorkspaceSessions(repoFullName, userId);
    console.log(`[Sessions List] Found ${supabaseSessions.length} sessions in Supabase for ${repoFullName} (user: ${userId})`);

    const sessions = supabaseSessions.map(session => ({
      sessionId: session.session_id,
      name: session.name,
      branchName: session.branch_name,
      baseBranch: session.base_branch,
      baseCommit: session.base_commit || '',
      worktreePath: '', // Worktree path is local, resolved when session is loaded
      createdAt: session.created_at,
      lastAccessedAt: session.last_accessed_at,
      messageCount: 0, // Will be populated separately if needed
      isValid: isWorkspaceSessionWorktreeValid(session.session_id)
    }));

    res.json({ sessions });
  } catch (error: any) {
    console.error('Error listing workspace sessions:', error);
    res.status(500).json({ error: `Failed to list sessions: ${error.message}` });
  }
});

// Get a specific workspace session
router.get('/api/workspace/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const sessionInfo = getWorkspaceSessionInfo(sessionId);
    if (!sessionInfo) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get conversation messages for this session
    const conversations = db.prepare(`
      SELECT messages FROM conversations WHERE workspace_session_id = ? ORDER BY updated_at DESC LIMIT 1
    `).get(sessionId) as { messages: string } | undefined;

    const messages = conversations ? JSON.parse(conversations.messages) : [];

    res.json({
      sessionId: sessionInfo.session_id,
      name: sessionInfo.name,
      branchName: sessionInfo.branch_name,
      baseBranch: sessionInfo.base_branch,
      baseCommit: sessionInfo.base_commit,
      worktreePath: sessionInfo.worktree_path,
      createdAt: sessionInfo.created_at,
      lastAccessedAt: sessionInfo.last_accessed_at,
      messages,
      isValid: isWorkspaceSessionWorktreeValid(sessionId)
    });
  } catch (error: any) {
    console.error('Error getting workspace session:', error);
    res.status(500).json({ error: `Failed to get session: ${error.message}` });
  }
});

// Rename a workspace session
router.put('/api/workspace/session/:sessionId', authenticateApiKey, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }

  try {
    // Update in SQLite
    const result = db.prepare('UPDATE workspace_sessions SET name = ?, last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(name, sessionId);

    // Also update in Supabase
    await updateSupabaseWorkspaceSession(sessionId, { name });

    if (result.changes === 0) {
      // Check if it exists in Supabase even if not in SQLite
      const supabaseSession = await getSupabaseWorkspaceSession(sessionId);
      if (!supabaseSession) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
    }

    res.json({ success: true, name });
  } catch (error: any) {
    console.error('Error renaming workspace session:', error);
    res.status(500).json({ error: `Failed to rename session: ${error.message}` });
  }
});

export default router;
