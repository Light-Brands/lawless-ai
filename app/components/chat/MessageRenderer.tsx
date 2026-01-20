'use client';

import React from 'react';
import type { Message, ContentBlock } from '../../types/chat';
import { ThinkingBlockRenderer } from './ThinkingBlockRenderer';
import { ToolCardRenderer } from './ToolCardRenderer';
import { ChatMarkdown } from './ChatMarkdown';
import '../../styles/chat-markdown.css';

interface MessageRendererProps {
  message: Message;
  messageIndex: number;
  onToggleThinking: (messageIndex: number, blockIndex: number) => void;
}

// Render a single content block
function ContentBlockRenderer({
  block,
  messageIndex,
  blockIndex,
  onToggleThinking,
}: {
  block: ContentBlock;
  messageIndex: number;
  blockIndex: number;
  onToggleThinking: (messageIndex: number, blockIndex: number) => void;
}) {
  switch (block.type) {
    case 'text':
      return <ChatMarkdown content={block.content} />;

    case 'thinking':
      return (
        <ThinkingBlockRenderer
          block={block}
          onToggle={() => onToggleThinking(messageIndex, blockIndex)}
        />
      );

    case 'tool_use':
      return <ToolCardRenderer block={block} />;

    case 'error':
      return (
        <div className="chat-error-block">
          {block.content}
          <style jsx>{`
            .chat-error-block {
              color: #f85149;
              background: transparent;
              padding: 0;
              border-radius: 0;
              border-left: 1px solid rgba(248, 81, 73, 0.5);
              padding-left: 6px;
              font-size: 0.65rem;
            }
          `}</style>
        </div>
      );

    default:
      return null;
  }
}

export function MessageRenderer({
  message,
  messageIndex,
  onToggleThinking,
}: MessageRendererProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        {message.content.map((block, blockIndex) => (
          <ContentBlockRenderer
            key={blockIndex}
            block={block}
            messageIndex={messageIndex}
            blockIndex={blockIndex}
            onToggleThinking={onToggleThinking}
          />
        ))}
        {message.content.length === 0 && !isUser && (
          <div className="message-typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      <style jsx>{`
        .chat-message {
          display: flex;
          gap: 0.375rem;
          padding: 0.125rem 0;
        }

        .chat-message.user {
          background: transparent;
          border-left: 2px solid #58a6ff;
          padding-left: 0.5rem;
          margin-left: -0.5rem;
        }

        .chat-message.assistant {
          background: transparent;
        }

        .message-avatar {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 0.6rem;
          opacity: 0.6;
        }

        .message-content {
          flex: 1;
          min-width: 0;
          font-size: 0.7rem;
          color: var(--text-primary, #c9d1d9);
          overflow-x: hidden;
        }

        .message-typing {
          display: flex;
          gap: 2px;
          padding: 0.125rem 0;
        }

        .typing-dot {
          width: 3px;
          height: 3px;
          background: var(--text-secondary, #8b949e);
          border-radius: 50%;
          animation: typingBounce 1.4s ease-in-out infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingBounce {
          0%,
          60%,
          100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

// Export a simpler list component
interface MessageListProps {
  messages: Message[];
  onToggleThinking: (messageIndex: number, blockIndex: number) => void;
}

export function MessageList({ messages, onToggleThinking }: MessageListProps) {
  return (
    <div className="chat-messages">
      {messages.map((message, index) => (
        <MessageRenderer
          key={message.id || index}
          message={message}
          messageIndex={index}
          onToggleThinking={onToggleThinking}
        />
      ))}
      <style jsx>{`
        .chat-messages {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
      `}</style>
    </div>
  );
}

export default MessageRenderer;
