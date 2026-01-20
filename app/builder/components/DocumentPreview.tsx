'use client';

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import type { BuilderType } from '@/app/types/builder';
import { getSections, generateDocument } from '../lib/documentTemplates';

// Initialize mermaid with dark theme
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

// Configure marked with highlight.js
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Simple hash function for stable IDs
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Custom renderer - mermaid blocks get placeholder, others get syntax highlighting
const renderer = new marked.Renderer();
renderer.code = function(code: string, infostring: string | undefined): string {
  const lang = (infostring || '').toLowerCase().trim();

  // Mermaid blocks get a placeholder div that we'll render client-side
  if (lang === 'mermaid') {
    // Use stable hash-based ID so re-renders don't change the ID
    const id = `mermaid-${simpleHash(code)}`;
    return `<div class="mermaid-placeholder" data-mermaid-id="${id}" data-mermaid-code="${encodeURIComponent(code)}"></div>`;
  }

  // Regular code blocks get syntax highlighting
  const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(code, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

marked.use({ renderer });

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CloudIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

interface DocumentPreviewProps {
  brandName: string;
  builderType: BuilderType;
  sections: Record<string, string>;
  onSave: () => void;
  onCopy: () => void;
  saving?: boolean;
  hasUnsavedChanges?: boolean;
}

export function DocumentPreview({
  brandName,
  builderType,
  sections,
  onSave,
  onCopy,
  saving,
  hasUnsavedChanges = false,
}: DocumentPreviewProps) {
  const sectionConfig = getSections(builderType);
  const title = builderType === 'plan' ? `Project Plan: ${brandName}` : `Brand Identity: ${brandName}`;

  const completedCount = useMemo(() => {
    return sectionConfig.filter((s) => sections[s.id]).length;
  }, [sections, sectionConfig]);

  const hasContent = sections['_raw_content'] || completedCount > 0;

  const handleDownload = () => {
    const markdown = generateDocument(brandName, builderType, sections);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = builderType === 'plan' ? 'project-plan.md' : 'brand-identity.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="builder-preview-panel">
      <div className="builder-preview-header">
        <div className="builder-preview-title-row">
          <span className="builder-preview-title">
            {sections['_raw_content'] ? 'Document Preview' : `Document Preview (${completedCount}/${sectionConfig.length} sections)`}
          </span>
          {hasUnsavedChanges && hasContent && (
            <span className="builder-draft-badge">Draft</span>
          )}
        </div>
        <div className="builder-preview-actions">
          <button
            className="builder-vault-btn"
            onClick={onCopy}
            title="Copy to clipboard"
          >
            <CopyIcon />
          </button>
          <button
            className="builder-vault-btn"
            onClick={handleDownload}
            title="Download markdown"
          >
            <DownloadIcon />
          </button>
        </div>
      </div>

      <div className="builder-preview-content">
        <div className="builder-document">
          <h1>{title}</h1>
          <blockquote>Generated with Lawless AI Builder</blockquote>

          {/* Existing document - show as-is */}
          {sections['_raw_content'] ? (
            <div className="builder-raw-content">
              <MarkdownContent content={sections['_raw_content']} />
            </div>
          ) : (
            /* New document - show template sections */
            sectionConfig.map((section) => (
              <div key={section.id} id={`section-${section.id}`}>
                <h2>{section.title}</h2>
                {sections[section.id] ? (
                  <MarkdownContent content={sections[section.id]} />
                ) : (
                  <div className="builder-section-placeholder">
                    {section.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="builder-save-section">
        {hasUnsavedChanges && hasContent && (
          <p className="builder-save-hint">Changes saved locally. Commit to save permanently.</p>
        )}
        <button
          className="builder-save-btn"
          onClick={onSave}
          disabled={saving || !hasContent}
        >
          <CloudIcon />
          {saving ? 'Committing...' : 'Commit to Brand Factory'}
        </button>
      </div>
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(Math.max(0.25, s * delta), 4));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetView();
    }
  }, [isOpen, resetView]);

  if (!isOpen) return null;

  return (
    <div className="diagram-zoom-overlay" onClick={onClose}>
      <div className="diagram-zoom-container" onClick={e => e.stopPropagation()}>
        <div className="diagram-zoom-toolbar">
          <button onClick={() => setScale(s => Math.min(s * 1.2, 4))} title="Zoom in">+</button>
          <span className="diagram-zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(s * 0.8, 0.25))} title="Zoom out">−</button>
          <button onClick={resetView} title="Reset view">⟲</button>
          <button onClick={onClose} title="Close" className="diagram-zoom-close">✕</button>
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

// Cache for rendered mermaid SVGs to avoid re-rendering
const mermaidCache = new Map<string, string>();

// Markdown rendering with marked + highlight.js + mermaid
function MarkdownContent({ content }: { content: string }) {
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

        // Check if already rendered (placeholder was replaced)
        if (!placeholder.parentNode) continue;

        try {
          let svg: string;

          // Check cache first
          if (mermaidCache.has(id)) {
            svg = mermaidCache.get(id)!;
          } else {
            // Render with mermaid
            const result = await mermaid.render(id, code);
            svg = result.svg;
            mermaidCache.set(id, svg);
          }

          // Double-check placeholder is still in DOM
          if (!placeholder.parentNode) continue;

          // Create wrapper with click-to-zoom
          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-diagram';
          wrapper.innerHTML = svg;
          wrapper.title = 'Click to zoom';
          wrapper.style.cursor = 'pointer';
          wrapper.onclick = () => setZoomDiagram(svg);

          placeholder.replaceWith(wrapper);
        } catch (error) {
          console.error('Mermaid render error:', error);

          // Check placeholder is still in DOM
          if (!placeholder.parentNode) continue;

          // Show error state
          const errorDiv = document.createElement('div');
          errorDiv.className = 'mermaid-error';
          errorDiv.textContent = `Diagram error: ${error instanceof Error ? error.message : 'Failed to render'}`;
          placeholder.replaceWith(errorDiv);
        }
      }
    };

    renderDiagrams();
  }, [html]);

  return (
    <>
      <div
        ref={containerRef}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <DiagramZoomModal
        isOpen={!!zoomDiagram}
        onClose={() => setZoomDiagram(null)}
        svgContent={zoomDiagram || ''}
      />
    </>
  );
}
