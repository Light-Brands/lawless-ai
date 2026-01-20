'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useIDEStore } from '../../../stores/ideStore';

export function ChatPane() {
  const {
    chatMode,
    setChatMode,
    terminalMessages,
    workspaceMessages,
    addMessage,
    activeSession,
  } = useIDEStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = chatMode === 'terminal' ? terminalMessages : workspaceMessages;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    addMessage(chatMode, { role: 'user', content: userMessage });
    setIsLoading(true);

    try {
      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          mode: chatMode,
          session: activeSession,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      addMessage(chatMode, { role: 'assistant', content: data.content });
    } catch (error) {
      console.error('Chat error:', error);
      addMessage(chatMode, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-pane">
      {/* Mode tabs */}
      <div className="chat-mode-tabs">
        <button
          className={`chat-mode-tab ${chatMode === 'terminal' ? 'active' : ''}`}
          onClick={() => setChatMode('terminal')}
        >
          Terminal
        </button>
        <button
          className={`chat-mode-tab ${chatMode === 'workspace' ? 'active' : ''}`}
          onClick={() => setChatMode('workspace')}
        >
          Workspace
        </button>
      </div>

      {/* Context panel */}
      {activeSession && (
        <div className="chat-context-panel">
          <div className="context-header">
            <span>Claude's Context</span>
            <button className="context-toggle">Hide</button>
          </div>
          <div className="context-items">
            <div className="context-item">
              <span className="context-icon">📁</span>
              <span>Repo: {activeSession.repo}</span>
            </div>
            <div className="context-item">
              <span className="context-icon">🌿</span>
              <span>Branch: {activeSession.branch}</span>
            </div>
            <div className="context-item">
              <span className="context-icon">📄</span>
              <span>Files in context: {activeSession.state.open_files.length}</span>
            </div>
            <div className="context-item">
              <span className="context-icon">🔧</span>
              <span>Tools: 8 available</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p>
              {chatMode === 'terminal'
                ? 'Terminal mode - execute commands directly'
                : 'Workspace mode - Claude has full context of your project'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="typing-indicator">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Prompt templates */}
      <div className="prompt-templates">
        <button className="prompt-template" onClick={() => setInput('Fix the errors')}>
          Fix errors
        </button>
        <button className="prompt-template" onClick={() => setInput('Write tests')}>
          Write tests
        </button>
        <button className="prompt-template" onClick={() => setInput('Explain this')}>
          Explain
        </button>
        <button className="prompt-template" onClick={() => setInput('Refactor')}>
          Refactor
        </button>
      </div>

      {/* Input */}
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={chatMode === 'terminal' ? 'Enter command...' : 'Describe what you want...'}
          disabled={isLoading}
          className="chat-input"
        />
        <button type="submit" disabled={isLoading || !input.trim()} className="chat-send-btn">
          Send
        </button>
      </form>
    </div>
  );
}
