'use client';

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

// Configure marked for markdown rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// SVG Icons as components for cleaner code
const SparkleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
  </svg>
);

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54"/>
  </svg>
);

const CodeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13"/>
    <path d="M22 2L15 22L11 13L2 9L22 2Z"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

interface GitHubUser {
  login: string;
  name: string;
  avatar: string;
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [serverStatus, setServerStatus] = useState<'ok' | 'error'>('ok');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentAssistantMessageRef = useRef<string>('');

  // Initialize session on mount
  useEffect(() => {
    createSession();
    checkServerStatus();
    checkGitHubAuth();

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }, []);

  async function checkGitHubAuth() {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      if (data.authenticated) {
        setGithubUser(data.user);
      }
    } catch (error) {
      console.error('Failed to check GitHub auth:', error);
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Highlight code blocks after messages update
  useEffect(() => {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  }, [messages]);

  async function createSession() {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setSessionId(data.sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
      setServerStatus('error');
    }
  }

  async function checkServerStatus() {
    try {
      const response = await fetch('/api/health');
      setServerStatus(response.ok ? 'ok' : 'error');
    } catch {
      setServerStatus('error');
    }
  }

  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(content: string): string {
    return marked.parse(content) as string;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const message = inputValue.trim();
    if (!message || isStreaming) return;

    setShowWelcome(false);

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: message,
      time: formatTime(new Date()),
    };
    setMessages(prev => [...prev, userMessage]);

    // Clear input
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Send to API
    await sendMessage(message);
  }

  async function sendMessage(message: string) {
    setIsStreaming(true);
    currentAssistantMessageRef.current = '';

    // Add placeholder assistant message
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      time: formatTime(new Date()),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                currentAssistantMessageRef.current += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content = currentAssistantMessageRef.current;
                  }
                  return newMessages;
                });
              } else if (data.type === 'error') {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content = `Error: ${data.content}`;
                  }
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.content = 'Failed to get response. Please try again.';
        }
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
      scrollToBottom();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isStreaming) {
        handleSubmit(e as unknown as FormEvent);
      }
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }

  async function clearConversation() {
    if (sessionId) {
      try {
        await fetch(`/api/session/${sessionId}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Failed to clear session:', error);
      }
    }

    setMessages([]);
    setShowWelcome(true);
    await createSession();
  }

  function handleSuggestionClick(suggestion: string) {
    setInputValue(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  return (
    <div className="app">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <LightningIcon />
            </div>
            <div className="logo-text">
              <span className="logo-title">Lawless AI</span>
              <span className="logo-subtitle">Solution Architect</span>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active" onClick={() => { clearConversation(); setSidebarOpen(false); }}>
            <span className="nav-icon"><PlusIcon /></span>
            <span>New Chat</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="powered-by">
            <span>Powered by Claude</span>
            <span className={`status-dot ${serverStatus === 'error' ? 'error' : ''}`}></span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-container">
        {/* Chat Header */}
        <header className="chat-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </button>
            <div className="chat-title">
              <h1>Lawless AI</h1>
              <p>Your intelligent solution architect</p>
            </div>
          </div>
          <div className="header-actions">
            {githubUser ? (
              <a
                href="/repos"
                className="github-btn"
                title="My Repositories"
              >
                <GitHubIcon />
                <span>Repos</span>
              </a>
            ) : (
              <a
                href="/api/auth/github"
                className="github-btn"
                title="Login with GitHub"
              >
                <GitHubIcon />
                <span>GitHub</span>
              </a>
            )}
            <button className="icon-btn" onClick={clearConversation} title="Clear conversation">
              <TrashIcon />
            </button>
          </div>
        </header>

        {/* Messages Container */}
        <div className="messages-container" ref={messagesContainerRef}>
          {/* Welcome Message */}
          {showWelcome && (
            <div className="welcome-message">
              <div className="welcome-icon">
                <LightningIcon />
              </div>
              <div className="welcome-badge">
                <SparkleIcon />
                <span>AI-Powered Assistant</span>
              </div>
              <h2>Welcome to Lawless AI</h2>
              <p>I&apos;m your Solution Architect, here to bridge the gap between technical complexity and human understanding. Ask me anything about architecture, code, or complex technical challenges.</p>

              {/* Feature Cards */}
              <div className="feature-cards">
                <div className="feature-card">
                  <div className="feature-card-icon">
                    <BrainIcon />
                  </div>
                  <h3>Deep Understanding</h3>
                  <p>Complex concepts explained with clarity and precision</p>
                </div>
                <div className="feature-card">
                  <div className="feature-card-icon">
                    <CodeIcon />
                  </div>
                  <h3>Code Assistance</h3>
                  <p>Debug, optimize, and architect your solutions</p>
                </div>
                <div className="feature-card">
                  <div className="feature-card-icon">
                    <ChatIcon />
                  </div>
                  <h3>Natural Dialogue</h3>
                  <p>Conversational AI that adapts to your needs</p>
                </div>
              </div>

              <p className="suggestions-label">Try asking</p>
              <div className="welcome-suggestions">
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Help me understand how AI agents work")}
                >
                  Explain AI agents
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("What's the best way to architect a scalable web application?")}
                >
                  Web app architecture
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Can you help me debug a problem I'm having?")}
                >
                  Debug my code
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Explain microservices vs monolith architecture")}
                >
                  Compare architectures
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? <LightningIcon /> : <UserIcon />}
              </div>
              <div className="message-content">
                <div
                  className="message-bubble"
                  dangerouslySetInnerHTML={{
                    __html: msg.role === 'assistant'
                      ? (msg.content ? renderMarkdown(msg.content) : '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>')
                      : escapeHtml(msg.content)
                  }}
                />
                <div className="message-time">{msg.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="input-container">
          <form className="input-form" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message Lawless AI..."
                rows={1}
                autoFocus
              />
              <button
                type="submit"
                className="send-btn"
                disabled={!inputValue.trim() || isStreaming}
              >
                <SendIcon />
              </button>
            </div>
            <div className="input-footer">
              <span className="input-hint">Press Enter to send, Shift+Enter for new line</span>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
