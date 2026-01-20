'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
  id: string;
}

interface ViewerState {
  scale: number;
  translateX: number;
  translateY: number;
}

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#7c3aed',
    primaryTextColor: '#e0e0e0',
    primaryBorderColor: '#5b21b6',
    lineColor: '#6b7280',
    secondaryColor: '#1e1e2e',
    tertiaryColor: '#0f0f1a',
    background: '#0a0a14',
    mainBkg: '#1a1a2e',
    secondBkg: '#0f0f1a',
    nodeBorder: '#5b21b6',
    clusterBkg: '#1e1e2e',
    clusterBorder: '#3d3d5c',
    titleColor: '#f4f4f5',
    edgeLabelBackground: '#1a1a2e',
    nodeTextColor: '#e0e0e0',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
});

export function MermaidDiagram({ code, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerState, setViewerState] = useState<ViewerState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Render mermaid diagram
  useEffect(() => {
    const renderDiagram = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}`, code);
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code, id]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 5),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewerState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.2),
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setViewerState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isFullscreen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewerState((prev) => ({
      ...prev,
      scale: Math.max(0.2, Math.min(5, prev.scale * delta)),
    }));
  }, [isFullscreen]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFullscreen) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewerState.translateX, y: e.clientY - viewerState.translateY });
  }, [isFullscreen, viewerState.translateX, viewerState.translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !isFullscreen) return;
    setViewerState((prev) => ({
      ...prev,
      translateX: e.clientX - dragStart.x,
      translateY: e.clientY - dragStart.y,
    }));
  }, [isDragging, isFullscreen, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcuts in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setIsFullscreen(false);
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleResetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleZoomIn, handleZoomOut, handleResetView]);

  // Open fullscreen and reset view
  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setViewerState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  if (error) {
    return (
      <div className="mermaid-error">
        <span className="error-icon">!</span>
        <span>{error}</span>
        <pre className="error-code">{code}</pre>
      </div>
    );
  }

  return (
    <>
      {/* Inline diagram preview */}
      <div className="mermaid-container" ref={containerRef}>
        <div className="mermaid-toolbar">
          <span className="mermaid-label">Diagram</span>
          <button
            className="mermaid-expand-btn"
            onClick={openFullscreen}
            title="Click to expand (or click diagram)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            Expand
          </button>
        </div>
        <div
          className="mermaid-preview"
          onClick={openFullscreen}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="mermaid-fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
          <div
            className="mermaid-fullscreen-container"
            ref={fullscreenRef}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Controls */}
            <div className="mermaid-controls">
              <div className="mermaid-controls-left">
                <button onClick={handleZoomOut} title="Zoom Out (-)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </button>
                <span className="zoom-level">{Math.round(viewerState.scale * 100)}%</span>
                <button onClick={handleZoomIn} title="Zoom In (+)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </button>
                <button onClick={handleResetView} title="Reset View (0)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
              <div className="mermaid-controls-right">
                <span className="controls-hint">Scroll to zoom | Drag to pan | Esc to close</span>
                <button onClick={() => setIsFullscreen(false)} className="close-btn" title="Close (Esc)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Diagram canvas */}
            <div
              className="mermaid-canvas"
              style={{
                transform: `translate(${viewerState.translateX}px, ${viewerState.translateY}px) scale(${viewerState.scale})`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default MermaidDiagram;
