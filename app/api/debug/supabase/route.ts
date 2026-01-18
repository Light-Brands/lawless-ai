import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Only allow in development or with PIN verified
  const pinVerified = request.cookies.get('pin_verified')?.value === 'true';
  if (!pinVerified) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ENCRYPTION_KEY_SET: !!process.env.ENCRYPTION_KEY,
      ENCRYPTION_KEY_LENGTH: process.env.ENCRYPTION_KEY?.length || 0,
    },
  };

  try {
    const supabase = createServiceClient();

    // Test 1: Check if we can query users table
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    results.usersTableTest = {
      success: !usersError,
      error: usersError?.message || null,
      rowCount: usersData?.length || 0,
    };

    // Test 2: Check if we can query integration_connections table
    const { data: intData, error: intError } = await supabase
      .from('integration_connections')
      .select('id')
      .limit(1);

    results.integrationConnectionsTableTest = {
      success: !intError,
      error: intError?.message || null,
      rowCount: intData?.length || 0,
    };

    // Test 3: Try to insert a test row (then delete it)
    const testId = '00000000-0000-0000-0000-000000000000';
    const { error: insertError } = await supabase
      .from('users')
      .upsert({
        id: testId,
        github_username: '_test_user_',
        display_name: 'Test User',
        updated_at: new Date().toISOString(),
      } as never, { onConflict: 'id' });

    const insertTestResult = {
      success: !insertError,
      error: insertError?.message || null,
      code: insertError?.code || null,
      cleaned: false,
    };

    // Clean up test row
    if (!insertError) {
      await supabase.from('users').delete().eq('id', testId);
      insertTestResult.cleaned = true;
    }

    results.insertTest = insertTestResult;

  } catch (err) {
    results.error = err instanceof Error ? err.message : 'Unknown error';
  }

  return NextResponse.json(results, { status: 200 });
}
