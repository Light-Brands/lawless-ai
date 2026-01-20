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

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  const apiKey = process.env.BACKEND_API_KEY;

  try {
    // Proxy to backend's preview endpoint
    const targetUrl = `${backendUrl}/api/preview/proxy?sessionId=${sessionId}&port=${port}&path=${encodeURIComponent(path)}`;

    const response = await fetch(targetUrl, {
      headers: {
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        // Don't request compressed content since we need to rewrite HTML
        'Accept-Encoding': 'identity',
      },
    });

    // Get content type from response - ensure we have a proper MIME type
    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';

    if (!response.ok) {
      // If backend returns error, preserve content-type for proper rendering
      const errorContent = await response.text();
      console.error('[Preview Proxy] Backend error:', response.status, errorContent);
      const errorHeaders = new Headers();
      // If it looks like HTML, return as HTML so the browser renders it
      if (errorContent.trim().startsWith('<!') || errorContent.trim().startsWith('<html')) {
        errorHeaders.set('Content-Type', 'text/html; charset=utf-8');
      } else {
        errorHeaders.set('Content-Type', contentType);
      }
      return new NextResponse(errorContent, { status: response.status, headers: errorHeaders });
    }

    // Stream the response body
    const body = await response.arrayBuffer();

    // Create response with appropriate headers for iframe rendering
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    // Explicitly allow iframe embedding
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    // Remove any CSP that might block iframe content
    headers.delete('Content-Security-Policy');

    // Copy relevant headers from the proxied response (but NOT content-encoding since we want uncompressed)
    const headersToForward = ['cache-control', 'etag', 'last-modified'];
    headersToForward.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });

    // For HTML content, rewrite URLs and inject base tag
    if (contentType.includes('text/html')) {
      const html = new TextDecoder().decode(body);
      // Rewrite relative URLs to go through our proxy
      const rewrittenHtml = rewriteHtmlUrls(html, sessionId, port);
      // Ensure Content-Type includes charset
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return new NextResponse(rewrittenHtml, { headers });
    }

    return new NextResponse(body, { headers });
  } catch (error) {
    console.error('[Preview Proxy] Error:', error);
    // Return HTML error page that will render properly
    const errorHtml = `<!DOCTYPE html>
<html>
<head><title>Preview Error</title></head>
<body style="font-family: system-ui; padding: 2rem; background: #1a1a1a; color: #fff;">
  <h1>Failed to connect to dev server</h1>
  <p>Make sure your dev server is running on port ${port}</p>
  <pre style="background: #333; padding: 1rem; border-radius: 4px;">${error instanceof Error ? error.message : 'Unknown error'}</pre>
</body>
</html>`;
    return new NextResponse(errorHtml, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Rewrites URLs in HTML to go through our proxy
 */
function rewriteHtmlUrls(html: string, sessionId: string, port: string): string {
  const proxyBase = `/api/preview/proxy?sessionId=${sessionId}&port=${port}&path=`;

  // Inject a script that intercepts fetch/XHR to proxy dynamic requests
  const interceptScript = `
<script>
(function() {
  const proxyBase = '${proxyBase}';
  const origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
      url = proxyBase + encodeURIComponent(url);
    }
    return origFetch.call(this, url, opts);
  };
  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    xhr.open = function(method, url, ...args) {
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
        url = proxyBase + encodeURIComponent(url);
      }
      return origOpen.call(this, method, url, ...args);
    };
    return xhr;
  };
})();
</script>`;

  // Rewrite URLs and inject the intercept script
  let result = html
    // Rewrite href="/..." and src="/..." (double quotes)
    .replace(/(href|src|action)="\/([^"]*?)"/g, (match, attr, path) => {
      // Don't rewrite data: URLs, external URLs, or protocol-relative URLs
      if (path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:') || path.startsWith('/')) {
        return match;
      }
      return `${attr}="${proxyBase}${encodeURIComponent('/' + path)}"`;
    })
    // Rewrite href='...' and src='...' (single quotes)
    .replace(/(href|src|action)='\/([^']*?)'/g, (match, attr, path) => {
      if (path.startsWith('data:') || path.startsWith('http:') || path.startsWith('https:') || path.startsWith('/')) {
        return match;
      }
      return `${attr}='${proxyBase}${encodeURIComponent('/' + path)}'`;
    })
    // Rewrite srcset attributes (for responsive images)
    .replace(/srcset="([^"]+)"/g, (match, srcset) => {
      const rewritten = srcset.split(',').map((entry: string) => {
        const parts = entry.trim().split(/\s+/);
        if (parts[0] && parts[0].startsWith('/') && !parts[0].startsWith('//')) {
          parts[0] = proxyBase + encodeURIComponent(parts[0]);
        }
        return parts.join(' ');
      }).join(', ');
      return `srcset="${rewritten}"`;
    });

  // Inject the intercept script after <head> or at the start of the document
  if (result.includes('<head>')) {
    result = result.replace('<head>', '<head>' + interceptScript);
  } else if (result.includes('<head ')) {
    result = result.replace(/<head\s[^>]*>/, '$&' + interceptScript);
  } else if (result.includes('<html>') || result.includes('<html ')) {
    result = result.replace(/<html[^>]*>/, '$&' + interceptScript);
  } else {
    // Prepend to document if no head/html tag
    result = interceptScript + result;
  }

  return result;
}
