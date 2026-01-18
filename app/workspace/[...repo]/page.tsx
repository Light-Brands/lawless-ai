'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReadTool, WriteTool, EditTool, BashTool, GlobTool, GrepTool, TaskTool, ToolStatus } from '@/app/components/tools';

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
  const [sessionId] = useState(() => `workspace-${Date.now()}`);

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
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: [{ type: 'text', content: userMessage }] }]);
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
          sessionId,
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
    <div className="workspace-page">
      {/* Header */}
      <header className="workspace-header">
        <div className="workspace-header-left">
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
            <div className="workspace-input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Claude to edit code..."
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
    </div>
  );
}
