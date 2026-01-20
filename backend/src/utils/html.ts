// Helper functions for HTML parsing

export function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function extractMetadataFromHtml(html: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) metadata.title = titleMatch[1].trim();
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) metadata.description = descMatch[1];
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1];
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) metadata.ogDescription = ogDescMatch[1];
  return metadata;
}

export function extractColorsFromHtml(html: string): string[] {
  const colors = new Set<string>();
  const hexMatches = html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
  for (const match of hexMatches) {
    const color = match[0].toLowerCase();
    if (!['#fff', '#ffffff', '#000', '#000000', '#333', '#333333', '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc'].includes(color)) {
      colors.add(color);
    }
  }
  const rgbMatches = html.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi);
  for (const match of rgbMatches) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20 || Math.abs(r - b) > 20) {
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      colors.add(hex);
    }
  }
  return Array.from(colors).slice(0, 10);
}

// Helper function for scraping websites (used by chat tool loop)
export async function scrapeWebsiteForChat(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, error: 'Invalid URL protocol' };
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://jnxfynvgkguaghhorsov.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

    const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/scrape-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ url: parsedUrl.toString() }),
      signal: AbortSignal.timeout(60000),
    });

    const scrapeData = await scrapeResponse.json() as {
      success: boolean;
      content?: string;
      metadata?: Record<string, string>;
      colors?: string[];
      error?: string;
    };

    if (!scrapeResponse.ok || !scrapeData.success) {
      return { success: false, error: scrapeData.error || 'Scraping failed' };
    }

    // Format the scraped content for Claude
    const { content, metadata, colors } = scrapeData;
    let formattedContent = `## Website Content from ${url}\n\n`;
    if (metadata?.title) formattedContent += `**Title:** ${metadata.title}\n`;
    if (metadata?.description) formattedContent += `**Description:** ${metadata.description}\n`;
    if (colors && colors.length > 0) formattedContent += `**Brand Colors:** ${colors.join(', ')}\n`;
    formattedContent += `\n### Page Content:\n${content?.slice(0, 10000) || 'No content extracted'}`;

    return { success: true, content: formattedContent };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
