'use client';

import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeSyncOptions<T> {
  table: keyof Database['public']['Tables'];
  filter?: {
    column: string;
    value: string;
  };
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time updates on a Supabase table
 */
export function useRealtimeSync<T>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSyncOptions<T>) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!enabled) {
      setIsSubscribed(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    const subscribe = async () => {
      try {
        // Build channel name
        const channelName = filter
          ? `${table}:${filter.column}=eq.${filter.value}`
          : `${table}:all`;

        // Create subscription
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: table as string,
              filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
            },
            (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
              const event = payload.eventType as RealtimeEvent;
              const record = (payload.new || payload.old) as T;

              switch (event) {
                case 'INSERT':
                  onInsert?.(record);
                  break;
                case 'UPDATE':
                  onUpdate?.(record);
                  break;
                case 'DELETE':
                  onDelete?.(payload.old as T);
                  break;
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setIsSubscribed(true);
              setError(null);
            } else if (status === 'CHANNEL_ERROR') {
              setError('Failed to subscribe to real-time updates');
              setIsSubscribed(false);
            }
          });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Subscription failed';
        console.error('Real-time subscription error:', err);
        setError(message);
        setIsSubscribed(false);
      }
    };

    subscribe();

    // Cleanup
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      setIsSubscribed(false);
    };
  }, [supabase, table, filter?.column, filter?.value, enabled, onInsert, onUpdate, onDelete]);

  return { isSubscribed, error };
}

/**
 * Hook for syncing workspace sessions in real-time
 */
export function useRealtimeWorkspaceSessions(
  repoFullName: string,
  onUpdate: (sessions: Database['public']['Tables']['workspace_sessions']['Row'][]) => void
) {
  const [sessions, setSessions] = useState<
    Database['public']['Tables']['workspace_sessions']['Row'][]
  >([]);

  const handleInsert = useCallback(
    (session: Database['public']['Tables']['workspace_sessions']['Row']) => {
      setSessions((prev) => {
        const updated = [session, ...prev.filter((s) => s.id !== session.id)];
        onUpdate(updated);
        return updated;
      });
    },
    [onUpdate]
  );

  const handleUpdate = useCallback(
    (session: Database['public']['Tables']['workspace_sessions']['Row']) => {
      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === session.id ? session : s));
        onUpdate(updated);
        return updated;
      });
    },
    [onUpdate]
  );

  const handleDelete = useCallback(
    (session: Database['public']['Tables']['workspace_sessions']['Row']) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== session.id);
        onUpdate(updated);
        return updated;
      });
    },
    [onUpdate]
  );

  const { isSubscribed, error } = useRealtimeSync<
    Database['public']['Tables']['workspace_sessions']['Row']
  >({
    table: 'workspace_sessions',
    filter: {
      column: 'repo_full_name',
      value: repoFullName,
    },
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    enabled: !!repoFullName,
  });

  return { isSubscribed, error, sessions };
}

/**
 * Hook for syncing conversations in real-time
 */
export function useRealtimeConversation(
  workspaceSessionId: string | null,
  onMessagesUpdate: (messages: unknown[]) => void
) {
  const handleUpdate = useCallback(
    (conversation: Database['public']['Tables']['conversations']['Row']) => {
      const messages = (conversation.messages as unknown[]) || [];
      onMessagesUpdate(messages);
    },
    [onMessagesUpdate]
  );

  const { isSubscribed, error } = useRealtimeSync<
    Database['public']['Tables']['conversations']['Row']
  >({
    table: 'conversations',
    filter: workspaceSessionId
      ? {
          column: 'workspace_session_id',
          value: workspaceSessionId,
        }
      : undefined,
    onUpdate: handleUpdate,
    onInsert: handleUpdate,
    enabled: !!workspaceSessionId,
  });

  return { isSubscribed, error };
}

interface PresencePayload {
  key: string;
  newPresences?: Record<string, unknown>[];
  leftPresences?: Record<string, unknown>[];
}

/**
 * Presence tracking for collaborative features
 */
export function usePresence(channelName: string, userInfo: { id: string; name: string }) {
  const [presenceState, setPresenceState] = useState<Record<string, unknown[]>>({});
  const supabase = getSupabaseClient();

  useEffect(() => {
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userInfo.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setPresenceState(channel.presenceState());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: PresencePayload) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }: PresencePayload) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userInfo);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, channelName, userInfo.id, userInfo.name]);

  return { presenceState };
}
