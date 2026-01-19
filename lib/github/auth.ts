import { createClient, createServiceClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';

/**
 * Get GitHub token from database
 */
export async function getGitHubToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Get GitHub username (matches our database schema)
    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return null;
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    // Get encrypted token from integration_connections
    const { data: connection } = await serviceClient
      .from('integration_connections')
      .select('access_token')
      .eq('user_id', githubUsername)
      .eq('provider', 'github')
      .single();

    const typedConnection = connection as { access_token: string } | null;

    if (typedConnection?.access_token && process.env.ENCRYPTION_KEY) {
      try {
        return decryptToken(typedConnection.access_token);
      } catch (e) {
        console.error('Failed to decrypt token:', e);
      }
    }

    // Fallback: try to get provider token from session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) {
      return session.provider_token;
    }

    return null;
  } catch (e) {
    console.error('GitHub auth error:', e);
    return null;
  }
}
