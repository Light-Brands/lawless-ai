import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic();

interface AnalysisResult {
  summary: string;
  tagline?: string;
  description?: string;
  brandColors?: string[];
  brandFonts?: string[];
  targetAudience?: string;
  keyFeatures?: string[];
  tone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Fetch the website content
    let htmlContent: string;
    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LawlessAI/1.0; +https://lawless.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      htmlContent = await response.text();
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to fetch website: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    // Extract text content and metadata from HTML
    const textContent = extractTextContent(htmlContent);
    const metadata = extractMetadata(htmlContent);
    const colors = extractColors(htmlContent);

    // Use Claude to analyze the content
    const analysisPrompt = `Analyze this website content and extract brand/project information.

Website URL: ${url}
${metadata.title ? `Page Title: ${metadata.title}` : ''}
${metadata.description ? `Meta Description: ${metadata.description}` : ''}
${metadata.ogTitle ? `OG Title: ${metadata.ogTitle}` : ''}
${metadata.ogDescription ? `OG Description: ${metadata.ogDescription}` : ''}

Extracted Colors: ${colors.length > 0 ? colors.join(', ') : 'None found'}

Page Content:
${textContent.slice(0, 8000)}

Based on this content, provide a JSON analysis with these fields:
- summary: A 2-3 sentence overview of what this brand/company does
- tagline: Their main tagline or value proposition (if found)
- description: A longer description of their product/service
- targetAudience: Who their target audience appears to be
- keyFeatures: Array of key features or offerings (max 5)
- tone: The brand's communication tone (e.g., "Professional and trustworthy", "Fun and casual")

Respond with ONLY valid JSON, no markdown or explanation.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    let analysis: AnalysisResult;

    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // Fallback if JSON parsing fails
      analysis = {
        summary: responseText.slice(0, 500),
      };
    }

    // Add extracted colors
    if (colors.length > 0) {
      analysis.brandColors = colors.slice(0, 6);
    }

    return NextResponse.json({
      success: true,
      analysis,
      metadata,
    });
  } catch (error) {
    console.error('Website analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// Extract readable text from HTML
function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Remove HTML tags but keep content
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

// Extract metadata from HTML
function extractMetadata(html: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) metadata.title = titleMatch[1].trim();

  // Meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) metadata.description = descMatch[1];

  // OG title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1];

  // OG description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) metadata.ogDescription = ogDescMatch[1];

  return metadata;
}

// Extract colors from CSS
function extractColors(html: string): string[] {
  const colors = new Set<string>();

  // Match hex colors
  const hexMatches = html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
  for (const match of hexMatches) {
    const color = match[0].toLowerCase();
    // Skip common non-brand colors
    if (!['#fff', '#ffffff', '#000', '#000000', '#333', '#333333', '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc'].includes(color)) {
      colors.add(color);
    }
  }

  // Match rgb/rgba colors (simplified)
  const rgbMatches = html.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi);
  for (const match of rgbMatches) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // Skip grays
    if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20 || Math.abs(r - b) > 20) {
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      colors.add(hex);
    }
  }

  return Array.from(colors).slice(0, 10);
}
