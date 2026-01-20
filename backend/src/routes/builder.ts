import { Router, Request, Response } from 'express';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { authenticateApiKey } from '../middleware/auth';
import { PLAN_BUILDER_PROMPT, IDENTITY_BUILDER_PROMPT } from '../prompts/builder';
import { scrapeWebsiteForChat } from '../utils/html';

const router = Router();

// Website analysis endpoint - uses Supabase edge function with Firecrawl for JS-rendered sites
router.post('/api/builder/analyze-website', authenticateApiKey, async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  try {
    // Call Supabase edge function to scrape the website (handles JS rendering)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://jnxfynvgkguaghhorsov.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

    const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ url: parsedUrl.toString() }),
      signal: AbortSignal.timeout(60000), // 60s timeout for scraping
    });

    const scrapeData = await scrapeResponse.json() as {
      success: boolean;
      content?: string;
      metadata?: Record<string, string>;
      colors?: string[];
      error?: string;
    };

    if (!scrapeResponse.ok || !scrapeData.success) {
      throw new Error(scrapeData.error || `Scraping failed: ${scrapeResponse.status}`);
    }

    const { content, metadata, colors } = scrapeData;

    // Build prompt for Claude with the scraped content
    const analysisPrompt = `Analyze this website content and extract brand/project information.

Website URL: ${url}
${metadata?.title ? `Page Title: ${metadata.title}` : ''}
${metadata?.description ? `Meta Description: ${metadata.description}` : ''}
${metadata?.ogTitle ? `OG Title: ${metadata.ogTitle}` : ''}
${metadata?.ogDescription ? `OG Description: ${metadata.ogDescription}` : ''}

Extracted Colors: ${colors && colors.length > 0 ? colors.join(', ') : 'None found'}

Page Content (Markdown):
${content?.slice(0, 12000) || 'No content extracted'}

Based on this content, provide a JSON analysis with these fields:
- summary: A 2-3 sentence overview of what this brand/company does
- tagline: Their main tagline or value proposition (if found)
- description: A longer description of their product/service
- targetAudience: Who their target audience appears to be
- keyFeatures: Array of key features or offerings (max 5)
- tone: The brand's communication tone (e.g., "Professional and trustworthy", "Fun and casual")

Respond with ONLY valid JSON, no markdown or explanation.`;

    // Spawn Claude CLI
    const spawnEnv = {
      ...process.env,
      NO_COLOR: '1',
      HOME: '/home/ubuntu',
      PATH: '/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin'
    };

    const claude: ChildProcessWithoutNullStreams = spawn('claude', [
      '--print',
      '--output-format', 'text'
    ], {
      env: spawnEnv,
      cwd: '/home/ubuntu'
    });

    claude.stdin.write(analysisPrompt);
    claude.stdin.end();

    let responseContent = '';

    claude.stdout.on('data', (chunk: Buffer) => {
      responseContent += chunk.toString();
    });

    claude.stderr.on('data', (data: Buffer) => {
      console.error('Claude stderr:', data.toString());
    });

    claude.on('close', (code: number | null) => {
      if (code !== 0) {
        res.status(500).json({ error: 'Analysis failed' });
        return;
      }

      // Parse Claude's response
      let analysis: Record<string, unknown>;
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = { summary: responseContent.slice(0, 500) };
        }
      } catch {
        analysis = { summary: responseContent.slice(0, 500) };
      }

      // Add extracted colors from scraping
      if (colors && colors.length > 0) {
        analysis.brandColors = colors.slice(0, 6);
      }

      res.json({
        success: true,
        analysis,
        metadata: metadata || {},
      });
    });

    claude.on('error', (err: Error) => {
      console.error('Failed to spawn Claude:', err);
      res.status(500).json({ error: 'Failed to start analysis' });
    });

  } catch (error) {
    console.error('Website analysis error:', error);
    res.status(400).json({
      error: `Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

router.post('/api/builder/chat', authenticateApiKey, async (req: Request, res: Response) => {
  const { message, brandName, builderType, history, userId, currentDocument, brandContext } = req.body;

  if (!message || !brandName || !builderType) {
    res.status(400).json({ error: 'Message, brandName, and builderType are required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  res.flushHeaders();

  // Select system prompt based on builder type
  const systemPrompt = builderType === 'plan' ? PLAN_BUILDER_PROMPT : IDENTITY_BUILDER_PROMPT;

  // Build conversation history
  let conversationHistory = '';
  if (history && Array.isArray(history) && history.length > 0) {
    conversationHistory = history.map((msg: { role: string; content: string }) => {
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      return `${prefix}: ${msg.content}`;
    }).join('\n\n');
  }

  // Build context section
  let contextSection = '';
  if (brandContext) {
    const contextParts = [];
    if (brandContext.websiteSummary) contextParts.push(`Website Analysis: ${brandContext.websiteSummary}`);
    if (brandContext.tagline) contextParts.push(`Tagline: ${brandContext.tagline}`);
    if (brandContext.description) contextParts.push(`Description: ${brandContext.description}`);
    if (brandContext.brandColors?.length) contextParts.push(`Brand Colors: ${brandContext.brandColors.join(', ')}`);
    if (brandContext.additionalNotes) contextParts.push(`Additional Notes: ${brandContext.additionalNotes}`);
    if (contextParts.length > 0) {
      contextSection = `\n\n## Brand Context\n${contextParts.join('\n')}`;
    }
  }

  // Build current document section
  let documentSection = '';
  if (currentDocument) {
    documentSection = `\n\n## Current Document\nThe user has the following document open. When they ask for changes, update the ENTIRE document using <document_replace> tags:\n\n\`\`\`markdown\n${currentDocument}\n\`\`\``;
  }

  const spawnEnv = {
    ...process.env,
    NO_COLOR: '1',
    HOME: '/home/ubuntu',
    PATH: '/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin'
  };

  // Helper to run Claude and collect response
  const runClaude = (prompt: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const claude: ChildProcessWithoutNullStreams = spawn('claude', [
        '--print',
        '--output-format', 'stream-json',
        '--verbose'
      ], {
        env: spawnEnv,
        cwd: '/home/ubuntu'
      });

      claude.stdin.write(prompt);
      claude.stdin.end();

      let responseContent = '';
      let buffer = '';

      claude.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === 'assistant' && data.message?.content) {
              for (const content of data.message.content) {
                if (content.type === 'text' && content.text) {
                  if (content.text.startsWith(responseContent) && responseContent.length > 0) {
                    const newContent = content.text.slice(responseContent.length);
                    if (newContent) {
                      responseContent = content.text;
                      res.write(`data: ${JSON.stringify({ type: 'chunk', content: newContent })}\n\n`);
                    }
                  } else if (!responseContent.includes(content.text)) {
                    responseContent += content.text;
                    res.write(`data: ${JSON.stringify({ type: 'chunk', content: content.text })}\n\n`);
                  }
                }
              }
            }

            if (data.type === 'result' && data.result) {
              if (!responseContent) {
                responseContent = data.result;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: data.result })}\n\n`);
              }
            }

            if (data.type === 'error' || data.is_error) {
              res.write(`data: ${JSON.stringify({ type: 'error', message: data.message || data.error || 'Unknown error' })}\n\n`);
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      });

      claude.stderr.on('data', (data: Buffer) => {
        console.error('[Builder Chat] stderr:', data.toString());
      });

      claude.on('close', () => resolve(responseContent));
      claude.on('error', reject);
    });
  };

  // Build initial prompt
  let fullPrompt = conversationHistory
    ? `${systemPrompt}\n\nBrand: ${brandName}${contextSection}${documentSection}\n\nPrevious conversation:\n${conversationHistory}\n\nUser: ${message}`
    : `${systemPrompt}\n\nBrand: ${brandName}${contextSection}${documentSection}\n\nUser: ${message}`;

  try {
    let responseContent = '';
    let toolResults = '';
    const maxToolIterations = 3; // Prevent infinite loops

    for (let i = 0; i < maxToolIterations; i++) {
      // Run Claude with current prompt (including any tool results from previous iteration)
      const promptWithTools = toolResults
        ? `${fullPrompt}\n\nAssistant: ${responseContent}\n\n[Tool Results]\n${toolResults}\n\nContinue your response to the user, incorporating the website information you just received:`
        : fullPrompt;

      responseContent = await runClaude(promptWithTools);

      // Check for scrape_website tool calls
      const scrapeMatch = responseContent.match(/<scrape_website\s+url="([^"]+)"\s*\/>/);

      if (scrapeMatch) {
        const urlToScrape = scrapeMatch[1];
        console.log(`[Builder Chat] Scraping website: ${urlToScrape}`);

        // Notify frontend that we're fetching
        res.write(`data: ${JSON.stringify({ type: 'status', message: `Fetching ${urlToScrape}...` })}\n\n`);

        // Execute the scrape
        const scrapeResult = await scrapeWebsiteForChat(urlToScrape);

        if (scrapeResult.success) {
          toolResults = scrapeResult.content || '';
          // Strip the tool tag from response before continuing
          responseContent = responseContent.replace(/<scrape_website\s+url="[^"]+"\s*\/>/, '[Fetching website...]');
        } else {
          toolResults = `Error fetching website: ${scrapeResult.error}`;
        }

        // Continue loop to re-run Claude with tool results
        continue;
      }

      // No more tool calls, break out of loop
      break;
    }

    // Parse document updates from final response
    const tagName = builderType === 'plan' ? 'plan_update' : 'identity_update';
    const regex = new RegExp(`<${tagName}\\s+section="([^"]+)">([\\s\\S]*?)<\\/${tagName}>`, 'g');

    let match;
    while ((match = regex.exec(responseContent)) !== null) {
      res.write(`data: ${JSON.stringify({
        type: 'tool_use',
        id: `doc_${match[1]}_${Date.now()}`,
        tool: 'document_update',
        input: { section: match[1], content: match[2].trim() }
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', content: responseContent.trim() })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Failed to spawn Claude for builder:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to start Claude CLI' })}\n\n`);
    res.end();
  }
});

export default router;
