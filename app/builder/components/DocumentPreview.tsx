'use client';

import React, { useMemo } from 'react';
import type { BuilderType } from '@/app/types/builder';
import { getSections, generateDocument } from '../lib/documentTemplates';
import { MarkdownRenderer } from '@/app/components/MarkdownRenderer';

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
              <MarkdownRenderer content={sections['_raw_content']} />
            </div>
          ) : (
            /* New document - show template sections */
            sectionConfig.map((section) => (
              <div key={section.id} id={`section-${section.id}`}>
                <h2>{section.title}</h2>
                {sections[section.id] ? (
                  <MarkdownRenderer content={sections[section.id]} />
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
