import { NextRequest, NextResponse } from 'next/server';
import { clearConversation } from '@/lib/conversations';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  clearConversation(params.sessionId);
  return NextResponse.json({ success: true });
}
