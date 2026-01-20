import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize SQLite database
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'conversations.db');

// Ensure data directory exists before initializing SQLite
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  console.log(`[Server] Creating database directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: DatabaseType = new Database(dbPath);
console.log(`[Server] SQLite database initialized at: ${dbPath}`);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    session_id TEXT PRIMARY KEY,
    messages TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);

  CREATE TABLE IF NOT EXISTS terminal_sessions (
    session_id TEXT PRIMARY KEY,
    repo_full_name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_terminal_sessions_repo
  ON terminal_sessions(repo_full_name);

  CREATE TABLE IF NOT EXISTS workspace_sessions (
    session_id TEXT PRIMARY KEY,
    repo_full_name TEXT NOT NULL,
    name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_workspace_sessions_repo
  ON workspace_sessions(repo_full_name);

  CREATE TABLE IF NOT EXISTS terminal_tabs (
    id TEXT PRIMARY KEY,
    terminal_session_id TEXT NOT NULL,
    tab_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Terminal',
    tab_index INTEGER NOT NULL DEFAULT 0,
    worktree_path TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    base_branch TEXT DEFAULT 'main',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_focused_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(terminal_session_id, tab_id),
    FOREIGN KEY (terminal_session_id) REFERENCES terminal_sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_terminal_tabs_session
  ON terminal_tabs(terminal_session_id);

  CREATE INDEX IF NOT EXISTS idx_terminal_tabs_worktree
  ON terminal_tabs(worktree_path);
`);

// Add workspace_session_id column to conversations if it doesn't exist
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN workspace_session_id TEXT`);
} catch (e) {
  // Column already exists, ignore
}

export { dbPath };
