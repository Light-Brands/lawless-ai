import { NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

export async function GET() {
  const token = await getIntegrationToken('supabase_pat');

  if (!token) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
  }

  try {
    // Fetch organizations
    const orgsRes = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!orgsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: orgsRes.status });
    }

    const orgs = await orgsRes.json();

    const organizations = orgs.map((org: { id: string; name: string }) => ({
      id: org.id,
      name: org.name,
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Error fetching Supabase orgs:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
