import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createActivityEvent,
  createActivityEvents,
  getActivityEvents,
  deleteActivityEventsBySession,
} from '@/lib/supabase/services/activity-events';
import type { ActivityEventType } from '@/types/database';

// GET - Retrieve activity events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const repoFullName = searchParams.get('repoFullName');
    const eventType = searchParams.get('eventType') as ActivityEventType | null;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = createServiceClient();

    const events = await getActivityEvents(supabase, {
      sessionId: sessionId || undefined,
      repoFullName: repoFullName || undefined,
      eventType: eventType || undefined,
      limit,
      offset,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error getting activity events:', error);
    return NextResponse.json({ error: 'Failed to get activity events' }, { status: 500 });
  }
}

// POST - Create activity event(s)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both single event and batch events
    const { event, events: batchEvents } = body;

    const supabase = createServiceClient();

    if (batchEvents && Array.isArray(batchEvents)) {
      // Batch creation
      const created = await createActivityEvents(supabase, batchEvents);
      return NextResponse.json({ events: created, count: created.length });
    }

    if (event) {
      // Single event creation
      const { eventType, icon, summary, details, relatedFile, sessionId, repoFullName, metadata } = event;

      if (!eventType || !icon || !summary) {
        return NextResponse.json(
          { error: 'eventType, icon, and summary are required' },
          { status: 400 }
        );
      }

      const created = await createActivityEvent(supabase, {
        eventType,
        icon,
        summary,
        details,
        relatedFile,
        sessionId,
        repoFullName,
        metadata,
      });

      if (!created) {
        return NextResponse.json({ error: 'Failed to create activity event' }, { status: 500 });
      }

      return NextResponse.json({ event: created });
    }

    return NextResponse.json({ error: 'No event or events provided' }, { status: 400 });
  } catch (error) {
    console.error('Error creating activity event:', error);
    return NextResponse.json({ error: 'Failed to create activity event' }, { status: 500 });
  }
}

// DELETE - Clear activity events for a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const success = await deleteActivityEventsBySession(supabase, sessionId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete activity events' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity events:', error);
    return NextResponse.json({ error: 'Failed to delete activity events' }, { status: 500 });
  }
}
