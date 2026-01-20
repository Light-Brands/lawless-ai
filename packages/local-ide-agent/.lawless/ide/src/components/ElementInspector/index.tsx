'use client';

import React, { useEffect, useRef } from 'react';
import { useIDEStore } from '../../stores/ideStore';

/**
 * ElementInspector - Enables click-to-select functionality
 *
 * This component:
 * 1. Listens for mouse movements to highlight elements
 * 2. Captures clicks to select elements
 * 3. Extracts React component info when available
 * 4. Dispatches events for the ChatDrawer to consume
 */
export function ElementInspector() {
  const { isInspectorActive, setSelectedElement } = useIDEStore();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const currentElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isInspectorActive) return;

    // Create highlight overlay
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #7c3aed;
      background: rgba(124, 58, 237, 0.1);
      z-index: 9998;
      transition: all 0.1s ease-out;
      display: none;
    `;
    document.body.appendChild(highlight);
    highlightRef.current = highlight;

    // Handle mouse move
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as Element;

      // Ignore elements inside the Claude drawer
      if (target.closest('[data-lawless-drawer]')) {
        highlight.style.display = 'none';
        return;
      }

      // Ignore the highlight itself
      if (target === highlight) return;

      currentElement.current = target;
      const rect = target.getBoundingClientRect();

      highlight.style.display = 'block';
      highlight.style.top = `${rect.top}px`;
      highlight.style.left = `${rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
    };

    // Handle click
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;

      // Ignore elements inside the Claude drawer
      if (target.closest('[data-lawless-drawer]')) return;

      // Prevent default to avoid navigation
      e.preventDefault();
      e.stopPropagation();

      // Extract component info
      const componentInfo = extractComponentInfo(target);

      setSelectedElement(componentInfo);

      // Dispatch custom event for ChatDrawer
      window.dispatchEvent(
        new CustomEvent('lawless:element-selected', {
          detail: componentInfo,
        })
      );
    };

    // Add listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      highlight.remove();
    };
  }, [isInspectorActive, setSelectedElement]);

  return null;
}

/**
 * Extract component info from a DOM element
 * Attempts to find React fiber data for component name and source location
 */
function extractComponentInfo(element: Element) {
  const tagName = element.tagName.toLowerCase();
  let componentName: string | undefined;
  let filePath: string | undefined;
  let lineNumber: number | undefined;

  // Try to get React fiber info (works in development mode)
  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  );

  if (fiberKey) {
    const fiber = (element as any)[fiberKey];

    // Walk up the fiber tree to find a named component
    let current = fiber;
    while (current) {
      if (current.type && typeof current.type === 'function') {
        componentName = current.type.displayName || current.type.name;

        // Try to get source location from _debugSource (React dev mode)
        if (current._debugSource) {
          filePath = current._debugSource.fileName;
          lineNumber = current._debugSource.lineNumber;
        }
        break;
      }
      current = current.return;
    }
  }

  // Fallback: try data attributes
  if (!componentName) {
    componentName = element.getAttribute('data-component') || undefined;
  }
  if (!filePath) {
    filePath = element.getAttribute('data-source-file') || undefined;
  }
  if (!lineNumber) {
    const line = element.getAttribute('data-source-line');
    lineNumber = line ? parseInt(line, 10) : undefined;
  }

  return {
    tagName,
    componentName,
    filePath,
    lineNumber,
    innerHTML: element.innerHTML.slice(0, 200),
  };
}

export default ElementInspector;
