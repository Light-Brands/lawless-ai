'use client';

export type Status = 'pending' | 'running' | 'success' | 'error';

interface StatusIndicatorProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusLabels: Record<Status, string> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Success',
  error: 'Error',
};

export default function StatusIndicator({
  status,
  size = 'md',
  showLabel = false,
}: StatusIndicatorProps) {
  return (
    <span className={`status-indicator ${status} size-${size}`}>
      <span className="status-indicator-dot">
        {status === 'running' && <span className="status-indicator-spinner" />}
        {status === 'success' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === 'error' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </span>
      {showLabel && <span className="status-indicator-label">{statusLabels[status]}</span>}
    </span>
  );
}
