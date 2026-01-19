import { createClient, createServiceClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';

export type IntegrationProvider = 'github' | 'vercel' | 'supabase_pat';

/**
 * Get the current user's GitHub username from their Supabase session
 */
export async function getGitHubUsername(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    return user.user_metadata?.user_name ||
           user.user_metadata?.preferred_username ||
           null;
  } catch {
    return null;
  }
}

/**
 * Get an integration token from the database
 * Returns the decrypted token if available, null otherwise
 */
export async function getIntegrationToken(
  provider: IntegrationProvider,
  githubUsername?: string
): Promise<string | null> {
  try {
    // Get username if not provided
    const username = githubUsername || await getGitHubUsername();
    if (!username) return null;

    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from('integration_connections')
      .select('access_token')
      .eq('user_id', username)
      .eq('provider', provider)
      .single();

    const tokenData = data as { access_token?: string } | null;
    if (error || !tokenData?.access_token) return null;

    // Decrypt the token
    try {
      return decryptToken(tokenData.access_token);
    } catch {
      // If decryption fails, the token might be stored unencrypted (legacy)
      return tokenData.access_token;
    }
  } catch {
    return null;
  }
}

/**
 * Get integration metadata from the database
 */
export async function getIntegrationMetadata(
  provider: IntegrationProvider,
  githubUsername?: string
): Promise<Record<string, unknown> | null> {
  try {
    const username = githubUsername || await getGitHubUsername();
    if (!username) return null;

    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from('integration_connections')
      .select('metadata')
      .eq('user_id', username)
      .eq('provider', provider)
      .single();

    const metadataData = data as { metadata?: Record<string, unknown> } | null;
    if (error || !metadataData?.metadata) return null;

    return metadataData.metadata;
  } catch {
    return null;
  }
}

/**
 * Check if an integration is connected
 */
export async function isIntegrationConnected(
  provider: IntegrationProvider,
  githubUsername?: string
): Promise<boolean> {
  const token = await getIntegrationToken(provider, githubUsername);
  return !!token;
}
