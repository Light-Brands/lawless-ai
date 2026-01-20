import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';

const PREVIEW_SUBDOMAIN_PATTERN = /^preview-([a-zA-Z0-9_-]+)\.dev\.lightbrands\.ai$/;

/**
 * Middleware that handles preview subdomain requests.
 * Routes like preview-{sessionId}.dev.lightbrands.ai get proxied to the session's localhost.
 */
export async function previewSubdomainMiddleware(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host || '';
  const match = host.match(PREVIEW_SUBDOMAIN_PATTERN);

  if (!match) {
    // Not a preview subdomain, continue to normal routes
    return next();
  }

  const sessionId = match[1];
  const port = req.query.port || '3000';
  const reqPath = req.path || '/';

  // Verify session exists
  const session = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId) as any;
  const terminalSession = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId) as any;

  if (!session && !terminalSession) {
    res.status(404).send(errorPage('Session not found', `Session ID: ${sessionId}`));
    return;
  }

  try {
    // Build query string from original request (excluding our internal params)
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'port') {
        queryParams.append(key, String(value));
      }
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    // Proxy request to localhost:port
    const targetUrl = `http://localhost:${port}${reqPath}${queryString}`;

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Accept': (req.headers.accept as string) || '*/*',
        'Accept-Encoding': 'identity', // Request uncompressed for URL rewriting
        'Content-Type': (req.headers['content-type'] as string) || '',
        'User-Agent': (req.headers['user-agent'] as string) || 'LawlessAI-Preview',
        'Cookie': (req.headers.cookie as string) || '',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Get content type
    const contentType = proxyRes.headers.get('content-type') || 'text/html; charset=utf-8';

    // Set response headers - explicitly allow iframe embedding from any origin
    res.setHeader('Content-Type', contentType);
    res.removeHeader('X-Frame-Options'); // Allow cross-origin iframe embedding
    res.removeHeader('Content-Security-Policy'); // Remove any restrictive CSP

    // Forward cache headers
    const cacheControl = proxyRes.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    // For HTML content, rewrite URLs to stay on the preview subdomain
    if (contentType.includes('text/html')) {
      let html = await proxyRes.text();
      html = rewriteHtmlUrls(html, host, port as string);
      res.status(proxyRes.status).send(html);
    } else {
      // Stream non-HTML content directly
      const buffer = await proxyRes.arrayBuffer();
      res.status(proxyRes.status).send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error('[Preview Subdomain] Proxy error:', error);
    res.status(502).send(errorPage(
      'Failed to connect to dev server',
      error.code === 'ECONNREFUSED'
        ? `Dev server not running on port ${port}`
        : error.message
    ));
  }
}

/**
 * Rewrite URLs in HTML to keep requests on the preview subdomain.
 * This is simpler than the proxy approach since we don't need to rewrite to a different path.
 */
function rewriteHtmlUrls(html: string, host: string, port: string): string {
  // Inject a script to intercept fetch/XHR for dynamic requests
  // Since we're on the same subdomain, relative URLs work naturally
  // But we need to handle any absolute URLs that point to localhost
  const interceptScript = `
<script>
(function() {
  // Rewrite localhost URLs to go through the preview subdomain
  const rewriteUrl = (url) => {
    if (typeof url === 'string') {
      // Rewrite localhost:${port} URLs
      if (url.includes('localhost:${port}') || url.includes('127.0.0.1:${port}')) {
        return url.replace(/https?:\\/\\/(localhost|127\\.0\\.0\\.1):${port}/, '');
      }
    }
    return url;
  };

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = function(url, opts) {
    return origFetch.call(this, rewriteUrl(url), opts);
  };

  // Intercept XMLHttpRequest
  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    xhr.open = function(method, url, ...args) {
      return origOpen.call(this, method, rewriteUrl(url), ...args);
    };
    return xhr;
  };
})();
</script>`;

  // Inject script after <head> tag
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + interceptScript);
  } else if (html.includes('<head ')) {
    html = html.replace(/<head\s[^>]*>/, '$&' + interceptScript);
  } else if (html.includes('<html>') || html.includes('<html ')) {
    html = html.replace(/<html[^>]*>/, '$&' + interceptScript);
  } else {
    html = interceptScript + html;
  }

  return html;
}

/**
 * Generate an error page HTML
 */
function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Preview Error</title></head>
<body style="font-family: system-ui; padding: 2rem; background: #1a1a1a; color: #fff;">
  <h1>${title}</h1>
  <p style="color: #999;">${message}</p>
</body>
</html>`;
}
