import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ActivityEvent, ActivityEventInsert, ActivityEventType } from '@/types/database';

export interface ActivityEventInput {
  userId?: string;
  sessionId?: string;
  repoFullName?: string;
  eventType: ActivityEventType;
  icon: string;
  summary: string;
  details?: string;
  relatedFile?: string;
  metadata?: Record<string, unknown>;
}

export async function createActivityEvent(
  supabase: SupabaseClient<Database>,
  input: ActivityEventInput
): Promise<ActivityEvent | null> {
  const { data, error } = await supabase
    .from('activity_events')
    .insert({
      user_id: input.userId,
      session_id: input.sessionId,
      repo_full_name: input.repoFullName,
      event_type: input.eventType,
      icon: input.icon,
      summary: input.summary,
      details: input.details,
      related_file: input.relatedFile,
      metadata: input.metadata || {},
    } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating activity event:', error);
    return null;
  }

  return data as ActivityEvent;
}

export async function createActivityEvents(
  supabase: SupabaseClient<Database>,
  events: ActivityEventInput[]
): Promise<ActivityEvent[]> {
  if (events.length === 0) return [];

  const { data, error } = await supabase
    .from('activity_events')
    .insert(
      events.map((input) => ({
        user_id: input.userId,
        session_id: input.sessionId,
        repo_full_name: input.repoFullName,
        event_type: input.eventType,
        icon: input.icon,
        summary: input.summary,
        details: input.details,
        related_file: input.relatedFile,
        metadata: input.metadata || {},
      })) as never[]
    )
    .select();

  if (error) {
    console.error('Error creating activity events:', error);
    return [];
  }

  return (data as ActivityEvent[]) || [];
}

export async function getActivityEvents(
  supabase: SupabaseClient<Database>,
  options: {
    sessionId?: string;
    repoFullName?: string;
    eventType?: ActivityEventType;
    limit?: number;
    offset?: number;
  }
): Promise<ActivityEvent[]> {
  let query = supabase
    .from('activity_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (options.sessionId) {
    query = query.eq('session_id', options.sessionId);
  }

  if (options.repoFullName) {
    query = query.eq('repo_full_name', options.repoFullName);
  }

  if (options.eventType) {
    query = query.eq('event_type', options.eventType);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching activity events:', error);
    return [];
  }

  return (data as ActivityEvent[]) || [];
}

export async function getActivityEventsBySession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  limit = 100
): Promise<ActivityEvent[]> {
  return getActivityEvents(supabase, { sessionId, limit });
}

export async function getActivityEventsByRepo(
  supabase: SupabaseClient<Database>,
  repoFullName: string,
  limit = 100
): Promise<ActivityEvent[]> {
  return getActivityEvents(supabase, { repoFullName, limit });
}

export async function deleteActivityEvent(
  supabase: SupabaseClient<Database>,
  eventId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('activity_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('Error deleting activity event:', error);
    return false;
  }

  return true;
}

export async function deleteActivityEventsBySession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('activity_events')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error deleting activity events by session:', error);
    return false;
  }

  return true;
}

export async function clearOldActivityEvents(
  supabase: SupabaseClient<Database>,
  olderThanDays = 30
): Promise<boolean> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { error } = await supabase
    .from('activity_events')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    console.error('Error clearing old activity events:', error);
    return false;
  }

  return true;
}
