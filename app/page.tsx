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

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [serverStatus, setServerStatus] = useState<'ok' | 'error'>('ok');

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentAssistantMessageRef = useRef<string>('');

  // Initialize session on mount
  useEffect(() => {
    createSession();
    checkServerStatus();
  }, []);

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
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            <div className="logo-text">
              <span className="logo-title">Lawless AI</span>
              <span className="logo-subtitle">Solution Architect</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active" onClick={clearConversation}>
            <span className="nav-icon">+</span>
            <span>New Chat</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="powered-by">
            <span>Powered by Claude CLI</span>
            <span className={`status-dot ${serverStatus === 'error' ? 'error' : ''}`}></span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-container">
        {/* Chat Header */}
        <header className="chat-header">
          <div className="chat-title">
            <h1>Lawless AI</h1>
            <p>Bridging technical complexity and human understanding</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={clearConversation} title="Clear conversation">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </header>

        {/* Messages Container */}
        <div className="messages-container" ref={messagesContainerRef}>
          {/* Welcome Message */}
          {showWelcome && (
            <div className="welcome-message">
              <div className="welcome-icon">⚡</div>
              <h2>Welcome to Lawless AI</h2>
              <p>I&apos;m your Solution Architect - here to bridge the gap between technical complexity and human understanding. I&apos;ll translate complex concepts into clarity, warmth, and accessibility.</p>
              <div className="welcome-suggestions">
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Help me understand how AI agents work in simple terms")}
                >
                  Explain AI agents simply
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("What's the best way to architect a new web application?")}
                >
                  Web app architecture
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Can you help me debug a problem I'm having?")}
                >
                  Debug a problem
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? '⚡' : '👤'}
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
                placeholder="Ask Lawless AI anything..."
                rows={1}
                autoFocus
              />
              <button
                type="submit"
                className="send-btn"
                disabled={!inputValue.trim() || isStreaming}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
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
