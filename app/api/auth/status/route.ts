import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const githubToken = request.cookies.get('github_token')?.value;
  const vercelToken = request.cookies.get('vercel_token')?.value;
  const supabaseToken = request.cookies.get('supabase_token')?.value;
  const supabaseProjects = request.cookies.get('supabase_projects')?.value;

  const result: {
    authenticated: boolean;
    user?: {
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
  } = {
    authenticated: false,
    vercel: { connected: false },
    supabase: { connected: false },
  };

  // Check GitHub auth
  if (githubToken) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        result.authenticated = true;
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
