import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    return NextResponse.json({
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      userMetadata: user?.user_metadata,
      hasSession: !!session,
      hasProviderToken: !!session?.provider_token,
      providerTokenLength: session?.provider_token?.length,
      userError: userError?.message,
      sessionError: sessionError?.message,
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
        vercelUrl: process.env.VERCEL_URL,
      }
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
