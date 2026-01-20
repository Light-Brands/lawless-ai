'use client';

import { useMemo, useEffect, useState } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

// Initialize mermaid with dark theme
let mermaidInitialized = false;
function initMermaid() {
  if (mermaidInitialized || typeof window === 'undefined') return;
  mermaidInitialized = true;
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
    flowchart: { htmlLabels: true, curve: 'basis' },
    securityLevel: 'loose',
  });
}

// Configure marked for non-mermaid code blocks
marked.setOptions({ gfm: true, breaks: true });

const renderer = new marked.Renderer();
renderer.code = function(code: string, infostring: string | undefined): string {
  const lang = (infostring || '').toLowerCase().trim();
  // Skip mermaid - we handle it separately
  if (lang === 'mermaid') return '';
  const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(code, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ renderer });

// Extract mermaid blocks and split content
function parseContent(content: string): Array<{ type: 'markdown' | 'mermaid'; content: string }> {
  const parts: Array<{ type: 'markdown' | 'mermaid'; content: string }> = [];
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = mermaidRegex.exec(content)) !== null) {
    // Add markdown before this mermaid block
    if (match.index > lastIndex) {
      parts.push({ type: 'markdown', content: content.slice(lastIndex, match.index) });
    }
    // Add the mermaid block
    parts.push({ type: 'mermaid', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining markdown
  if (lastIndex < content.length) {
    parts.push({ type: 'markdown', content: content.slice(lastIndex) });
  }

  return parts;
}

// Mermaid diagram component - manages its own rendering
function MermaidDiagram({ code, onDiagramClick }: { code: string; onDiagramClick?: (svg: string) => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initMermaid();
    let cancelled = false;

    const render = async () => {
      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, code);
        if (!cancelled) setSvg(result.svg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render');
      }
    };

    render();
    return () => { cancelled = true; };
  }, [code]);

  const [zoomOpen, setZoomOpen] = useState(false);

  if (error) {
    return <div className="mermaid-error">Diagram error: {error}</div>;
  }

  if (!svg) {
    return <div className="mermaid-loading">Loading diagram...</div>;
  }

  return (
    <>
      <div
        className="mermaid-diagram"
        dangerouslySetInnerHTML={{ __html: svg }}
        onClick={() => onDiagramClick ? onDiagramClick(svg) : setZoomOpen(true)}
        title="Click to zoom"
        style={{ cursor: 'pointer' }}
      />
      {zoomOpen && !onDiagramClick && (
        <DiagramZoomModal isOpen={zoomOpen} onClose={() => setZoomOpen(false)} svgContent={svg} />
      )}
    </>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onDiagramClick?: (svg: string) => void;
}

export function MarkdownRenderer({ content, className = '', onDiagramClick }: MarkdownRendererProps) {
  const parts = useMemo(() => parseContent(content), [content]);

  return (
    <div className={`markdown-body ${className}`}>
      {parts.map((part, i) => {
        if (part.type === 'mermaid') {
          return <MermaidDiagram key={i} code={part.content} onDiagramClick={onDiagramClick} />;
        }
        const html = marked.parse(part.content, { async: false }) as string;
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
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
