import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface TreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

function buildTree(items: TreeItem[]): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();

  // Sort items by path to ensure parent directories come before children
  const sortedItems = [...items].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sortedItems) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');

    const node: TreeNode = {
      name,
      path: item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
    };

    if (item.type === 'tree') {
      node.children = [];
    }

    pathMap.set(item.path, node);

    if (parentPath === '') {
      root.push(node);
    } else {
      const parent = pathMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  }

  // Sort each level: directories first, then files, both alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'dir' ? -1 : 1;
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
    return nodes;
  };

  return sortNodes(root);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref'); // branch/commit ref

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
  }

  try {
    // First, get the default branch if no ref provided
    let treeSha = ref;
    if (!treeSha) {
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!repoResponse.ok) {
        throw new Error(`Failed to fetch repo: ${repoResponse.status}`);
      }

      const repoData = await repoResponse.json();
      treeSha = repoData.default_branch;
    }

    // Fetch the full tree recursively
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!treeResponse.ok) {
      if (treeResponse.status === 401) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      if (treeResponse.status === 404) {
        return NextResponse.json({ error: 'Repository or branch not found' }, { status: 404 });
      }
      throw new Error(`GitHub API error: ${treeResponse.status}`);
    }

    const treeData = await treeResponse.json();

    // Build hierarchical tree structure
    const tree = buildTree(treeData.tree);

    return NextResponse.json({
      tree,
      sha: treeData.sha,
      truncated: treeData.truncated,
    });
  } catch (error) {
    console.error('Error fetching tree:', error);
    return NextResponse.json({ error: 'Failed to fetch file tree' }, { status: 500 });
  }
}
