import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
  version: string;
  status: 'applied' | 'pending';
  appliedAt?: string;
}

export interface MigrationsSummary {
  total: number;
  applied: number;
  pending: number;
}

export interface MigrationRunResult {
  version: string;
  success: boolean;
  message: string;
  error?: string;
  alreadyApplied?: boolean;
  timestamp: number;
}

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

// Terminal tab with isolated worktree
export interface TerminalTab {
  tabId: string;
  name: string;
  index: number;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
}

// Port information for dev servers
export interface PortInfo {
  port: number;
  detectedAt: Date;
  source: 'terminal' | 'scan';
  label?: string;  // "Next.js", "Vite", etc.
  tabId?: string;  // Which terminal detected it
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

  // Multi-port preview (for detecting multiple dev servers)
  activePorts: Record<number, PortInfo>;
  selectedPort: number | null;
  addPort: (port: number, source: 'terminal' | 'scan', label?: string, tabId?: string) => void;
  removePort: (port: number) => void;
  setSelectedPort: (port: number | null) => void;
  syncPortsFromScan: (ports: number[]) => void;

  // Terminal tabs
  terminalTabs: TerminalTab[];
  activeTabId: string | null;
  addTerminalTab: (tab: TerminalTab) => void;
  removeTerminalTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTerminalTabs: (tabs: TerminalTab[]) => void;

  // Database
  pendingMigrations: string[];
  setPendingMigrations: (migrations: string[]) => void;
  autoApplyMigrations: boolean;
  setAutoApplyMigrations: (enabled: boolean) => void;

  // Migrations
  migrations: MigrationFile[];
  migrationsLoading: boolean;
  migrationsSummary: MigrationsSummary | null;
  migrationRunResults: Record<string, MigrationRunResult>;
  setMigrations: (migrations: MigrationFile[], summary: MigrationsSummary) => void;
  setMigrationsLoading: (loading: boolean) => void;
  setMigrationRunResult: (result: MigrationRunResult) => void;
  clearMigrationRunResult: (version: string) => void;

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

      // Multi-port preview
      activePorts: {},
      selectedPort: null,
      addPort: (port, source, label, tabId) => set((state) => {
        const existing = state.activePorts[port];
        // Terminal detection takes precedence over scan detection
        if (existing && source === 'scan' && existing.source === 'terminal') {
          return state;
        }
        return {
          activePorts: {
            ...state.activePorts,
            [port]: { port, detectedAt: new Date(), source, label, tabId },
          },
          // Auto-select first port if none selected
          selectedPort: state.selectedPort ?? port,
        };
      }),
      removePort: (port) => set((state) => {
        const { [port]: _, ...rest } = state.activePorts;
        const newSelected = state.selectedPort === port
          ? (Object.keys(rest).length > 0 ? parseInt(Object.keys(rest)[0]) : null)
          : state.selectedPort;
        return { activePorts: rest, selectedPort: newSelected };
      }),
      setSelectedPort: (port) => set({ selectedPort: port }),
      syncPortsFromScan: (ports) => set((state) => {
        const portSet = new Set(ports);
        const newPorts = { ...state.activePorts };

        // Remove scan-detected ports that are no longer active
        for (const [p, info] of Object.entries(newPorts)) {
          if (info.source === 'scan' && !portSet.has(parseInt(p))) {
            delete newPorts[parseInt(p)];
          }
        }

        // Add newly discovered ports
        for (const port of ports) {
          if (!newPorts[port]) {
            newPorts[port] = { port, detectedAt: new Date(), source: 'scan' };
          }
        }

        // Update selected port if current selection is gone
        const newSelected = state.selectedPort && newPorts[state.selectedPort]
          ? state.selectedPort
          : (Object.keys(newPorts).length > 0 ? parseInt(Object.keys(newPorts)[0]) : null);

        return { activePorts: newPorts, selectedPort: newSelected };
      }),

      // Terminal tabs
      terminalTabs: [],
      activeTabId: null,
      addTerminalTab: (tab) => set((state) => ({
        terminalTabs: [...state.terminalTabs, tab].sort((a, b) => a.index - b.index),
        activeTabId: state.activeTabId ?? tab.tabId,
      })),
      removeTerminalTab: (tabId) => set((state) => {
        const newTabs = state.terminalTabs.filter(t => t.tabId !== tabId);
        const newActiveTabId = state.activeTabId === tabId
          ? (newTabs[0]?.tabId ?? null)
          : state.activeTabId;
        return { terminalTabs: newTabs, activeTabId: newActiveTabId };
      }),
      setActiveTab: (tabId) => set({ activeTabId: tabId }),
      setTerminalTabs: (tabs) => set({ terminalTabs: tabs }),

      // Database
      pendingMigrations: [],
      setPendingMigrations: (migrations) => set({ pendingMigrations: migrations }),
      autoApplyMigrations: false,
      setAutoApplyMigrations: (enabled) => set({ autoApplyMigrations: enabled }),

      // Migrations
      migrations: [],
      migrationsLoading: false,
      migrationsSummary: null,
      migrationRunResults: {},
      setMigrations: (migrations, summary) =>
        set({
          migrations,
          migrationsSummary: summary,
          pendingMigrations: migrations.filter((m) => m.status === 'pending').map((m) => m.name),
        }),
      setMigrationsLoading: (loading) => set({ migrationsLoading: loading }),
      setMigrationRunResult: (result) =>
        set((state) => ({
          migrationRunResults: {
            ...state.migrationRunResults,
            [result.version]: result,
          },
        })),
      clearMigrationRunResult: (version) =>
        set((state) => {
          const { [version]: _, ...rest } = state.migrationRunResults;
          return { migrationRunResults: rest };
        }),

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
