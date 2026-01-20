'use client';

import React, { useState } from 'react';

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: 'claude' | 'user' | 'git' | 'deployment' | 'database' | 'system';
  icon: string;
  summary: string;
  details?: string;
  relatedFile?: string;
}

// Mock data for now
const mockEvents: ActivityEvent[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    type: 'claude',
    icon: '🤖',
    summary: 'Claude edited src/app/page.tsx',
    details: 'Changed 12 lines',
    relatedFile: 'src/app/page.tsx',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 6 * 60 * 1000),
    type: 'user',
    icon: '📝',
    summary: 'You opened src/app/page.tsx',
    relatedFile: 'src/app/page.tsx',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 7 * 60 * 1000),
    type: 'deployment',
    icon: '🚀',
    summary: 'Deployment started (preview)',
    details: 'Branch: claude/add-auth-a1b2c3',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    type: 'git',
    icon: '📤',
    summary: 'You committed "Fix header"',
    details: '1 file changed',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    type: 'database',
    icon: '🗄️',
    summary: 'Migration applied: add_users.sql',
    details: 'Created table: users',
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    type: 'claude',
    icon: '🤖',
    summary: 'Claude ran: npm install axios',
    details: 'Added 1 dependency',
  },
  {
    id: '7',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    type: 'user',
    icon: '💬',
    summary: 'You asked: "Add authentication"',
  },
  {
    id: '8',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    type: 'system',
    icon: '🎉',
    summary: 'Session created',
    details: 'Repo: lawless-ai',
  },
];

export function ActivityPane() {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredEvents = mockEvents.filter((event) => {
    if (filter !== 'all' && event.type !== filter) return false;
    if (search && !event.summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group events by day
  const groupedEvents = filteredEvents.reduce((groups, event) => {
    const date = event.timestamp.toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
    return groups;
  }, {} as Record<string, ActivityEvent[]>);

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
        <span>Activity</span>
        <div className="activity-controls">
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="claude">Claude</option>
            <option value="user">User</option>
            <option value="git">Git</option>
            <option value="deployment">Deployment</option>
            <option value="database">Database</option>
          </select>
          <button className="export-btn" title="Export">
            ↓
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
        {Object.entries(groupedEvents).map(([date, events]) => (
          <div key={date} className="timeline-group">
            <div className="timeline-date">{getDateLabel(date)}</div>
            {events.map((event) => (
              <div key={event.id} className={`timeline-event ${event.type}`}>
                <div className="event-time">{formatTime(event.timestamp)}</div>
                <div className="event-icon">{event.icon}</div>
                <div className="event-content">
                  <div className="event-summary">{event.summary}</div>
                  {event.details && <div className="event-details">└─ {event.details}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
