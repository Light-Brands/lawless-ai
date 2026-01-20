import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Proxies Vercel deployment previews and strips X-Frame-Options header
 * to allow embedding in iframes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const path = searchParams.get('path') || '/';

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  // Validate it's a Vercel URL
  if (!url.includes('.vercel.app')) {
    return NextResponse.json({ error: 'Only Vercel URLs are supported' }, { status: 400 });
  }

  try {
    // Ensure URL has protocol
    const targetUrl = url.startsWith('https://') ? url : `https://${url}`;
    const fullUrl = `${targetUrl}${path}`;

    const response = await fetch(fullUrl, {
      headers: {
        'Accept': request.headers.get('accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': request.headers.get('accept-language') || 'en-US,en;q=0.9',
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 LawlessAI-Preview',
      },
    });

    // Get the response body
    const contentType = response.headers.get('content-type') || 'text/html';

    // Create response headers, excluding X-Frame-Options and CSP frame-ancestors
    const headers = new Headers();
    headers.set('Content-Type', contentType);

    // Copy safe headers
    const safeHeaders = ['cache-control', 'etag', 'last-modified', 'content-encoding'];
    safeHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });

    // Handle different content types
    if (contentType.includes('text/html')) {
      let html = await response.text();

      // Rewrite relative URLs to go through our proxy
      const baseUrl = targetUrl;
      html = rewriteUrls(html, baseUrl, url);

      return new NextResponse(html, {
        status: response.status,
        headers,
      });
    } else {
      // For non-HTML content (CSS, JS, images), pass through
      const body = await response.arrayBuffer();
      return new NextResponse(body, {
        status: response.status,
        headers,
      });
    }
  } catch (error: any) {
    console.error('[Vercel Preview Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment: ' + error.message },
      { status: 502 }
    );
  }
}

/**
 * Rewrites URLs in HTML to go through our proxy
 */
function rewriteUrls(html: string, baseUrl: string, originalUrl: string): string {
  const proxyBase = `/api/preview/vercel?url=${encodeURIComponent(originalUrl)}&path=`;

  // Rewrite absolute URLs starting with /
  html = html.replace(/(href|src|action)="\/([^"]*?)"/g, (match, attr, path) => {
    // Don't rewrite data: URLs or external URLs
    if (path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:') || path.startsWith('//')) {
      return match;
    }
    return `${attr}="${proxyBase}${encodeURIComponent('/' + path)}"`;
  });

  // Rewrite single-quoted attributes
  html = html.replace(/(href|src|action)='\/([^']*?)'/g, (match, attr, path) => {
    if (path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:') || path.startsWith('//')) {
      return match;
    }
    return `${attr}='${proxyBase}${encodeURIComponent('/' + path)}'`;
  });

  // Add base tag for relative URLs that don't start with /
  // This helps with URLs like "image.png" instead of "/image.png"
  if (!html.includes('<base')) {
    html = html.replace('<head>', `<head><base href="${baseUrl}/">`);
  }

  return html;
}
