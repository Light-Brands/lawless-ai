'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Dynamically import xterm to avoid SSR issues
let Terminal: any;
let FitAddon: any;
let WebLinksAddon: any;

interface User {
  login: string;
  name: string;
  avatar: string;
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

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
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

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<any>(null);
  const fitAddon = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const repoPath = Array.isArray(params.repo) ? params.repo.join('/') : params.repo;

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
      } catch (err) {
        router.push('/');
      }
    }
    checkAuth();
  }, [router]);

  // Initialize terminal
  useEffect(() => {
    let mounted = true;

    async function initTerminal() {
      if (!terminalRef.current || !user || !repoPath) return;

      // Dynamically import xterm modules
      const xtermModule = await import('@xterm/xterm');
      const fitModule = await import('@xterm/addon-fit');
      const webLinksModule = await import('@xterm/addon-web-links');

      Terminal = xtermModule.Terminal;
      FitAddon = fitModule.FitAddon;
      WebLinksAddon = webLinksModule.WebLinksAddon;

      // Import CSS
      await import('@xterm/xterm/css/xterm.css');

      if (!mounted) return;

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

      term.open(terminalRef.current);
      fit.fit();

      terminalInstance.current = term;
      fitAddon.current = fit;

      // Connect to WebSocket
      connectWebSocket(term);

      // Handle resize
      const handleResize = () => {
        if (fitAddon.current) {
          fitAddon.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'resize',
              cols: term.cols,
              rows: term.rows,
            }));
          }
        }
      };

      window.addEventListener('resize', handleResize);

      // Handle input
      term.onData((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
      });

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    if (user && repoPath) {
      initTerminal();
    }

    return () => {
      mounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
    };
  }, [user, repoPath]);

  function connectWebSocket(term: any) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${backendUrl}/ws/terminal?repo=${encodeURIComponent(repoPath!)}`;

    setConnecting(true);
    setError(null);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnecting(false);
      setConnected(true);
      if (fitAddon.current && term) {
        fitAddon.current.fit();
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'connected':
            setSessionId(msg.sessionId);
            term.writeln(`\x1b[32m${msg.message}\x1b[0m`);
            term.writeln('\x1b[90mStarting Claude CLI...\x1b[0m\r\n');
            break;
          case 'output':
            term.write(msg.data);
            break;
          case 'error':
            term.writeln(`\x1b[31mError: ${msg.message}\x1b[0m`);
            setError(msg.message);
            break;
          case 'exit':
            term.writeln(`\r\n\x1b[90mProcess exited with code ${msg.code}\x1b[0m`);
            break;
        }
      } catch (e) {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      setConnecting(false);
      term.writeln('\r\n\x1b[33mDisconnected from server\x1b[0m');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setError('Failed to connect to terminal server');
      setConnecting(false);
    };
  }

  function handleReconnect() {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
      connectWebSocket(terminalInstance.current);
    }
  }

  function handleDisconnect() {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }

  function handleRestartClaude() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'restart' }));
    }
  }

  return (
    <div className="terminal-page">
      <style jsx global>{`
        .terminal-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #0d1117;
          color: #c9d1d9;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #161b22;
          border-bottom: 1px solid #30363d;
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

        .terminal-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.connected {
          background: #3fb950;
          box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
        }

        .status-dot.connecting {
          background: #d29922;
          animation: pulse 1.5s infinite;
        }

        .status-dot.disconnected {
          background: #f85149;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
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
          border-color: #2ea043;
        }

        .terminal-btn.danger {
          color: #f85149;
        }

        .terminal-btn.danger:hover {
          background: rgba(248, 81, 73, 0.1);
          border-color: #f85149;
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

        .terminal-container {
          flex: 1;
          padding: 0.5rem;
          overflow: hidden;
        }

        .terminal-wrapper {
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          background: #0d1117;
        }

        .terminal-wrapper .xterm {
          height: 100%;
          padding: 0.5rem;
        }

        .terminal-wrapper .xterm-viewport {
          overflow-y: auto !important;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(248, 81, 73, 0.1);
          border-bottom: 1px solid rgba(248, 81, 73, 0.3);
          color: #f85149;
          font-size: 0.875rem;
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
              <div className="terminal-status">
                <span className={`status-dot ${connected ? 'connected' : connecting ? 'connecting' : 'disconnected'}`} />
                <span>{connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</span>
              </div>

              {connected && (
                <button className="terminal-btn" onClick={handleRestartClaude} title="Restart Claude CLI">
                  <RefreshIcon />
                  Restart Claude
                </button>
              )}

              {connected ? (
                <button className="terminal-btn danger" onClick={handleDisconnect}>
                  <DisconnectIcon />
                  Disconnect
                </button>
              ) : (
                <button className="terminal-btn primary" onClick={handleReconnect}>
                  Reconnect
                </button>
              )}

              <Link href={`/workspace/${repoPath}`} className="terminal-btn">
                <WorkspaceIcon />
                Workspace UI
              </Link>
            </div>
          </header>

          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button className="terminal-btn" onClick={handleReconnect}>
                Retry
              </button>
            </div>
          )}

          <div className="terminal-container">
            <div className="terminal-wrapper">
              <div ref={terminalRef} style={{ height: '100%' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
