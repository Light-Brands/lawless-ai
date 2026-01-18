'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WorkerInfo {
  id: string;
  name: string;
  type: 'oracle' | 'aws' | 'gcp' | 'local';
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
}

const ServerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
    <line x1="6" x2="6.01" y1="6" y2="6"/>
    <line x1="6" x2="6.01" y1="18" y2="18"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/>
    <path d="m12 5 7 7-7 7"/>
  </svg>
);

export default function WorkersCard() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkers();
  }, []);

  async function loadWorkers() {
    try {
      const res = await fetch('/api/workers/status');
      const data = await res.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Failed to load workers:', error);
    } finally {
      setLoading(false);
    }
  }

  const onlineCount = workers.filter(w => w.status === 'online').length;
  const totalCount = workers.length;

  return (
    <div className="integration-card workers-card">
      <div className="integration-card-header">
        <div className="integration-card-icon workers">
          <ServerIcon />
        </div>
        <span className={`status-badge ${onlineCount > 0 ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          {loading ? 'Checking...' : `${onlineCount}/${totalCount} Online`}
        </span>
      </div>

      <div className="integration-card-content">
        <h3>Backend Workers</h3>
        <p className="integration-card-description">
          Monitor backend worker instances that power AI processing and real-time features.
        </p>
      </div>

      {!loading && workers.length > 0 && (
        <div className="workers-preview">
          {workers.slice(0, 2).map((worker) => (
            <div key={worker.id} className="worker-preview-item">
              <span className={`worker-preview-dot ${worker.status}`}></span>
              <span className="worker-preview-name">{worker.name}</span>
              {worker.region && (
                <span className="worker-preview-region">{worker.region}</span>
              )}
            </div>
          ))}
          {workers.length > 2 && (
            <div className="worker-preview-more">
              +{workers.length - 2} more
            </div>
          )}
        </div>
      )}

      <div className="integration-card-actions">
        <Link href="/workers" className="integration-btn connect workers-btn">
          <ServerIcon />
          View Workers
          <ArrowRightIcon />
        </Link>
      </div>
    </div>
  );
}
