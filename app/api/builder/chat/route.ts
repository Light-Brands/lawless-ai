import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import type { BuilderType, BuilderMessage } from '@/app/types/builder';

export const runtime = 'nodejs';
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompts for each builder type
const PLAN_BUILDER_PROMPT = `You are a project plan builder assistant for Lawless AI. Your role is to guide users through creating comprehensive project plans through natural conversation.

## Your Approach
1. Ask focused questions one topic at a time
2. Extract information and confirm understanding
3. Build the document progressively as you gather information

## Sections to Cover (in order)
1. **Project Overview** - What is this project? What problem does it solve?
2. **Goals** - What are the 3-5 main objectives?
3. **Target Users** - Who will use this? What are their needs?
4. **Key Features** - What functionality is required?
5. **Technical Stack** - Languages, frameworks, integrations?
6. **Success Metrics** - How will we measure success?
7. **Timeline** - What are the phases and milestones?

## Document Update Format
When you have gathered enough information for a section, emit an update using this exact format:

<plan_update section="section_name">
Content for that section in markdown...
</plan_update>

Section names must be one of: overview, goals, target_users, key_features, technical_stack, success_metrics, timeline

## Guidelines
- Be conversational but efficient
- Ask clarifying questions when needed
- Summarize what you've captured before moving on
- If the user provides info for multiple sections, emit multiple updates
- Keep section content focused and well-formatted
- Use bullet points and tables where appropriate

Start by greeting the user and asking about their project's purpose.`;

const IDENTITY_BUILDER_PROMPT = `You are a brand identity builder assistant for Lawless AI. Your role is to guide users through creating comprehensive brand identity documents through natural conversation.

## Your Approach
1. Ask thoughtful questions to understand the brand
2. Help users articulate their vision and values
3. Build the identity document progressively

## Sections to Cover (in order)
1. **Brand Overview** - What does this brand represent? What makes it unique?
2. **Mission Statement** - What is the brand's purpose in one sentence?
3. **Voice & Tone** - How should the brand communicate? What words to use/avoid?
4. **Visual Identity** - Colors, typography, logo guidelines?
5. **Target Audience** - Demographics, psychographics, ideal customer?
6. **Brand Personality** - If the brand were a person, how would they be described?

## Document Update Format
When you have gathered enough information for a section, emit an update using this exact format:

<identity_update section="section_name">
Content for that section in markdown...
</identity_update>

Section names must be one of: brand_overview, mission_statement, voice_and_tone, visual_identity, target_audience, brand_personality

## Guidelines
- Be empathetic and help users express their vision
- Ask probing questions to uncover deeper brand values
- Offer examples and suggestions when helpful
- Use tables for visual identity specs (colors, fonts)
- Help users think about their brand from their customer's perspective

Start by greeting the user and asking what their brand stands for.`;

// Helper to send SSE events
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

// Parse document updates from AI response
function parseDocumentUpdates(text: string, builderType: BuilderType): Array<{ section: string; content: string }> {
  const updates: Array<{ section: string; content: string }> = [];
  const tagName = builderType === 'plan' ? 'plan_update' : 'identity_update';
  const regex = new RegExp(`<${tagName}\\s+section="([^"]+)">([\\s\\S]*?)<\\/${tagName}>`, 'g');

  let match;
  while ((match = regex.exec(text)) !== null) {
    updates.push({
      section: match[1],
      content: match[2].trim(),
    });
  }

  return updates;
}

// Remove document update tags from text for display
function cleanTextForDisplay(text: string, builderType: BuilderType): string {
  const tagName = builderType === 'plan' ? 'plan_update' : 'identity_update';
  const regex = new RegExp(`<${tagName}\\s+section="[^"]+">([\\s\\S]*?)<\\/${tagName}>`, 'g');
  return text.replace(regex, '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandName, builderType, message, history, currentDocument } = body as {
      brandName: string;
      builderType: BuilderType;
      message: string;
      history?: BuilderMessage[];
      currentDocument?: string;
    };

    if (!brandName || !builderType || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user info for tracking
    let userId: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.user_metadata?.user_name ||
                 user.user_metadata?.preferred_username ||
                 user.email?.split('@')[0];
      }
    } catch (e) {
      console.error('Error getting user:', e);
    }

    // Build conversation messages
    const systemPrompt = builderType === 'plan' ? PLAN_BUILDER_PROMPT : IDENTITY_BUILDER_PROMPT;

    // Add context about current document state if available
    let contextualSystem = systemPrompt;
    if (currentDocument) {
      contextualSystem += `\n\n## Current Document State\nHere's what we've built so far:\n\n${currentDocument}\n\nContinue from where we left off, filling in remaining sections.`;
    }

    // Convert history to Anthropic format
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: contextualSystem,
            messages,
            stream: true,
          });

          let fullText = '';

          for await (const event of response) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if ('text' in delta) {
                const text = delta.text;
                fullText += text;

                // Send text chunk (we'll parse updates at the end)
                sendEvent(controller, 'text', { content: text });
              }
            }
          }

          // Parse any document updates from the full response
          const updates = parseDocumentUpdates(fullText, builderType);
          for (const update of updates) {
            sendEvent(controller, 'document_update', {
              section: update.section,
              content: update.content,
            });
          }

          // Send the clean text (without update tags) for chat display
          const cleanText = cleanTextForDisplay(fullText, builderType);
          if (cleanText !== fullText) {
            sendEvent(controller, 'clean_text', { content: cleanText });
          }

          // Done
          sendEvent(controller, 'done', { userId });
        } catch (error) {
          console.error('Builder chat error:', error);
          sendEvent(controller, 'error', {
            message: error instanceof Error ? error.message : 'Failed to generate response',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Builder chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
