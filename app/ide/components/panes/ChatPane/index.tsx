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
import { ideEvents, useIDEEvent } from '../../../lib/eventBus';
import '../../../../styles/command-dictionary.css';
import {
  BookIcon,
  SendIcon,
  FolderIcon,
  GitBranchIcon,
  FileIcon,
  WrenchIcon,
  ChatIcon,
} from '../../Icons';
import { QuickCommands } from '../../QuickCommands';

export function ChatPane() {
  const { repoFullName, sessionId } = useIDEContext();
  const { activeSession } = useIDEStore();

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
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [expandedContext, setExpandedContext] = useState<Set<string>>(new Set());

  // Toggle context section expansion
  const toggleContextExpand = (section: string) => {
    setExpandedContext(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Available tools definition
  const availableTools = [
    { name: 'read_file', description: 'Read contents of a file from the repository' },
    { name: 'write_file', description: 'Create or update a file in the repository' },
    { name: 'list_files', description: 'List files and directories in a path' },
    { name: 'search_code', description: 'Search for code patterns across the codebase' },
    { name: 'run_terminal', description: 'Execute shell commands in the workspace' },
    { name: 'git_status', description: 'Check git status, staged changes, and diff' },
    { name: 'git_commit', description: 'Stage and commit changes with a message' },
    { name: 'web_search', description: 'Search the web for documentation and solutions' },
  ];

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
    sessionId: sessionId || null,
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

  // Listen for chat:send events from other panes
  useIDEEvent('chat:send', async (data) => {
    if (data.autoSend) {
      // Auto-send the message
      await sendMessage(data.message);
    } else {
      // Just populate the input
      setInput(data.message);
      inputRef.current?.focus();
    }
  }, [sendMessage]);

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

  // Handle quick command selection
  const handleQuickCommandSelect = useCallback((item: DictionaryItem) => {
    if (item.type === 'agent') {
      // Agents use @ prefix
      setInput(`@${item.name} `);
    } else {
      // Commands and skills use / prefix
      const usage = item.usage || `/${item.name}`;
      setInput(usage.endsWith(']') ? usage.replace(/\[.*\]/, '') : usage + ' ');
    }
    inputRef.current?.focus();
  }, []);

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
      {/* Header with title and dictionary button */}
      <div className="chat-header">
        <h3 className="chat-title">AI Chat</h3>
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
          <div className="context-sections">
            {/* Repo - simple display */}
            <div className="context-section">
              <div className="context-section-header">
                <span className="context-icon"><FolderIcon size={14} /></span>
                <span className="context-label">Repository</span>
                <span className="context-value">{activeSession.repo}</span>
              </div>
            </div>

            {/* Branch - simple display */}
            <div className="context-section">
              <div className="context-section-header">
                <span className="context-icon"><GitBranchIcon size={14} /></span>
                <span className="context-label">Branch</span>
                <span className="context-value">{activeSession.branch}</span>
              </div>
            </div>

            {/* Files - expandable */}
            <div className={`context-section expandable ${expandedContext.has('files') ? 'expanded' : ''}`}>
              <div
                className="context-section-header clickable"
                onClick={() => toggleContextExpand('files')}
              >
                <span className="context-icon"><FileIcon size={14} /></span>
                <span className="context-label">Open Files</span>
                <span className="context-badge">{activeSession.state.open_files.length}</span>
                <span className="expand-arrow">{expandedContext.has('files') ? '▼' : '▶'}</span>
              </div>
              {expandedContext.has('files') && (
                <div className="context-details">
                  {activeSession.state.open_files.length === 0 ? (
                    <div className="context-detail-empty">No files open</div>
                  ) : (
                    activeSession.state.open_files.map((file: string, i: number) => (
                      <div key={i} className="context-detail-item">
                        <span className="detail-icon">📄</span>
                        <span className="detail-text">{file}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Tools - expandable */}
            <div className={`context-section expandable ${expandedContext.has('tools') ? 'expanded' : ''}`}>
              <div
                className="context-section-header clickable"
                onClick={() => toggleContextExpand('tools')}
              >
                <span className="context-icon"><WrenchIcon size={14} /></span>
                <span className="context-label">Available Tools</span>
                <span className="context-badge">{availableTools.length}</span>
                <span className="expand-arrow">{expandedContext.has('tools') ? '▼' : '▶'}</span>
              </div>
              {expandedContext.has('tools') && (
                <div className="context-details">
                  {availableTools.map((tool, i) => (
                    <div key={i} className="context-detail-item tool-item">
                      <span className="tool-name">{tool.name}</span>
                      <span className="tool-desc">{tool.description}</span>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="empty-icon"><ChatIcon size={32} /></div>
            <h3>Start a conversation</h3>
            <p>Claude has full context of your project and can make changes</p>
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
        <SlashAutocomplete
          searchTerm={input.slice(1)}
          isVisible={showAutocomplete}
          selectedIndex={autocompleteIndex}
          onSelect={handleAutocompleteSelect}
          onClose={() => setShowAutocomplete(false)}
          onSelectedIndexChange={setAutocompleteIndex}
        />

        {/* @ mention autocomplete */}
        <AtMentionAutocomplete
          searchTerm={input.match(/(?:^|\s)@(\w*)$/)?.[1] || ''}
          isVisible={showAtMention}
          selectedIndex={atMentionIndex}
          onSelect={handleAtMentionSelect}
          onClose={() => setShowAtMention(false)}
          onSelectedIndexChange={setAtMentionIndex}
        />

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude anything... (/ for commands, @ for agents)"
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

      {/* Quick Commands Panel */}
      <QuickCommands
        onSelect={handleQuickCommandSelect}
        isExpanded={showQuickCommands}
        onToggleExpand={() => setShowQuickCommands(!showQuickCommands)}
      />

      {/* Command Dictionary modal */}
      <CommandDictionary
        isOpen={showDictionary}
        onClose={() => setShowDictionary(false)}
        onSelect={(item) => {
          setInput(item.usage || `/${item.name}`);
          setShowDictionary(false);
          inputRef.current?.focus();
        }}
      />

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
          padding: 0.375rem 0.625rem;
          border-bottom: 1px solid var(--border-color, #2a2a2f);
          flex-shrink: 0;
        }

        .chat-title {
          margin: 0;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }

        .dictionary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background: transparent;
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 4px;
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
          padding: 0.375rem 0.5rem;
          flex-shrink: 0;
          max-height: 180px;
          overflow-y: auto;
        }

        .context-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.625rem;
          color: var(--text-secondary, #888);
          margin-bottom: 0.25rem;
        }

        .context-toggle {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          font-size: 0.6rem;
          cursor: pointer;
          padding: 0;
        }

        .context-toggle:hover {
          color: var(--text-primary, #fff);
        }

        .context-sections {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .context-section {
          background: var(--bg-tertiary, #1a1a1f);
          border-radius: 4px;
          overflow: hidden;
        }

        .context-section-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.625rem;
        }

        .context-section-header.clickable {
          cursor: pointer;
          transition: background 0.15s;
        }

        .context-section-header.clickable:hover {
          background: rgba(124, 58, 237, 0.1);
        }

        .context-icon {
          display: flex;
          align-items: center;
          color: var(--accent-color, #7c3aed);
          flex-shrink: 0;
        }

        .context-label {
          color: var(--text-secondary, #888);
          flex-shrink: 0;
        }

        .context-value {
          color: var(--text-primary, #e0e0e0);
          font-family: monospace;
          font-size: 0.6rem;
          margin-left: auto;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .context-badge {
          background: var(--accent-color, #7c3aed);
          color: white;
          font-size: 0.55rem;
          font-weight: 600;
          padding: 0.0625rem 0.25rem;
          border-radius: 8px;
          margin-left: auto;
        }

        .expand-arrow {
          color: var(--text-secondary, #666);
          font-size: 0.5rem;
          margin-left: 0.125rem;
          transition: transform 0.15s;
        }

        .context-section.expanded .expand-arrow {
          color: var(--accent-color, #7c3aed);
        }

        .context-details {
          padding: 0 0.5rem 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          border-top: 1px solid var(--border-color, #2a2a2f);
          margin-top: 0.125rem;
          padding-top: 0.25rem;
        }

        .context-detail-item {
          display: flex;
          align-items: flex-start;
          gap: 0.375rem;
          font-size: 0.6rem;
          padding: 0.25rem 0.375rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .context-detail-item.tool-item {
          flex-direction: column;
          gap: 0.0625rem;
        }

        .detail-icon {
          font-size: 0.625rem;
          flex-shrink: 0;
        }

        .detail-text {
          color: var(--text-primary, #e0e0e0);
          font-family: monospace;
          word-break: break-all;
        }

        .tool-name {
          color: var(--accent-color, #a78bfa);
          font-family: monospace;
          font-weight: 500;
        }

        .tool-desc {
          color: var(--text-secondary, #888);
          font-size: 0.55rem;
          line-height: 1.3;
        }

        .context-detail-empty {
          color: var(--text-secondary, #666);
          font-size: 0.6rem;
          font-style: italic;
          padding: 0.125rem 0;
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
          padding: 0.5rem;
          min-height: 0;
        }

        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 0.75rem;
        }

        .empty-icon {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
          opacity: 0.5;
        }

        .chat-empty-state h3 {
          margin: 0 0 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary, #fff);
        }

        .chat-empty-state p {
          margin: 0 0 0.5rem;
          font-size: 0.75rem;
          color: var(--text-secondary, #888);
          max-width: 240px;
        }

        .empty-tips {
          display: flex;
          gap: 0.75rem;
          font-size: 0.625rem;
          color: var(--text-secondary, #666);
        }

        .empty-tips code {
          background: var(--bg-secondary, #141417);
          padding: 0.0625rem 0.25rem;
          border-radius: 2px;
          font-family: monospace;
        }

        .chat-error {
          margin: 0 0.5rem;
          padding: 0.375rem 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          color: #ef4444;
          font-size: 0.7rem;
          flex-shrink: 0;
        }

        .prompt-templates {
          display: flex;
          gap: 0.375rem;
          padding: 0.375rem 0.5rem;
          overflow-x: auto;
          flex-shrink: 0;
        }

        .prompt-template {
          padding: 0.25rem 0.5rem;
          background: var(--bg-secondary, #141417);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 12px;
          color: var(--text-secondary, #888);
          font-size: 0.625rem;
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
          padding: 0.5rem;
          border-top: 1px solid var(--border-color, #2a2a2f);
          flex-shrink: 0;
        }

        .chat-input-form {
          display: flex;
          gap: 0.375rem;
        }

        .chat-input {
          flex: 1;
          padding: 0.5rem 0.625rem;
          background: var(--bg-secondary, #141417);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 6px;
          color: var(--text-primary, #fff);
          font-size: 0.75rem;
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
          width: 32px;
          height: 32px;
          background: var(--accent-color, #7c3aed);
          border: none;
          border-radius: 6px;
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
          width: 12px;
          height: 12px;
          border: 1.5px solid rgba(255, 255, 255, 0.3);
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
