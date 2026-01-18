import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Check if Supabase is configured
const USE_SUPABASE_AUTH = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getAppUrl(request: NextRequest): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  if (host && !host.includes('localhost')) {
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Sign out from Supabase if configured
  if (USE_SUPABASE_AUTH) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signout error:', error);
    }
  }

  // Clear legacy auth cookies
  response.cookies.delete('github_token');
  response.cookies.delete('github_user');

  return response;
}

export async function GET(request: NextRequest) {
  const APP_URL = getAppUrl(request);

  // Sign out from Supabase if configured
  if (USE_SUPABASE_AUTH) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signout error:', error);
    }
  }

  const response = NextResponse.redirect(`${APP_URL}/login`);

  // Clear legacy auth cookies
  response.cookies.delete('github_token');
  response.cookies.delete('github_user');

  return response;
}
