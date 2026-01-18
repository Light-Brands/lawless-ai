/**
 * Claude CLI Stream Event Types
 *
 * These types represent the structured events emitted by the Claude CLI
 * when running with --output-format stream-json --verbose
 */

// Tool types supported by Claude Code
export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Task'
  | 'TodoWrite'
  | 'WebFetch'
  | 'WebSearch'
  | 'AskUserQuestion'
  | 'NotebookEdit';

// Tool input types
export interface ReadToolInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface WriteToolInput {
  file_path: string;
  content: string;
}

export interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface BashToolInput {
  command: string;
  timeout?: number;
  description?: string;
}

export interface GlobToolInput {
  pattern: string;
  path?: string;
}

export interface GrepToolInput {
  pattern: string;
  path?: string;
  type?: string;
  glob?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
}

export interface TaskToolInput {
  description: string;
  prompt: string;
  subagent_type: string;
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

export interface TodoWriteToolInput {
  todos: TodoItem[];
}

export type ToolInput =
  | ReadToolInput
  | WriteToolInput
  | EditToolInput
  | BashToolInput
  | GlobToolInput
  | GrepToolInput
  | TaskToolInput
  | TodoWriteToolInput;

// Base stream event
export interface BaseStreamEvent {
  type: string;
  timestamp?: string;
}

// Text chunk event
export interface TextEvent extends BaseStreamEvent {
  type: 'text';
  content: string;
}

// Thinking/reasoning event
export interface ThinkingEvent extends BaseStreamEvent {
  type: 'thinking';
  content: string;
}

// Tool use event (Claude is calling a tool)
export interface ToolUseEvent extends BaseStreamEvent {
  type: 'tool_use';
  id: string;
  tool: ToolName;
  input: ToolInput;
}

// Tool result event (tool has completed)
export interface ToolResultEvent extends BaseStreamEvent {
  type: 'tool_result';
  id: string;
  tool: ToolName;
  output: string;
  success: boolean;
  error?: string;
}

// System event (initialization, etc.)
export interface SystemEvent extends BaseStreamEvent {
  type: 'system';
  subtype?: 'init' | 'complete' | 'error';
  message?: string;
}

// Result event (final completion)
export interface ResultEvent extends BaseStreamEvent {
  type: 'result';
  result: string;
}

// Error event
export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  message: string;
  code?: string;
}

// Union of all stream events
export type StreamEvent =
  | TextEvent
  | ThinkingEvent
  | ToolUseEvent
  | ToolResultEvent
  | SystemEvent
  | ResultEvent
  | ErrorEvent;

// Message content types for the chat UI
export interface TextContent {
  type: 'text';
  content: string;
}

export interface ThinkingContent {
  type: 'thinking';
  content: string;
  collapsed: boolean;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  tool: ToolName;
  input: ToolInput;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
}

export type MessageContent = TextContent | ThinkingContent | ToolUseContent;

// Chat message structure
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: MessageContent[];
}

// Helper type guards
export function isTextEvent(event: StreamEvent): event is TextEvent {
  return event.type === 'text';
}

export function isThinkingEvent(event: StreamEvent): event is ThinkingEvent {
  return event.type === 'thinking';
}

export function isToolUseEvent(event: StreamEvent): event is ToolUseEvent {
  return event.type === 'tool_use';
}

export function isToolResultEvent(event: StreamEvent): event is ToolResultEvent {
  return event.type === 'tool_result';
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === 'error';
}

// Parse a JSON line from the stream into a StreamEvent
export function parseStreamLine(line: string): StreamEvent | null {
  try {
    const data = JSON.parse(line);
    return data as StreamEvent;
  } catch {
    return null;
  }
}
