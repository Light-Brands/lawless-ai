import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import { db } from '../config/database';
import { authenticateApiKey } from '../middleware/auth';

const router = Router();

// Preview proxy endpoint - proxies requests to dev servers running in worktrees
router.get('/api/preview/proxy', authenticateApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const port = req.query.port as string || '3000';
  const reqPath = req.query.path as string || '/';

  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  // Verify session exists
  const session = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId) as any;
  const terminalSession = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId) as any;

  if (!session && !terminalSession) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    // Proxy request to localhost:port
    const targetUrl = 'http://localhost:' + port + reqPath;

    const proxyRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': (req.headers.accept as string) || '*/*',
        'Accept-Encoding': (req.headers['accept-encoding'] as string) || '',
        'User-Agent': (req.headers['user-agent'] as string) || 'LawlessAI-Preview',
      },
    });

    // Forward response headers
    const contentType = proxyRes.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);

    const cacheControl = proxyRes.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    // Stream response body
    const buffer = await proxyRes.arrayBuffer();
    res.status(proxyRes.status).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Preview proxy error:', error);
    if (error.code === 'ECONNREFUSED') {
      res.status(502).json({ error: 'Dev server not running on port ' + port });
    } else {
      res.status(502).json({ error: 'Failed to proxy: ' + error.message });
    }
  }
});


// Vercel Preview Proxy - strips X-Frame-Options to allow iframe embedding
router.get('/preview/vercel', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  const reqPath = req.query.path as string || '/';

  if (!url) {
    res.status(400).json({ error: 'URL parameter required' });
    return;
  }

  // Only allow Vercel URLs
  if (!url.includes('.vercel.app')) {
    res.status(400).json({ error: 'Only Vercel URLs are supported' });
    return;
  }

  try {
    const targetUrl = url.startsWith('https://') ? url : 'https://' + url;
    const fullUrl = targetUrl + reqPath;

    console.log('[Vercel Preview] Proxying:', fullUrl);

    const proxyRes = await fetch(fullUrl, {
      headers: {
        'Accept': req.headers.accept as string || 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': req.headers['accept-language'] as string || 'en-US,en;q=0.9',
        'User-Agent': req.headers['user-agent'] as string || 'Mozilla/5.0 LawlessAI-Preview',
      },
    });

    const contentType = proxyRes.headers.get('content-type') || 'text/html';

    // Set response headers - explicitly NOT setting X-Frame-Options
    res.setHeader('Content-Type', contentType);

    const cacheControl = proxyRes.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    if (contentType.includes('text/html')) {
      let html = await proxyRes.text();

      // Rewrite URLs to go through our proxy
      const proxyBase = '/preview/vercel?url=' + encodeURIComponent(url) + '&path=';

      // Rewrite href and src attributes starting with /
      html = html.replace(/(href|src)="\/([^"]*?)"/g, (match: string, attr: string, path: string) => {
        if (path.startsWith('data:') || path.startsWith('http')) return match;
        return attr + '="' + proxyBase + encodeURIComponent('/' + path) + '"';
      });

      // Add base tag for relative URLs
      if (!html.includes('<base')) {
        html = html.replace('<head>', '<head><base href="' + targetUrl + '/">');
      }

      res.status(proxyRes.status).send(html);
    } else {
      const buffer = await proxyRes.arrayBuffer();
      res.status(proxyRes.status).send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error('[Vercel Preview] Error:', error);
    res.status(502).json({ error: 'Failed to fetch: ' + error.message });
  }
});

// Scan ports 3000-3999 for active dev servers
router.get('/api/preview/ports', authenticateApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  // Verify session exists
  const session = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId);
  const terminalSession = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId);

  if (!session && !terminalSession) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    // Scan ports 3000-3999 using ss command
    const result = execSync(
      `ss -tlnp 2>/dev/null | grep -E ':3[0-9]{3}\\s' | awk '{print $4}' | sed 's/.*://' | sort -un`,
      { encoding: 'utf-8', timeout: 5000 }
    );

    const ports = result.split('\n')
      .map((p: string) => parseInt(p.trim(), 10))
      .filter((p: number) => !isNaN(p) && p >= 3000 && p <= 3999);

    res.json({ ports, scannedAt: new Date().toISOString() });
  } catch (error) {
    // No ports found or error scanning
    res.json({ ports: [], scannedAt: new Date().toISOString() });
  }
});

export default router;
