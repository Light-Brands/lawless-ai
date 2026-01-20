'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { createPortal } from 'react-dom';
import { useIDEStore } from '../stores/ideStore';
import { PaneContainer } from './PaneContainer';
import { IDEProvider } from '../contexts/IDEContext';
import { useServiceContext } from '../contexts/ServiceContext';
import {
  ChatIcon,
  CodeIcon,
  GlobeIcon,
  DatabaseIcon,
  RocketIcon,
  ActivityIcon,
  TerminalIcon,
} from './Icons';
import { useToast } from '../../components/Toast';

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

// Context for pane content portals
const PanePortalContext = React.createContext<{
  registerTarget: (paneId: number, element: HTMLDivElement | null) => void;
  targets: Record<number, HTMLDivElement | null>;
}>({
  registerTarget: () => {},
  targets: {},
});

// Component that renders pane content and portals it to the target when visible
function PaneContentPortal({
  paneId,
  isVisible,
  children,
}: {
  paneId: number;
  isVisible: boolean;
  children: React.ReactNode;
}) {
  const { targets } = React.useContext(PanePortalContext);
  const target = targets[paneId];

  // When visible and target exists, portal to the target
  if (isVisible && target) {
    return createPortal(children, target);
  }

  // When hidden, render in place (hidden container)
  return <>{children}</>;
}

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

// External link icon component
const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const PANE_CONFIG = {
  1: { title: 'AI Chat', icon: <ChatIcon size={16} />, component: ChatPane, defaultSize: 20, minSize: 15, externalLinkType: null },
  2: { title: 'Editor', icon: <CodeIcon size={16} />, component: EditorPane, defaultSize: 35, minSize: 20, externalLinkType: 'github' as const },
  3: { title: 'Preview', icon: <GlobeIcon size={16} />, component: PreviewPane, defaultSize: 25, minSize: 15, externalLinkType: null },
  4: { title: 'Database', icon: <DatabaseIcon size={16} />, component: DatabasePane, defaultSize: 20, minSize: 15, externalLinkType: 'supabase' as const },
  5: { title: 'Deployments', icon: <RocketIcon size={16} />, component: DeploymentsPane, defaultSize: 20, minSize: 15, externalLinkType: 'vercel' as const },
  6: { title: 'Activity', icon: <ActivityIcon size={16} />, component: ActivityPane, defaultSize: 18, minSize: 12, externalLinkType: null },
  7: { title: 'Terminal', icon: <TerminalIcon size={16} />, component: TerminalPane, defaultSize: 30, minSize: 15, externalLinkType: null },
};

interface IDELayoutProps {
  owner?: string;
  repo?: string;
  sessionId?: string | null;
}

export function IDELayout({ owner = '', repo = '', sessionId = null }: IDELayoutProps) {
  const { paneOrder, paneVisibility, togglePane, maxPanesReached, setMaxPanesReached } = useIDEStore();
  const toast = useToast();

  // Track portal targets for each pane
  const [portalTargets, setPortalTargets] = useState<Record<number, HTMLDivElement | null>>({});

  // Get service context for dynamic external links
  const { vercel, supabase } = useServiceContext();

  // Compute external links dynamically based on current service connections
  const getExternalLink = useCallback((linkType: 'github' | 'vercel' | 'supabase' | null) => {
    if (!linkType) return null;

    switch (linkType) {
      case 'github':
        // Link to exact project codebase
        if (owner && repo) {
          return { url: `https://github.com/${owner}/${repo}`, title: 'Open GitHub Repository' };
        }
        return { url: 'https://github.com', title: 'Open GitHub' };

      case 'vercel':
        // Link to exact project - use projectName (slug) for URL, fall back to projectId
        if (vercel.projectId) {
          const teamPath = vercel.teamId || 'autod3vs-projects';
          const projectSlug = vercel.projectName || vercel.projectId;
          return { url: `https://vercel.com/${teamPath}/${projectSlug}`, title: 'Open Vercel Project' };
        }
        return { url: 'https://vercel.com/autod3vs-projects/~/deployments', title: 'Open Vercel' };

      case 'supabase':
        // Link to exact database table view
        if (supabase.projectRef) {
          return { url: `https://supabase.com/dashboard/project/${supabase.projectRef}/editor`, title: 'Open Supabase Table Editor' };
        }
        return { url: 'https://supabase.com/dashboard', title: 'Open Supabase' };

      default:
        return null;
    }
  }, [owner, repo, vercel.projectId, vercel.projectName, vercel.teamId, supabase.projectRef]);

  const registerTarget = useCallback((paneId: number, element: HTMLDivElement | null) => {
    setPortalTargets((prev) => {
      if (prev[paneId] === element) return prev;
      return { ...prev, [paneId]: element };
    });
  }, []);

  // Show toast when max panes limit is reached
  useEffect(() => {
    if (maxPanesReached) {
      toast.warning('Pane limit reached', 'Close one pane before opening another');
      setMaxPanesReached(false);
    }
  }, [maxPanesReached, setMaxPanesReached, toast]);

  // Get visible and collapsed panes
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
      <PanePortalContext.Provider value={{ registerTarget, targets: portalTargets }}>
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

          {/*
            All pane content is rendered here ONCE in consistent order.
            When visible, content portals to the panel target.
            When collapsed, content stays here but hidden.
            This prevents unmounting/remounting when toggling visibility.
          */}
          <div className="pane-content-holder">
            {paneOrder.map((paneId) => {
              const config = PANE_CONFIG[paneId as keyof typeof PANE_CONFIG];
              const PaneComponent = config.component;
              const isVisible = paneVisibility[paneId];

              return (
                <div
                  key={`content-${paneId}`}
                  className="pane-content-wrapper"
                  style={{ display: isVisible ? 'none' : 'block' }}
                >
                  <PaneContentPortal paneId={paneId} isVisible={isVisible}>
                    <PaneComponent />
                  </PaneContentPortal>
                </div>
              );
            })}
          </div>

          {/* Visible panes with react-resizable-panels */}
          <PanelGroup orientation="horizontal" className="panes-container">
            {visiblePanes.map((paneId, index) => {
              const config = PANE_CONFIG[paneId as keyof typeof PANE_CONFIG];

              return (
                <React.Fragment key={paneId}>
                  <Panel
                    id={`pane-${paneId}`}
                    defaultSize={getDefaultSize(paneId)}
                    minSize={config.minSize}
                    className="panel"
                  >
                    <PaneContainer
                      id={paneId}
                      title={config.title}
                      icon={config.icon}
                      onCollapse={() => togglePane(paneId)}
                      headerActions={(() => {
                        const externalLink = getExternalLink(config.externalLinkType);
                        return externalLink ? (
                          <button
                            className="pane-external-link-btn"
                            onClick={() => window.open(externalLink.url, '_blank')}
                            title={externalLink.title}
                          >
                            <ExternalLinkIcon />
                          </button>
                        ) : undefined;
                      })()}
                    >
                      {/* Portal target - content will be rendered here via portal */}
                      <PanePortalTarget paneId={paneId} />
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
      </PanePortalContext.Provider>
    </IDEProvider>
  );
}

// Component that registers itself as a portal target
function PanePortalTarget({ paneId }: { paneId: number }) {
  const { registerTarget } = React.useContext(PanePortalContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerTarget(paneId, ref.current);
    return () => registerTarget(paneId, null);
  }, [paneId, registerTarget]);

  return <div ref={ref} className="pane-portal-target" />;
}
