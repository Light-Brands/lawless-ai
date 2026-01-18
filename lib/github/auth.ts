import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';

/**
 * Get GitHub token from Supabase session or legacy cookie
 */
export async function getGitHubToken(request: NextRequest): Promise<string | null> {
  // First try Supabase session
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Get encrypted token from integration_connections
      const { data: connection } = await supabase
        .from('integration_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('provider', 'github')
        .single() as { data: { access_token: string } | null };

      if (connection?.access_token && process.env.ENCRYPTION_KEY) {
        try {
          return decryptToken(connection.access_token);
        } catch (e) {
          console.error('Failed to decrypt token:', e);
        }
      }

      // Fallback: try to get provider token from session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        return session.provider_token;
      }
    }
  } catch (e) {
    console.error('Supabase auth error:', e);
  }

  // Fallback to legacy cookie
  return request.cookies.get('github_token')?.value || null;
}
