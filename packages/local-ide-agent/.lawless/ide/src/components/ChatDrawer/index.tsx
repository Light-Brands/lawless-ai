'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useIDEStore } from '../../stores/ideStore';
import { useChat } from '../../lib/useChat';
import styles from './ChatDrawer.module.css';

interface SelectedElement {
  tagName: string;
  componentName?: string;
  filePath?: string;
  lineNumber?: number;
}

export function ClaudeDrawer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const { messages, input, setInput, sendMessage, isLoading } = useChat();

  // Handle resize drag
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = drawerHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 100, dragStartHeight.current + delta));
      setDrawerHeight(newHeight);
      if (newHeight > 150) {
        setIsExpanded(true);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Listen for element selection from inspector
  useEffect(() => {
    const handleElementSelected = (e: CustomEvent<SelectedElement>) => {
      setSelectedElement(e.detail);
      setIsExpanded(true);
    };

    window.addEventListener('lawless:element-selected' as any, handleElementSelected);
    return () => {
      window.removeEventListener('lawless:element-selected' as any, handleElementSelected);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Include selected element context if available
    const contextPrefix = selectedElement
      ? `[Context: Selected element <${selectedElement.componentName || selectedElement.tagName}> at ${selectedElement.filePath}:${selectedElement.lineNumber}]\n\n`
      : '';

    sendMessage(contextPrefix + input);
    setInput('');
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setDrawerHeight(300);
    }
  };

  return (
    <div
      ref={drawerRef}
      className={`${styles.drawer} ${isExpanded ? styles.expanded : styles.collapsed}`}
      style={{ height: isExpanded ? drawerHeight : 48 }}
    >
      {/* Drag handle */}
      <div className={styles.dragHandle} onMouseDown={handleDragStart}>
        <div className={styles.handleBar} />
      </div>

      {/* Header */}
      <div className={styles.header} onClick={toggleExpand}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>Claude</span>
          {selectedElement && (
            <span className={styles.selectedElement}>
              Selected: &lt;{selectedElement.componentName || selectedElement.tagName}&gt;
              {selectedElement.filePath && ` - ${selectedElement.filePath}:${selectedElement.lineNumber}`}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.expandHint}>
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
          <div className={styles.statusDots}>
            <span className={styles.dot} title="Claude" />
            <span className={styles.dot} title="GitHub" />
            <span className={styles.dot} title="Supabase" />
            <span className={styles.dot} title="Vercel" />
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={styles.content}>
          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                {selectedElement ? (
                  <p>
                    I see you've selected the <strong>{selectedElement.componentName || selectedElement.tagName}</strong> element.
                    What would you like me to change?
                  </p>
                ) : (
                  <p>
                    Click any element on the page to select it, or just describe what you'd like to build.
                  </p>
                )}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
                  <div className={styles.messageContent}>{msg.content}</div>
                </div>
              ))
            )}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form className={styles.inputForm} onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedElement ? `Describe changes to ${selectedElement.componentName || selectedElement.tagName}...` : 'Describe what you want to build...'}
              className={styles.input}
              disabled={isLoading}
            />
            <button type="submit" className={styles.sendButton} disabled={isLoading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ClaudeDrawer;
