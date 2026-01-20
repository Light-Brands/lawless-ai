import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from multiple locations
// Priority: backend/.env > root/.env.local > root/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Initialize database (must be imported after env vars are loaded)
import { dbPath } from './config/database';

// Import middleware
import { corsMiddleware, allowedOrigins } from './middleware/cors';

// Import utils
import { GIT_COMMIT } from './utils/git';

// Import routes
import chatRoutes from './routes/chat';
import conversationsRoutes from './routes/conversations';
import workspaceRoutes from './routes/workspace';
import builderRoutes from './routes/builder';
import demoRoutes from './routes/demo';
import gitRoutes from './routes/git';
import terminalSessionsRoutes from './routes/terminalSessions';
import workspaceSessionsRoutes from './routes/workspaceSessions';
import previewRoutes from './routes/preview';
import terminalTabsRoutes from './routes/terminalTabs';

// Import WebSocket setup
import { setupTerminalWebSocket } from './websocket/terminal';

const app = express();
const PORT = process.env.PORT || 4000;

// Apply middleware
app.use(corsMiddleware);
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    commit: GIT_COMMIT
  });
});

// Version endpoint - detailed deployment info
app.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    commit: GIT_COMMIT,
    node: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Mount all routes
app.use(chatRoutes);
app.use(conversationsRoutes);
app.use(workspaceRoutes);
app.use(builderRoutes);
app.use(demoRoutes);
app.use(gitRoutes);
app.use(terminalSessionsRoutes);
app.use(workspaceSessionsRoutes);
app.use(previewRoutes);
app.use(terminalTabsRoutes);

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// Setup WebSocket server for terminal sessions
const { wss, pingInterval } = setupTerminalWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Lawless AI Backend Server                       ║
╠═══════════════════════════════════════════════════════════╣
║  Port:     ${String(PORT).padEnd(45)}║
║  WebSocket: ws://localhost:${PORT}/ws/terminal${' '.repeat(26)}║
║  Database: ${dbPath.slice(-45).padEnd(45)}║
║  CORS:     ${(allowedOrigins[0] || 'all origins').slice(0, 45).padEnd(45)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown - clean up ping interval
process.on('SIGTERM', () => {
  clearInterval(pingInterval);
  wss.close();
  server.close();
});
