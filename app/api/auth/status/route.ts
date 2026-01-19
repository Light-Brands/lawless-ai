import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { decryptToken, isEncrypted } from '@/lib/encryption';

export const runtime = 'nodejs';

// Check if Supabase is configured
const USE_SUPABASE_AUTH = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request: NextRequest) {
  // Legacy cookie-based tokens
  const legacyGithubToken = request.cookies.get('github_token')?.value;
  const vercelToken = request.cookies.get('vercel_token')?.value;
  const supabaseToken = request.cookies.get('supabase_token')?.value;
  const supabaseProjects = request.cookies.get('supabase_projects')?.value;
  const repoIntegrationsCookie = request.cookies.get('repo_integrations')?.value;

  const result: {
    authenticated: boolean;
    authMethod?: 'supabase' | 'legacy';
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

  // Parse repo integrations from cookie (for backward compatibility)
  if (repoIntegrationsCookie) {
    try {
      result.repoIntegrations = JSON.parse(repoIntegrationsCookie);
    } catch (error) {
      console.error('Repo integrations parse failed:', error);
    }
  }

  // Try Supabase Auth first if configured
  if (USE_SUPABASE_AUTH) {
    try {
      const supabase = await createClient();

      // Debug: Log available cookies
      const allCookies = request.cookies.getAll();
      console.log('Auth status - Available cookies:', allCookies.map(c => c.name));

      const { data: { user }, error } = await supabase.auth.getUser();

      console.log('Auth status - getUser result:', {
        hasUser: !!user,
        userId: user?.id,
        error: error?.message
      });

      if (user) {
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

        // Check for integration connections
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
        }

        return NextResponse.json(result);
      }
    } catch (error) {
      console.error('Supabase auth check failed:', error);
      // Fall through to legacy auth check
    }
  }

  // Legacy: Check GitHub token cookie
  if (legacyGithubToken) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${legacyGithubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        result.authenticated = true;
        result.authMethod = 'legacy';
        result.user = {
          login: userData.login,
          name: userData.name,
          avatar: userData.avatar_url,
        };
      }
    } catch (error) {
      console.error('GitHub auth check failed:', error);
    }
  }

  // Check Vercel auth
  if (vercelToken) {
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        result.vercel = {
          connected: true,
          user: {
            name: userData.user.name || userData.user.username,
            email: userData.user.email,
            avatar: userData.user.avatar,
          },
        };
      }
    } catch (error) {
      console.error('Vercel auth check failed:', error);
    }
  }

  // Check Supabase auth
  if (supabaseToken) {
    try {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        headers: {
          'Authorization': `Bearer ${supabaseToken}`,
        },
      });

      if (response.ok) {
        const projects = await response.json();
        result.supabase = {
          connected: true,
          projectCount: Array.isArray(projects) ? projects.length : 0,
        };
      }
    } catch (error) {
      console.error('Supabase auth check failed:', error);
    }
  } else if (supabaseProjects) {
    // Using project-level credentials instead of PAT
    try {
      const projects = JSON.parse(supabaseProjects);
      result.supabase = {
        connected: true,
        projectCount: Array.isArray(projects) ? projects.length : 0,
      };
    } catch (error) {
      console.error('Supabase projects parse failed:', error);
    }
  }

  return NextResponse.json(result);
}
