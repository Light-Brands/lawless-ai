'use client';

import React, { useCallback, useRef } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import { TerminalIcon, ChatIcon, ChevronUpIcon, ChevronDownIcon } from '../Icons';

type BottomZoneTab = 'terminal' | 'chat';
type BottomZoneHeight = 'collapsed' | 'half' | 'expanded' | 'fullscreen';

interface MobileBottomZoneProps {
  terminalContent: React.ReactNode;
  chatContent: React.ReactNode;
}

// Haptic feedback helper
const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const durations = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(durations[style]);
  }
};

export function MobileBottomZone({ terminalContent, chatContent }: MobileBottomZoneProps) {
  const {
    mobile,
    setMobileBottomZoneTab,
    setMobileBottomZoneHeight,
    expandMobileBottomZone,
    collapseMobileBottomZone,
    serverStatus,
  } = useIDEStore();

  const { bottomZoneTab, bottomZoneHeight, chatUnreadCount } = mobile;
  const isTerminalRunning = serverStatus === 'running' || serverStatus === 'starting';

  // Touch handling for swipe gestures
  const touchStartY = useRef(0);
  const touchStartHeight = useRef<BottomZoneHeight>('half');

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartHeight.current = bottomZoneHeight;
  }, [bottomZoneHeight]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const threshold = 50;

    if (Math.abs(deltaY) > threshold) {
      haptic('light');
      if (deltaY > 0) {
        // Swiped up - expand
        expandMobileBottomZone();
      } else {
        // Swiped down - collapse
        collapseMobileBottomZone();
      }
    }
  }, [expandMobileBottomZone, collapseMobileBottomZone]);

  const handleTabClick = useCallback((tab: BottomZoneTab) => {
    haptic('light');
    setMobileBottomZoneTab(tab);
  }, [setMobileBottomZoneTab]);

  const handleToggleHeight = useCallback(() => {
    haptic('light');
    if (bottomZoneHeight === 'collapsed') {
      setMobileBottomZoneHeight('half');
    } else {
      setMobileBottomZoneHeight('collapsed');
    }
  }, [bottomZoneHeight, setMobileBottomZoneHeight]);

  const handleDoubleClickToggle = useCallback(() => {
    haptic('medium');
    if (bottomZoneHeight === 'fullscreen') {
      setMobileBottomZoneHeight('half');
    } else {
      setMobileBottomZoneHeight('fullscreen');
    }
  }, [bottomZoneHeight, setMobileBottomZoneHeight]);

  return (
    <div
      className="mobile-bottom-zone"
      data-height={bottomZoneHeight}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toggle bar */}
      <div className="bottom-zone-toggle" onDoubleClick={handleDoubleClickToggle}>
        {/* Drag handle / height toggle */}
        <button
          className="bottom-zone-drag-handle"
          onClick={handleToggleHeight}
          aria-label={bottomZoneHeight === 'collapsed' ? 'Expand' : 'Collapse'}
        >
          {bottomZoneHeight === 'collapsed' ? (
            <ChevronUpIcon size={16} />
          ) : (
            <ChevronDownIcon size={16} />
          )}
        </button>

        {/* Terminal tab */}
        <button
          className={`bottom-zone-toggle-tab terminal ${bottomZoneTab === 'terminal' ? 'active' : ''} ${isTerminalRunning ? 'running' : ''}`}
          onClick={() => handleTabClick('terminal')}
          aria-selected={bottomZoneTab === 'terminal'}
        >
          <TerminalIcon size={18} />
          <span>Terminal</span>
        </button>

        {/* Divider */}
        <div className="bottom-zone-toggle-divider" />

        {/* Chat tab */}
        <button
          className={`bottom-zone-toggle-tab chat ${bottomZoneTab === 'chat' ? 'active' : ''}`}
          onClick={() => handleTabClick('chat')}
          aria-selected={bottomZoneTab === 'chat'}
        >
          <ChatIcon size={18} />
          <span>Chat</span>
          {chatUnreadCount > 0 && (
            <span className="bottom-zone-unread-badge">{chatUnreadCount}</span>
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="bottom-zone-content">
        {/* Terminal content */}
        <div
          className={`bottom-zone-pane terminal ${bottomZoneTab === 'terminal' ? 'active' : ''}`}
          aria-hidden={bottomZoneTab !== 'terminal'}
        >
          {terminalContent}
        </div>

        {/* Chat content */}
        <div
          className={`bottom-zone-pane chat ${bottomZoneTab === 'chat' ? 'active' : ''}`}
          aria-hidden={bottomZoneTab !== 'chat'}
        >
          {chatContent}
        </div>
      </div>
    </div>
  );
}
