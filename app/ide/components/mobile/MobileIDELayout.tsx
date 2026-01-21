'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import { MobileHeader } from './MobileHeader';
import { MobileTabBar } from './MobileTabBar';
import { IDEProvider } from '../../contexts/IDEContext';
import dynamic from 'next/dynamic';

// Pane components (lazy loaded)
const ChatPane = dynamic(() => import('../panes/ChatPane').then((m) => m.ChatPane), {
  loading: () => <MobilePaneSkeleton />,
});

const EditorPane = dynamic(() => import('../panes/EditorPane').then((m) => m.EditorPane), {
  loading: () => <MobilePaneSkeleton />,
});

const PreviewPane = dynamic(() => import('../panes/PreviewPane').then((m) => m.PreviewPane), {
  loading: () => <MobilePaneSkeleton />,
});

const DatabasePane = dynamic(() => import('../panes/DatabasePane').then((m) => m.DatabasePane), {
  loading: () => <MobilePaneSkeleton />,
});

const DeploymentsPane = dynamic(() => import('../panes/DeploymentsPane').then((m) => m.DeploymentsPane), {
  loading: () => <MobilePaneSkeleton />,
});

const ActivityPane = dynamic(() => import('../panes/ActivityPane').then((m) => m.ActivityPane), {
  loading: () => <MobilePaneSkeleton />,
});

const TerminalPane = dynamic(() => import('../panes/TerminalPane').then((m) => m.TerminalPane), {
  loading: () => <MobilePaneSkeleton />,
  ssr: false,
});

// Pane component mapping
const PANE_COMPONENTS: Record<number, React.ComponentType> = {
  1: ChatPane,
  2: EditorPane,
  3: PreviewPane,
  4: DatabasePane,
  5: DeploymentsPane,
  6: ActivityPane,
  7: TerminalPane,
};

function MobilePaneSkeleton() {
  return (
    <div className="mobile-pane-skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-content">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

interface MobileIDELayoutProps {
  owner?: string;
  repo?: string;
  sessionId?: string | null;
  branchName?: string;
}

export function MobileIDELayout({
  owner = '',
  repo = '',
  sessionId = null,
  branchName = 'main',
}: MobileIDELayoutProps) {
  const {
    activeMobilePane,
    mobileTabOrder,
    goToNextMobilePane,
    goToPrevMobilePane,
  } = useIDEStore();

  const repoFullName = owner && repo ? `${owner}/${repo}` : '';

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(false);
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only swipe if horizontal movement > vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      setIsSwiping(true);
      setSwipeOffset(deltaX);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isSwiping) {
      const threshold = 50;

      if (swipeOffset > threshold) {
        // Swiped right - go to previous pane
        goToPrevMobilePane();
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      } else if (swipeOffset < -threshold) {
        // Swiped left - go to next pane
        goToNextMobilePane();
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }
    }

    setIsSwiping(false);
    setSwipeOffset(0);
  }, [isSwiping, swipeOffset, goToNextMobilePane, goToPrevMobilePane]);

  // Get position class for animation
  const getPaneClass = (paneId: number) => {
    const currentIndex = mobileTabOrder.indexOf(activeMobilePane);
    const paneIndex = mobileTabOrder.indexOf(paneId);

    if (paneId === activeMobilePane) return 'active';
    if (paneIndex < currentIndex) return 'prev';
    return 'next';
  };

  return (
    <IDEProvider owner={owner} repo={repo} sessionId={sessionId}>
      <div className="mobile-ide-container">
        {/* Mobile header */}
        <MobileHeader
          repoFullName={repoFullName}
          branchName={branchName}
        />

        {/* Panes container with swipe support */}
        <div
          className="mobile-panes-wrapper"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Render all panes, show only active one */}
          {mobileTabOrder.map((paneId) => {
            const PaneComponent = PANE_COMPONENTS[paneId];
            if (!PaneComponent) return null;

            const positionClass = getPaneClass(paneId);
            const isActive = paneId === activeMobilePane;

            // Apply swipe offset to active pane
            const style: React.CSSProperties = {};
            if (isActive && isSwiping) {
              style.transform = `translateX(${swipeOffset}px)`;
              style.transition = 'none';
            }

            return (
              <div
                key={paneId}
                className={`mobile-pane ${positionClass} ${isSwiping ? 'swiping' : ''}`}
                style={style}
                aria-hidden={!isActive}
              >
                <div className="mobile-pane-content">
                  <PaneComponent />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom tab bar */}
        <MobileTabBar />
      </div>
    </IDEProvider>
  );
}
