'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useIDEStore } from '../stores/ideStore';
import { useIDEContext } from '../contexts/IDEContext';

const SCAN_INTERVAL = 10000; // 10 seconds

export interface UsePortScannerOptions {
  enabled?: boolean;
  interval?: number;
}

export interface UsePortScannerReturn {
  scanNow: () => Promise<void>;
}

/**
 * Hook to periodically scan for active dev servers on ports 3000-3999.
 * Syncs discovered ports with the IDE store.
 */
export function usePortScanner(options: UsePortScannerOptions = {}): UsePortScannerReturn {
  const { enabled = true, interval = SCAN_INTERVAL } = options;
  const { sessionId } = useIDEContext();
  const { syncPortsFromScan } = useIDEStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const scan = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/preview/ports?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.ports) {
        syncPortsFromScan(data.ports);
      }
    } catch (e) {
      console.error('[PortScanner] Error:', e);
    }
  }, [sessionId, syncPortsFromScan]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial scan
    scan();

    // Set up interval
    intervalRef.current = setInterval(scan, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, sessionId, scan, interval]);

  return { scanNow: scan };
}
