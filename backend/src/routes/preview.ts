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
        // Request uncompressed content for easier processing
        'Accept-Encoding': (req.headers['accept-encoding'] as string) || 'identity',
        'User-Agent': (req.headers['user-agent'] as string) || 'LawlessAI-Preview',
      },
    });

    // Forward response headers with explicit content-type
    const contentType = proxyRes.headers.get('content-type') || 'text/html; charset=utf-8';
    res.setHeader('Content-Type', contentType);

    // Allow iframe embedding
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Remove any restrictive CSP
    res.removeHeader('Content-Security-Policy');

    const cacheControl = proxyRes.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    // Stream response body
    const buffer = await proxyRes.arrayBuffer();
    res.status(proxyRes.status).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Preview proxy error:', error);
    // Return HTML error page that renders properly in iframe
    const errorHtml = `<!DOCTYPE html>
<html>
<head><title>Preview Error</title></head>
<body style="font-family: system-ui; padding: 2rem; background: #1a1a1a; color: #fff;">
  <h1>Failed to connect to dev server</h1>
  <p>Port: ${port}</p>
  <p>${error.code === 'ECONNREFUSED' ? 'Dev server not running' : error.message}</p>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(502).send(errorHtml);
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

// Scan ports 3000-3999 for active dev servers belonging to this session
router.get('/api/preview/ports', authenticateApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  // Get session and its worktree path
  const session = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId) as any;
  const terminalSession = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId) as any;

  if (!session && !terminalSession) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const worktreePath = session?.worktree_path || terminalSession?.worktree_path;

  try {
    // Scan ports 3000-3999 using ss command, extracting both port and PID
    // ss output format: LISTEN 0 511 *:3001 *:* users:(("next-server",pid=195462,fd=19))
    const result = execSync(
      `ss -tlnp 2>/dev/null | grep -E ':3[0-9]{3}\\s'`,
      { encoding: 'utf-8', timeout: 5000 }
    );

    // Parse ss output to extract port and PID pairs
    const portPidPairs: { port: number; pid: number }[] = [];
    for (const line of result.split('\n')) {
      if (!line.trim()) continue;

      // Extract port from the local address column (4th field)
      const portMatch = line.match(/:(\d+)\s+\*:/);
      const port = portMatch ? parseInt(portMatch[1], 10) : NaN;

      // Extract PID from users:((... pid=XXXXX ...))
      const pidMatch = line.match(/pid=(\d+)/);
      const pid = pidMatch ? parseInt(pidMatch[1], 10) : NaN;

      if (!isNaN(port) && port >= 3000 && port <= 3999 && !isNaN(pid)) {
        portPidPairs.push({ port, pid });
      }
    }

    const allPorts = portPidPairs.map(p => p.port);

    // Filter ports to only include those running from this session's worktree
    const sessionPorts: number[] = [];
    const debugInfo: { port: number; pid: number; cwd: string; match: boolean }[] = [];

    if (worktreePath) {
      for (const { port, pid } of portPidPairs) {
        try {
          // Get the working directory of the process using /proc
          const cwdResult = execSync(
            `readlink /proc/${pid}/cwd 2>/dev/null`,
            { encoding: 'utf-8', timeout: 2000 }
          ).trim();

          // Check if the process is running from within this session's worktree
          const isMatch = cwdResult && cwdResult.startsWith(worktreePath);
          debugInfo.push({ port, pid, cwd: cwdResult, match: !!isMatch });

          if (isMatch) {
            sessionPorts.push(port);
          }
        } catch (e) {
          // If we can't determine the port's owner, skip it
          debugInfo.push({ port, pid, cwd: `error: ${(e as Error).message}`, match: false });
          continue;
        }
      }
    }

    res.json({
      ports: sessionPorts,
      allPorts, // Include all ports for debugging
      worktreePath,
      debugInfo,
      scannedAt: new Date().toISOString()
    });
  } catch (error) {
    // No ports found or error scanning
    res.json({ ports: [], scannedAt: new Date().toISOString() });
  }
});

export default router;
