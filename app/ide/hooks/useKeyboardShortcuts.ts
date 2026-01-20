import { useEffect } from 'react';
import { useIDEStore } from '../stores/ideStore';

/**
 * Keyboard shortcuts for the IDE
 *
 * Cmd+1-6: Toggle panes
 * Cmd+Shift+P: Command palette
 * Cmd+Shift+N: New session
 * Cmd+Shift+F: Search across files
 * Cmd+S: Save current file
 * Cmd+Enter: Send message (when in chat)
 */
export function useKeyboardShortcuts() {
  const { togglePane, setCommandPaletteOpen, commandPaletteOpen } = useIDEStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+Shift+P: Command palette
      if (cmdKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        return;
      }

      // Cmd+1-6: Toggle panes
      if (cmdKey && !e.shiftKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const pane = parseInt(e.key);
        togglePane(pane);
        return;
      }

      // Cmd+Shift+N: New session
      if (cmdKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        // Open session creation modal
        document.dispatchEvent(new CustomEvent('ide:new-session'));
        return;
      }

      // Cmd+Shift+F: Search across files
      if (cmdKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('ide:search-files'));
        return;
      }

      // Cmd+S: Save current file
      if (cmdKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('ide:save-file'));
        return;
      }

      // Escape: Close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePane, setCommandPaletteOpen, commandPaletteOpen]);
}
