import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Check if Supabase is configured
const USE_SUPABASE_AUTH = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request: NextRequest) {
  const result: {
    authenticated: boolean;
    authMethod?: 'supabase';
    user?: {
      id?: string;
      login: string;
      name: string;
      avatar: string;
    };
    vercel?: {
      connected: boolean;
      user?: {
        name: string;
        email: string;
        avatar?: string;
      };
    };
    supabase?: {
      connected: boolean;
      projectCount?: number;
    };
    repoIntegrations?: {
      [repoFullName: string]: {
        vercel?: { projectId: string; projectName: string };
        supabase?: { projectRef: string; projectName: string };
      };
    };
  } = {
    authenticated: false,
    vercel: { connected: false },
    supabase: { connected: false },
  };

  if (!USE_SUPABASE_AUTH) {
    return NextResponse.json({
      ...result,
      error: 'Supabase auth not configured',
    });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(result);
    }

    // Use GitHub username as id (matches our database schema)
    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username || user.email?.split('@')[0] || 'user';

    result.authenticated = true;
    result.authMethod = 'supabase';
    result.user = {
      id: githubUsername, // Use GitHub username, not Supabase UUID
      login: githubUsername,
      name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
      avatar: user.user_metadata?.avatar_url || '',
    };

    // Use service client for queries (RLS uses UUID but we use GitHub username)
    const serviceClient = createServiceClient();

    // Fetch repo integrations from database
    type RepoIntegrationRow = { repo_full_name: string; vercel_project_id: string | null; supabase_project_ref: string | null };
    const { data: repoIntegrations } = await serviceClient
      .from('repo_integrations')
      .select('repo_full_name, vercel_project_id, supabase_project_ref')
      .eq('user_id', githubUsername);

    if (repoIntegrations && repoIntegrations.length > 0) {
      result.repoIntegrations = {};
      for (const integration of repoIntegrations as RepoIntegrationRow[]) {
        result.repoIntegrations[integration.repo_full_name] = {};
        if (integration.vercel_project_id) {
          result.repoIntegrations[integration.repo_full_name].vercel = {
            projectId: integration.vercel_project_id,
            projectName: '', // Would need to fetch from Vercel API
          };
        }
        if (integration.supabase_project_ref) {
          result.repoIntegrations[integration.repo_full_name].supabase = {
            projectRef: integration.supabase_project_ref,
            projectName: '', // Would need to fetch from Supabase API
          };
        }
      }
    }

    // Check for integration connections from database
    type IntegrationRow = { provider: string; metadata: unknown };
    const { data: integrations } = await serviceClient
      .from('integration_connections')
      .select('provider, metadata')
      .eq('user_id', githubUsername);

    if (integrations) {
      const integrationsTyped = integrations as IntegrationRow[];

      const vercelIntegration = integrationsTyped.find(i => i.provider === 'vercel');
      if (vercelIntegration) {
        result.vercel = {
          connected: true,
          user: vercelIntegration.metadata as { name: string; email: string; avatar?: string },
        };
      }

      const supabaseIntegration = integrationsTyped.find(i => i.provider === 'supabase_pat');
      if (supabaseIntegration) {
        result.supabase = {
          connected: true,
          projectCount: (supabaseIntegration.metadata as { projectCount?: number })?.projectCount || 0,
        };
      }

      const githubIntegration = integrationsTyped.find(i => i.provider === 'github');
      if (githubIntegration) {
        // GitHub is connected if we have a token stored
        // The user info comes from Supabase Auth already
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Auth status check failed:', error);
    return NextResponse.json({
      ...result,
      error: 'Failed to check authentication status',
    });
  }
}
