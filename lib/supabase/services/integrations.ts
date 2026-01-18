import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, IntegrationConnection, RepoIntegration, Json } from '@/types/database';
import { encryptToken, decryptToken, isEncrypted } from '@/lib/encryption';

export type IntegrationProvider = 'github' | 'vercel' | 'supabase_pat';

export async function getIntegrationConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: IntegrationProvider
): Promise<IntegrationConnection | null> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching integration connection:', error);
    }
    return null;
  }

  return data as IntegrationConnection;
}

export async function listIntegrationConnections(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<IntegrationConnection[]> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error listing integration connections:', error);
    return [];
  }

  return (data as IntegrationConnection[]) || [];
}

export async function saveIntegrationConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: IntegrationProvider,
  accessToken: string,
  metadata: Record<string, unknown> = {},
  refreshToken?: string,
  expiresAt?: Date
): Promise<boolean> {
  // Encrypt the access token
  let encryptedToken: string | null = null;
  let encryptedRefreshToken: string | null = null;

  if (process.env.ENCRYPTION_KEY) {
    try {
      encryptedToken = encryptToken(accessToken);
      if (refreshToken) {
        encryptedRefreshToken = encryptToken(refreshToken);
      }
    } catch (err) {
      console.error('Token encryption error:', err);
      // Fall back to plain text if encryption fails (not recommended for production)
      encryptedToken = accessToken;
      encryptedRefreshToken = refreshToken || null;
    }
  } else {
    // No encryption key configured - store plain (development only)
    encryptedToken = accessToken;
    encryptedRefreshToken = refreshToken || null;
  }

  const { error } = await supabase.from('integration_connections').upsert(
    {
      user_id: userId,
      provider,
      access_token: encryptedToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: expiresAt?.toISOString(),
      metadata: metadata as Json,
      updated_at: new Date().toISOString(),
    } as never,
    {
      onConflict: 'user_id,provider',
    }
  );

  if (error) {
    console.error('Error saving integration connection:', error);
    return false;
  }

  return true;
}

export async function getDecryptedToken(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  const connection = await getIntegrationConnection(supabase, userId, provider);
  if (!connection || !connection.access_token) {
    return null;
  }

  // Decrypt if encrypted
  if (process.env.ENCRYPTION_KEY && isEncrypted(connection.access_token)) {
    try {
      return decryptToken(connection.access_token);
    } catch (err) {
      console.error('Token decryption error:', err);
      return null;
    }
  }

  // Return as-is if not encrypted (development mode)
  return connection.access_token;
}

export async function deleteIntegrationConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const { error } = await supabase
    .from('integration_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    console.error('Error deleting integration connection:', error);
    return false;
  }

  return true;
}

// Repo Integrations

export async function getRepoIntegration(
  supabase: SupabaseClient<Database>,
  userId: string,
  repoFullName: string
): Promise<RepoIntegration | null> {
  const { data, error } = await supabase
    .from('repo_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('repo_full_name', repoFullName)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching repo integration:', error);
    }
    return null;
  }

  return data as RepoIntegration;
}

export async function listRepoIntegrations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<RepoIntegration[]> {
  const { data, error } = await supabase
    .from('repo_integrations')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error listing repo integrations:', error);
    return [];
  }

  return (data as RepoIntegration[]) || [];
}

export async function saveRepoIntegration(
  supabase: SupabaseClient<Database>,
  userId: string,
  repoFullName: string,
  vercelProjectId?: string,
  supabaseProjectRef?: string
): Promise<boolean> {
  const { error } = await supabase.from('repo_integrations').upsert(
    {
      user_id: userId,
      repo_full_name: repoFullName,
      vercel_project_id: vercelProjectId,
      supabase_project_ref: supabaseProjectRef,
    } as never,
    {
      onConflict: 'user_id,repo_full_name',
    }
  );

  if (error) {
    console.error('Error saving repo integration:', error);
    return false;
  }

  return true;
}

export async function deleteRepoIntegration(
  supabase: SupabaseClient<Database>,
  userId: string,
  repoFullName: string
): Promise<boolean> {
  const { error } = await supabase
    .from('repo_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('repo_full_name', repoFullName);

  if (error) {
    console.error('Error deleting repo integration:', error);
    return false;
  }

  return true;
}
