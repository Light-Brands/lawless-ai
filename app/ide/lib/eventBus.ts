/**
 * IDE Event Bus - Cross-pane communication system
 *
 * All panes communicate through this centralized event bus,
 * enabling decoupled, reactive updates across the IDE.
 */

type IDEEventType =
  | 'file:changed'
  | 'file:saved'
  | 'file:opened'
  | 'migration:detected'
  | 'migration:applied'
  | 'deployment:started'
  | 'deployment:completed'
  | 'deployment:failed'
  | 'server:started'
  | 'server:stopped'
  | 'conflict:detected'
  | 'session:action'
  | 'session:initialized'
  | 'toast:show'
  | 'pane:focus'
  | 'pane:action'
  // Service connection events
  | 'service:connecting'
  | 'service:connected'
  | 'service:error'
  // Terminal events
  | 'terminal:connected'
  | 'terminal:disconnected'
  | 'terminal:output'
  // Chat events
  | 'chat:message'
  | 'chat:tool_execution'
  | 'chat:send';

interface IDEEventMap {
  'file:changed': { path: string; source: 'claude' | 'user' | 'external' };
  'file:saved': { path: string; branch: string };
  'file:opened': { path: string };
  'migration:detected': { file: string; content: string };
  'migration:applied': { file: string; success: boolean; error?: string };
  'deployment:started': { id: string; branch: string };
  'deployment:completed': { id: string; status: 'success' | 'failed'; url?: string };
  'deployment:failed': { id: string; error: string; logs: string };
  'server:started': { port: number; url: string };
  'server:stopped': { port: number };
  'conflict:detected': { files: string[] };
  'session:action': { action: string; details: any };
  'session:initialized': { sessionId: string };
  'toast:show': { message: string; type: 'info' | 'success' | 'error' | 'warning'; duration?: number };
  'pane:focus': { paneId: number };
  'pane:action': { pane: string | null; action: string };
  // Service connection events
  'service:connecting': { service: 'github' | 'supabase' | 'vercel' | 'worktree' | 'terminal' };
  'service:connected': { service: 'github' | 'supabase' | 'vercel' | 'worktree' | 'terminal' };
  'service:error': { service: 'github' | 'supabase' | 'vercel' | 'worktree' | 'terminal'; error: string };
  // Terminal events
  'terminal:connected': { sessionId: string };
  'terminal:disconnected': { sessionId: string; code?: number };
  'terminal:output': { sessionId: string; data: string };
  // Chat events
  'chat:message': { type: 'start' | 'end' | 'tool_use'; tool?: string; input?: Record<string, unknown> };
  'chat:tool_execution': { toolId: string; tool: string; status: 'running' | 'success' | 'error' };
  'chat:send': { message: string; autoSend?: boolean };
}

type EventCallback<T extends IDEEventType> = (data: IDEEventMap[T]) => void;

class IDEEventBus {
  private listeners: Map<IDEEventType, Set<EventCallback<any>>> = new Map();

  /**
   * Subscribe to an event
   */
  on<T extends IDEEventType>(event: T, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  emit<T extends IDEEventType>(event: T, data: IDEEventMap[T]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }

    // Log events in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IDE Event] ${event}`, data);
    }
  }

  /**
   * Subscribe to an event once
   */
  once<T extends IDEEventType>(event: T, callback: EventCallback<T>): () => void {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Remove all listeners for an event
   */
  off(event: IDEEventType): void {
    this.listeners.delete(event);
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const ideEvents = new IDEEventBus();

// React hook for using the event bus
import { useEffect } from 'react';

export function useIDEEvent<T extends IDEEventType>(
  event: T,
  callback: EventCallback<T>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const unsubscribe = ideEvents.on(event, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Helper to emit toast notifications
export function showToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration = 5000) {
  ideEvents.emit('toast:show', { message, type, duration });
}
