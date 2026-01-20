'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ideEvents, useIDEEvent } from '../../../lib/eventBus';
import { useIDEContext } from '../../../contexts/IDEContext';
import type { ActivityEventType } from '@/types/database';
import {
  GitHubIcon,
  DatabaseIcon,
  RocketIcon,
  GitBranchIcon,
  TerminalIcon,
  PlugIcon,
  RobotIcon,
  FileIcon,
  SaveIcon,
  FolderOpenIcon,
  WrenchIcon,
  CheckCircleIcon,
  XCircleIcon,
  PartyIcon,
  WaveIcon,
  ActivityIcon,
} from '../../Icons';

// Map icon keys to React components (supports both new keys and legacy emojis)
const iconMap: Record<string, React.ReactNode> = {
  // Service icons
  github: <GitHubIcon size={14} />,
  supabase: <DatabaseIcon size={14} />,
  vercel: <RocketIcon size={14} />,
  worktree: <GitBranchIcon size={14} />,
  terminal: <TerminalIcon size={14} />,
  plug: <PlugIcon size={14} />,
  // Action icons
  robot: <RobotIcon size={14} />,
  file: <FileIcon size={14} />,
  save: <SaveIcon size={14} />,
  folder: <FolderOpenIcon size={14} />,
  wrench: <WrenchIcon size={14} />,
  rocket: <RocketIcon size={14} />,
  // Status icons
  success: <CheckCircleIcon size={14} />,
  error: <XCircleIcon size={14} />,
  party: <PartyIcon size={14} />,
  wave: <WaveIcon size={14} />,
  activity: <ActivityIcon size={14} />,
  // Legacy emoji mappings for backward compatibility
  '🐙': <GitHubIcon size={14} />,
  '🗄️': <DatabaseIcon size={14} />,
  '🚀': <RocketIcon size={14} />,
  '🌿': <GitBranchIcon size={14} />,
  '⌨️': <TerminalIcon size={14} />,
  '🔌': <PlugIcon size={14} />,
  '🤖': <RobotIcon size={14} />,
  '📝': <FileIcon size={14} />,
  '💾': <SaveIcon size={14} />,
  '📂': <FolderOpenIcon size={14} />,
  '🔧': <WrenchIcon size={14} />,
  '✅': <CheckCircleIcon size={14} />,
  '❌': <XCircleIcon size={14} />,
  '🎉': <PartyIcon size={14} />,
  '👋': <WaveIcon size={14} />,
  '📋': <ActivityIcon size={14} />,
};

// Get icon component from key or emoji
const getActivityIcon = (iconKey: string): React.ReactNode => {
  return iconMap[iconKey] || <ActivityIcon size={14} />;
};

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: ActivityEventType;
  icon: string;
  summary: string;
  details?: string;
  relatedFile?: string;
  persisted?: boolean;
}

interface DatabaseActivityEvent {
  id: string;
  created_at: string;
  event_type: ActivityEventType;
  icon: string;
  summary: string;
  details: string | null;
  related_file: string | null;
}

// Convert database event to local event
function fromDatabaseEvent(dbEvent: DatabaseActivityEvent): ActivityEvent {
  return {
    id: dbEvent.id,
    timestamp: new Date(dbEvent.created_at),
    type: dbEvent.event_type,
    icon: dbEvent.icon,
    summary: dbEvent.summary,
    details: dbEvent.details || undefined,
    relatedFile: dbEvent.related_file || undefined,
    persisted: true,
  };
}

// Convert service connection events to activity events
function createServiceEvent(service: string, action: 'connecting' | 'connected' | 'error', error?: string): ActivityEvent {
  const icons: Record<string, string> = {
    github: 'github',
    supabase: 'supabase',
    vercel: 'vercel',
    worktree: 'worktree',
    terminal: 'terminal',
  };

  const summaries: Record<string, string> = {
    connecting: `Connecting to ${service}...`,
    connected: `Connected to ${service}`,
    error: `Failed to connect to ${service}`,
  };

  return {
    id: `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date(),
    type: 'service',
    icon: icons[service] || 'plug',
    summary: summaries[action],
    details: error,
    persisted: false,
  };
}

export function ActivityPane() {
  const { sessionId, repoFullName } = useIDEContext();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const saveQueueRef = useRef<ActivityEvent[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load events from database on mount
  useEffect(() => {
    async function loadEvents() {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (sessionId) params.set('sessionId', sessionId);
        if (repoFullName) params.set('repoFullName', repoFullName);
        params.set('limit', '100');

        const response = await fetch(`/api/activity?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.events && Array.isArray(data.events)) {
            const loadedEvents = data.events.map(fromDatabaseEvent);
            setEvents(loadedEvents);
          }
        }
      } catch (err) {
        console.error('Failed to load activity events:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadEvents();
  }, [sessionId, repoFullName]);

  // Save events to database (debounced batch save)
  const saveEventsToDatabase = useCallback(async () => {
    if (saveQueueRef.current.length === 0 || !sessionId) return;

    const eventsToSave = saveQueueRef.current.filter(e => !e.persisted);
    saveQueueRef.current = [];

    if (eventsToSave.length === 0) return;

    try {
      const response = await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: eventsToSave.map(e => ({
            eventType: e.type,
            icon: e.icon,
            summary: e.summary,
            details: e.details,
            relatedFile: e.relatedFile,
            sessionId,
            repoFullName,
          })),
        }),
      });

      if (response.ok) {
        // Mark events as persisted
        setEvents(prev => prev.map(e =>
          eventsToSave.some(saved => saved.id === e.id)
            ? { ...e, persisted: true }
            : e
        ));
      }
    } catch (err) {
      console.error('Failed to save activity events:', err);
    }
  }, [sessionId, repoFullName]);

  // Queue event for saving
  const queueEventForSave = useCallback((event: ActivityEvent) => {
    saveQueueRef.current.push(event);

    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveEventsToDatabase();
    }, 2000);
  }, [saveEventsToDatabase]);

  // Add event helper
  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 100));
    queueEventForSave(event);
  }, [queueEventForSave]);

  // Clear events (also clears from database)
  const clearEvents = useCallback(async () => {
    setEvents([]);

    if (sessionId) {
      try {
        await fetch(`/api/activity?sessionId=${sessionId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to clear activity events:', err);
      }
    }
  }, [sessionId]);

  // Subscribe to service events
  useIDEEvent('service:connecting', (data) => {
    addEvent(createServiceEvent(data.service, 'connecting'));
  }, [addEvent]);

  useIDEEvent('service:connected', (data) => {
    addEvent(createServiceEvent(data.service, 'connected'));
  }, [addEvent]);

  useIDEEvent('service:error', (data) => {
    addEvent(createServiceEvent(data.service, 'error', data.error));
  }, [addEvent]);

  // Subscribe to file events
  useIDEEvent('file:changed', (data) => {
    addEvent({
      id: `file-${Date.now()}`,
      timestamp: new Date(),
      type: data.source === 'claude' ? 'claude' : 'user',
      icon: data.source === 'claude' ? 'robot' : 'file',
      summary: `${data.source === 'claude' ? 'Claude' : 'You'} edited ${data.path.split('/').pop()}`,
      relatedFile: data.path,
      persisted: false,
    });
  }, [addEvent]);

  useIDEEvent('file:saved', (data) => {
    addEvent({
      id: `save-${Date.now()}`,
      timestamp: new Date(),
      type: 'user',
      icon: 'save',
      summary: `Saved ${data.path.split('/').pop()}`,
      details: `Branch: ${data.branch}`,
      relatedFile: data.path,
      persisted: false,
    });
  }, [addEvent]);

  useIDEEvent('file:opened', (data) => {
    addEvent({
      id: `open-${Date.now()}`,
      timestamp: new Date(),
      type: 'user',
      icon: 'folder',
      summary: `Opened ${data.path.split('/').pop()}`,
      relatedFile: data.path,
      persisted: false,
    });
  }, [addEvent]);

  // Subscribe to terminal events
  useIDEEvent('terminal:connected', (data) => {
    addEvent({
      id: `term-connect-${Date.now()}`,
      timestamp: new Date(),
      type: 'terminal',
      icon: 'terminal',
      summary: 'Terminal connected',
      details: `Session: ${data.sessionId.slice(0, 8)}...`,
      persisted: false,
    });
  }, [addEvent]);

  useIDEEvent('terminal:disconnected', (data) => {
    addEvent({
      id: `term-disconnect-${Date.now()}`,
      timestamp: new Date(),
      type: 'terminal',
      icon: 'terminal',
      summary: 'Terminal disconnected',
      details: data.code ? `Code: ${data.code}` : undefined,
      persisted: false,
    });
  }, [addEvent]);

  // Subscribe to chat events
  useIDEEvent('chat:message', (data) => {
    if (data.type === 'tool_use' && data.tool) {
      addEvent({
        id: `tool-${Date.now()}`,
        timestamp: new Date(),
        type: 'claude',
        icon: 'wrench',
        summary: `Claude using ${data.tool}`,
        details: data.input ? JSON.stringify(data.input).slice(0, 50) + '...' : undefined,
        persisted: false,
      });
    }
  }, [addEvent]);

  // Subscribe to deployment events
  useIDEEvent('deployment:started', (data) => {
    addEvent({
      id: `deploy-start-${Date.now()}`,
      timestamp: new Date(),
      type: 'deployment',
      icon: 'rocket',
      summary: 'Deployment started',
      details: `Branch: ${data.branch}`,
      persisted: false,
    });
  }, [addEvent]);

  useIDEEvent('deployment:completed', (data) => {
    addEvent({
      id: `deploy-complete-${Date.now()}`,
      timestamp: new Date(),
      type: 'deployment',
      icon: data.status === 'success' ? 'success' : 'error',
      summary: `Deployment ${data.status}`,
      details: data.url,
      persisted: false,
    });
  }, [addEvent]);

  // Subscribe to migration events
  useIDEEvent('migration:applied', (data) => {
    addEvent({
      id: `migration-${Date.now()}`,
      timestamp: new Date(),
      type: 'database',
      icon: data.success ? 'success' : 'error',
      summary: `Migration ${data.success ? 'applied' : 'failed'}: ${data.file}`,
      details: data.error,
      persisted: false,
    });
  }, [addEvent]);

  // Subscribe to session events
  useIDEEvent('session:initialized', (data) => {
    addEvent({
      id: `session-${Date.now()}`,
      timestamp: new Date(),
      type: 'system',
      icon: 'party',
      summary: 'Session initialized',
      details: `ID: ${data.sessionId.slice(0, 8)}...`,
      persisted: false,
    });
  }, [addEvent]);

  // Add initial event if no events loaded
  useEffect(() => {
    if (!isLoading && events.length === 0) {
      addEvent({
        id: 'welcome',
        timestamp: new Date(),
        type: 'system',
        icon: 'wave',
        summary: 'Activity log started',
        details: 'Events will appear here',
        persisted: false,
      });
    }
  }, [isLoading, events.length, addEvent]);

  // Save pending events before unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Force save on unmount
      if (saveQueueRef.current.length > 0) {
        saveEventsToDatabase();
      }
    };
  }, [saveEventsToDatabase]);

  const filteredEvents = events.filter((event) => {
    if (filter !== 'all' && event.type !== filter) return false;
    if (search && !event.summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group events by day
  const groupedEvents = filteredEvents.reduce(
    (groups, event) => {
      const date = event.timestamp.toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
      return groups;
    },
    {} as Record<string, ActivityEvent[]>
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDateLabel = (dateStr: string) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return dateStr;
  };

  return (
    <div className="activity-pane">
      {/* Header */}
      <div className="activity-header">
        <span>Activity ({events.length})</span>
        <div className="activity-controls">
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="claude">Claude</option>
            <option value="user">User</option>
            <option value="terminal">Terminal</option>
            <option value="deployment">Deployment</option>
            <option value="database">Database</option>
            <option value="service">Service</option>
            <option value="system">System</option>
          </select>
          <button
            className="clear-btn"
            title="Clear"
            onClick={clearEvents}
          >
            ×
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="activity-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity..."
          className="search-input"
        />
      </div>

      {/* Timeline */}
      <div className="activity-timeline">
        {isLoading ? (
          <div className="activity-empty">
            <div className="loading-spinner" />
            <p>Loading activity...</p>
          </div>
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div className="activity-empty">
            <span className="empty-icon"><ActivityIcon size={24} /></span>
            <p>No activity yet</p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([date, dayEvents]) => (
            <div key={date} className="timeline-group">
              <div className="timeline-date">{getDateLabel(date)}</div>
              {dayEvents.map((event) => (
                <div key={event.id} className={`timeline-event ${event.type}`}>
                  <div className="event-time">{formatTime(event.timestamp)}</div>
                  <div className="event-icon">{getActivityIcon(event.icon)}</div>
                  <div className="event-content">
                    <div className="event-summary">{event.summary}</div>
                    {event.details && (
                      <div className="event-details">└─ {event.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .activity-pane {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary, #0d0d0f);
          overflow: hidden;
        }

        .activity-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--border-color, #2a2a2f);
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-primary, #fff);
          flex-shrink: 0;
        }

        .activity-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .filter-select {
          padding: 0.25rem 0.5rem;
          background: var(--bg-secondary, #141417);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 4px;
          color: var(--text-primary, #fff);
          font-size: 0.75rem;
          cursor: pointer;
        }

        .clear-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 4px;
          color: var(--text-secondary, #888);
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .clear-btn:hover {
          background: var(--bg-secondary, #141417);
          color: var(--text-primary, #fff);
        }

        .activity-search {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--border-color, #2a2a2f);
          flex-shrink: 0;
        }

        .search-input {
          width: 100%;
          padding: 0.375rem 0.5rem;
          background: var(--bg-secondary, #141417);
          border: 1px solid var(--border-color, #2a2a2f);
          border-radius: 4px;
          color: var(--text-primary, #fff);
          font-size: 0.8rem;
        }

        .search-input::placeholder {
          color: var(--text-secondary, #666);
        }

        .activity-timeline {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 0.75rem;
        }

        .activity-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary, #666);
          gap: 0.5rem;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--bg-tertiary, #30363d);
          border-top-color: #58a6ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          font-size: 2rem;
          opacity: 0.5;
        }

        .activity-empty p {
          margin: 0;
          font-size: 0.85rem;
        }

        .timeline-group {
          margin-bottom: 1rem;
        }

        .timeline-date {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-secondary, #888);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid var(--border-color, #2a2a2f);
        }

        .timeline-event {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.375rem 0;
          font-size: 0.8rem;
        }

        .event-time {
          flex-shrink: 0;
          width: 50px;
          color: var(--text-secondary, #666);
          font-family: monospace;
          font-size: 0.7rem;
        }

        .event-icon {
          flex-shrink: 0;
          font-size: 0.9rem;
        }

        .event-content {
          flex: 1;
          min-width: 0;
        }

        .event-summary {
          color: var(--text-primary, #fff);
          word-break: break-word;
        }

        .event-details {
          color: var(--text-secondary, #666);
          font-size: 0.75rem;
          margin-top: 0.125rem;
          word-break: break-all;
        }

        .timeline-event.claude .event-summary {
          color: #a78bfa;
        }

        .timeline-event.service .event-summary {
          color: #60a5fa;
        }

        .timeline-event.deployment .event-summary {
          color: #34d399;
        }

        .timeline-event.database .event-summary {
          color: #fbbf24;
        }

        .timeline-event.terminal .event-summary {
          color: #38bdf8;
        }
      `}</style>
    </div>
  );
}
