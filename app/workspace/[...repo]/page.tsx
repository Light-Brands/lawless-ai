'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReadTool, WriteTool, EditTool, BashTool, GlobTool, GrepTool, TaskTool, ToolStatus } from '@/app/components/tools';
import SlashAutocomplete from '@/app/components/SlashAutocomplete';
import CommandDictionary from '@/app/components/CommandDictionary';
import { DictionaryItem } from '@/app/data/command-dictionary';
import '@/app/styles/command-dictionary.css';

// Content block types
interface TextBlock {
  type: 'text';
  content: string;
}

interface ThinkingBlock {
  type: 'thinking';
  content: string;
  collapsed: boolean;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  output?: string;
}

type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock;

interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

interface WorkspaceSession {
  sessionId: string;
  name: string;
  branchName: string;
  baseBranch: string;
  baseCommit: string;
  createdAt: string;
  lastAccessedAt: string;
  messageCount?: number;
  isValid?: boolean;
}

// SVG Icons
const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const GitBranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

const TerminalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" x2="20" y1="19" y2="19"/>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13"/>
    <path d="M22 2L15 22L11 13L2 9L22 2Z"/>
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19"/>
    <line x1="5" x2="19" y1="12" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const SidebarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
);

const MessageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const SmallGitBranchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);

function generateSessionId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionName(index: number): string {
  return `Session ${index + 1}`;
}

// Render a tool card based on the tool type
function ToolCardRenderer({ block }: { block: ToolUseBlock }) {
  const { tool, input, status, output } = block;

  switch (tool) {
    case 'Read':
      return (
        <ReadTool
          filePath={(input.file_path as string) || 'unknown'}
          content={output}
          status={status}
          startLine={input.offset as number}
          endLine={input.limit as number}
        />
      );

    case 'Write':
      return (
        <WriteTool
          filePath={(input.file_path as string) || 'unknown'}
          content={(input.content as string) || output}
          status={status}
        />
      );

    case 'Edit':
      return (
        <EditTool
          filePath={(input.file_path as string) || 'unknown'}
          oldContent={(input.old_string as string) || ''}
          newContent={(input.new_string as string) || ''}
          status={status}
        />
      );

    case 'Bash':
      return (
        <BashTool
          command={(input.command as string) || ''}
          output={output}
          status={status}
          description={input.description as string}
        />
      );

    case 'Glob':
      return (
        <GlobTool
          pattern={(input.pattern as string) || ''}
          path={input.path as string}
          files={output ? output.split('\n').filter(Boolean) : []}
          status={status}
        />
      );

    case 'Grep':
      // Parse grep output into matches
      const matches = output
        ? output.split('\n').filter(Boolean).map(line => {
            const match = line.match(/^(.+?):(\d+):(.*)$/);
            if (match) {
              return { file: match[1], line: parseInt(match[2]), content: match[3] };
            }
            return { file: 'unknown', line: 0, content: line };
          })
        : [];

      return (
        <GrepTool
          pattern={(input.pattern as string) || ''}
          path={input.path as string}
          fileType={input.type as string}
          matches={matches}
          status={status}
        />
      );

    case 'Task':
      return (
        <TaskTool
          description={(input.description as string) || ''}
          agentType={input.subagent_type as string}
          status={status}
          result={output}
        />
      );

    default:
      // Generic tool display
      return (
        <div className="tool-card generic">
          <div className="tool-card-header">
            <span className="tool-card-label">{tool}</span>
            <span className="tool-card-status">{status}</span>
          </div>
          {output && (
            <div className="tool-card-body">
              <pre>{output}</pre>
            </div>
          )}
        </div>
      );
  }
}

// Thinking block component
function ThinkingBlockRenderer({ block, onToggle }: { block: ThinkingBlock; onToggle: () => void }) {
  return (
    <div className={`thinking-block ${block.collapsed ? 'collapsed' : ''}`}>
      <button className="thinking-block-header" onClick={onToggle}>
        <span className="thinking-block-icon">💭</span>
        <span className="thinking-block-label">Thinking</span>
        <ChevronIcon expanded={!block.collapsed} />
      </button>
      {!block.collapsed && (
        <div className="thinking-block-content">
          {block.content}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const repoFullName = Array.isArray(params.repo) ? params.repo.join('/') : params.repo;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session state
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Dictionary and autocomplete state
  const [showDictionary, setShowDictionary] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Store messages per session
  const sessionMessages = useRef<Map<string, Message[]>>(new Map());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadGitStatus();
  }, [repoFullName]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    if (repoFullName) {
      loadSessions();
    }
  }, [repoFullName]);

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const [owner, repo] = repoFullName.split('/');
      const response = await fetch(`/api/workspace/sessions/${owner}/${repo}`);
      const data = await response.json();

      if (!response.ok) {
        // Backend is unavailable - work in local mode
        console.warn('Sessions API unavailable, working in local mode');
        setSessionsError(data.details || data.error || 'Backend unavailable');
        setSessions([]);
        return;
      }

      if (data.sessions) {
        setSessions(data.sessions);
        setSessionsError(null);
        // If no active session and sessions exist, select the first one
        if (data.sessions.length > 0 && !activeSessionId) {
          const firstSession = data.sessions[0];
          setActiveSessionId(firstSession.sessionId);
          loadSessionMessages(firstSession.sessionId);
        }
        // Don't auto-create session if there are none - let user do it manually
      }
    } catch (err: any) {
      console.warn('Failed to load sessions, working in local mode:', err.message);
      setSessionsError(err.message || 'Failed to connect to backend');
      setSessions([]);
      // Don't try to create a session - just work locally
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSessionMessages(sessionId: string) {
    // Check if we already have messages cached
    const cached = sessionMessages.current.get(sessionId);
    if (cached) {
      setMessages(cached);
      return;
    }

    try {
      const response = await fetch(`/api/workspace/session/${sessionId}`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        // Convert stored messages to ContentBlock format
        const formattedMessages: Message[] = data.messages.map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: [{ type: 'text', content: msg.content }]
        }));
        sessionMessages.current.set(sessionId, formattedMessages);
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
      setMessages([]);
    }
  }

  const createNewSession = useCallback(async () => {
    // If we already know the backend is down, don't try
    if (sessionsError) {
      console.warn('Backend unavailable, cannot create session');
      return;
    }

    const sessionId = generateSessionId();
    const sessionName = generateSessionName(sessions.length);

    try {
      const response = await fetch('/api/workspace/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName,
          sessionId,
          sessionName,
          baseBranch: 'main',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.warn('Failed to create session:', error);
        setSessionsError(error.details || error.error || 'Failed to create session');
        return;
      }

      const data = await response.json();

      const newSession: WorkspaceSession = {
        sessionId: data.sessionId,
        name: data.name,
        branchName: data.branchName,
        baseBranch: data.baseBranch,
        baseCommit: data.baseCommit,
        createdAt: data.createdAt,
        lastAccessedAt: data.lastAccessedAt,
        messageCount: 0,
        isValid: true,
      };

      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.sessionId);
      setMessages([]);
      sessionMessages.current.set(newSession.sessionId, []);
      setSessionsError(null);
    } catch (err: any) {
      console.warn('Error creating session:', err.message);
      setSessionsError(err.message || 'Failed to create session');
    }
  }, [sessions.length, repoFullName, sessionsError]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/workspace/session/${sessionId}?repo=${encodeURIComponent(repoFullName)}`, {
        method: 'DELETE',
      });

      // Remove from local state
      sessionMessages.current.delete(sessionId);
      setSessions(prev => {
        const updated = prev.filter(s => s.sessionId !== sessionId);
        // If we're deleting the active session, switch to another
        if (activeSessionId === sessionId && updated.length > 0) {
          setActiveSessionId(updated[0].sessionId);
          loadSessionMessages(updated[0].sessionId);
        } else if (updated.length === 0) {
          setActiveSessionId(null);
          setMessages([]);
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [activeSessionId, repoFullName]);

  const switchSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;

    // Save current messages
    if (activeSessionId) {
      sessionMessages.current.set(activeSessionId, messages);
    }

    setActiveSessionId(sessionId);
    loadSessionMessages(sessionId);
  }, [activeSessionId, messages]);

  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    try {
      const response = await fetch(`/api/workspace/session/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        setSessions(prev => prev.map(s =>
          s.sessionId === sessionId ? { ...s, name: newName } : s
        ));
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }

    setEditingSessionId(null);
    setEditingName('');
  }, []);

  // Handle input change with autocomplete detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Show autocomplete when input starts with "/" and has content after
    if (value.startsWith('/')) {
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, []);

  // Handle autocomplete item selection
  const handleAutocompleteSelect = useCallback((item: DictionaryItem) => {
    // Replace input with selected command
    const usage = item.usage || `/${item.name}`;
    setInput(usage.endsWith(']') ? usage.replace(/\[.*\]/, '') : usage);
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, []);

  // Close autocomplete
  const handleAutocompleteClose = useCallback(() => {
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, []);

  async function loadGitStatus() {
    try {
      const response = await fetch(`/api/workspace/git/status?repo=${encodeURIComponent(repoFullName)}`);
      const data = await response.json();
      if (data.status) {
        setGitStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to load git status:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || !activeSessionId) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    const userMsg: Message = { role: 'user', content: [{ type: 'text', content: userMessage }] };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Add empty assistant message that we'll populate
    setMessages((prev) => [...prev, { role: 'assistant', content: [] }]);

    try {
      const response = await fetch('/api/workspace/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          repoFullName,
          workspaceSessionId: activeSessionId,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const toolBlocks = new Map<string, number>(); // Map tool ID to index in content array

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role !== 'assistant') return prev;

                const content = [...lastMessage.content];

                switch (data.type) {
                  case 'text':
                  case 'chunk': {
                    // Append to last text block or create new one
                    const lastBlock = content[content.length - 1];
                    if (lastBlock && lastBlock.type === 'text') {
                      lastBlock.content += data.content;
                    } else {
                      content.push({ type: 'text', content: data.content });
                    }
                    break;
                  }

                  case 'thinking': {
                    content.push({
                      type: 'thinking',
                      content: data.content,
                      collapsed: true,
                    });
                    break;
                  }

                  case 'tool_use': {
                    const toolBlock: ToolUseBlock = {
                      type: 'tool_use',
                      id: data.id,
                      tool: data.tool,
                      input: data.input || {},
                      status: 'running',
                    };
                    content.push(toolBlock);
                    toolBlocks.set(data.id, content.length - 1);
                    break;
                  }

                  case 'tool_result': {
                    const toolIndex = toolBlocks.get(data.id);
                    if (toolIndex !== undefined && content[toolIndex]?.type === 'tool_use') {
                      const block = content[toolIndex] as ToolUseBlock;
                      block.status = data.success ? 'success' : 'error';
                      block.output = data.output;
                    }
                    break;
                  }

                  case 'error': {
                    content.push({
                      type: 'text',
                      content: `Error: ${data.message}`,
                    });
                    break;
                  }
                }

                newMessages[newMessages.length - 1] = { ...lastMessage, content };
                return newMessages;
              });
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Update cached messages
      if (activeSessionId) {
        setMessages(msgs => {
          sessionMessages.current.set(activeSessionId, msgs);
          return msgs;
        });
      }

      // Refresh git status after Claude might have made changes
      loadGitStatus();
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.content.push({ type: 'text', content: 'Error: Failed to get response' });
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  }

  function toggleThinking(messageIndex: number, blockIndex: number) {
    setMessages((prev) => {
      const newMessages = [...prev];
      const block = newMessages[messageIndex].content[blockIndex];
      if (block.type === 'thinking') {
        block.collapsed = !block.collapsed;
      }
      return newMessages;
    });
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    setCommitting(true);

    try {
      const response = await fetch('/api/workspace/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName,
          message: commitMessage,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCommitMessage('');
        loadGitStatus();
        alert('Changes committed successfully!');
      } else {
        alert(`Commit failed: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to commit changes');
    } finally {
      setCommitting(false);
    }
  }

  async function handlePush() {
    try {
      const response = await fetch('/api/workspace/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Pushed to remote successfully!');
      } else {
        alert(`Push failed: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to push changes');
    }
  }

  const hasChanges = gitStatus && (
    gitStatus.modified.length > 0 ||
    gitStatus.added.length > 0 ||
    gitStatus.deleted.length > 0 ||
    gitStatus.untracked.length > 0
  );

  const changesCount = (gitStatus?.modified.length || 0) + (gitStatus?.added.length || 0) + (gitStatus?.untracked.length || 0) + (gitStatus?.deleted.length || 0);

  const activeSession = sessions.find(s => s.sessionId === activeSessionId);

  // Render message content blocks
  function renderContent(content: ContentBlock[], messageIndex: number) {
    return content.map((block, blockIndex) => {
      switch (block.type) {
        case 'text':
          return (
            <div key={blockIndex} className="workspace-text-block">
              {block.content}
            </div>
          );

        case 'thinking':
          return (
            <ThinkingBlockRenderer
              key={blockIndex}
              block={block}
              onToggle={() => toggleThinking(messageIndex, blockIndex)}
            />
          );

        case 'tool_use':
          return <ToolCardRenderer key={blockIndex} block={block} />;

        default:
          return null;
      }
    });
  }

  return (
    <div className="workspace-page with-sidebar">

      {/* Session Sidebar */}
      <aside className={`workspace-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Sessions {!sessionsError && `(${sessions.length})`}</span>
          <div className="sidebar-actions">
            {!sessionsError && (
              <button
                className="sidebar-btn primary"
                onClick={createNewSession}
                title="New session"
              >
                <PlusIcon />
              </button>
            )}
          </div>
        </div>
        <div className="sessions-list">
          {sessionsLoading ? (
            <div style={{ padding: '1rem', color: '#8b949e', textAlign: 'center' }}>
              Loading sessions...
            </div>
          ) : sessionsError ? (
            <div style={{ padding: '1rem', color: '#8b949e', textAlign: 'center', fontSize: '0.875rem' }}>
              <div style={{ marginBottom: '0.5rem', color: '#f0883e' }}>
                Sessions unavailable
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                Backend server not reachable. You can still chat below.
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '1rem', color: '#8b949e', textAlign: 'center' }}>
              <div>No sessions yet</div>
              <button
                onClick={createNewSession}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: '#238636',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Create Session
              </button>
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.sessionId}
                className={`session-item ${session.sessionId === activeSessionId ? 'active' : ''}`}
                onClick={() => switchSession(session.sessionId)}
              >
                <div className="session-icon">
                  <MessageIcon />
                </div>
                <div className="session-info">
                  {editingSessionId === session.sessionId ? (
                    <input
                      className="session-name-input"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameSession(session.sessionId, editingName);
                        } else if (e.key === 'Escape') {
                          setEditingSessionId(null);
                          setEditingName('');
                        }
                      }}
                      onBlur={() => renameSession(session.sessionId, editingName)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="session-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingSessionId(session.sessionId);
                        setEditingName(session.name);
                      }}
                    >
                      {session.name}
                    </div>
                  )}
                  <div className="session-meta">
                    <span className="session-branch">
                      <SmallGitBranchIcon />
                      {session.branchName.replace('workspace/', '')}
                    </span>
                    {session.messageCount !== undefined && session.messageCount > 0 && (
                      <span>{session.messageCount} msgs</span>
                    )}
                  </div>
                </div>
                <button
                  className="session-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this session? This will also delete the branch and worktree.')) {
                      deleteSession(session.sessionId);
                    }
                  }}
                  title="Delete session"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="workspace-main">
        {/* Header */}
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="workspace-back-btn"
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              style={{ marginRight: '0.5rem' }}
            >
              <SidebarIcon />
            </button>
            <button
              onClick={() => router.push('/repos')}
              className="workspace-back-btn"
              aria-label="Back to repositories"
            >
              <BackIcon />
            </button>
            <div className="workspace-title">
              <h1>{repoFullName?.split('/')[1] || repoFullName}</h1>
              <span className="workspace-owner">{repoFullName?.split('/')[0]}</span>
            </div>
            {activeSession && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginLeft: '1rem',
                padding: '0.25rem 0.75rem',
                background: '#21262d',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#58a6ff'
              }}>
                <SmallGitBranchIcon />
                {activeSession.branchName}
              </div>
            )}
          </div>
          <div className="workspace-header-right">
            <button
              onClick={() => router.push(`/terminal/${repoFullName}`)}
              className="workspace-terminal-btn"
              title="Open Terminal"
            >
              <TerminalIcon />
              <span className="terminal-btn-label">Terminal</span>
            </button>
            <button
              onClick={() => setShowDictionary(true)}
              className="dictionary-btn"
              title="Command Dictionary"
            >
              <BookIcon />
              <span className="dictionary-btn-label">Commands</span>
            </button>
            <button
              onClick={() => setShowGitPanel(!showGitPanel)}
              className={`workspace-git-btn ${hasChanges ? 'has-changes' : ''} ${showGitPanel ? 'active' : ''}`}
            >
              <GitBranchIcon />
              <span className="git-btn-label">Git</span>
              {hasChanges && <span className="git-changes-badge">{changesCount}</span>}
            </button>
          </div>
        </header>

        <div className="workspace-content">
          {/* Chat panel */}
          <div className="workspace-chat">
            {/* Messages */}
            <div className="workspace-messages">
              {messages.length === 0 && (
                <div className="workspace-empty">
                  <div className="workspace-empty-icon">
                    <GitBranchIcon />
                  </div>
                  <h2>Ready to code</h2>
                  <p>Ask Claude to read, edit, or create files in this repository.</p>
                  {activeSession && (
                    <p style={{ fontSize: '0.875rem', color: '#8b949e', marginTop: '0.5rem' }}>
                      Working on branch: <code style={{ color: '#58a6ff' }}>{activeSession.branchName}</code>
                    </p>
                  )}
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`workspace-message ${msg.role}`}
                >
                  <div className="workspace-message-header">
                    {msg.role === 'user' ? 'You' : 'Claude'}
                  </div>
                  <div className="workspace-message-content">
                    {renderContent(msg.content, i)}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.content.length === 0 && (
                <div className="workspace-thinking">
                  <div className="thinking-dots">
                    <span></span><span></span><span></span>
                  </div>
                  Claude is thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="workspace-input-form">
              <div className="workspace-input-wrapper" style={{ position: 'relative' }}>
                {showAutocomplete && (
                  <SlashAutocomplete
                    searchTerm={input}
                    isVisible={showAutocomplete}
                    onSelect={handleAutocompleteSelect}
                    onClose={handleAutocompleteClose}
                    selectedIndex={autocompleteIndex}
                    onSelectedIndexChange={setAutocompleteIndex}
                  />
                )}
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask Claude to edit code... (type / for commands)"
                  className="workspace-input"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="workspace-send-btn"
                >
                  <SendIcon />
                </button>
              </div>
            </form>
          </div>

          {/* Desktop Git panel */}
          {showGitPanel && !isMobile && (
            <div className="workspace-git-panel">
              <div className="git-panel-header">
                <h2>Git Status</h2>
                <button onClick={() => setShowGitPanel(false)} className="git-panel-close">
                  <CloseIcon />
                </button>
              </div>

              {gitStatus && (
                <div className="git-panel-content">
                  {gitStatus.modified.length > 0 && (
                    <div className="git-section">
                      <h3 className="git-section-title modified">Modified</h3>
                      <div className="git-files">
                        {gitStatus.modified.map((file) => (
                          <div key={file} className="git-file">{file}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gitStatus.added.length > 0 && (
                    <div className="git-section">
                      <h3 className="git-section-title added">Added</h3>
                      <div className="git-files">
                        {gitStatus.added.map((file) => (
                          <div key={file} className="git-file">{file}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gitStatus.untracked.length > 0 && (
                    <div className="git-section">
                      <h3 className="git-section-title untracked">Untracked</h3>
                      <div className="git-files">
                        {gitStatus.untracked.map((file) => (
                          <div key={file} className="git-file">{file}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gitStatus.deleted.length > 0 && (
                    <div className="git-section">
                      <h3 className="git-section-title deleted">Deleted</h3>
                      <div className="git-files">
                        {gitStatus.deleted.map((file) => (
                          <div key={file} className="git-file">{file}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasChanges && (
                    <div className="git-no-changes">No changes</div>
                  )}

                  {hasChanges && (
                    <div className="git-actions">
                      <input
                        type="text"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Commit message..."
                        className="git-commit-input"
                      />
                      <button
                        onClick={handleCommit}
                        disabled={!commitMessage.trim() || committing}
                        className="git-commit-btn"
                      >
                        {committing ? 'Committing...' : 'Commit All'}
                      </button>
                      <button
                        onClick={handlePush}
                        className="git-push-btn"
                      >
                        Push to GitHub
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Git Bottom Sheet */}
        {showGitPanel && isMobile && (
          <div className="mobile-sheet-overlay" onClick={() => setShowGitPanel(false)}>
            <div className="mobile-sheet git-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-sheet-handle" />

              <div className="mobile-sheet-header">
                <h3>Git Status</h3>
                <button className="mobile-sheet-close" onClick={() => setShowGitPanel(false)}>
                  <CloseIcon />
                </button>
              </div>

              {gitStatus && (
                <div className="mobile-sheet-list git-mobile-content">
                  {gitStatus.modified.length > 0 && (
                    <div className="git-mobile-section">
                      <h4 className="git-mobile-title modified">Modified ({gitStatus.modified.length})</h4>
                      {gitStatus.modified.map((file) => (
                        <div key={file} className="git-mobile-file">{file}</div>
                      ))}
                    </div>
                  )}

                  {gitStatus.added.length > 0 && (
                    <div className="git-mobile-section">
                      <h4 className="git-mobile-title added">Added ({gitStatus.added.length})</h4>
                      {gitStatus.added.map((file) => (
                        <div key={file} className="git-mobile-file">{file}</div>
                      ))}
                    </div>
                  )}

                  {gitStatus.untracked.length > 0 && (
                    <div className="git-mobile-section">
                      <h4 className="git-mobile-title untracked">Untracked ({gitStatus.untracked.length})</h4>
                      {gitStatus.untracked.map((file) => (
                        <div key={file} className="git-mobile-file">{file}</div>
                      ))}
                    </div>
                  )}

                  {gitStatus.deleted.length > 0 && (
                    <div className="git-mobile-section">
                      <h4 className="git-mobile-title deleted">Deleted ({gitStatus.deleted.length})</h4>
                      {gitStatus.deleted.map((file) => (
                        <div key={file} className="git-mobile-file">{file}</div>
                      ))}
                    </div>
                  )}

                  {!hasChanges && (
                    <div className="git-mobile-empty">No changes detected</div>
                  )}
                </div>
              )}

              {hasChanges && (
                <div className="git-mobile-actions">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    className="git-mobile-input"
                  />
                  <div className="git-mobile-buttons">
                    <button
                      onClick={handleCommit}
                      disabled={!commitMessage.trim() || committing}
                      className="git-mobile-commit"
                    >
                      {committing ? 'Committing...' : 'Commit'}
                    </button>
                    <button
                      onClick={handlePush}
                      className="git-mobile-push"
                    >
                      Push
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Command Dictionary Modal */}
        <CommandDictionary
          isOpen={showDictionary}
          onClose={() => setShowDictionary(false)}
          onSelect={(item) => {
            handleAutocompleteSelect(item);
            setShowDictionary(false);
          }}
        />
      </div>
    </div>
  );
}
