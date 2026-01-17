import { LAWLESS_SYSTEM_PROMPT } from './constants';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// In-memory store for conversations (will reset on server restart)
// For production, consider using a database or Redis
const conversations = new Map<string, Message[]>();

export function getConversation(sessionId: string): Message[] {
  return conversations.get(sessionId) || [];
}

export function addMessage(sessionId: string, message: Message): void {
  const history = conversations.get(sessionId) || [];
  history.push(message);
  conversations.set(sessionId, history);
}

export function clearConversation(sessionId: string): void {
  conversations.delete(sessionId);
}

export function createConversation(sessionId: string): void {
  conversations.set(sessionId, []);
}

export function buildPromptWithHistory(history: Message[]): string {
  let prompt = LAWLESS_SYSTEM_PROMPT + '\n\n';
  prompt += '---\n\nConversation:\n\n';

  for (const msg of history) {
    if (msg.role === 'user') {
      prompt += `Human: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }

  // End with indication that assistant should respond
  prompt += 'Assistant:';

  return prompt;
}
