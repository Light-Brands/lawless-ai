import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET: Fetch user preferences
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from('users')
      .select('last_conversation_id, last_root_conversation_id, preferences')
      .eq('id', githubUsername)
      .single();

    if (error) {
      console.error('Error fetching user preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    return NextResponse.json({
      lastConversationId: data?.last_conversation_id,
      lastRootConversationId: data?.last_root_conversation_id,
      preferences: data?.preferences || {},
    });
  } catch (error) {
    console.error('Error in GET /api/user/preferences:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH: Update user preferences
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    const body = await request.json();
    const { lastConversationId, lastRootConversationId, preferences } = body;

    const serviceClient = createServiceClient();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (lastConversationId !== undefined) {
      updates.last_conversation_id = lastConversationId;
    }
    if (lastRootConversationId !== undefined) {
      updates.last_root_conversation_id = lastRootConversationId;
    }
    if (preferences !== undefined) {
      // Merge with existing preferences
      const { data: existing } = await serviceClient
        .from('users')
        .select('preferences')
        .eq('id', githubUsername)
        .single();

      updates.preferences = {
        ...(existing?.preferences || {}),
        ...preferences,
      };
    }

    const { error } = await serviceClient
      .from('users')
      .update(updates as never)
      .eq('id', githubUsername);

    if (error) {
      console.error('Error updating user preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/user/preferences:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
