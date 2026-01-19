import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Project-level credentials are no longer supported
// Use PAT (Personal Access Token) authentication instead
export async function POST() {
  return NextResponse.json({
    error: 'Project-level credentials are no longer supported. Please use a Personal Access Token (PAT) to connect your Supabase account.',
    hint: 'Go to https://supabase.com/dashboard/account/tokens to generate a PAT.',
  }, { status: 400 });
}
