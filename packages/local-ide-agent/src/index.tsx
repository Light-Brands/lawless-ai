// Local IDE Agent - Main entry point
// This package provides the Claude drawer and element inspector for local development

import React from 'react';

export { ClaudeDrawer } from '../.lawless/ide/src/components/ChatDrawer';
export { ElementInspector } from '../.lawless/ide/src/components/ElementInspector';
export { useIDEStore } from '../.lawless/ide/src/stores/ideStore';
export { useChat } from '../.lawless/ide/src/lib/useChat';

// Re-export types
export type { } from '../.lawless/ide/src/stores/ideStore';

/**
 * LawlessIDEProvider - Wrapper component for the Local IDE Agent
 *
 * Usage in your app's layout.tsx:
 *
 * ```tsx
 * import { LawlessIDEProvider } from '@lawless-ai/local-ide-agent';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         {process.env.NODE_ENV === 'development' && <LawlessIDEProvider />}
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function LawlessIDEProvider() {
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Dynamic import to avoid including in production bundles
  const { ClaudeDrawer } = require('../.lawless/ide/src/components/ChatDrawer');
  const { ElementInspector } = require('../.lawless/ide/src/components/ElementInspector');

  return (
    <>
      <ElementInspector />
      <ClaudeDrawer />
    </>
  );
}
