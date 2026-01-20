import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { execSync } from 'child_process';
import * as pty from 'node-pty';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import {
  getMainRepoPath,
  getSessionInfo,
  createSessionWorktree,
  updateSessionAccess,
  isSessionWorktreeValid,
} from '../utils/workspace';
import { terminalSessions } from '../routes/terminalSessions';

// Track alive status for ping/pong
const isAlive = new Map<WebSocket, boolean>();

export function setupTerminalWebSocket(server: Server): { wss: WebSocketServer; pingInterval: NodeJS.Timeout } {
  // WebSocket server for terminal sessions with keep-alive
  const wss = new WebSocketServer({
    server,
    path: '/ws/terminal',
    // Server-side ping every 30 seconds to keep connections alive through proxies
    perMessageDeflate: false,
  });

  // Send pings every 30 seconds to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (isAlive.get(ws) === false) {
        console.log('Terminating stale WebSocket connection');
        return ws.terminate();
      }
      isAlive.set(ws, false);
      ws.ping();
    });
  }, 30000);

  wss.on('connection', (ws: WebSocket, req) => {
    // Mark connection as alive for ping/pong
    isAlive.set(ws, true);
    ws.on('pong', () => {
      isAlive.set(ws, true);
    });

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const repoFullName = url.searchParams.get('repo');
    const clientSessionId = url.searchParams.get('session');
    const tabId = url.searchParams.get('tab') || 'main';  // Default tab

    // Use client-provided session ID if available
    const sessionId = clientSessionId || uuidv4();

    console.log(`Terminal WebSocket connected: ${sessionId}, tab: ${tabId}, repo: ${repoFullName}`);

    if (!repoFullName) {
      ws.send(JSON.stringify({ type: 'error', message: 'Repository name required' }));
      ws.close();
      return;
    }

    const mainRepoPath = getMainRepoPath(repoFullName);

    if (!fs.existsSync(mainRepoPath)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Workspace not found. Please set up the repository first.' }));
      ws.close();
      return;
    }

    // Check if this session has an existing worktree
    let sessionInfo = getSessionInfo(sessionId);
    let isNewSession = false;
    let workingDirectory: string;
    let branchName: string;

    // Check if connecting to a specific tab with its own worktree
    const tabInfo = tabId !== 'main' ? db.prepare(
      'SELECT worktree_path, branch_name, base_branch FROM terminal_tabs WHERE terminal_session_id = ? AND tab_id = ?'
    ).get(sessionId, tabId) as any : null;

    if (tabInfo && fs.existsSync(tabInfo.worktree_path)) {
      // Tab has its own worktree - use that
      workingDirectory = tabInfo.worktree_path;
      branchName = tabInfo.branch_name;
      console.log(`Using tab-specific worktree: ${workingDirectory}, branch: ${branchName}`);
    } else if (sessionInfo && isSessionWorktreeValid(sessionId)) {
      // Reconnecting to existing session (main worktree)
      workingDirectory = sessionInfo.worktree_path;
      branchName = sessionInfo.branch_name;
      updateSessionAccess(sessionId);
      console.log(`Reconnecting to existing session worktree: ${workingDirectory}`);
    } else if (sessionInfo) {
      // Session exists but worktree is invalid - clean up and recreate
      console.log(`Session ${sessionId} has invalid worktree, recreating...`);
      db.prepare('DELETE FROM terminal_sessions WHERE session_id = ?').run(sessionId);
      sessionInfo = createSessionWorktree(repoFullName, sessionId);
      workingDirectory = sessionInfo.worktree_path;
      branchName = sessionInfo.branch_name;
      isNewSession = true;
    } else {
      // New session - create worktree
      console.log(`Creating new session worktree for: ${sessionId}`);
      sessionInfo = createSessionWorktree(repoFullName, sessionId);
      workingDirectory = sessionInfo.worktree_path;
      branchName = sessionInfo.branch_name;
      isNewSession = true;
    }

    // Create tmux session name - include tab ID for isolation
    const tmuxSessionName = tabId !== 'main'
      ? `lw_${sessionId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}_tab_${tabId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15)}`
      : `lw_${sessionId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;

    // Check if tmux session already exists
    const tmuxSessionExists = (): boolean => {
      try {
        execSync("tmux has-session -t " + tmuxSessionName + " 2>/dev/null");
        return true;
      } catch {
        return false;
      }
    };

    const existingTmux = tmuxSessionExists();
    console.log("tmux session " + tmuxSessionName + ": " + (existingTmux ? "exists, attaching" : "creating new"));

    // If no existing session, create one first (detached)
    if (!existingTmux) {
      try {
        execSync("tmux new-session -d -s " + tmuxSessionName + " -c " + JSON.stringify(workingDirectory));
        console.log("Created new tmux session: " + tmuxSessionName);
      } catch (err) {
        console.error("Failed to create tmux session:", err);
      }
    }

    // Spawn PTY that attaches to the tmux session
    const ptyProcess = pty.spawn("tmux", ["attach-session", "-t", tmuxSessionName], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        HOME: process.env.HOME || "/home/ubuntu",
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
      } as { [key: string]: string },
    });

    // Key includes tabId for tab isolation
    const ptyKey = tabId !== 'main' ? `${sessionId}_${tabId}` : sessionId;
    terminalSessions.set(ptyKey, ptyProcess);

    // Send initial message with session info
    ws.send(JSON.stringify({
      type: "connected",
      sessionId,
      tabId,
      tmuxSession: tmuxSessionName,
      branchName: branchName,
      baseBranch: tabInfo?.base_branch || sessionInfo?.base_branch,
      baseCommit: sessionInfo?.base_commit,
      worktreePath: workingDirectory,
      isNewSession: !existingTmux,
      reconnected: existingTmux,
      message: existingTmux
        ? `[Reconnected] tmux:${tmuxSessionName} | Branch: ${branchName}\r\n`
        : `[New Session] tmux:${tmuxSessionName} | Branch: ${branchName}\r\n`
    }));

    // Only start Claude CLI for new tmux sessions
    if (!existingTmux) {
      setTimeout(() => {
        ptyProcess.write("claude --dangerously-skip-permissions\r");
      }, 500);
    }

    // Pipe PTY output to WebSocket
    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`PTY exited with code ${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      }
      terminalSessions.delete(sessionId);
    });

    // Handle incoming messages from client
    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.type) {
          case 'input':
            ptyProcess.write(msg.data);
            break;
          case 'resize':
            if (msg.cols && msg.rows) {
              ptyProcess.resize(msg.cols, msg.rows);
            }
            break;
          case 'restart':
            // Kill current process and restart Claude
            ptyProcess.write('\x03'); // Ctrl+C
            setTimeout(() => {
              ptyProcess.write('claude --dangerously-skip-permissions\r');
            }, 500);
            break;
          case 'ping':
            // Respond to keep-alive ping
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (e) {
        // If not JSON, treat as raw input
        ptyProcess.write(message.toString());
      }
    });

    ws.on('close', () => {
      console.log(`Terminal WebSocket disconnected: ${sessionId}`);
      isAlive.delete(ws);
      const session = terminalSessions.get(sessionId);
      if (session) {
        session.kill();
        terminalSessions.delete(sessionId);
      }
    });

    ws.on('error', (err) => {
      console.error(`Terminal WebSocket error: ${err.message}`);
    });
  });

  return { wss, pingInterval };
}
