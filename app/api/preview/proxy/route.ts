import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Proxies requests to the remote dev server running on the backend.
 * This allows the local browser to view the localhost of the remote worktree.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const port = searchParams.get('port') || '3000';
  const path = searchParams.get('path') || '/';

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const apiKey = process.env.BACKEND_API_KEY;

  try {
    // Proxy to backend's preview endpoint
    const targetUrl = `${backendUrl}/api/preview/proxy?sessionId=${sessionId}&port=${port}&path=${encodeURIComponent(path)}`;

    const response = await fetch(targetUrl, {
      headers: {
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
    });

    if (!response.ok) {
      // If backend returns error, try to get error message
      const errorText = await response.text();
      console.error('[Preview Proxy] Backend error:', response.status, errorText);
      return new NextResponse(errorText, { status: response.status });
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'text/html';

    // Stream the response body
    const body = await response.arrayBuffer();

    // Create response with appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);

    // Copy relevant headers from the proxied response
    const headersToForward = ['content-encoding', 'cache-control', 'etag', 'last-modified'];
    headersToForward.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });

    // For HTML content, we may need to rewrite URLs
    if (contentType.includes('text/html')) {
      const html = new TextDecoder().decode(body);
      // Rewrite relative URLs to go through our proxy
      const rewrittenHtml = rewriteHtmlUrls(html, sessionId, port);
      return new NextResponse(rewrittenHtml, { headers });
    }

    return new NextResponse(body, { headers });
  } catch (error) {
    console.error('[Preview Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to dev server' },
      { status: 502 }
    );
  }
}

/**
 * Rewrites URLs in HTML to go through our proxy
 */
function rewriteHtmlUrls(html: string, sessionId: string, port: string): string {
  const proxyBase = `/api/preview/proxy?sessionId=${sessionId}&port=${port}&path=`;

  // Rewrite href and src attributes with relative paths
  return html
    // Rewrite href="/..." and src="/..."
    .replace(/(href|src)="\/([^"]*?)"/g, (match, attr, path) => {
      // Don't rewrite data: URLs or external URLs
      if (path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:')) {
        return match;
      }
      return `${attr}="${proxyBase}${encodeURIComponent('/' + path)}"`;
    })
    // Rewrite href='...' and src='...' with single quotes
    .replace(/(href|src)='\/([^']*?)'/g, (match, attr, path) => {
      if (path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:')) {
        return match;
      }
      return `${attr}='${proxyBase}${encodeURIComponent('/' + path)}'`;
    });
}
