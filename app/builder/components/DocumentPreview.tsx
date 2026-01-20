'use client';

import { useMemo } from 'react';
import type { BuilderType } from '@/app/types/builder';
import { getSections, generateDocument } from '../lib/documentTemplates';

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

interface DocumentPreviewProps {
  brandName: string;
  builderType: BuilderType;
  sections: Record<string, string>;
  onSave: () => void;
  onCopy: () => void;
  saving?: boolean;
}

export function DocumentPreview({
  brandName,
  builderType,
  sections,
  onSave,
  onCopy,
  saving,
}: DocumentPreviewProps) {
  const sectionConfig = getSections(builderType);
  const title = builderType === 'plan' ? `Project Plan: ${brandName}` : `Brand Identity: ${brandName}`;

  const completedCount = useMemo(() => {
    return sectionConfig.filter((s) => sections[s.id]).length;
  }, [sections, sectionConfig]);

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
        <span className="builder-preview-title">
          Document Preview ({completedCount}/{sectionConfig.length} sections)
        </span>
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

          {sectionConfig.map((section) => (
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
          ))}
        </div>
      </div>

      <div className="builder-save-section">
        <button
          className="builder-save-btn"
          onClick={onSave}
          disabled={saving || completedCount === 0}
        >
          {saving ? 'Saving...' : 'Save to Brand Factory'}
        </button>
      </div>
    </div>
  );
}

// Simple markdown rendering for preview
function MarkdownContent({ content }: { content: string }) {
  // Basic markdown to HTML conversion
  const html = useMemo(() => {
    let result = content;

    // Headers (h3 only since h1/h2 are already used)
    result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');

    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Bullet lists
    result = result.replace(/^- (.+)$/gm, '<li>$1</li>');
    result = result.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Tables (basic)
    const tableRegex = /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g;
    result = result.replace(tableRegex, (match, header, body) => {
      const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map((row: string) => {
        const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    // Paragraphs (wrap remaining text)
    result = result.replace(/^(?!<[a-z])(.*[^\n])$/gm, '<p>$1</p>');

    // Clean up extra line breaks
    result = result.replace(/<\/p>\n+<p>/g, '</p><p>');

    return result;
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
