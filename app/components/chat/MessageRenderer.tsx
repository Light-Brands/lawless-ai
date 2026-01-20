'use client';

import React from 'react';
import type { Message, ContentBlock } from '../../types/chat';
import { ThinkingBlockRenderer } from './ThinkingBlockRenderer';
import { ToolCardRenderer } from './ToolCardRenderer';

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
      return (
        <div className="chat-text-block">
          {block.content}
          <style jsx>{`
            .chat-text-block {
              white-space: pre-wrap;
              word-break: break-word;
              line-height: 1.6;
            }
          `}</style>
        </div>
      );

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
              background: rgba(248, 81, 73, 0.1);
              padding: 0.5rem 0.75rem;
              border-radius: 6px;
              border-left: 3px solid #f85149;
              font-size: 0.9rem;
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
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 8px;
        }

        .chat-message.user {
          background: var(--bg-tertiary, #21262d);
        }

        .chat-message.assistant {
          background: transparent;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary, #161b22);
          border-radius: 50%;
          flex-shrink: 0;
          font-size: 0.9rem;
        }

        .message-content {
          flex: 1;
          min-width: 0;
          font-size: 0.9rem;
          color: var(--text-primary, #c9d1d9);
        }

        .message-typing {
          display: flex;
          gap: 4px;
          padding: 0.5rem 0;
        }

        .typing-dot {
          width: 6px;
          height: 6px;
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
            transform: translateY(-4px);
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
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

export default MessageRenderer;
