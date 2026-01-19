import { NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

export async function GET() {
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  try {
    // Fetch user info first
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: userRes.status });
    }

    const userData = await userRes.json();

    // Fetch teams the user belongs to
    const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    let teams: { id: string; slug: string; name: string; avatar?: string }[] = [];

    if (teamsRes.ok) {
      const teamsData = await teamsRes.json();
      teams = teamsData.teams || [];
    }

    // Return personal account + teams
    const accounts = [
      {
        id: userData.user.id,
        slug: userData.user.username,
        name: userData.user.name || userData.user.username,
        avatar: userData.user.avatar,
        type: 'personal',
      },
      ...teams.map((team: { id: string; slug: string; name: string; avatar?: string }) => ({
        id: team.id,
        slug: team.slug,
        name: team.name,
        avatar: team.avatar,
        type: 'team',
      })),
    ];

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching Vercel teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
