/**
 * Shared chat types for IDE and Workspace
 */

// Tool execution status
export type ToolStatus = 'running' | 'success' | 'error';

// Content block types
export interface TextBlock {
  type: 'text';
  content: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  content: string;
  collapsed: boolean;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  output?: string;
}

export interface ErrorBlock {
  type: 'error';
  content: string;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ErrorBlock;

// Message with content blocks
export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: ContentBlock[];
  timestamp?: Date;
  sessionId?: string;
}

// Simple message for conversation history
export interface SimpleMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Git status for workspace
export interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

// Workspace session
export interface WorkspaceSession {
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

// Chat streaming event types
export type ChatEventType =
  | 'text'
  | 'chunk'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done';

export interface ChatTextEvent {
  type: 'text' | 'chunk';
  content: string;
}

export interface ChatThinkingEvent {
  type: 'thinking';
  content: string;
}

export interface ChatToolUseEvent {
  type: 'tool_use';
  id: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface ChatToolResultEvent {
  type: 'tool_result';
  id: string;
  success: boolean;
  output?: string;
}

export interface ChatErrorEvent {
  type: 'error';
  message: string;
}

export interface ChatDoneEvent {
  type: 'done';
}

export type ChatEvent =
  | ChatTextEvent
  | ChatThinkingEvent
  | ChatToolUseEvent
  | ChatToolResultEvent
  | ChatErrorEvent
  | ChatDoneEvent;

// Chat submission payload
export interface ChatSubmitPayload {
  message: string;
  repoFullName: string;
  workspaceSessionId?: string;
  conversationHistory?: SimpleMessage[];
}

// Type guards
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text';
}

export function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return block.type === 'thinking';
}

export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

export function isErrorBlock(block: ContentBlock): block is ErrorBlock {
  return block.type === 'error';
}
