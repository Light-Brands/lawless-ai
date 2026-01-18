import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawless-ai.vercel.app';

// Check if Supabase is configured
const USE_SUPABASE_AUTH = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  // Sign out from Supabase if configured
  if (USE_SUPABASE_AUTH) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signout error:', error);
    }
  }

  const response = NextResponse.redirect(APP_URL);

  // Clear legacy auth cookies
  response.cookies.delete('github_token');
  response.cookies.delete('github_user');

  return response;
}
