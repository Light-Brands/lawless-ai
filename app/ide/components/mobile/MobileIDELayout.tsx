'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomZone } from './MobileBottomZone';
import { IDEProvider } from '../../contexts/IDEContext';
import dynamic from 'next/dynamic';

// Main pane components (lazy loaded)
const PreviewPane = dynamic(() => import('../panes/PreviewPane').then((m) => m.PreviewPane), {
  loading: () => <MobilePaneSkeleton />,
});

const EditorPane = dynamic(() => import('../panes/EditorPane').then((m) => m.EditorPane), {
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

const SettingsPane = dynamic(() => import('../panes/SettingsPane').then((m) => m.SettingsPane), {
  loading: () => <MobilePaneSkeleton />,
});

// Bottom zone components (lazy loaded)
const TerminalPane = dynamic(() => import('../panes/TerminalPane').then((m) => m.TerminalPane), {
  loading: () => <MobilePaneSkeleton />,
  ssr: false,
});

const ChatPane = dynamic(() => import('../panes/ChatPane').then((m) => m.ChatPane), {
  loading: () => <MobilePaneSkeleton />,
});

// Main pane component mapping
type MainPaneId = 'preview' | 'editor' | 'database' | 'deployments' | 'activity' | 'settings';

const MAIN_PANE_COMPONENTS: Record<MainPaneId, React.ComponentType> = {
  preview: PreviewPane,
  editor: EditorPane,
  database: DatabasePane,
  deployments: DeploymentsPane,
  activity: ActivityPane,
  settings: SettingsPane,
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
  const { mobile, setMobileMainPane } = useIDEStore();
  const { mainPane, bottomZoneHeight } = mobile;

  const repoFullName = owner && repo ? `${owner}/${repo}` : '';

  // Swipe handling for main pane navigation
  const touchStartX = useRef(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const mainPaneOrder: MainPaneId[] = ['preview', 'editor', 'database', 'deployments', 'activity', 'settings'];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(false);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 80;

    if (Math.abs(deltaX) > threshold) {
      const currentIndex = mainPaneOrder.indexOf(mainPane);

      if (deltaX > 0 && currentIndex > 0) {
        // Swiped right - previous pane
        setMobileMainPane(mainPaneOrder[currentIndex - 1]);
        if ('vibrate' in navigator) navigator.vibrate(10);
      } else if (deltaX < 0 && currentIndex < mainPaneOrder.length - 1) {
        // Swiped left - next pane
        setMobileMainPane(mainPaneOrder[currentIndex + 1]);
        if ('vibrate' in navigator) navigator.vibrate(10);
      }
    }

    setIsSwiping(false);
  }, [mainPane, mainPaneOrder, setMobileMainPane]);

  // Get the active main pane component
  const MainPaneComponent = MAIN_PANE_COMPONENTS[mainPane];

  return (
    <IDEProvider owner={owner} repo={repo} sessionId={sessionId}>
      <div className="mobile-ide-layout" data-bottom-zone-height={bottomZoneHeight}>
        {/* Mobile header */}
        <MobileHeader
          repoFullName={repoFullName}
          branchName={branchName}
        />

        {/* Main pane area (Preview, Editor, Database, etc.) */}
        <div
          className="mobile-main-pane"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <MainPaneComponent />
        </div>

        {/* Bottom zone (Terminal + Chat toggle) */}
        <MobileBottomZone
          terminalContent={<TerminalPane />}
          chatContent={<ChatPane />}
        />

        {/* Bottom navigation (controls main pane only) */}
        <MobileBottomNav />
      </div>
    </IDEProvider>
  );
}
