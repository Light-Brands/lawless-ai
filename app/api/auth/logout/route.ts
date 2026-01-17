import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawless-ai.vercel.app';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear auth cookies
  response.cookies.delete('github_token');
  response.cookies.delete('github_user');

  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(APP_URL);

  // Clear auth cookies
  response.cookies.delete('github_token');
  response.cookies.delete('github_user');

  return response;
}
