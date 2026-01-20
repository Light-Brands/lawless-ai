'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

// Initialize mermaid with dark theme
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#8b5cf6',
      primaryTextColor: '#f5f5f5',
      primaryBorderColor: '#6d28d9',
      lineColor: '#a78bfa',
      secondaryColor: '#1e1b4b',
      tertiaryColor: '#0f0f23',
      background: '#0a0a0f',
      mainBkg: '#1a1a2e',
      nodeBorder: '#6d28d9',
      clusterBkg: '#1e1b4b',
      titleColor: '#f5f5f5',
      edgeLabelBackground: '#1a1a2e',
    },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
    },
    securityLevel: 'loose',
  });
}

// Simple hash function for stable IDs
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Configure marked with highlight.js
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Custom renderer
const renderer = new marked.Renderer();
renderer.code = function(code: string, infostring: string | undefined): string {
  const lang = (infostring || '').toLowerCase().trim();

  if (lang === 'mermaid') {
    const id = `mermaid-${simpleHash(code)}`;
    return `<div class="mermaid-placeholder" data-mermaid-id="${id}" data-mermaid-code="${encodeURIComponent(code)}"></div>`;
  }

  const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(code, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

marked.use({ renderer });

// Cache for rendered mermaid SVGs
const mermaidCache = new Map<string, string>();

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onDiagramClick?: (svg: string) => void;
}

export function MarkdownRenderer({ content, className = '', onDiagramClick }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomDiagram, setZoomDiagram] = useState<string | null>(null);

  const html = useMemo(() => {
    return marked.parse(content, { async: false }) as string;
  }, [content]);

  // Render mermaid diagrams after mount
  useEffect(() => {
    if (!containerRef.current) return;

    const placeholders = containerRef.current.querySelectorAll('.mermaid-placeholder');
    if (placeholders.length === 0) return;

    const renderDiagrams = async () => {
      for (const placeholder of Array.from(placeholders)) {
        const id = placeholder.getAttribute('data-mermaid-id');
        const code = decodeURIComponent(placeholder.getAttribute('data-mermaid-code') || '');

        if (!id || !code) continue;
        if (!placeholder.parentNode) continue;

        try {
          let svg: string;

          if (mermaidCache.has(id)) {
            svg = mermaidCache.get(id)!;
          } else {
            const result = await mermaid.render(id, code);
            svg = result.svg;
            mermaidCache.set(id, svg);
          }

          if (!placeholder.parentNode) continue;

          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-diagram';
          wrapper.innerHTML = svg;
          wrapper.title = 'Click to zoom';
          wrapper.style.cursor = 'pointer';
          wrapper.onclick = () => {
            if (onDiagramClick) {
              onDiagramClick(svg);
            } else {
              setZoomDiagram(svg);
            }
          };

          placeholder.replaceWith(wrapper);
        } catch (error) {
          console.error('Mermaid render error:', error);
          if (!placeholder.parentNode) continue;

          const errorDiv = document.createElement('div');
          errorDiv.className = 'mermaid-error';
          errorDiv.textContent = `Diagram error: ${error instanceof Error ? error.message : 'Failed to render'}`;
          placeholder.replaceWith(errorDiv);
        }
      }
    };

    renderDiagrams();
  }, [html, onDiagramClick]);

  return (
    <>
      <div
        ref={containerRef}
        className={`markdown-body ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {zoomDiagram && !onDiagramClick && (
        <DiagramZoomModal
          isOpen={!!zoomDiagram}
          onClose={() => setZoomDiagram(null)}
          svgContent={zoomDiagram}
        />
      )}
    </>
  );
}

// Zoom modal for diagrams
function DiagramZoomModal({
  isOpen,
  onClose,
  svgContent
}: {
  isOpen: boolean;
  onClose: () => void;
  svgContent: string;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(Math.max(0.25, s * delta), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!isOpen) {
      resetView();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="diagram-zoom-overlay" onClick={onClose}>
      <div className="diagram-zoom-container" onClick={e => e.stopPropagation()}>
        <div className="diagram-zoom-toolbar">
          <button onClick={() => setScale(s => Math.min(s * 1.2, 4))} title="Zoom in">+</button>
          <span className="diagram-zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(s * 0.8, 0.25))} title="Zoom out">-</button>
          <button onClick={resetView} title="Reset view">Reset</button>
          <button onClick={onClose} title="Close" className="diagram-zoom-close">X</button>
        </div>
        <div
          className="diagram-zoom-viewport"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="diagram-zoom-content"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
    </div>
  );
}
