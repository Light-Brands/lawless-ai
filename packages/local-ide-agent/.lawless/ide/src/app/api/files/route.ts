import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Security: Ensure we only access files within the project
function isPathSafe(filePath: string): boolean {
  const resolved = path.resolve(process.cwd(), filePath);
  const projectRoot = process.cwd();

  // Must be within project root
  if (!resolved.startsWith(projectRoot)) return false;

  // Block access to sensitive paths
  const blockedPaths = ['.env', 'node_modules', '.git'];
  for (const blocked of blockedPaths) {
    if (resolved.includes(blocked)) return false;
  }

  return true;
}

// GET - Read file contents
export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  if (!isPathSafe(filePath)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const stats = await fs.stat(fullPath);

    return NextResponse.json({
      path: filePath,
      content,
      size: stats.size,
      modified: stats.mtime,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

// PUT - Write file contents
export async function PUT(req: NextRequest) {
  try {
    const { path: filePath, content } = await req.json();

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: 'Path and content are required' },
        { status: 400 }
      );
    }

    if (!isPathSafe(filePath)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const fullPath = path.resolve(process.cwd(), filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    console.error('File write error:', error);
    return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
  }
}

// DELETE - Delete file
export async function DELETE(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  if (!isPathSafe(filePath)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    await fs.unlink(fullPath);

    return NextResponse.json({ success: true, path: filePath });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
