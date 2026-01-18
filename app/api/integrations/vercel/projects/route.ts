import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('vercel_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.vercel.com/v9/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch projects' },
        { status: response.status }
      );
    }

    const data = await response.json();

    const projects = data.projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      framework: project.framework,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      latestDeployment: project.latestDeployments?.[0] ? {
        id: project.latestDeployments[0].id,
        url: project.latestDeployments[0].url,
        state: project.latestDeployments[0].state,
        createdAt: project.latestDeployments[0].createdAt,
      } : null,
      targets: project.targets,
      link: project.link ? {
        type: project.link.type,
        repo: project.link.repo,
        repoId: project.link.repoId,
        org: project.link.org,
      } : null,
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Vercel projects fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// Create a new Vercel project and optionally link to GitHub
export async function POST(request: NextRequest) {
  const token = request.cookies.get('vercel_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, framework, gitRepository, environmentVariables } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Build project creation payload
    const projectPayload: Record<string, unknown> = {
      name,
      framework: framework || 'nextjs',
    };

    // Link to GitHub repo if provided
    if (gitRepository) {
      projectPayload.gitRepository = {
        type: 'github',
        repo: gitRepository.repo, // format: "owner/repo"
      };
    }

    // Create the project
    const createResponse = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectPayload),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to create project' },
        { status: createResponse.status }
      );
    }

    const project = await createResponse.json();

    // Add environment variables if provided
    if (environmentVariables && environmentVariables.length > 0) {
      for (const envVar of environmentVariables) {
        await fetch(`https://api.vercel.com/v10/projects/${project.id}/env`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: envVar.key,
            value: envVar.value,
            type: envVar.type || 'encrypted',
            target: envVar.target || ['production', 'preview', 'development'],
          }),
        });
      }
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        framework: project.framework,
        link: project.link,
      },
    });
  } catch (error) {
    console.error('Vercel project creation error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
