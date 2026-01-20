import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { conversationService } from '../services/conversationService';
import { isSupabaseAvailable } from '../lib/supabase';

const router = Router();

// ============================================
// Supabase-backed Conversation API Endpoints
// ============================================

// List conversations for a user (Supabase)
router.get('/api/conversations', authenticateApiKey, async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const type = req.query.type as string;
  const repoFullName = req.query.repo as string;
  const workspaceSessionId = req.query.workspaceSessionId as string;
  const includeArchived = req.query.includeArchived === 'true';
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const conversations = await conversationService.list({
      userId,
      type: type as 'root' | 'workspace' | 'direct' | undefined,
      repoFullName,
      workspaceSessionId,
      includeArchived,
      limit,
    });

    res.json({ conversations });
  } catch (error: any) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: `Failed to list conversations: ${error.message}` });
  }
});

// Get a specific conversation (Supabase)
router.get('/api/conversations/:conversationId', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const conversation = await conversationService.get(conversationId);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ conversation });
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: `Failed to get conversation: ${error.message}` });
  }
});

// Create a new conversation (Supabase)
router.post('/api/conversations', authenticateApiKey, async (req: Request, res: Response) => {
  const { userId, type, workspaceSessionId, repoFullName, title, metadata } = req.body;

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const conversation = await conversationService.create({
      userId,
      type: type || 'root',
      workspaceSessionId,
      repoFullName,
      title,
      metadata,
    });

    if (!conversation) {
      res.status(500).json({ error: 'Failed to create conversation' });
      return;
    }

    res.json({ conversation });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: `Failed to create conversation: ${error.message}` });
  }
});

// Update conversation title (Supabase)
router.patch('/api/conversations/:conversationId', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { title } = req.body;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const success = await conversationService.updateTitle(conversationId, title);

    if (!success) {
      res.status(500).json({ error: 'Failed to update conversation' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: `Failed to update conversation: ${error.message}` });
  }
});

// Archive a conversation (Supabase)
router.post('/api/conversations/:conversationId/archive', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const success = await conversationService.archive(conversationId);

    if (!success) {
      res.status(500).json({ error: 'Failed to archive conversation' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error archiving conversation:', error);
    res.status(500).json({ error: `Failed to archive conversation: ${error.message}` });
  }
});

// Delete a conversation (Supabase)
router.delete('/api/conversations/:conversationId', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const success = await conversationService.delete(conversationId);

    if (!success) {
      res.status(500).json({ error: 'Failed to delete conversation' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: `Failed to delete conversation: ${error.message}` });
  }
});

export default router;
