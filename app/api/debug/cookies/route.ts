import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const cookieNames = allCookies.map(c => c.name);

  const githubUser = request.cookies.get('github_user')?.value;
  const githubToken = request.cookies.get('github_token')?.value;

  return NextResponse.json({
    cookieCount: allCookies.length,
    cookieNames,
    github_user: githubUser || 'NOT SET',
    github_token: githubToken ? 'SET (hidden)' : 'NOT SET',
  });
}
