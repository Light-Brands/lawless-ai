'use client';

import { useState } from 'react';

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
  </svg>
);

export interface BrandContext {
  websiteUrl?: string;
  websiteSummary?: string;
  brandColors?: string[];
  brandFonts?: string[];
  tagline?: string;
  description?: string;
  additionalNotes?: string;
}

interface ContextPanelProps {
  context: BrandContext;
  onContextChange: (context: BrandContext) => void;
  onAnalyze: () => void;
  analyzing?: boolean;
}

export function ContextPanel({ context, onContextChange, onAnalyze, analyzing }: ContextPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const updateContext = (updates: Partial<BrandContext>) => {
    onContextChange({ ...context, ...updates });
  };

  const hasContext = context.websiteSummary || context.additionalNotes;

  return (
    <div className="context-panel">
      <button
        className="context-panel-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="context-panel-title">
          <GlobeIcon />
          <span>Brand Context</span>
          {hasContext && <span className="context-panel-badge">Active</span>}
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded && (
        <div className="context-panel-content">
          {/* Website URL Input */}
          <div className="context-field">
            <label className="context-label">Website URL</label>
            <div className="context-url-row">
              <input
                type="url"
                className="context-input"
                placeholder="https://yourbrand.com"
                value={context.websiteUrl || ''}
                onChange={(e) => updateContext({ websiteUrl: e.target.value })}
              />
              <button
                className="context-analyze-btn"
                onClick={onAnalyze}
                disabled={!context.websiteUrl || analyzing}
                title="Analyze website for brand context"
              >
                {analyzing ? (
                  <div className="context-spinner" />
                ) : (
                  <SparklesIcon />
                )}
              </button>
            </div>
            <p className="context-help">Enter your website to automatically extract brand details</p>
          </div>

          {/* Website Analysis Results */}
          {context.websiteSummary && (
            <div className="context-field">
              <label className="context-label">Website Analysis</label>
              <div className="context-summary">
                {context.websiteSummary}
              </div>
            </div>
          )}

          {/* Extracted Brand Colors */}
          {context.brandColors && context.brandColors.length > 0 && (
            <div className="context-field">
              <label className="context-label">Brand Colors</label>
              <div className="context-colors">
                {context.brandColors.map((color, i) => (
                  <div
                    key={i}
                    className="context-color-swatch"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tagline */}
          {context.tagline && (
            <div className="context-field">
              <label className="context-label">Tagline</label>
              <div className="context-tagline">"{context.tagline}"</div>
            </div>
          )}

          {/* Additional Notes */}
          <div className="context-field">
            <label className="context-label">Additional Context</label>
            <textarea
              className="context-textarea"
              placeholder="Add any additional details about your brand, target audience, goals, existing materials..."
              value={context.additionalNotes || ''}
              onChange={(e) => updateContext({ additionalNotes: e.target.value })}
              rows={4}
            />
          </div>
        </div>
      )}
    </div>
  );
}
