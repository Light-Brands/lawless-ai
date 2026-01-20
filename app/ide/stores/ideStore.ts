import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Session {
  id: string;
  user_id: string;
  repo: string;
  branch: string;
  worktree_path: string;
  port: number;
  created_at: Date;
  expires_at: Date;
  notes: string;
  state: {
    pane_order: number[];
    pane_visibility: Record<number, boolean>;
    pane_widths: Record<number, number>;
    active_file: string | null;
    open_files: string[];
    split_view: boolean;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: any[];
}

interface IDEStore {
  // Sessions
  activeSession: Session | null;
  sessions: Session[];
  setActiveSession: (session: Session | null) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;

  // Pane state
  paneOrder: number[];
  paneVisibility: Record<number, boolean>;
  paneWidths: Record<number, number>;
  maxPanesReached: boolean;
  togglePane: (pane: number) => void;
  setPaneVisibility: (pane: number, visible: boolean) => void;
  setPaneWidth: (pane: number, width: number) => void;
  reorderPanes: (order: number[]) => void;
  setMaxPanesReached: (reached: boolean) => void;

  // Chat
  chatMode: 'terminal' | 'workspace';
  setChatMode: (mode: 'terminal' | 'workspace') => void;
  terminalMessages: Message[];
  workspaceMessages: Message[];
  addMessage: (mode: 'terminal' | 'workspace', message: Omit<Message, 'id' | 'timestamp'>) => void;

  // Editor
  activeFile: string | null;
  openFiles: string[];
  unsavedFiles: Set<string>;
  setActiveFile: (path: string | null) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  markFileUnsaved: (path: string) => void;
  markFileSaved: (path: string) => void;
  splitView: boolean;
  setSplitView: (enabled: boolean) => void;
  fileTreeCollapsed: boolean;
  setFileTreeCollapsed: (collapsed: boolean) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Preview
  previewMode: 'local' | 'deployed';
  setPreviewMode: (mode: 'local' | 'deployed') => void;
  serverStatus: 'stopped' | 'starting' | 'running' | 'error';
  setServerStatus: (status: 'stopped' | 'starting' | 'running' | 'error') => void;
  serverPort: number | null;
  setServerPort: (port: number | null) => void;

  // Database
  pendingMigrations: string[];
  setPendingMigrations: (migrations: string[]) => void;
  autoApplyMigrations: boolean;
  setAutoApplyMigrations: (enabled: boolean) => void;

  // Deployments
  deploymentStatus: 'idle' | 'building' | 'ready' | 'failed';
  setDeploymentStatus: (status: 'idle' | 'building' | 'ready' | 'failed') => void;
}

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
      // Sessions
      activeSession: null,
      sessions: [],
      setActiveSession: (session) => set({ activeSession: session }),
      addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
          activeSession: state.activeSession?.id === id ? { ...state.activeSession, ...updates } : state.activeSession,
        })),
      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSession: state.activeSession?.id === id ? null : state.activeSession,
        })),

      // Pane state - default: Chat + Editor + Terminal visible
      paneOrder: [1, 2, 7, 3, 4, 5, 6],
      paneVisibility: { 1: true, 2: true, 3: false, 4: false, 5: false, 6: false, 7: true },
      paneWidths: { 1: 350, 2: 500, 3: 400, 4: 350, 5: 350, 6: 300, 7: 400 },
      maxPanesReached: false,
      togglePane: (pane) =>
        set((state) => {
          const isCurrentlyHidden = !state.paneVisibility[pane];

          // If trying to open a hidden pane, check limit (max 5 visible panes)
          if (isCurrentlyHidden) {
            const visibleCount = Object.values(state.paneVisibility).filter(Boolean).length;
            if (visibleCount >= 5) {
              return { maxPanesReached: true };
            }
          }

          return {
            paneVisibility: { ...state.paneVisibility, [pane]: isCurrentlyHidden },
            maxPanesReached: false,
          };
        }),
      setPaneVisibility: (pane, visible) =>
        set((state) => ({
          paneVisibility: { ...state.paneVisibility, [pane]: visible },
        })),
      setPaneWidth: (pane, width) =>
        set((state) => ({
          paneWidths: { ...state.paneWidths, [pane]: width },
        })),
      reorderPanes: (order) => set({ paneOrder: order }),
      setMaxPanesReached: (reached) => set({ maxPanesReached: reached }),

      // Chat
      chatMode: 'workspace',
      setChatMode: (mode) => set({ chatMode: mode }),
      terminalMessages: [],
      workspaceMessages: [],
      addMessage: (mode, message) => {
        const newMessage: Message = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        if (mode === 'terminal') {
          set((state) => ({ terminalMessages: [...state.terminalMessages, newMessage] }));
        } else {
          set((state) => ({ workspaceMessages: [...state.workspaceMessages, newMessage] }));
        }
      },

      // Editor
      activeFile: null,
      openFiles: [],
      unsavedFiles: new Set(),
      setActiveFile: (path) => set({ activeFile: path }),
      openFile: (path) =>
        set((state) => ({
          openFiles: state.openFiles.includes(path) ? state.openFiles : [...state.openFiles, path],
          activeFile: path,
        })),
      closeFile: (path) =>
        set((state) => {
          const newOpenFiles = state.openFiles.filter((f) => f !== path);
          const newUnsaved = new Set(state.unsavedFiles);
          newUnsaved.delete(path);
          return {
            openFiles: newOpenFiles,
            unsavedFiles: newUnsaved,
            activeFile: state.activeFile === path ? newOpenFiles[newOpenFiles.length - 1] || null : state.activeFile,
          };
        }),
      markFileUnsaved: (path) =>
        set((state) => {
          const newUnsaved = new Set(state.unsavedFiles);
          newUnsaved.add(path);
          return { unsavedFiles: newUnsaved };
        }),
      markFileSaved: (path) =>
        set((state) => {
          const newUnsaved = new Set(state.unsavedFiles);
          newUnsaved.delete(path);
          return { unsavedFiles: newUnsaved };
        }),
      splitView: false,
      setSplitView: (enabled) => set({ splitView: enabled }),
      fileTreeCollapsed: false,
      setFileTreeCollapsed: (collapsed) => set({ fileTreeCollapsed: collapsed }),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // Preview
      previewMode: 'local',
      setPreviewMode: (mode) => set({ previewMode: mode }),
      serverStatus: 'stopped',
      setServerStatus: (status) => set({ serverStatus: status }),
      serverPort: null,
      setServerPort: (port) => set({ serverPort: port }),

      // Database
      pendingMigrations: [],
      setPendingMigrations: (migrations) => set({ pendingMigrations: migrations }),
      autoApplyMigrations: false,
      setAutoApplyMigrations: (enabled) => set({ autoApplyMigrations: enabled }),

      // Deployments
      deploymentStatus: 'idle',
      setDeploymentStatus: (status) => set({ deploymentStatus: status }),
    }),
    {
      name: 'lawless-ide-store',
      partialize: (state) => ({
        paneOrder: state.paneOrder,
        paneVisibility: state.paneVisibility,
        paneWidths: state.paneWidths,
        chatMode: state.chatMode,
        splitView: state.splitView,
        fileTreeCollapsed: state.fileTreeCollapsed,
        previewMode: state.previewMode,
        autoApplyMigrations: state.autoApplyMigrations,
      }),
    }
  )
);
