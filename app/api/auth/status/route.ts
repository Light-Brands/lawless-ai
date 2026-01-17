import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;
  const username = request.cookies.get('github_user')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  // Verify token is still valid
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ authenticated: false });
    }

    const userData = await response.json();

    return NextResponse.json({
      authenticated: true,
      user: {
        login: userData.login,
        name: userData.name,
        avatar: userData.avatar_url,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}
