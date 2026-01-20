import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import { authenticateApiKey } from '../middleware/auth';
import { getWorkspacePath, getMainRepoPath } from '../utils/workspace';
import { db } from '../config/database';

const router = Router();

// Get git status for workspace
router.get('/api/workspace/git/status', authenticateApiKey, (req: Request, res: Response) => {
  const repoFullName = req.query.repo as string;

  if (!repoFullName) {
    res.status(400).json({ error: 'Repository required' });
    return;
  }

  const workspacePath = getWorkspacePath(repoFullName);

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found' });
    return;
  }

  try {
    const statusOutput = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8'
    });

    const status = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      untracked: [] as string[]
    };

    statusOutput.split('\n').filter(Boolean).forEach(line => {
      const code = line.substring(0, 2);
      const file = line.substring(3);

      if (code.includes('M')) status.modified.push(file);
      else if (code.includes('A')) status.added.push(file);
      else if (code.includes('D')) status.deleted.push(file);
      else if (code === '??') status.untracked.push(file);
    });

    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get git status: ${error.message}` });
  }
});

// Commit changes
router.post('/api/workspace/git/commit', authenticateApiKey, (req: Request, res: Response) => {
  const { repoFullName, message } = req.body;

  if (!repoFullName || !message) {
    res.status(400).json({ error: 'Repository and message required' });
    return;
  }

  const workspacePath = getWorkspacePath(repoFullName);

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found' });
    return;
  }

  try {
    // Stage all changes
    execSync('git add -A', { cwd: workspacePath });

    // Commit
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: workspacePath
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to commit: ${error.message}` });
  }
});

// Push changes
router.post('/api/workspace/git/push', authenticateApiKey, (req: Request, res: Response) => {
  const { repoFullName, githubToken } = req.body;

  if (!repoFullName || !githubToken) {
    res.status(400).json({ error: 'Repository and GitHub token required' });
    return;
  }

  const workspacePath = getWorkspacePath(repoFullName);

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found' });
    return;
  }

  try {
    // Update remote URL with token for auth
    const remoteUrl = `https://${githubToken}@github.com/${repoFullName}.git`;
    execSync(`git remote set-url origin ${remoteUrl}`, { cwd: workspacePath });

    // Push
    execSync('git push', {
      cwd: workspacePath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to push: ${error.message}` });
  }
});

// List available branches for worktree creation
router.get('/api/git/branches', authenticateApiKey, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }

  const terminalSession = db.prepare(
    'SELECT repo_full_name FROM terminal_sessions WHERE session_id = ?'
  ).get(sessionId) as any;

  if (!terminalSession) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const repoPath = getMainRepoPath(terminalSession.repo_full_name);

  try {
    // Get all branches (local and remote)
    const result = execSync(
      `cd "${repoPath}" && git branch -a --format='%(refname:short)'`,
      { encoding: 'utf-8' }
    );

    const branches = result
      .split('\n')
      .map((b: string) => b.trim())
      .filter((b: string) => b && !b.includes('HEAD'))
      .map((b: string) => b.replace('origin/', ''))
      .filter((b: string, i: number, arr: string[]) => arr.indexOf(b) === i); // Dedupe

    res.json({ branches });
  } catch (error) {
    console.error('Failed to list branches:', error);
    res.json({ branches: ['main'] });
  }
});

export default router;
