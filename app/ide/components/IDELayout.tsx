'use client';

import React, { useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useIDEStore } from '../stores/ideStore';
import { PaneContainer } from './PaneContainer';
import { IDEProvider } from '../contexts/IDEContext';
import {
  ChatIcon,
  CodeIcon,
  GlobeIcon,
  DatabaseIcon,
  RocketIcon,
  ActivityIcon,
  TerminalIcon,
} from './Icons';

// Pane components (lazy loaded)
import dynamic from 'next/dynamic';

const ChatPane = dynamic(() => import('./panes/ChatPane').then((m) => m.ChatPane), {
  loading: () => <PaneSkeleton />,
});

const EditorPane = dynamic(() => import('./panes/EditorPane').then((m) => m.EditorPane), {
  loading: () => <PaneSkeleton />,
});

const PreviewPane = dynamic(() => import('./panes/PreviewPane').then((m) => m.PreviewPane), {
  loading: () => <PaneSkeleton />,
});

const DatabasePane = dynamic(() => import('./panes/DatabasePane').then((m) => m.DatabasePane), {
  loading: () => <PaneSkeleton />,
});

const DeploymentsPane = dynamic(() => import('./panes/DeploymentsPane').then((m) => m.DeploymentsPane), {
  loading: () => <PaneSkeleton />,
});

const ActivityPane = dynamic(() => import('./panes/ActivityPane').then((m) => m.ActivityPane), {
  loading: () => <PaneSkeleton />,
});

const TerminalPane = dynamic(() => import('./panes/TerminalPane').then((m) => m.TerminalPane), {
  loading: () => <PaneSkeleton />,
  ssr: false, // Terminal uses browser-only APIs
});

function PaneSkeleton() {
  return (
    <div className="pane-skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-content">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

const PANE_CONFIG = {
  1: { title: 'AI Chat', icon: <ChatIcon size={16} />, component: ChatPane, defaultSize: 20, minSize: 15 },
  2: { title: 'Editor', icon: <CodeIcon size={16} />, component: EditorPane, defaultSize: 35, minSize: 20 },
  3: { title: 'Preview', icon: <GlobeIcon size={16} />, component: PreviewPane, defaultSize: 25, minSize: 15 },
  4: { title: 'Database', icon: <DatabaseIcon size={16} />, component: DatabasePane, defaultSize: 20, minSize: 15 },
  5: { title: 'Deployments', icon: <RocketIcon size={16} />, component: DeploymentsPane, defaultSize: 20, minSize: 15 },
  6: { title: 'Activity', icon: <ActivityIcon size={16} />, component: ActivityPane, defaultSize: 18, minSize: 12 },
  7: { title: 'Terminal', icon: <TerminalIcon size={16} />, component: TerminalPane, defaultSize: 30, minSize: 15 },
};

interface IDELayoutProps {
  owner?: string;
  repo?: string;
  sessionId?: string | null;
}

export function IDELayout({ owner = '', repo = '', sessionId = null }: IDELayoutProps) {
  const { paneOrder, paneVisibility, togglePane } = useIDEStore();

  // Get visible panes in order
  const visiblePanes = paneOrder.filter((p) => paneVisibility[p]);
  const collapsedPanes = paneOrder.filter((p) => !paneVisibility[p]);

  // Calculate default sizes based on visible panes
  const getDefaultSize = useCallback((paneId: number) => {
    const config = PANE_CONFIG[paneId as keyof typeof PANE_CONFIG];
    const totalDefaultSize = visiblePanes.reduce((sum, p) => {
      return sum + PANE_CONFIG[p as keyof typeof PANE_CONFIG].defaultSize;
    }, 0);
    // Normalize to 100%
    return (config.defaultSize / totalDefaultSize) * 100;
  }, [visiblePanes]);

  return (
    <IDEProvider owner={owner} repo={repo} sessionId={sessionId}>
      <div className="ide-layout">
        {/* Collapsed pane icons */}
        {collapsedPanes.length > 0 && (
          <div className="collapsed-panes">
            {collapsedPanes.map((paneId) => {
              const config = PANE_CONFIG[paneId as keyof typeof PANE_CONFIG];
              return (
                <button
                  key={paneId}
                  className="collapsed-pane-icon"
                  onClick={() => togglePane(paneId)}
                  title={`${config.title} (Cmd+${paneId})`}
                >
                  <span className="pane-icon">{config.icon}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Visible panes with react-resizable-panels */}
        <PanelGroup orientation="horizontal" className="panes-container">
          {visiblePanes.map((paneId, index) => {
            const config = PANE_CONFIG[paneId as keyof typeof PANE_CONFIG];
            const PaneComponent = config.component;

            return (
              <React.Fragment key={paneId}>
                <Panel
                  id={`pane-${paneId}`}
                  defaultSize={`${getDefaultSize(paneId)}%`}
                  minSize={`${config.minSize}%`}
                  className="panel"
                >
                  <PaneContainer
                    id={paneId}
                    title={config.title}
                    icon={config.icon}
                    onCollapse={() => togglePane(paneId)}
                  >
                    <PaneComponent />
                  </PaneContainer>
                </Panel>

                {/* Resize handle between panes */}
                {index < visiblePanes.length - 1 && (
                  <PanelResizeHandle className="resize-handle" />
                )}
              </React.Fragment>
            );
          })}
        </PanelGroup>
      </div>
    </IDEProvider>
  );
}
