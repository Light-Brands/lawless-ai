'use client';

import { useState, useRef, useEffect } from 'react';
import type { BuilderType, BuilderMessage } from '@/app/types/builder';
import { getSections } from '../lib/documentTemplates';

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect x="2" y="8" width="20" height="14" rx="2" />
    <circle cx="8" cy="16" r="2" />
    <circle cx="16" cy="16" r="2" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface BuilderChatProps {
  messages: BuilderMessage[];
  isLoading: boolean;
  builderType: BuilderType;
  completedSections: string[];
  onSendMessage: (message: string) => void;
  onJumpToSection: (section: string) => void;
}

export function BuilderChat({
  messages,
  isLoading,
  builderType,
  completedSections,
  onSendMessage,
  onJumpToSection,
}: BuilderChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sections = getSections(builderType);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="builder-chat-panel">
      {/* Messages */}
      <div className="builder-chat-messages">
        {messages.length === 0 && (
          <div className="builder-empty-state">
            <div className="builder-empty-icon">
              <BotIcon />
            </div>
            <h3 className="builder-empty-title">
              {builderType === 'plan' ? 'Plan Builder' : 'Identity Builder'}
            </h3>
            <p className="builder-empty-description">
              {builderType === 'plan'
                ? "Let's build your project plan together. I'll guide you through each section."
                : "Let's create your brand identity. I'll help you define what your brand stands for."}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`builder-message ${message.role}`}>
            <div className="builder-message-avatar">
              {message.role === 'assistant' ? <BotIcon /> : <UserIcon />}
            </div>
            <div className="builder-message-content">
              <div className="builder-message-text">{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="builder-message assistant">
            <div className="builder-message-avatar">
              <BotIcon />
            </div>
            <div className="builder-message-content">
              <div className="builder-spinner" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Section Shortcuts */}
      <div className="builder-section-shortcuts">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`builder-shortcut ${completedSections.includes(section.id) ? 'completed' : ''}`}
            onClick={() => onJumpToSection(section.id)}
            title={section.description}
          >
            {completedSections.includes(section.id) && <CheckIcon />}
            {section.title}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="builder-chat-input-container">
        <form onSubmit={handleSubmit} className="builder-chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="builder-chat-input"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <button
            type="submit"
            className="builder-send-btn"
            disabled={!input.trim() || isLoading}
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
