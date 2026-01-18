'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import '@xterm/xterm/css/xterm.css';

// Dynamically import xterm to avoid SSR issues
let Terminal: any;
let FitAddon: any;
let WebLinksAddon: any;

interface User {
  login: string;
  name: string;
  avatar: string;
}

interface TerminalSession {
  id: string;
  name: string;
  createdAt: Date;
  connected: boolean;
  branchName?: string;
  baseBranch?: string;
  baseCommit?: string;
  terminal?: any;
  ws?: WebSocket;
}

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const TerminalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" x2="20" y1="19" y2="19"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19"/>
    <line x1="5" x2="19" y1="12" y2="12"/>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const DisconnectIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

const WorkspaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1"/>
    <rect width="7" height="7" x="14" y="3" rx="1"/>
    <rect width="7" height="7" x="14" y="14" rx="1"/>
    <rect width="7" height="7" x="3" y="14" rx="1"/>
  </svg>
);

const MessageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const SidebarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
);

const GitBranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionName(index: number): string {
  return `Session ${index + 1}`;
}

// Max lines to store per session
const MAX_HISTORY_LINES = 1000;

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const terminalContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const fitAddons = useRef<Map<string, any>>(new Map());
  const terminals = useRef<Map<string, any>>(new Map());
  const websockets = useRef<Map<string, WebSocket>>(new Map());
  const pingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const initializedSessions = useRef<Set<string>>(new Set());
  const sessionOutputs = useRef<Map<string, string[]>>(new Map());

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendWsUrl, setBackendWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const repoPath = Array.isArray(params.repo) ? params.repo.join('/') : params.repo;
  const storageKey = repoPath ? `terminal_sessions_${repoPath.replace('/', '_')}` : null;
  const outputStorageKey = repoPath ? `terminal_outputs_${repoPath.replace('/', '_')}` : null;

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/');
          return;
        }

        setUser(data.user);

        // Fetch WebSocket URL
        try {
          const configRes = await fetch('/api/terminal/config');
          const config = await configRes.json();
          setBackendWsUrl(config.wsUrl);
        } catch (e) {
          console.error('Failed to fetch terminal config, using default');
        }
      } catch (err) {
        router.push('/');
      }
    }
    checkAuth();
  }, [router]);

  // Load saved sessions and outputs from localStorage
  useEffect(() => {
    if (!repoPath) return;

    const savedSessions = localStorage.getItem(`terminal_sessions_${repoPath.replace('/', '_')}`);
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        const restoredSessions: TerminalSession[] = parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          connected: false,
          branchName: s.branchName,
          baseBranch: s.baseBranch,
          baseCommit: s.baseCommit,
        }));
        setSessions(restoredSessions);
        if (restoredSessions.length > 0) {
          setActiveSessionId(restoredSessions[0].id);
        }
      } catch (e) {
        console.error('Failed to parse saved sessions');
      }
    }

    // Load saved outputs
    const savedOutputs = localStorage.getItem(`terminal_outputs_${repoPath.replace('/', '_')}`);
    if (savedOutputs) {
      try {
        const parsed = JSON.parse(savedOutputs);
        Object.entries(parsed).forEach(([sessionId, lines]) => {
          sessionOutputs.current.set(sessionId, lines as string[]);
        });
      } catch (e) {
        console.error('Failed to parse saved outputs');
      }
    }
  }, [repoPath]);

  // Save sessions to localStorage
  useEffect(() => {
    if (!repoPath || sessions.length === 0) return;

    const toSave = sessions.map(s => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt.toISOString(),
      branchName: s.branchName,
      baseBranch: s.baseBranch,
      baseCommit: s.baseCommit,
    }));
    localStorage.setItem(`terminal_sessions_${repoPath.replace('/', '_')}`, JSON.stringify(toSave));
  }, [sessions, repoPath]);

  // Save outputs to localStorage periodically and on unmount
  useEffect(() => {
    if (!repoPath) return;

    const saveOutputs = () => {
      const outputs: Record<string, string[]> = {};
      sessionOutputs.current.forEach((lines, sessionId) => {
        outputs[sessionId] = lines;
      });
      if (Object.keys(outputs).length > 0) {
        localStorage.setItem(`terminal_outputs_${repoPath.replace('/', '_')}`, JSON.stringify(outputs));
      }
    };

    // Save every 5 seconds
    const interval = setInterval(saveOutputs, 5000);

    // Also save on visibility change (when user navigates away)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveOutputs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Save on beforeunload
    const handleBeforeUnload = () => {
      saveOutputs();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save on unmount
      saveOutputs();
    };
  }, [repoPath]);

  // Connect to WebSocket for a session
  const connectWebSocket = useCallback((sessionId: string, term: any) => {
    if (!backendWsUrl) {
      term.writeln(`\x1b[33mWaiting for server configuration...\x1b[0m`);
      return;
    }

    const wsUrl = `${backendWsUrl}/ws/terminal?repo=${encodeURIComponent(repoPath!)}&session=${sessionId}`;

    term.writeln(`\x1b[90mConnecting to server...\x1b[0m`);

    const ws = new WebSocket(wsUrl);
    websockets.current.set(sessionId, ws);

    ws.onopen = () => {
      term.writeln('\x1b[32mConnected!\x1b[0m');
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, connected: true } : s
      ));

      const fit = fitAddons.current.get(sessionId);
      if (fit && term) {
        fit.fit();
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        }));
      }

      // Start keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      pingIntervals.current.set(sessionId, pingInterval);
    };

    ws.onmessage = (event) => {
      // Helper to capture output for persistence
      const captureOutput = (data: string) => {
        let lines = sessionOutputs.current.get(sessionId) || [];
        // Split data by lines and add to buffer
        const newLines = data.split('\n');
        lines = [...lines, ...newLines];
        // Keep only the last MAX_HISTORY_LINES
        if (lines.length > MAX_HISTORY_LINES) {
          lines = lines.slice(-MAX_HISTORY_LINES);
        }
        sessionOutputs.current.set(sessionId, lines);
      };

      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'connected':
            const connectedMsg = `\x1b[32m${msg.message}\x1b[0m\n\x1b[90mStarting Claude CLI...\x1b[0m\r\n`;
            term.writeln(`\x1b[32m${msg.message}\x1b[0m`);
            term.writeln('\x1b[90mStarting Claude CLI...\x1b[0m\r\n');
            captureOutput(connectedMsg);
            // Update session with branch info from backend
            if (msg.branchName) {
              setSessions(prev => prev.map(s =>
                s.id === sessionId ? {
                  ...s,
                  branchName: msg.branchName,
                  baseBranch: msg.baseBranch,
                  baseCommit: msg.baseCommit,
                } : s
              ));
            }
            break;
          case 'output':
            term.write(msg.data);
            captureOutput(msg.data);
            break;
          case 'error':
            const errorMsg = `\x1b[31mError: ${msg.message}\x1b[0m`;
            term.writeln(errorMsg);
            captureOutput(errorMsg + '\n');
            setError(msg.message);
            break;
          case 'exit':
            const exitMsg = `\r\n\x1b[90mProcess exited with code ${msg.code}\x1b[0m`;
            term.writeln(exitMsg);
            captureOutput(exitMsg + '\n');
            break;
          case 'pong':
            // Keep-alive response received, connection is healthy
            break;
        }
      } catch (e) {
        term.write(event.data);
        captureOutput(event.data);
      }
    };

    ws.onclose = (event) => {
      // Clear keep-alive ping interval
      const pingInterval = pingIntervals.current.get(sessionId);
      if (pingInterval) {
        clearInterval(pingInterval);
        pingIntervals.current.delete(sessionId);
      }

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, connected: false } : s
      ));
      term.writeln(`\r\n\x1b[33mDisconnected (code: ${event.code})\x1b[0m`);
      if (event.code === 1006) {
        term.writeln('\x1b[31mConnection failed - is the backend server running?\x1b[0m');
      }
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31mWebSocket error\x1b[0m');
      setError('Failed to connect to terminal server');
    };
  }, [backendWsUrl, repoPath]);

  // Initialize terminal for a session
  const initializeTerminal = useCallback(async (sessionId: string, container: HTMLDivElement) => {
    if (initializedSessions.current.has(sessionId)) return;
    initializedSessions.current.add(sessionId);

    // Dynamically import xterm modules
    const xtermModule = await import('@xterm/xterm');
    const fitModule = await import('@xterm/addon-fit');
    const webLinksModule = await import('@xterm/addon-web-links');

    Terminal = xtermModule.Terminal;
    FitAddon = fitModule.FitAddon;
    WebLinksAddon = webLinksModule.WebLinksAddon;

    // Create terminal
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);

    term.open(container);
    fit.fit();

    terminals.current.set(sessionId, term);
    fitAddons.current.set(sessionId, fit);

    // Restore saved output if available
    const savedOutput = sessionOutputs.current.get(sessionId);
    if (savedOutput && savedOutput.length > 0) {
      term.writeln('\x1b[90m--- Restored session history ---\x1b[0m');
      savedOutput.forEach(line => {
        term.writeln(line);
      });
      term.writeln('\x1b[90m--- End of history ---\x1b[0m\r\n');
    }

    // Connect to WebSocket
    connectWebSocket(sessionId, term);

    // Handle input
    term.onData((data: string) => {
      const ws = websockets.current.get(sessionId);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });
  }, [connectWebSocket]);

  // Refit terminal when switching sessions
  useEffect(() => {
    if (!activeSessionId) return;

    const fit = fitAddons.current.get(activeSessionId);
    if (fit) {
      setTimeout(() => fit.fit(), 100);
    }
  }, [activeSessionId]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (activeSessionId) {
        const fit = fitAddons.current.get(activeSessionId);
        const term = terminals.current.get(activeSessionId);
        const ws = websockets.current.get(activeSessionId);

        if (fit && term) {
          fit.fit();
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'resize',
              cols: term.cols,
              rows: term.rows,
            }));
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSessionId]);

  // Connect terminals when backendWsUrl becomes available
  useEffect(() => {
    if (!backendWsUrl) return;

    // Connect any terminals that were initialized before the URL was ready
    terminals.current.forEach((term, sessionId) => {
      const ws = websockets.current.get(sessionId);
      // Only connect if not already connected
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        connectWebSocket(sessionId, term);
      }
    });
  }, [backendWsUrl, connectWebSocket]);

  const createNewSession = useCallback(async () => {
    const sessionId = generateSessionId();
    const sessionName = generateSessionName(sessions.length);

    // Create session on backend first
    try {
      const response = await fetch('/api/terminal/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: repoPath,
          sessionId,
          baseBranch: 'main',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to create session:', error);
        setError(`Failed to create session: ${error.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();

      const newSession: TerminalSession = {
        id: sessionId,
        name: sessionName,
        createdAt: new Date(),
        connected: false,
        branchName: data.branchName,
        baseBranch: data.baseBranch,
        baseCommit: data.baseCommit,
      };

      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);
    } catch (err: any) {
      console.error('Error creating session:', err);
      setError(`Failed to create session: ${err.message}`);
    }
  }, [sessions.length, repoPath]);

  const deleteSession = useCallback(async (sessionId: string) => {
    // Clear ping interval if exists
    const pingInterval = pingIntervals.current.get(sessionId);
    if (pingInterval) {
      clearInterval(pingInterval);
      pingIntervals.current.delete(sessionId);
    }

    // Close WebSocket if exists
    const ws = websockets.current.get(sessionId);
    if (ws) {
      ws.close();
      websockets.current.delete(sessionId);
    }

    // Dispose terminal if exists
    const term = terminals.current.get(sessionId);
    if (term) {
      term.dispose();
      terminals.current.delete(sessionId);
    }

    fitAddons.current.delete(sessionId);
    terminalContainersRef.current.delete(sessionId);
    initializedSessions.current.delete(sessionId);
    sessionOutputs.current.delete(sessionId);

    // Call backend to delete worktree and branch
    try {
      await fetch(`/api/terminal/session/${sessionId}?repo=${encodeURIComponent(repoPath!)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete session on backend:', err);
      // Continue with local cleanup even if backend fails
    }

    // Remove from state
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      // If we're deleting the active session, switch to another
      if (activeSessionId === sessionId && updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else if (updated.length === 0) {
        setActiveSessionId(null);
      }
      return updated;
    });
  }, [activeSessionId, repoPath]);

  const switchSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);

    // Refit the terminal after switching
    setTimeout(() => {
      const fit = fitAddons.current.get(sessionId);
      if (fit) {
        fit.fit();
      }
    }, 100);
  }, [activeSessionId]);

  const reconnectSession = useCallback((sessionId: string) => {
    if (!backendWsUrl) {
      setError('Server configuration not loaded yet');
      return;
    }
    const term = terminals.current.get(sessionId);
    if (term) {
      term.clear();
      connectWebSocket(sessionId, term);
    }
  }, [connectWebSocket, backendWsUrl]);

  const restartClaude = useCallback(() => {
    if (!activeSessionId) return;
    const ws = websockets.current.get(activeSessionId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'restart' }));
    }
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Auto-create first session if none exist
  useEffect(() => {
    if (user && repoPath && sessions.length === 0) {
      createNewSession();
    }
  }, [user, repoPath, sessions.length, createNewSession]);

  return (
    <div className="terminal-page">
      <style jsx global>{`
        .terminal-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #0d1117;
          color: #c9d1d9;
          overflow: hidden;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #161b22;
          border-bottom: 1px solid #30363d;
          flex-shrink: 0;
        }

        .terminal-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .terminal-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #58a6ff;
        }

        .terminal-repo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: #21262d;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.875rem;
        }

        .terminal-header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .terminal-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .terminal-btn:hover {
          background: #30363d;
          border-color: #8b949e;
        }

        .terminal-btn.primary {
          background: #238636;
          border-color: #238636;
        }

        .terminal-btn.primary:hover {
          background: #2ea043;
        }

        .home-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          transition: all 0.15s;
        }

        .home-link:hover {
          background: #30363d;
          border-color: #8b949e;
          color: #c9d1d9;
        }

        .terminal-main {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }

        .terminal-sidebar {
          width: 280px;
          background: #161b22;
          border-right: 1px solid #30363d;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          transition: margin-left 0.2s ease;
        }

        .terminal-sidebar.collapsed {
          margin-left: -280px;
        }

        .terminal-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #30363d;
        }

        .terminal-sidebar-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #c9d1d9;
        }

        .terminal-sidebar-actions {
          display: flex;
          gap: 0.5rem;
        }

        .sidebar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sidebar-btn:hover {
          background: #21262d;
          color: #c9d1d9;
          border-color: #8b949e;
        }

        .sidebar-btn.primary {
          background: #238636;
          border-color: #238636;
          color: white;
        }

        .sidebar-btn.primary:hover {
          background: #2ea043;
        }

        .terminal-sessions {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .terminal-session-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          margin-bottom: 0.25rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          width: 100%;
          text-align: left;
        }

        .terminal-session-item:hover {
          background: #21262d;
        }

        .terminal-session-item.active {
          background: #21262d;
          border-color: #58a6ff;
        }

        .session-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #30363d;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .terminal-session-item.active .session-icon {
          background: #58a6ff;
          color: #0d1117;
        }

        .session-info {
          flex: 1;
          min-width: 0;
        }

        .session-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #c9d1d9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .session-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #8b949e;
          margin-top: 2px;
        }

        .session-status {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-dot.connected {
          background: #3fb950;
        }

        .status-dot.disconnected {
          background: #8b949e;
        }

        .session-branch {
          display: flex;
          align-items: center;
          gap: 3px;
          color: #8b949e;
          font-size: 0.7rem;
        }

        .branch-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #21262d;
          border-radius: 12px;
          font-size: 0.75rem;
          color: #58a6ff;
          margin-left: 8px;
        }

        .session-delete {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: #8b949e;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s;
        }

        .terminal-session-item:hover .session-delete {
          opacity: 1;
        }

        .session-delete:hover {
          background: rgba(248, 81, 73, 0.2);
          color: #f85149;
        }

        .terminal-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
        }

        .terminal-content-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          background: #0d1117;
          border-bottom: 1px solid #30363d;
          flex-shrink: 0;
        }

        .terminal-content-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #c9d1d9;
        }

        .terminal-content-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .terminal-container {
          flex: 1;
          padding: 0.5rem;
          overflow: hidden;
          min-height: 0;
        }

        .terminal-wrapper {
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          background: #0d1117;
        }

        .terminal-wrapper .xterm {
          height: 100% !important;
          padding: 0.5rem;
        }

        .terminal-wrapper .xterm-screen {
          height: 100% !important;
        }

        .terminal-wrapper .xterm-viewport {
          overflow-y: auto !important;
        }

        .loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 1rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #30363d;
          border-top-color: #58a6ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-sessions {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: #8b949e;
        }

        .empty-sessions-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #21262d;
          border-radius: 12px;
        }

        .empty-sessions-icon svg {
          width: 32px;
          height: 32px;
          opacity: 0.5;
        }
      `}</style>

      {!user ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <span>Loading...</span>
        </div>
      ) : (
        <>
          <header className="terminal-header">
            <div className="terminal-header-left">
              <Link href="/repos" className="home-link" title="Back to Repos">
                <HomeIcon />
              </Link>
              <button
                className="terminal-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                <SidebarIcon />
              </button>
              <div className="terminal-logo">
                <TerminalIcon />
                <span>Claude Terminal</span>
              </div>
              <div className="terminal-repo">
                <WorkspaceIcon />
                {repoPath}
              </div>
            </div>

            <div className="terminal-header-right">
              <Link href={`/workspace/${repoPath}`} className="terminal-btn">
                <WorkspaceIcon />
                Workspace UI
              </Link>
            </div>
          </header>

          <div className="terminal-main">
            <aside className={`terminal-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
              <div className="terminal-sidebar-header">
                <span className="terminal-sidebar-title">Sessions ({sessions.length})</span>
                <div className="terminal-sidebar-actions">
                  <button
                    className="sidebar-btn primary"
                    onClick={createNewSession}
                    title="New session"
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
              <div className="terminal-sessions">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`terminal-session-item ${session.id === activeSessionId ? 'active' : ''}`}
                    onClick={() => switchSession(session.id)}
                  >
                    <div className="session-icon">
                      <MessageIcon />
                    </div>
                    <div className="session-info">
                      <div className="session-name">{session.name}</div>
                      <div className="session-meta">
                        <span className="session-status">
                          <span className={`status-dot ${session.connected ? 'connected' : 'disconnected'}`} />
                          {session.connected ? 'Connected' : 'Disconnected'}
                        </span>
                        {session.branchName && (
                          <span className="session-branch">
                            <GitBranchIcon />
                            {session.branchName.replace('session/', '')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="session-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      title="Delete session"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </aside>

            <div className="terminal-content">
              {activeSession ? (
                <>
                  <div className="terminal-content-header">
                    <div className="terminal-content-title">
                      <MessageIcon />
                      <span>{activeSession.name}</span>
                      <span className={`status-dot ${activeSession.connected ? 'connected' : 'disconnected'}`} />
                      {activeSession.branchName && (
                        <span className="branch-badge">
                          <GitBranchIcon />
                          {activeSession.branchName}
                        </span>
                      )}
                    </div>
                    <div className="terminal-content-actions">
                      {activeSession.connected ? (
                        <>
                          <button className="terminal-btn" onClick={restartClaude}>
                            <RefreshIcon />
                            Restart Claude
                          </button>
                          <button
                            className="terminal-btn"
                            onClick={() => {
                              const ws = websockets.current.get(activeSessionId!);
                              if (ws) ws.close();
                            }}
                          >
                            <DisconnectIcon />
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          className="terminal-btn primary"
                          onClick={() => reconnectSession(activeSessionId!)}
                        >
                          Reconnect
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="terminal-container">
                    <div className="terminal-wrapper">
                      {sessions.map(session => (
                        <div
                          key={session.id}
                          ref={(el) => {
                            if (el && !terminalContainersRef.current.has(session.id)) {
                              terminalContainersRef.current.set(session.id, el);
                              if (user && repoPath) {
                                initializeTerminal(session.id, el);
                              }
                            }
                          }}
                          style={{
                            height: '100%',
                            display: session.id === activeSessionId ? 'block' : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-sessions">
                  <div className="empty-sessions-icon">
                    <TerminalIcon />
                  </div>
                  <p>No sessions yet</p>
                  <button className="terminal-btn primary" onClick={createNewSession}>
                    <PlusIcon />
                    Create Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
