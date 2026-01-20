'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useIDEContext } from '../../../contexts/IDEContext';
import { useWorkspaceChat } from '../../../../hooks/useWorkspaceChat';
import { MessageList } from '../../../../components/chat/MessageRenderer';
import SlashAutocomplete from '../../../../components/SlashAutocomplete';
import AtMentionAutocomplete from '../../../../components/AtMentionAutocomplete';
import CommandDictionary from '../../../../components/CommandDictionary';
import { DictionaryItem } from '../../../../data/command-dictionary';
import { ideEvents } from '../../../lib/eventBus';
import '../../../../styles/command-dictionary.css';

// Icons
const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

export function ChatPane() {
  const { repoFullName, sessionId } = useIDEContext();
  const { chatMode, setChatMode, activeSession } = useIDEStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [showAtMention, setShowAtMention] = useState(false);
  const [atMentionIndex, setAtMentionIndex] = useState(0);
  const [showDictionary, setShowDictionary] = useState(false);
  const [showContext, setShowContext] = useState(true);

  // Use workspace chat hook with persistence enabled
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    toggleThinking,
    clearMessages,
  } = useWorkspaceChat({
    repoFullName: repoFullName || '',
    sessionId: chatMode === 'workspace' ? sessionId : null,
    persistMessages: true,
    onMessageStart: () => {
      ideEvents.emit('chat:message', { type: 'start' });
    },
    onMessageEnd: () => {
      ideEvents.emit('chat:message', { type: 'end' });
    },
    onError: (err) => {
      ideEvents.emit('toast:show', { message: err, type: 'error' });
    },
    onToolUse: (tool, input) => {
      ideEvents.emit('chat:message', { type: 'tool_use', tool, input });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle input change with autocomplete detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ mention - look for @ at start or after space
    const atMatch = value.match(/(?:^|\s)@(\w*)$/);
    if (atMatch) {
      setShowAtMention(true);
      setAtMentionIndex(0);
      setShowAutocomplete(false);
    }
    // Show autocomplete when input starts with "/"
    else if (value.startsWith('/')) {
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
      setShowAtMention(false);
    } else {
      setShowAutocomplete(false);
      setShowAtMention(false);
    }
  }, []);

  // Handle autocomplete selection
  const handleAutocompleteSelect = useCallback((item: DictionaryItem) => {
    const usage = item.usage || `/${item.name}`;
    setInput(usage.endsWith(']') ? usage.replace(/\[.*\]/, '') : usage);
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
    inputRef.current?.focus();
  }, []);

  // Handle @ mention selection
  const handleAtMentionSelect = useCallback((item: DictionaryItem) => {
    const atMatch = input.match(/(?:^|\s)@(\w*)$/);
    if (atMatch) {
      const beforeAt = input.slice(0, input.length - atMatch[0].length + (atMatch[0].startsWith(' ') ? 1 : 0));
      setInput(`${beforeAt}@${item.name} `);
    } else {
      setInput(`${input}@${item.name} `);
    }
    setShowAtMention(false);
    setAtMentionIndex(0);
    inputRef.current?.focus();
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    setShowAutocomplete(false);
    setShowAtMention(false);

    await sendMessage(message);
  };

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete || showAtMention) {
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        setShowAtMention(false);
      }
      // Let the autocomplete components handle arrow keys
    }
  };

  return (
    <div className="chat-pane">
      {/* Mode tabs with dictionary button */}
      <div className="chat-header">
        <div className="chat-mode-tabs">
          <button
            className={`chat-mode-tab ${chatMode === 'workspace' ? 'active' : ''}`}
            onClick={() => setChatMode('workspace')}
          >
            Workspace
          </button>
          <button
            className={`chat-mode-tab ${chatMode === 'terminal' ? 'active' : ''}`}
            onClick={() => setChatMode('terminal')}
          >
            Terminal
          </button>
        </div>
        <button
          className="dictionary-btn"
          onClick={() => setShowDictionary(true)}
          title="Command Dictionary"
        >
          <BookIcon />
        </button>
      </div>

      {/* Context panel */}
      {activeSession && showContext && (
        <div className="chat-context-panel">
          <div className="context-header">
            <span>Claude's Context</span>
            <button className="context-toggle" onClick={() => setShowContext(false)}>
              Hide
            </button>
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
              <span>Files: {activeSession.state.open_files.length} open</span>
            </div>
            <div className="context-item">
              <span className="context-icon">🔧</span>
              <span>Tools: 8 available</span>
            </div>
          </div>
        </div>
      )}

      {!showContext && activeSession && (
        <button className="show-context-btn" onClick={() => setShowContext(true)}>
          Show context
        </button>
      )}

      {/* Messages */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="empty-icon">💬</div>
            <h3>Start a conversation</h3>
            <p>
              {chatMode === 'workspace'
                ? 'Workspace mode - Claude has full context of your project and can make changes'
                : 'Terminal mode - execute commands directly'}
            </p>
            <div className="empty-tips">
              <span>Type <code>/</code> for commands</span>
              <span>Type <code>@</code> for agents</span>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} onToggleThinking={toggleThinking} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="chat-error">
          {error}
        </div>
      )}

      {/* Prompt templates */}
      {messages.length === 0 && (
        <div className="prompt-templates">
          <button className="prompt-template" onClick={() => setInput('Fix the errors')}>
            Fix errors
          </button>
          <button className="prompt-template" onClick={() => setInput('Write tests for this')}>
            Write tests
          </button>
          <button className="prompt-template" onClick={() => setInput('Explain this code')}>
            Explain
          </button>
          <button className="prompt-template" onClick={() => setInput('Refactor this')}>
            Refactor
          </button>
        </div>
      )}

      {/* Input area with autocomplete */}
      <div className="chat-input-area">
        {/* Slash autocomplete */}
        {showAutocomplete && (
          <SlashAutocomplete
            query={input.slice(1)}
            selectedIndex={autocompleteIndex}
            onSelect={handleAutocompleteSelect}
            onClose={() => setShowAutocomplete(false)}
            onIndexChange={setAutocompleteIndex}
          />
        )}

        {/* @ mention autocomplete */}
        {showAtMention && (
          <AtMentionAutocomplete
            query={input.match(/(?:^|\s)@(\w*)$/)?.[1] || ''}
            selectedIndex={atMentionIndex}
            onSelect={handleAtMentionSelect}
            onClose={() => setShowAtMention(false)}
            onIndexChange={setAtMentionIndex}
          />
        )}

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              chatMode === 'workspace'
                ? 'Ask Claude anything... (/ for commands, @ for agents)'
                : 'Enter terminal command...'
            }
            disabled={isLoading}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="chat-send-btn"
          >
            {isLoading ? (
              <span className="sending-indicator" />
            ) : (
              <SendIcon />
            )}
          </button>
        </form>
      </div>

      {/* Command Dictionary modal */}
      {showDictionary && (
        <CommandDictionary
          onClose={() => setShowDictionary(false)}
          onSelect={(item) => {
            setInput(item.usage || `/${item.name}`);
            setShowDictionary(false);
            inputRef.current?.focus();
          }}
        />
      )}

      <style jsx>{`
        .chat-pane {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary, #0d0d0f);
          overflow: hidden;
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--border-color, #2a2a2f);
          flex-shrink: 0;
        }

        .chat-mode-tabs {
          display: flex;
          gap: 0.25rem;
          background: var(--bg-secondary, #141417);
          padding: 2px;
          border-radius: 6px;
        }

        .chat-mode-tab {
          padding: 0.375rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--text-secondary, #888);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .chat-mode-tab:hover {
          color: var(--text-primary, #fff);
        }

        .chat-mode-tab.active {
          background: var(--bg-tertiary, #1a1a1f);
          color: var(--text-primary, #fff);
        }

        .dictionary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 6px;
          color: var(--text-secondary, #888);
          cursor: pointer;
          transition: all 0.15s;
        }

        .dictionary-btn:hover {
          background: var(--bg-secondary, #141417);
          color: var(--text-primary, #fff);
          border-color: var(--border-hover, #3a3a3f);
        }

        .chat-context-panel {
          background: var(--bg-secondary, #141417);
          border-bottom: 1px solid var(--border-color, #2a2a2f);
          padding: 0.5rem 0.75rem;
          flex-shrink: 0;
        }

        .context-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
          margin-bottom: 0.5rem;
        }

        .context-toggle {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          font-size: 0.7rem;
          cursor: pointer;
          padding: 0;
        }

        .context-toggle:hover {
          color: var(--text-primary, #fff);
        }

        .context-items {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .context-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: var(--text-secondary, #888);
          background: var(--bg-tertiary, #1a1a1f);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .context-icon {
          font-size: 0.8rem;
        }

        .show-context-btn {
          background: none;
          border: none;
          color: var(--text-secondary, #666);
          font-size: 0.7rem;
          padding: 0.25rem 0.75rem;
          cursor: pointer;
          text-decoration: underline;
        }

        .show-context-btn:hover {
          color: var(--text-primary, #fff);
        }

        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem;
          min-height: 0;
        }

        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 1rem;
        }

        .empty-icon {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
          opacity: 0.5;
        }

        .chat-empty-state h3 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-primary, #fff);
        }

        .chat-empty-state p {
          margin: 0 0 1rem;
          font-size: 0.85rem;
          color: var(--text-secondary, #888);
          max-width: 280px;
        }

        .empty-tips {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-secondary, #666);
        }

        .empty-tips code {
          background: var(--bg-secondary, #141417);
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-family: monospace;
        }

        .chat-error {
          margin: 0 0.75rem;
          padding: 0.5rem 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          color: #ef4444;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .prompt-templates {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          overflow-x: auto;
          flex-shrink: 0;
        }

        .prompt-template {
          padding: 0.375rem 0.75rem;
          background: var(--bg-secondary, #141417);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 16px;
          color: var(--text-secondary, #888);
          font-size: 0.75rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }

        .prompt-template:hover {
          background: var(--bg-tertiary, #1a1a1f);
          color: var(--text-primary, #fff);
          border-color: var(--border-hover, #3a3a3f);
        }

        .chat-input-area {
          position: relative;
          padding: 0.75rem;
          border-top: 1px solid var(--border-color, #2a2a2f);
          flex-shrink: 0;
        }

        .chat-input-form {
          display: flex;
          gap: 0.5rem;
        }

        .chat-input {
          flex: 1;
          padding: 0.625rem 0.875rem;
          background: var(--bg-secondary, #141417);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 8px;
          color: var(--text-primary, #fff);
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.15s;
        }

        .chat-input:focus {
          border-color: var(--accent-color, #7c3aed);
        }

        .chat-input::placeholder {
          color: var(--text-secondary, #666);
        }

        .chat-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--accent-color, #7c3aed);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          transition: all 0.15s;
        }

        .chat-send-btn:hover:not(:disabled) {
          background: var(--accent-hover, #6d28d9);
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sending-indicator {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
