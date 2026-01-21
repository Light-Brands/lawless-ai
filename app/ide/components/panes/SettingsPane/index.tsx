'use client';

import React from 'react';
import { useIDEStore } from '../../../stores/ideStore';
import { useMobileDetection } from '../../../hooks/useMobileDetection';

export function SettingsPane() {
  const { settings, updateSettings } = useIDEStore();
  const isMobile = useMobileDetection();

  const handleToggle = (key: keyof typeof settings) => {
    if (typeof settings[key] === 'boolean') {
      updateSettings({ [key]: !settings[key] });
      // Haptic feedback on toggle
      if (settings.hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  };

  const handleSlider = (key: 'editorFontSize' | 'terminalFontSize', value: number) => {
    updateSettings({ [key]: value });
  };

  return (
    <div className="settings-pane">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Customize your IDE experience</p>
      </div>

      <div className="settings-content">
        {/* Editor Settings */}
        <section className="settings-section">
          <h3>Editor</h3>

          <div className="setting-item">
            <div className="setting-info">
              <label>Font Size</label>
              <span className="setting-value">{settings.editorFontSize}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="24"
              value={settings.editorFontSize}
              onChange={(e) => handleSlider('editorFontSize', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Auto Save</label>
              <span className="setting-description">Automatically save files on change</span>
            </div>
            <button
              className={`setting-toggle ${settings.autoSave ? 'active' : ''}`}
              onClick={() => handleToggle('autoSave')}
              role="switch"
              aria-checked={settings.autoSave}
            >
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </button>
          </div>
        </section>

        {/* Terminal Settings */}
        <section className="settings-section">
          <h3>Terminal</h3>

          <div className="setting-item">
            <div className="setting-info">
              <label>Font Size</label>
              <span className="setting-value">{settings.terminalFontSize}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="20"
              value={settings.terminalFontSize}
              onChange={(e) => handleSlider('terminalFontSize', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>
        </section>

        {/* Accessibility Settings */}
        <section className="settings-section">
          <h3>Accessibility</h3>

          <div className="setting-item">
            <div className="setting-info">
              <label>Haptic Feedback</label>
              <span className="setting-description">Vibration on interactions</span>
            </div>
            <button
              className={`setting-toggle ${settings.hapticFeedback ? 'active' : ''}`}
              onClick={() => handleToggle('hapticFeedback')}
              role="switch"
              aria-checked={settings.hapticFeedback}
            >
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </button>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Reduced Motion</label>
              <span className="setting-description">Minimize animations</span>
            </div>
            <button
              className={`setting-toggle ${settings.reducedMotion ? 'active' : ''}`}
              onClick={() => handleToggle('reducedMotion')}
              role="switch"
              aria-checked={settings.reducedMotion}
            >
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section about">
          <h3>About</h3>
          <div className="about-content">
            <p><strong>Lawless AI IDE</strong></p>
            <p className="version">Mobile Two-Zone Layout</p>
            <p className="description">
              A mobile-first development environment for building and deploying applications.
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        .settings-pane {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0d0d0f;
          overflow: hidden;
        }

        .settings-header {
          padding: 16px;
          border-bottom: 1px solid #1a1a1f;
          flex-shrink: 0;
        }

        .settings-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #e0e0e0;
          margin: 0 0 4px;
        }

        .settings-header p {
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .settings-content {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 8px 0;
        }

        .settings-section {
          padding: 16px;
          border-bottom: 1px solid #1a1a1f;
        }

        .settings-section:last-child {
          border-bottom: none;
        }

        .settings-section h3 {
          font-size: 12px;
          font-weight: 600;
          color: #7c3aed;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 0;
        }

        .setting-item:first-of-type {
          padding-top: 0;
        }

        .setting-item:last-of-type {
          padding-bottom: 0;
        }

        .setting-info {
          flex: 1;
          min-width: 0;
        }

        .setting-info label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #e0e0e0;
          margin-bottom: 2px;
        }

        .setting-description {
          display: block;
          font-size: 12px;
          color: #666;
        }

        .setting-value {
          display: block;
          font-size: 12px;
          color: #7c3aed;
          font-weight: 500;
        }

        .setting-slider {
          width: 100px;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: #2d2d44;
          border-radius: 2px;
          outline: none;
        }

        .setting-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #7c3aed;
          border-radius: 50%;
          cursor: pointer;
        }

        .setting-toggle {
          width: 48px;
          height: 28px;
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
          flex-shrink: 0;
        }

        .toggle-track {
          display: block;
          width: 100%;
          height: 100%;
          background: #2d2d44;
          border-radius: 14px;
          position: relative;
          transition: background 0.2s;
        }

        .setting-toggle.active .toggle-track {
          background: #7c3aed;
        }

        .toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .setting-toggle.active .toggle-thumb {
          transform: translateX(20px);
        }

        .about-content {
          color: #888;
          font-size: 13px;
        }

        .about-content p {
          margin: 0 0 8px;
        }

        .about-content .version {
          color: #7c3aed;
          font-size: 12px;
        }

        .about-content .description {
          color: #666;
          line-height: 1.5;
        }

        @media (max-width: 767px) {
          .settings-header {
            padding: 12px 16px;
          }

          .settings-section {
            padding: 12px 16px;
          }

          .setting-slider {
            width: 80px;
          }
        }
      `}</style>
    </div>
  );
}
