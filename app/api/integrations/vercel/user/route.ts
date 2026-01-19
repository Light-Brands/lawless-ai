import { NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

export async function GET() {
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      user: {
        id: data.user.id,
        name: data.user.name || data.user.username,
        email: data.user.email,
        avatar: data.user.avatar,
        username: data.user.username,
      },
    });
  } catch (error) {
    console.error('Vercel user fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
