import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { db } from '../config/database';

// Workspace directory for cloned repos
export const WORKSPACE_DIR = process.env.WORKSPACE_DIR || (
  process.platform === 'darwin'
    ? path.join(process.env.HOME || '/tmp', 'workspaces')
    : '/home/ubuntu/workspaces'
);

// Ensure workspace directory exists
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// Helper to get base workspace path for a repo (contains main/ and worktrees/)
export function getWorkspaceBasePath(repoFullName: string): string {
  return path.join(WORKSPACE_DIR, repoFullName.replace('/', '_'));
}

// Helper to get main repo path (the primary clone)
export function getMainRepoPath(repoFullName: string): string {
  return path.join(getWorkspaceBasePath(repoFullName), 'main');
}

// Helper to get worktrees directory
export function getWorktreesDir(repoFullName: string): string {
  return path.join(getWorkspaceBasePath(repoFullName), 'worktrees');
}

// Helper to get worktree path for a specific session
export function getWorktreePath(repoFullName: string, sessionId: string): string {
  return path.join(getWorktreesDir(repoFullName), sessionId);
}

// Helper to get branch name for a session
export function getBranchName(sessionId: string): string {
  return `session/${sessionId}`;
}

// Legacy helper - checks for old structure or returns main path
export function getWorkspacePath(repoFullName: string): string {
  const basePath = getWorkspaceBasePath(repoFullName);
  const mainPath = getMainRepoPath(repoFullName);

  // If main/ exists, use that (new structure)
  if (fs.existsSync(mainPath)) {
    return mainPath;
  }

  // Check if old structure exists (repo cloned directly in base path)
  if (fs.existsSync(path.join(basePath, '.git'))) {
    return basePath;
  }

  // Default to main path for new repos
  return mainPath;
}

// Session info type from database
export interface TerminalSessionInfo {
  session_id: string;
  repo_full_name: string;
  branch_name: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  created_at: string;
  last_accessed_at: string;
}

// Workspace session info type from database
export interface WorkspaceSessionInfo {
  session_id: string;
  repo_full_name: string;
  name: string;
  branch_name: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  created_at: string;
  last_accessed_at: string;
}

// Get session info from database
export function getSessionInfo(sessionId: string): TerminalSessionInfo | null {
  const row = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId) as TerminalSessionInfo | undefined;
  return row || null;
}

// Update session last accessed time
export function updateSessionAccess(sessionId: string): void {
  db.prepare('UPDATE terminal_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
}

// Check if a branch exists
function branchExists(repoPath: string, branchName: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

// Create a new session worktree
export function createSessionWorktree(repoFullName: string, sessionId: string, baseBranch: string = 'main'): TerminalSessionInfo {
  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);
  const worktreePath = getWorktreePath(repoFullName, sessionId);
  const branchName = getBranchName(sessionId);

  // Ensure worktrees directory exists
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  // Get current commit hash of base branch
  const baseCommit = execSync(`git rev-parse ${baseBranch}`, {
    cwd: mainRepoPath,
    encoding: 'utf-8'
  }).trim();

  // Check if branch already exists (from a previous incomplete cleanup)
  if (branchExists(mainRepoPath, branchName)) {
    // Delete the stale branch first
    try {
      execSync(`git branch -D "${branchName}"`, { cwd: mainRepoPath });
      console.log(`Deleted stale branch: ${branchName}`);
    } catch (e) {
      console.warn(`Failed to delete stale branch ${branchName}:`, e);
    }
  }

  // Create worktree with new branch
  execSync(`git worktree add -b "${branchName}" "${worktreePath}" ${baseBranch}`, {
    cwd: mainRepoPath
  });

  // Set git config for commits in the worktree
  execSync(`git config user.email "lawless-ai@localhost"`, { cwd: worktreePath });
  execSync(`git config user.name "Lawless AI"`, { cwd: worktreePath });

  // Save to database
  db.prepare(`
    INSERT INTO terminal_sessions (session_id, repo_full_name, branch_name, worktree_path, base_branch, base_commit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, repoFullName, branchName, worktreePath, baseBranch, baseCommit);

  return {
    session_id: sessionId,
    repo_full_name: repoFullName,
    branch_name: branchName,
    worktree_path: worktreePath,
    base_branch: baseBranch,
    base_commit: baseCommit,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString()
  };
}

// Delete a session worktree
export function deleteSessionWorktree(repoFullName: string, sessionId: string): boolean {
  const sessionInfo = getSessionInfo(sessionId);
  if (!sessionInfo) {
    return false;
  }

  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreePath = sessionInfo.worktree_path;
  const branchName = sessionInfo.branch_name;

  try {
    // Remove worktree
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

    // Delete from database
    db.prepare('DELETE FROM terminal_sessions WHERE session_id = ?').run(sessionId);

    return true;
  } catch (error) {
    console.error('Error deleting session worktree:', error);
    return false;
  }
}

// Check if session worktree exists and is valid
export function isSessionWorktreeValid(sessionId: string): boolean {
  const sessionInfo = getSessionInfo(sessionId);
  if (!sessionInfo) {
    return false;
  }

  // Check if worktree path exists
  if (!fs.existsSync(sessionInfo.worktree_path)) {
    return false;
  }

  // Check if it's a valid git worktree
  try {
    execSync('git rev-parse --git-dir', { cwd: sessionInfo.worktree_path });
    return true;
  } catch (e) {
    return false;
  }
}

// Get workspace session info from database
export function getWorkspaceSessionInfo(sessionId: string): WorkspaceSessionInfo | null {
  const row = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId) as WorkspaceSessionInfo | undefined;
  return row || null;
}

// Update workspace session last accessed time
export function updateWorkspaceSessionAccess(sessionId: string): void {
  db.prepare('UPDATE workspace_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
}

// Check if workspace session worktree exists and is valid
export function isWorkspaceSessionWorktreeValid(sessionId: string): boolean {
  const sessionInfo = getWorkspaceSessionInfo(sessionId);
  if (!sessionInfo) {
    return false;
  }

  // Check if worktree path exists
  if (!fs.existsSync(sessionInfo.worktree_path)) {
    return false;
  }

  // Check if it's a valid git worktree
  try {
    execSync('git rev-parse --git-dir', { cwd: sessionInfo.worktree_path });
    return true;
  } catch (e) {
    return false;
  }
}

// Migrate legacy workspace to new structure if needed
export function migrateWorkspaceIfNeeded(repoFullName: string): boolean {
  const basePath = getWorkspaceBasePath(repoFullName);
  const mainPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);

  // Already migrated or new structure
  if (fs.existsSync(mainPath)) {
    return true;
  }

  // Check for old structure (repo cloned directly in base path)
  const oldGitPath = path.join(basePath, '.git');
  if (fs.existsSync(oldGitPath)) {
    console.log(`Migrating workspace for ${repoFullName} to new structure...`);
    try {
      // Move to temp location
      const tempPath = basePath + '_migration_temp';
      fs.renameSync(basePath, tempPath);

      // Create new structure
      fs.mkdirSync(basePath, { recursive: true });
      fs.mkdirSync(worktreesDir, { recursive: true });

      // Move old repo to main/
      fs.renameSync(tempPath, mainPath);

      console.log(`Migration complete for ${repoFullName}`);
      return true;
    } catch (error) {
      console.error(`Migration failed for ${repoFullName}:`, error);
      return false;
    }
  }

  // No workspace exists
  return false;
}
