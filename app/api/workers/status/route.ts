import { NextResponse } from 'next/server';

interface WorkerConfig {
  id: string;
  name: string;
  type: 'oracle' | 'aws' | 'gcp' | 'local';
  url: string;
  region?: string;
  features?: string[];
}

// Configure your workers here
const WORKERS: WorkerConfig[] = [
  {
    id: 'oracle-primary',
    name: 'Oracle Primary',
    type: 'oracle',
    url: process.env.BACKEND_URL || 'http://147.224.217.154:3001',
    region: 'US Chicago',
    features: ['Claude CLI', 'Workspace', 'Terminal', 'WebSocket'],
  },
  // Add more workers as needed:
  // {
  //   id: 'oracle-secondary',
  //   name: 'Oracle Secondary',
  //   type: 'oracle',
  //   url: 'http://secondary.example.com:3001',
  //   region: 'US Phoenix',
  //   features: ['Claude CLI', 'Workspace'],
  // },
];

interface WorkerStatus {
  id: string;
  name: string;
  type: string;
  url: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  version: string;
  commit: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  nodeVersion: string;
  lastChecked: string;
  region?: string;
  features?: string[];
  error?: string;
}

async function checkWorkerStatus(worker: WorkerConfig): Promise<WorkerStatus> {
  const baseStatus: WorkerStatus = {
    id: worker.id,
    name: worker.name,
    type: worker.type,
    url: worker.url,
    status: 'unknown',
    version: 'unknown',
    commit: 'unknown',
    uptime: 0,
    memory: { rss: 0, heapTotal: 0, heapUsed: 0 },
    nodeVersion: 'unknown',
    lastChecked: new Date().toISOString(),
    region: worker.region,
    features: worker.features,
  };

  try {
    // Try to fetch version endpoint (more detailed)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${worker.url}/version`, {
      signal: controller.signal,
      headers: {
        'X-API-Key': process.env.BACKEND_API_KEY || '',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try health endpoint as fallback
      const healthResponse = await fetch(`${worker.url}/health`, {
        headers: {
          'X-API-Key': process.env.BACKEND_API_KEY || '',
        },
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        return {
          ...baseStatus,
          status: 'online',
          version: healthData.version || 'unknown',
          commit: healthData.commit || 'unknown',
        };
      }

      return {
        ...baseStatus,
        status: 'offline',
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      ...baseStatus,
      status: 'online',
      version: data.version || 'unknown',
      commit: data.commit || 'unknown',
      uptime: data.uptime || 0,
      memory: data.memory || { rss: 0, heapTotal: 0, heapUsed: 0 },
      nodeVersion: data.node || 'unknown',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a timeout/abort
    if (errorMessage.includes('abort')) {
      return {
        ...baseStatus,
        status: 'offline',
        error: 'Connection timeout',
      };
    }

    return {
      ...baseStatus,
      status: 'offline',
      error: errorMessage,
    };
  }
}

export async function GET() {
  try {
    // Check all workers in parallel
    const workerStatuses = await Promise.all(
      WORKERS.map((worker) => checkWorkerStatus(worker))
    );

    return NextResponse.json({
      workers: workerStatuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking workers:', error);
    return NextResponse.json(
      { error: 'Failed to check worker status' },
      { status: 500 }
    );
  }
}
