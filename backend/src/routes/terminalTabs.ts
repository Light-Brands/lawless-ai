import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db } from '../config/database';
import { authenticateApiKey } from '../middleware/auth';
import { getMainRepoPath } from '../utils/workspace';

const router = Router();

// Create terminal tab with isolated worktree
router.post('/api/terminal/tabs', authenticateApiKey, async (req: Request, res: Response) => {
  const { sessionId, tabId, name, branchName, baseBranch = 'main' } = req.body;

  if (!sessionId || !tabId) {
    res.status(400).json({ error: 'sessionId and tabId required' });
    return;
  }

  // Get terminal session with repo info
  const terminalSession = db.prepare(`
    SELECT session_id, repo_full_name
    FROM terminal_sessions
    WHERE session_id = ?
  `).get(sessionId) as any;

  if (!terminalSession) {
    res.status(404).json({ error: 'Terminal session not found' });
    return;
  }

  // Parse repo info
  const repoFullName = terminalSession.repo_full_name;
  const mainRepoPath = getMainRepoPath(repoFullName);

  // Create unique worktree for this tab
  const worktreeName = `ws_${sessionId}_tab_${tabId}`;
  const worktreePath = path.join(mainRepoPath, 'worktrees', worktreeName);
  // Use flat naming (underscores) to avoid Git ref conflicts with hierarchical branch names
  const targetBranch = branchName || `ws_${sessionId}_${tabId}`;

  try {
    // Ensure worktrees directory exists
    const worktreesDir = path.join(mainRepoPath, 'worktrees');
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    // Create worktree with new branch from base
    execSync(
      `cd "${mainRepoPath}" && git worktree add -b "${targetBranch}" "${worktreePath}" "${baseBranch}"`,
      { encoding: 'utf-8' }
    );

    // Set git config for commits in the worktree
    execSync(`git config user.email "lawless-ai@localhost"`, { cwd: worktreePath });
    execSync(`git config user.name "Lawless AI"`, { cwd: worktreePath });

    // Copy .env.local from main repo if it exists
    const mainEnvLocal = path.join(mainRepoPath, '.env.local');
    const worktreeEnvLocal = path.join(worktreePath, '.env.local');
    if (fs.existsSync(mainEnvLocal) && !fs.existsSync(worktreeEnvLocal)) {
      try {
        fs.copyFileSync(mainEnvLocal, worktreeEnvLocal);
        console.log(`Copied .env.local to tab worktree: ${worktreePath}`);
      } catch (e) {
        console.warn(`Failed to copy .env.local to tab worktree:`, e);
      }
    }

    // Install dependencies if package.json exists
    const packageJsonPath = path.join(worktreePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        console.log(`Installing dependencies in tab worktree: ${worktreePath}`);
        execSync('npm install', {
          cwd: worktreePath,
          encoding: 'utf-8',
          timeout: 300000, // 5 minute timeout
          stdio: 'pipe'
        });
        console.log(`Dependencies installed in tab worktree: ${worktreePath}`);
      } catch (e) {
        console.warn(`Failed to install dependencies in tab worktree (will continue):`, e);
        // Don't fail the tab creation - user can install manually
      }
    }

    // Count existing tabs for index
    const tabCount = db.prepare(
      'SELECT COUNT(*) as count FROM terminal_tabs WHERE terminal_session_id = ?'
    ).get(sessionId) as any;

    // Insert new tab with worktree info
    const tabDbId = uuidv4();
    db.prepare(`
      INSERT INTO terminal_tabs (id, terminal_session_id, tab_id, name, tab_index, worktree_path, branch_name, base_branch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tabDbId, sessionId, tabId, name || 'Terminal', tabCount?.count || 0, worktreePath, targetBranch, baseBranch);

    res.json({
      id: tabDbId,
      tabId,
      name: name || 'Terminal',
      index: tabCount?.count || 0,
      worktreePath,
      branchName: targetBranch,
      baseBranch,
    });
  } catch (error: any) {
    console.error('Failed to create worktree for tab:', error);
    res.status(500).json({ error: 'Failed to create isolated worktree: ' + error.message });
  }
});

// List terminal tabs
router.get('/api/terminal/tabs/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const terminalSession = db.prepare(
    'SELECT session_id FROM terminal_sessions WHERE session_id = ?'
  ).get(sessionId);

  if (!terminalSession) {
    res.status(404).json({ error: 'Terminal session not found' });
    return;
  }

  const tabs = db.prepare(`
    SELECT tab_id, name, tab_index, worktree_path, branch_name, base_branch, created_at, last_focused_at
    FROM terminal_tabs
    WHERE terminal_session_id = ?
    ORDER BY tab_index ASC
  `).all(sessionId);

  res.json({ tabs });
});

// Delete terminal tab and cleanup worktree
router.delete('/api/terminal/tabs/:sessionId/:tabId', authenticateApiKey, async (req: Request, res: Response) => {
  const { sessionId, tabId } = req.params;

  // Get terminal session info
  const terminalSession = db.prepare(
    'SELECT session_id, repo_full_name FROM terminal_sessions WHERE session_id = ?'
  ).get(sessionId) as any;

  if (!terminalSession) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Get tab info for worktree path
  const tab = db.prepare(
    'SELECT worktree_path, branch_name FROM terminal_tabs WHERE terminal_session_id = ? AND tab_id = ?'
  ).get(sessionId, tabId) as any;

  // Kill tmux session for this tab
  const tmuxSessionName = `lw_${sessionId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_tab_${tabId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}`;
  try {
    execSync(`tmux kill-session -t ${tmuxSessionName} 2>/dev/null`);
  } catch (e) { /* Session may not exist */ }

  // Remove worktree if it exists
  if (tab?.worktree_path) {
    const mainRepoPath = getMainRepoPath(terminalSession.repo_full_name);

    try {
      // Remove worktree (git worktree remove)
      execSync(`cd "${mainRepoPath}" && git worktree remove "${tab.worktree_path}" --force 2>/dev/null`);

      // Optionally delete the branch if it was auto-created (ws_ prefix)
      if (tab.branch_name?.startsWith('ws_')) {
        execSync(`cd "${mainRepoPath}" && git branch -D "${tab.branch_name}" 2>/dev/null`);
      }
    } catch (e) {
      console.warn('Failed to cleanup worktree:', e);
      // Continue with deletion even if worktree cleanup fails
    }
  }

  // Delete from database
  db.prepare(
    'DELETE FROM terminal_tabs WHERE terminal_session_id = ? AND tab_id = ?'
  ).run(sessionId, tabId);

  res.json({ success: true });
});

// Update terminal tab (focus time, name)
router.put('/api/terminal/tabs/:sessionId/:tabId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId, tabId } = req.params;
  const { name, focused } = req.body;

  const tab = db.prepare(
    'SELECT id FROM terminal_tabs WHERE terminal_session_id = ? AND tab_id = ?'
  ).get(sessionId, tabId);

  if (!tab) {
    res.status(404).json({ error: 'Tab not found' });
    return;
  }

  if (name) {
    db.prepare('UPDATE terminal_tabs SET name = ? WHERE terminal_session_id = ? AND tab_id = ?').run(name, sessionId, tabId);
  }

  if (focused) {
    db.prepare('UPDATE terminal_tabs SET last_focused_at = CURRENT_TIMESTAMP WHERE terminal_session_id = ? AND tab_id = ?').run(sessionId, tabId);
  }

  res.json({ success: true });
});

export default router;
