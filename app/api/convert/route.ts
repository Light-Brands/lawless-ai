import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const extension = filename.slice(filename.lastIndexOf('.'));

    // Only support markdown files for now
    if (extension !== '.md') {
      return NextResponse.json(
        { error: 'Only .md (Markdown) files are supported. Please convert your document to markdown first.' },
        { status: 400 }
      );
    }

    // Get file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const markdown = buffer.toString('utf-8');

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}
