import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createConversation } from '@/lib/conversations';

export async function POST() {
  const sessionId = uuidv4();
  createConversation(sessionId);
  return NextResponse.json({ sessionId });
}
