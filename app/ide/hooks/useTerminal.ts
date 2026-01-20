'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useIDEContext } from '../contexts/IDEContext';
import { useServiceContext } from '../contexts/ServiceContext';

// Max lines to store per session
const MAX_HISTORY_LINES = 1000;

// Auto-reconnect configuration for long-running sessions (24+ hours)
const RECONNECT_BASE_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 60000; // 60 seconds max between attempts
const RECONNECT_MAX_ATTEMPTS = 100; // Allow many reconnect attempts for long sessions
const RECONNECT_RESET_AFTER = 300000; // Reset attempt counter after 5 min of stable connection

// Special key codes for terminal
export const TERMINAL_KEYS = {
  TAB: '\t',
  ESCAPE: '\x1b',
  CTRL_C: '\x03',
  CTRL_D: '\x04',
  CTRL_Z: '\x1a',
  CTRL_L: '\x0c',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
  ENTER: '\r',
  BACKSPACE: '\x7f',
} as const;

export interface UseTerminalOptions {
  onConnected?: () => void;
  onDisconnected?: (code: number) => void;
  onError?: (error: string) => void;
  onBranchInfo?: (branchName: string, baseBranch: string, baseCommit: string) => void;
  autoReconnect?: boolean;
  persistOutput?: boolean;
}

export interface UseTerminalReturn {
  containerRef: (el: HTMLDivElement | null) => void;
  isConnected: boolean;
  isInitialized: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  branchName: string | null;
  connect: () => void;
  disconnect: () => void;
  restart: () => void;
  sendInput: (data: string) => void;
  sendKey: (key: keyof typeof TERMINAL_KEYS) => void;
  clear: () => void;
  fit: () => void;
  cancelReconnect: () => void;
}

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const {
    onConnected,
    onDisconnected,
    onError,
    onBranchInfo,
    autoReconnect = true,
    persistOutput = true,
  } = options;
  const { owner, repo, repoFullName, sessionId } = useIDEContext();
  const { terminal: terminalService } = useServiceContext();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [branchName, setBranchName] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const outputHistoryRef = useRef<string[]>([]);
  const backendWsUrlRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const saveOutputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongTimeRef = useRef<number>(Date.now());
  const connectionStableTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousSessionIdRef = useRef<string | null>(null);

  // Fetch backend WebSocket URL on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/terminal/config');
        const config = await res.json();
        backendWsUrlRef.current = config.wsUrl;
      } catch (e) {
        console.error('Failed to fetch terminal config:', e);
        onError?.('Failed to fetch terminal configuration');
      }
    }
    fetchConfig();
  }, [onError]);

  // Save output to database (debounced)
  const saveOutputToDatabase = useCallback(async () => {
    if (!persistOutput || !sessionId || !repoFullName) return;

    try {
      await fetch('/api/terminal/output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          repoFullName,
          outputLines: outputHistoryRef.current,
        }),
      });
    } catch (err) {
      console.error('Failed to save terminal output:', err);
    }
  }, [persistOutput, sessionId, repoFullName]);

  // Capture output for history persistence (debounced save)
  const captureOutput = useCallback((data: string) => {
    const newLines = data.split('\n');
    outputHistoryRef.current = [...outputHistoryRef.current, ...newLines].slice(-MAX_HISTORY_LINES);

    // Debounce database save
    if (saveOutputTimeoutRef.current) {
      clearTimeout(saveOutputTimeoutRef.current);
    }
    saveOutputTimeoutRef.current = setTimeout(() => {
      saveOutputToDatabase();
    }, 2000); // Save every 2 seconds at most
  }, [saveOutputToDatabase]);

  // Load saved output from database
  const loadSavedOutput = useCallback(async () => {
    if (!persistOutput || !sessionId || !repoFullName) return;

    try {
      const response = await fetch(`/api/terminal/output?sessionId=${sessionId}&repoFullName=${encodeURIComponent(repoFullName)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.outputLines && data.outputLines.length > 0) {
          outputHistoryRef.current = data.outputLines;
          // Restore output to terminal
          if (terminalRef.current) {
            terminalRef.current.writeln('\x1b[90m--- Restored previous session output ---\x1b[0m');
            data.outputLines.slice(-50).forEach((line: string) => {
              terminalRef.current.writeln(line);
            });
            terminalRef.current.writeln('\x1b[90m--- End of restored output ---\x1b[0m\r\n');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load terminal output:', err);
    }
  }, [persistOutput, sessionId, repoFullName]);

  // Cancel reconnection
  const cancelReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsReconnecting(false);
    setReconnectAttempt(0);
    intentionalDisconnectRef.current = true;
  }, []);

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || intentionalDisconnectRef.current) return;
    if (reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
      terminalRef.current?.writeln?.('\x1b[31mMax reconnection attempts reached. Please reconnect manually.\x1b[0m');
      setIsReconnecting(false);
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempt),
      RECONNECT_MAX_DELAY
    );

    setIsReconnecting(true);
    setReconnectAttempt((prev) => prev + 1);
    terminalRef.current?.writeln?.(`\x1b[33mReconnecting in ${delay / 1000}s... (attempt ${reconnectAttempt + 1}/${RECONNECT_MAX_ATTEMPTS})\x1b[0m`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!intentionalDisconnectRef.current) {
        connect();
      }
    }, delay);
  }, [autoReconnect, reconnectAttempt]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!backendWsUrlRef.current || !sessionId || !repoFullName) {
      terminalRef.current?.writeln?.('\x1b[33mWaiting for server configuration...\x1b[0m');
      return;
    }

    // Reset intentional disconnect flag when manually connecting
    intentionalDisconnectRef.current = false;
    setIsReconnecting(false);

    const wsUrl = `${backendWsUrlRef.current}/ws/terminal?repo=${encodeURIComponent(repoFullName)}&session=${sessionId}`;

    terminalRef.current?.writeln?.('\x1b[90mConnecting to server...\x1b[0m');

    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      terminalRef.current?.writeln?.('\x1b[32mConnected!\x1b[0m');
      setIsConnected(true);
      setIsReconnecting(false);
      onConnected?.();
      lastPongTimeRef.current = Date.now();

      // Reset reconnect counter after stable connection (5 minutes)
      if (connectionStableTimeoutRef.current) {
        clearTimeout(connectionStableTimeoutRef.current);
      }
      connectionStableTimeoutRef.current = setTimeout(() => {
        setReconnectAttempt(0);
      }, RECONNECT_RESET_AFTER);

      // Send initial resize
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminalRef.current.cols,
          rows: terminalRef.current.rows,
        }));
      }

      // Start keep-alive ping every 30 seconds
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      // Check for stale connections (no pong in 90 seconds = 3 missed pings)
      heartbeatCheckIntervalRef.current = setInterval(() => {
        const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
        if (timeSinceLastPong > 90000 && ws.readyState === WebSocket.OPEN) {
          terminalRef.current?.writeln?.('\x1b[33mConnection appears stale, reconnecting...\x1b[0m');
          ws.close();
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'connected':
            terminalRef.current?.writeln?.(`\x1b[32m${msg.message}\x1b[0m`);
            terminalRef.current?.writeln?.('\x1b[90mStarting Claude CLI...\x1b[0m\r\n');
            captureOutput(`${msg.message}\nStarting Claude CLI...\n`);
            if (msg.branchName) {
              setBranchName(msg.branchName);
              onBranchInfo?.(msg.branchName, msg.baseBranch, msg.baseCommit);
            }
            break;
          case 'output':
            terminalRef.current?.write?.(msg.data);
            captureOutput(msg.data);
            break;
          case 'error':
            terminalRef.current?.writeln?.(`\x1b[31mError: ${msg.message}\x1b[0m`);
            captureOutput(`Error: ${msg.message}\n`);
            onError?.(msg.message);
            break;
          case 'exit':
            terminalRef.current?.writeln?.(`\r\n\x1b[90mProcess exited with code ${msg.code}\x1b[0m`);
            captureOutput(`Process exited with code ${msg.code}\n`);
            break;
          case 'pong':
            // Keep-alive response received - connection is healthy
            lastPongTimeRef.current = Date.now();
            break;
        }
      } catch (e) {
        terminalRef.current?.write?.(event.data);
        captureOutput(event.data);
      }
    };

    ws.onclose = (event) => {
      // Clear keep-alive ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      // Clear heartbeat check interval
      if (heartbeatCheckIntervalRef.current) {
        clearInterval(heartbeatCheckIntervalRef.current);
        heartbeatCheckIntervalRef.current = null;
      }
      // Clear connection stable timeout
      if (connectionStableTimeoutRef.current) {
        clearTimeout(connectionStableTimeoutRef.current);
        connectionStableTimeoutRef.current = null;
      }

      setIsConnected(false);
      onDisconnected?.(event.code);

      // Don't show disconnect message if intentionally disconnected
      if (!intentionalDisconnectRef.current) {
        terminalRef.current?.writeln?.(`\r\n\x1b[33mDisconnected (code: ${event.code})\x1b[0m`);
        if (event.code === 1006) {
          terminalRef.current?.writeln?.('\x1b[31mConnection failed - is the backend server running?\x1b[0m');
        }
        // Schedule reconnection attempt
        scheduleReconnect();
      }

      // Save output before disconnect
      saveOutputToDatabase();
    };

    ws.onerror = () => {
      terminalRef.current?.writeln?.('\r\n\x1b[31mWebSocket error\x1b[0m');
      onError?.('Failed to connect to terminal server');
    };
  }, [sessionId, repoFullName, captureOutput, onConnected, onDisconnected, onError, onBranchInfo, scheduleReconnect, saveOutputToDatabase]);

  // Disconnect WebSocket (intentionally)
  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    cancelReconnect();

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (heartbeatCheckIntervalRef.current) {
      clearInterval(heartbeatCheckIntervalRef.current);
      heartbeatCheckIntervalRef.current = null;
    }
    if (connectionStableTimeoutRef.current) {
      clearTimeout(connectionStableTimeoutRef.current);
      connectionStableTimeoutRef.current = null;
    }
    setIsConnected(false);

    // Save output on disconnect
    saveOutputToDatabase();
  }, [cancelReconnect, saveOutputToDatabase]);

  // Handle session changes - disconnect old, clear state, reconnect new
  useEffect(() => {
    // Skip on initial mount (no previous session)
    if (previousSessionIdRef.current === null) {
      previousSessionIdRef.current = sessionId;
      return;
    }

    // Session changed - need to switch
    if (previousSessionIdRef.current !== sessionId && sessionId) {
      console.log(`[Terminal] Session changed: ${previousSessionIdRef.current} -> ${sessionId}`);

      // Save output for old session before switching
      if (previousSessionIdRef.current && outputHistoryRef.current.length > 0) {
        const oldSessionId = previousSessionIdRef.current;
        fetch('/api/terminal/output', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: oldSessionId,
            repoFullName,
            outputLines: outputHistoryRef.current,
          }),
        }).catch(err => console.error('Failed to save old session output:', err));
      }

      // Disconnect from old session
      intentionalDisconnectRef.current = true;
      cancelReconnect();
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (heartbeatCheckIntervalRef.current) {
        clearInterval(heartbeatCheckIntervalRef.current);
        heartbeatCheckIntervalRef.current = null;
      }
      setIsConnected(false);

      // Clear output history for new session
      outputHistoryRef.current = [];

      // Clear terminal display
      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.writeln('\x1b[90m--- Switched to new session ---\x1b[0m\r\n');
      }

      // Update ref to new session
      previousSessionIdRef.current = sessionId;

      // Reset state
      setBranchName(null);
      setReconnectAttempt(0);
      setIsReconnecting(false);
      intentionalDisconnectRef.current = false;

      // Load saved output for new session and connect
      if (terminalRef.current && backendWsUrlRef.current) {
        loadSavedOutput().then(() => {
          setTimeout(() => connect(), 100);
        });
      }
    }
  }, [sessionId, repoFullName, cancelReconnect, connect, loadSavedOutput]);

  // Restart Claude
  const restart = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'restart' }));
    }
  }, []);

  // Send input to terminal
  const sendInput = useCallback((data: string) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  // Send a special key to terminal
  const sendKey = useCallback((key: keyof typeof TERMINAL_KEYS) => {
    sendInput(TERMINAL_KEYS[key]);
  }, [sendInput]);

  // Clear terminal
  const clear = useCallback(() => {
    terminalRef.current?.clear?.();
  }, []);

  // Fit terminal to container
  const fit = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit();
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'resize',
          cols: terminalRef.current.cols,
          rows: terminalRef.current.rows,
        }));
      }
    }
  }, []);

  // Initialize terminal when container is set
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || initializedRef.current) return;

    containerRef.current = el;

    // Dynamically import xterm modules
    const initTerminal = async () => {
      try {
        const [xtermModule, fitModule, webLinksModule] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
        ]);

        const Terminal = xtermModule.Terminal;
        const FitAddon = fitModule.FitAddon;
        const WebLinksAddon = webLinksModule.WebLinksAddon;

        // Create terminal with fixed dimensions and scrollback
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 14,
          fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, monospace',
          scrollback: 10000, // Keep 10k lines of scrollback
          convertEol: true,
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

        term.open(el);
        fit.fit();

        terminalRef.current = term;
        fitAddonRef.current = fit;
        initializedRef.current = true;
        setIsInitialized(true);

        // Handle input
        term.onData((data: string) => {
          sendInput(data);
        });

        // Load saved output from previous session
        await loadSavedOutput();

        // Connect after initialization
        setTimeout(() => connect(), 100);
      } catch (err) {
        console.error('Failed to initialize terminal:', err);
        onError?.('Failed to initialize terminal');
      }
    };

    initTerminal();
  }, [connect, sendInput, onError]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      fit();
    };

    // Use ResizeObserver for more accurate resize detection
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [fit]);

  // Save output on visibility change and beforeunload for reliability
  useEffect(() => {
    if (!persistOutput || !sessionId || !repoFullName) return;

    // Save when tab becomes hidden (user navigates away)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveOutputToDatabase();
      }
    };

    // Use sendBeacon on page unload for reliable delivery
    const handleBeforeUnload = () => {
      if (outputHistoryRef.current.length > 0) {
        navigator.sendBeacon(
          '/api/terminal/output',
          JSON.stringify({
            sessionId,
            repoFullName,
            outputLines: outputHistoryRef.current,
          })
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [persistOutput, sessionId, repoFullName, saveOutputToDatabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      cancelReconnect();
      disconnect();
      if (saveOutputTimeoutRef.current) {
        clearTimeout(saveOutputTimeoutRef.current);
      }
      if (heartbeatCheckIntervalRef.current) {
        clearInterval(heartbeatCheckIntervalRef.current);
      }
      if (connectionStableTimeoutRef.current) {
        clearTimeout(connectionStableTimeoutRef.current);
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, [disconnect, cancelReconnect]);

  return {
    containerRef: setContainerRef,
    isConnected,
    isInitialized,
    isReconnecting,
    reconnectAttempt,
    branchName,
    connect,
    disconnect,
    restart,
    sendInput,
    sendKey,
    clear,
    fit,
    cancelReconnect,
  };
}
