import { execSync } from 'child_process';
import path from 'path';

// Get git commit SHA for version tracking
export function getGitCommit(): string {
  try {
    // __dirname is backend/dist/utils, so go up three levels to repo root
    const repoRoot = path.join(__dirname, '..', '..', '..');
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

export const GIT_COMMIT = getGitCommit();
