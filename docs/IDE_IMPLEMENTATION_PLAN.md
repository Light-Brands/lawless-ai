# Lawless AI IDE - Implementation Plan

> A state-of-the-art web-based IDE with Claude at its core, featuring 6 collapsible panes for AI chat, file editing, browser preview, database management, deployments, and activity timeline.

## Table of Contents

1. [Vision & Architecture](#vision--architecture)
2. [Technical Architecture](#technical-architecture)
3. [Phase 1: Foundation & Chat](#phase-1-foundation--chat)
4. [Phase 2: File Editor](#phase-2-file-editor)
5. [Phase 3: Browser Preview](#phase-3-browser-preview)
6. [Phase 4: Database & Deployments](#phase-4-database--deployments)
7. [Phase 5: Activity Pane & Polish](#phase-5-activity-pane--polish)
8. [Technical Specifications](#technical-specifications)
9. [Database Schema](#database-schema)
10. [API Endpoints](#api-endpoints)

---

## Vision & Architecture

### Core Concept

A unified IDE experience at `/ide` where all development activities happen in one window:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Header: Session Selector | Repo/Branch | [⌘P] Command Palette | Settings | User │
├─────────┬───────────────┬───────────┬───────────┬─────────────┬─────────────────┤
│         │               │           │           │             │                 │
│ Pane 1  │    Pane 2     │  Pane 3   │  Pane 4   │   Pane 5    │     Pane 6      │
│   AI    │  File Editor  │  Browser  │ Database  │ Deployments │    Activity     │
│  Chat   │   (GitHub)    │  Preview  │ (Supabase)│  (Vercel)   │    Timeline     │
│         │               │           │           │             │                 │
│ [Term]  │ [File Tree]   │ [Local]   │[Migrations│ [Deploy]    │ [Timeline]      │
│ [Work]  │ [CodeMirror]  │ [Deploy]  │ [Query]   │ [Logs]      │ [Filter]        │
│ [Ctx]   │ [Split View]  │ [Status]  │ [Schema]  │ [Env Vars]  │ [Search]        │
│         │ [Diff View]   │           │           │ [Rollback]  │                 │
└─────────┴───────────────┴───────────┴───────────┴─────────────┴─────────────────┘
```

### Key Principles

1. **Session-Driven**: Everything flows from the active session (AI conversation + worktree)
2. **GitHub as Source of Truth**: File editor reflects GitHub branches directly
3. **Worktree Isolation**: Each session operates in its own git worktree
4. **Collapsible Everything**: All 6 panes collapse to icons, resizable, reorderable
5. **Event-Driven Communication**: Panes communicate via event bus, not direct coupling
6. **Optimistic UI**: Actions feel instant, sync in background
7. **Lazy Loading**: Only load pane contents when expanded
8. **Automation with Control**: Auto-run features have explicit enable/disable toggles

### Session Model

```typescript
interface Session {
  id: string;                    // "claude/add-dark-mode-a1b2c3"
  user_id: string;               // GitHub username
  repo: string;                  // "owner/repo"
  branch: string;                // Same as session id
  worktree_path: string;         // "/worktrees/claude-add-dark-mode-a1b2c3"
  port: number;                  // Auto-assigned from 3000-3099
  created_at: Date;
  expires_at: Date;              // Default: created_at + 7 days (configurable)
  state: {
    pane_order: number[];        // [1, 2, 3, 4, 5, 6]
    pane_visibility: Record<number, boolean>;
    pane_widths: Record<number, number>;
    active_file: string | null;
    open_files: string[];        // For multi-tab
    split_view: boolean;
    notes: string;               // Session notes
  };
}
```

---

## Technical Architecture

### Event Bus System

All cross-pane communication flows through a centralized event bus:

```typescript
// lib/ide/eventBus.ts
type IDEEvent =
  | { type: 'file:changed'; path: string; source: 'claude' | 'user' | 'external' }
  | { type: 'file:saved'; path: string; branch: string }
  | { type: 'migration:detected'; file: string; content: string }
  | { type: 'migration:applied'; file: string; success: boolean }
  | { type: 'deployment:started'; id: string; branch: string }
  | { type: 'deployment:completed'; id: string; status: 'success' | 'failed'; url?: string }
  | { type: 'deployment:failed'; id: string; error: string; logs: string }
  | { type: 'server:started'; port: number }
  | { type: 'server:stopped'; port: number }
  | { type: 'conflict:detected'; files: string[] }
  | { type: 'session:action'; action: string; details: any };

const ideEvents = new EventEmitter<IDEEvent>();

// Usage in panes:
ideEvents.emit({ type: 'file:changed', path: 'src/app/page.tsx', source: 'claude' });
ideEvents.on('file:changed', (e) => fileTree.refresh());
ideEvents.on('deployment:failed', (e) => chatPane.notifyClaude(e));
```

### State Management (Zustand)

```typescript
// stores/ideStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IDEStore {
  // Pane state
  paneOrder: number[];
  paneVisibility: Record<number, boolean>;
  paneWidths: Record<number, number>;

  // Session
  activeSession: Session | null;
  sessions: Session[];

  // Actions
  togglePane: (pane: number) => void;
  reorderPanes: (order: number[]) => void;
  setPaneWidth: (pane: number, width: number) => void;
  setActiveSession: (session: Session) => void;
}

export const useIDEStore = create<IDEStore>()(
  persist(
    (set) => ({
      paneOrder: [1, 2, 3, 4, 5, 6],
      paneVisibility: { 1: true, 2: true, 3: false, 4: false, 5: false, 6: false },
      paneWidths: { 1: 350, 2: 500, 3: 400, 4: 350, 5: 350, 6: 300 },
      activeSession: null,
      sessions: [],
      // ... actions
    }),
    { name: 'ide-store' }
  )
);
```

### Data Fetching (TanStack Query)

```typescript
// hooks/useFiles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useFileContent(owner: string, repo: string, branch: string, path: string) {
  return useQuery({
    queryKey: ['file', owner, repo, branch, path],
    queryFn: () => fetchFileContent(owner, repo, branch, path),
    staleTime: 30_000,
  });
}

export function useCommitFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commitFile,
    // Optimistic update
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['file', ...] });
      const previous = queryClient.getQueryData(['file', ...]);
      queryClient.setQueryData(['file', ...], variables.content);
      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['file', ...], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['file', ...] });
    },
  });
}
```

### Lazy Loading Strategy

```typescript
// Components load progressively
const loadingOrder = {
  initial: ['IDELayout', 'SessionSelector', 'ChatPane.skeleton'],
  after100ms: ['FileTree.skeleton', 'ChatPane.full'],
  onPaneExpand: (pane: number) => {
    switch (pane) {
      case 2: return ['FileTree', 'CodeEditor'];
      case 3: return ['PreviewFrame'];
      case 4: return ['MigrationList', 'QueryEditor'];
      case 5: return ['DeploymentList'];
      case 6: return ['ActivityTimeline'];
    }
  },
  onFileOpen: ['LanguageMode', 'SyntaxHighlighter'],
};
```

### Offline & Resilience

```typescript
// lib/ide/offlineQueue.ts
interface QueuedAction {
  id: string;
  type: 'save' | 'commit' | 'query';
  payload: any;
  timestamp: Date;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];
  private db: IDBDatabase;  // IndexedDB for persistence

  async add(action: QueuedAction) {
    this.queue.push(action);
    await this.persistToIndexedDB(action);
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const action = this.queue[0];
      try {
        await this.execute(action);
        this.queue.shift();
        await this.removeFromIndexedDB(action.id);
      } catch (e) {
        if (action.retries < 3) {
          action.retries++;
          await this.delay(1000 * action.retries);
        } else {
          this.notifyUser(action, e);
          this.queue.shift();
        }
      }
    }
  }
}
```

---

## Phase 1: Foundation & Chat

### Goals
- Create `/ide` route with 6-pane collapsible layout
- Implement AI Chat pane with Terminal/Workspace modes
- Set up event bus, state management, and data fetching infrastructure
- Implement keyboard shortcuts and command palette

### Tasks

#### 1.1 Create IDE Route Structure
```
/app/ide/
├── page.tsx                      # Main IDE page
├── layout.tsx                    # IDE-specific layout (no standard header)
├── components/
│   ├── IDELayout.tsx             # 6-pane container with resize/collapse
│   ├── PaneContainer.tsx         # Individual pane wrapper with lazy loading
│   ├── PaneHeader.tsx            # Pane title bar with collapse button
│   ├── CommandPalette.tsx        # Cmd+Shift+P command palette
│   ├── SessionSelector.tsx       # Dropdown to switch sessions
│   ├── IDEHeader.tsx             # Minimal header for IDE
│   └── panes/
│       └── ChatPane/
│           ├── index.tsx
│           ├── TerminalMode.tsx
│           ├── WorkspaceMode.tsx
│           ├── ContextPanel.tsx   # AI Context visibility
│           ├── PromptTemplates.tsx
│           └── SessionHistory.tsx
├── stores/
│   └── ideStore.ts               # Zustand store
├── lib/
│   ├── eventBus.ts               # Cross-pane event bus
│   ├── offlineQueue.ts           # Offline action queue
│   └── queryClient.ts            # TanStack Query setup
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── usePaneResize.ts
│   ├── useSessionPersistence.ts
│   └── useOfflineStatus.ts
└── styles/
    └── ide.css
```

#### 1.2 Pane Layout System
- **Flexbox-based horizontal layout** with dynamic widths
- **Collapse behavior**: Click pane header icon → collapse to 48px icon strip
- **Resize**: Drag handles between panes (react-resizable-panels)
- **Reorder**: Drag pane headers to reorder (@dnd-kit)
- **Persist layout**: Save to Zustand store + sync to database

#### 1.3 Keyboard Shortcuts & Command Palette

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Toggle AI Chat pane |
| `Cmd+2` | Toggle File Editor pane |
| `Cmd+3` | Toggle Browser Preview pane |
| `Cmd+4` | Toggle Database pane |
| `Cmd+5` | Toggle Deployments pane |
| `Cmd+6` | Toggle Activity pane |
| `Cmd+Shift+P` | Open Command Palette |
| `Cmd+Shift+N` | New session |
| `Cmd+Shift+S` | Switch session |
| `Cmd+Shift+F` | Search across files |
| `Cmd+S` | Save current file |
| `Cmd+Enter` | Send message (in chat) |

**Command Palette Actions:**
- New Session
- Switch Session
- Toggle Pane (1-6)
- Open File...
- Search in Files...
- Run Command...
- Apply Migration
- Trigger Deployment
- View Deployment Logs
- Open Settings

#### 1.4 AI Chat Pane

```
┌─────────────────────────────────────┐
│ [Terminal] [Workspace]          [?] │  ← Mode tabs + context toggle
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Claude's Context         [Hide] │ │  ← AI Context Panel (collapsible)
│ │ 📁 Repo: lawless-ai             │ │
│ │ 🌿 Branch: claude/add-auth-...  │ │
│ │ 📄 Files in context: 4          │ │
│ │ 🔧 Tools: 8 available           │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│                                     │
│  Chat messages / Terminal output    │
│  (scrollable)                       │
│                                     │
├─────────────────────────────────────┤
│ Quick prompts: [Fix errors] [Test]  │  ← Prompt templates
├─────────────────────────────────────┤
│ > Type a message...           [Send]│
└─────────────────────────────────────┘
```

**AI Context Panel:**
- Shows what Claude can "see" in current session
- Repo, branch, worktree info
- Files recently read/in memory
- Available tools
- Helps users understand Claude's capabilities

**Prompt Templates:**
- "Fix the TypeScript errors"
- "Write tests for this function"
- "Explain this code"
- "Refactor for readability"
- Custom templates (user-configurable)

#### 1.5 Session Management
- **Session list in dropdown**: Shows all active sessions
- **Create session flow**: Select repo → enter task description → auto-create worktree + branch
- **Session naming**: `claude/{task-description}-{short-uid}`
- **Session notes**: Attach persistent notes to session for context when resuming
- **Auto-expire**: Supabase scheduled function (default 7 days, configurable)
- **Resume session**: Load all pane states, restore unsaved changes from IndexedDB

#### 1.6 Default State
- On first load: Pane 1 (Chat) + Pane 2 (File Editor) visible
- Other panes collapsed to icons
- Prompt to select/create session if none active
- Show session notes if resuming

### Deliverables
- [ ] `/ide` route renders 6-pane layout
- [ ] Zustand store for IDE state
- [ ] TanStack Query setup with optimistic updates
- [ ] Event bus for cross-pane communication
- [ ] Panes collapse/expand with animation
- [ ] Panes resize via drag handles
- [ ] Panes reorder via drag-and-drop
- [ ] Command palette (Cmd+Shift+P)
- [ ] All keyboard shortcuts functional
- [ ] AI Chat pane with Terminal/Workspace modes
- [ ] AI Context visibility panel
- [ ] Prompt templates
- [ ] Session selector with notes
- [ ] IndexedDB for offline persistence
- [ ] Layout persists across page reloads

---

## Phase 2: File Editor

### Goals
- GitHub-connected file browser with search
- CodeMirror 6 editor with split view and diff view
- Commit workflow with branch selection
- PR creation and merge conflict resolution

### Tasks

#### 2.1 File Browser (Left Panel)

```
┌─────────────────────────────────────┐
│ 🔍 Search files...            [⌘F]  │
├─────────────────────────────────────┤
│ owner/repo ▼  |  branch ▼           │
├─────────────────────────────────────┤
│ 📁 src/                             │
│   📁 app/                           │
│     📄 page.tsx              ●      │  ← ● = unsaved
│     📄 layout.tsx            ✎      │  ← ✎ = modified by Claude
│   📁 components/                    │
│ 📄 package.json                     │
└─────────────────────────────────────┘
```

- File tree from GitHub API (existing implementation)
- **Search across files** (Cmd+Shift+F): Full-text search in repo
- Branch dropdown includes all branches + session worktree branches
- Visual indicators:
  - ● = unsaved local changes
  - ✎ = modified by Claude (not yet committed)
  - ✓ = committed but not pushed
- Click to open file in editor

#### 2.2 CodeMirror 6 Editor (Main Area)

```
┌─────────────────────────────────────────────────────────────────┐
│ [page.tsx ●] [layout.tsx] [+]              [Split] [Diff] [⋮]   │
├─────────────────────────────────────────────────────────────────┤
│      │ Left file                  │ Right file (split view)     │
│ ─────┼────────────────────────────┼─────────────────────────────│
│  1   │ import React from 'react'; │ import React from 'react';  │
│  2   │                            │                             │
│  3   │ export default function    │ export default function     │
│  4   │   Page() {                 │   Page() {                  │
│  5   │   return <div>Hello</div>; │   return <div>World</div>;  │
│  6   │ }                          │ }                           │
├─────────────────────────────────────────────────────────────────┤
│ Ln 5, Col 12  |  TypeScript  |  UTF-8  |  Spaces: 2  |  [Commit]│
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Syntax highlighting for all major languages (lazy-loaded per language)
- Line numbers
- Search/replace (Cmd+F / Cmd+H)
- Multiple file tabs
- **Split view**: View two files side-by-side
- **Diff view**: Compare current vs. last commit / vs. another branch
- Auto-save to IndexedDB (immediate) + server (debounced)
- Status bar: line/col, language, encoding, indent

#### 2.3 Commit Workflow

```
┌─────────────────────────────────────┐
│ Commit Changes                      │
├─────────────────────────────────────┤
│ Target branch: [session-branch ▼]   │
│                                     │
│ Message: [Fix typo in page.tsx    ] │
│                                     │
│ Files to commit:                    │
│ ☑ src/app/page.tsx (+5, -2)        │
│                                     │
│        [Cancel]  [Commit & Push]    │
└─────────────────────────────────────┘
```

- Single-file commits (one file at a time)
- Branch selector for target branch
- Commit message input with suggestions
- Commit + push in one action (optimistic UI)

#### 2.4 PR Creation

```
┌─────────────────────────────────────┐
│ Create Pull Request                 │
├─────────────────────────────────────┤
│ From: claude/add-auth-a1b2c3        │
│ To:   [main ▼]                      │
│                                     │
│ Title: [Add authentication        ] │
│                                     │
│ Description:                        │
│ [Auto-generated from session notes  │
│  and commit history...            ] │
│                                     │
│        [Cancel]  [Create PR]        │
└─────────────────────────────────────┘
```

- Create PR from session branch to target
- Auto-generate description from session notes + commit history
- Link to PR after creation

#### 2.5 Merge Conflict Resolution

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Merge Conflicts Detected                              [×]    │
├─────────────────────────────────────────────────────────────────┤
│ Conflicting files:                                              │
│ • src/app/page.tsx                    [View Diff]               │
│ • src/components/Button.tsx           [View Diff]               │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ <<<<<<< HEAD                                                │ │
│ │ const message = "Hello";                                    │ │
│ │ =======                                                     │ │
│ │ const message = "World";                                    │ │
│ │ >>>>>>> main                                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Keep Ours] [Keep Theirs] [Ask Claude to Resolve] [Manual Edit] │
└─────────────────────────────────────────────────────────────────┘
```

- Detect conflicts on branch switch or pull
- Visual diff showing conflict markers
- Quick actions: Keep ours, Keep theirs
- **"Ask Claude to Resolve"**: Sends context to AI Chat, Claude proposes resolution
- Manual edit with conflict markers highlighted

### Deliverables
- [ ] File tree with search (Cmd+Shift+F)
- [ ] CodeMirror 6 editor with syntax highlighting
- [ ] Multi-tab file editing
- [ ] Split view (two files side-by-side)
- [ ] Diff view (current vs. commit/branch)
- [ ] Auto-save to IndexedDB + server
- [ ] Commit modal with branch selection
- [ ] Single-file commit + push (optimistic UI)
- [ ] PR creation flow with auto-description
- [ ] Merge conflict detection and UI
- [ ] Claude-assisted conflict resolution
- [ ] File change indicators (unsaved, modified, committed)

---

## Phase 3: Browser Preview

### Goals
- Live preview via WebSocket tunnel (simpler initial implementation)
- Vercel deployment previews
- Toggle between Local and Deployed views
- Upgrade to reverse proxy in Phase 5

### Tasks

#### 3.1 WebSocket Tunnel (Initial Implementation)

Instead of complex DNS/SSL reverse proxy setup, we start with a WebSocket tunnel:

```typescript
// Backend: /backend/src/previewTunnel.ts
class PreviewTunnel {
  private sessions: Map<string, {
    port: number;
    ws: WebSocket;
  }> = new Map();

  async createTunnel(sessionId: string, port: number) {
    // Client connects via WebSocket
    // Tunnel proxies HTTP requests to localhost:port
    // Returns responses through the WebSocket
  }
}

// Frontend: Uses iframe with blob URL or service worker to intercept
```

**Benefits:**
- No DNS changes needed
- No SSL certificate setup
- Works immediately
- Can iterate faster

**Limitations (acceptable for MVP):**
- Some auth flows may not work
- Can't easily share URLs
- Slightly more complex client code

#### 3.2 Port Management

- Auto-assign port from **3000-3099** (expanded from 3000-3010)
- Auto-bump to next available port if requested port is in use
- Track port assignments in database
- Release port when session expires

```typescript
async function assignPort(sessionId: string): Promise<number> {
  const usedPorts = await getUsedPorts();
  for (let port = 3000; port <= 3099; port++) {
    if (!usedPorts.includes(port)) {
      await assignPortToSession(sessionId, port);
      return port;
    }
  }
  throw new Error('No available ports (max 100 concurrent sessions)');
}
```

#### 3.3 Dual-Mode Preview Pane UI

```
┌─────────────────────────────────────────────────┐
│ [Local ●] [Deployed]                       [↻]  │
├─────────────────────────────────────────────────┤
│ Status: 🟢 Server running on port 3000          │
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│            [Preview content]                    │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ Console: [Logs] [Network] [Clear]               │
└─────────────────────────────────────────────────┘
```

**Local Mode:**
- Shows live dev server output via WebSocket tunnel
- Hot reload enabled
- Status: Running/Stopped/Starting
- Mini console for server logs

**Deployed Mode:**
- URL: Vercel preview URL (e.g., `https://project-abc123-branch.vercel.app`)
- Shows deployed state after commits
- Status: Building/Ready/Failed
- Auto-refresh when new deployment completes

#### 3.4 Dev Server Control

- Start server: Via Terminal mode or dedicated button
- Status indicator: Running/Stopped/Starting
- Auto-detect when server is ready (poll health endpoint)
- Show server logs in mini console
- Port display in status bar

#### 3.5 Vercel Preview Integration

- Fetch latest preview deployment for current branch from Vercel API
- Display deployment status (Building/Ready/Failed)
- Auto-refresh iframe when deployment completes
- Show build progress indicator
- Link to full deployment logs (opens Deployments pane)
- **Event emission**: `deployment:completed` or `deployment:failed`

### Deliverables
- [ ] WebSocket tunnel implementation
- [ ] Port assignment system (3000-3099)
- [ ] Preview pane with Local/Deployed toggle
- [ ] Local mode with WebSocket tunnel + status
- [ ] Deployed mode with Vercel preview URL
- [ ] Refresh button
- [ ] Server status indicator
- [ ] Mini console for server logs
- [ ] Deployment status indicator
- [ ] Hot reload working through tunnel

---

## Phase 4: Database & Deployments

### Goals
- Database pane with migration detection and management
- Deployments pane with logs, env vars, rollback
- Cross-pane integration via event bus

### Tasks

#### 4.1 Database Pane

```
┌─────────────────────────────────────────────────┐
│ [Migrations] [Query] [Schema]                   │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔔 New Migration Detected           [Apply] │ │
│ │ 20240119_add_sessions.sql                   │ │
│ │ Auto-apply: [OFF ▼]                         │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Migrations                          [+ New]     │
│ ✅ 20240115_initial_schema.sql      Applied     │
│ ✅ 20240117_add_users.sql           Applied     │
│ ⏳ 20240119_add_sessions.sql        Pending     │
├─────────────────────────────────────────────────┤
│ Query Editor                        [Run ▶]     │
│ ┌─────────────────────────────────────────────┐ │
│ │ SELECT * FROM users LIMIT 10;               │ │
│ └─────────────────────────────────────────────┘ │
│ Results (10 rows)                   [Export]    │
│ ┌────────┬──────────────┬──────────────────┐    │
│ │ id     │ username     │ created_at       │    │
│ └────────┴──────────────┴──────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Migration Detection:**
- Watch `supabase/migrations/` for new files (via oracle file watcher)
- Compare against applied migrations via Supabase MCP
- Toast notification when new migration detected
- **Event emission**: `migration:detected`
- Preview migration SQL before applying
- Auto-apply toggle (per session setting)

**Query Editor:**
- SQL editor with syntax highlighting
- **Read-only mode option** for safety (toggle in settings)
- Execute queries via Supabase MCP
- Results table with sorting/filtering/export
- Query history

**Schema Browser:**
- List all tables with columns
- Column types and constraints
- Click table to generate SELECT query
- Foreign key relationships

#### 4.2 Deployments Pane

```
┌─────────────────────────────────────────────────┐
│ [Deployments] [Env Vars]                        │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ ❌ Deployment Failed              [Fix It]  │ │
│ │ Branch: claude/add-auth-a1b2c3              │ │
│ │ Error: TypeScript errors                    │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Recent Deployments               [Deploy Now]   │
│ ✅ Production  abc123  2h ago         [Logs]    │
│ ❌ Preview     def456  3h ago         [Logs]    │
│ ✅ Preview     ghi789  1d ago         [Logs]    │
├─────────────────────────────────────────────────┤
│ Environment Variables               [+ Add]     │
│ Production:                                     │
│   DATABASE_URL     ••••••••       [👁] [Edit]  │
│   API_KEY          ••••••••       [👁] [Edit]  │
│ Preview:                                        │
│   DATABASE_URL     ••••••••       [👁] [Edit]  │
├─────────────────────────────────────────────────┤
│ Rollback                                        │
│ Current: abc123 (2h ago)                        │
│ Previous deployments: [Select ▼]    [Rollback]  │
└─────────────────────────────────────────────────┘
```

**Deployment Monitoring:**
- List recent deployments with status via Vercel API
- Production vs Preview distinction
- Real-time status updates via SSE or polling
- **Event emission**: `deployment:started`, `deployment:completed`, `deployment:failed`

**Failed Deployment Alert:**
- Prominent alert at top
- Toast notification across IDE
- **"Fix It" button**: Sends error + logs to Claude in Chat pane
- Auto-scroll to relevant logs

**Build Logs:**
- Scrollable log viewer
- Real-time updates during build
- Error highlighting
- Search within logs

**Environment Variables:**
- List env vars by environment (Production/Preview)
- Masked values by default, reveal on click
- Add/Edit/Delete via Vercel API
- **Rate limited** to prevent accidental mass changes

**Rollback:**
- Select previous deployment
- Confirmation before rollback
- Show rollback progress

#### 4.3 Cross-Pane Integration

When events occur, all relevant panes react:

```typescript
// Migration detected → notify Chat pane
ideEvents.on('migration:detected', (e) => {
  toastNotification(`New migration: ${e.file}`);
  if (automation.autoApplyMigrations) {
    applyMigration(e.file);
  }
});

// Deployment failed → notify Chat pane with context
ideEvents.on('deployment:failed', (e) => {
  toastNotification(`Deployment failed: ${e.error}`, 'error');
  if (automation.autoFixDeployments) {
    chatPane.sendMessage(`Deployment failed with error: ${e.error}\n\nLogs:\n${e.logs}\n\nPlease help me fix this.`);
  }
});

// File changed by Claude → refresh file tree
ideEvents.on('file:changed', (e) => {
  if (e.source === 'claude') {
    fileTree.markAsModified(e.path);
    activityPane.log({ type: 'claude_edit', file: e.path });
  }
});
```

### Deliverables
- [ ] Migration detection with file watcher
- [ ] Migration list with status
- [ ] Apply migration button + auto-apply toggle
- [ ] Query editor with read-only mode option
- [ ] Schema browser
- [ ] Deployment list with real-time status
- [ ] Failed deployment alert with "Fix It" button
- [ ] Build log viewer
- [ ] Environment variable management (with reveal toggle)
- [ ] Rollback functionality
- [ ] Event bus integration for all pane events
- [ ] Toast notifications for cross-pane events

---

## Phase 5: Activity Pane & Polish

### Goals
- Activity/Timeline pane showing all session events
- Upgrade preview to reverse proxy (optional, if needed)
- Performance optimization and security hardening
- Testing and documentation

### Tasks

#### 5.1 Activity Pane (Pane 6)

```
┌─────────────────────────────────────────────────┐
│ Activity                   [Filter ▼] [Search]  │
├─────────────────────────────────────────────────┤
│ Today                                           │
│ ─────────────────────────────────────────────── │
│ 10:45  🤖  Claude edited src/app/page.tsx       │
│        └─ Changed 12 lines                      │
│ 10:44  📝  You opened src/app/page.tsx          │
│ 10:43  🚀  Deployment started (preview)         │
│        └─ Branch: claude/add-auth-a1b2c3        │
│ 10:42  📤  You committed "Fix header"           │
│        └─ 1 file changed                        │
│ 10:40  🗄️  Migration applied: add_users.sql     │
│        └─ Created table: users                  │
│ 10:38  🤖  Claude ran: npm install axios        │
│        └─ Added 1 dependency                    │
│ 10:35  💬  You asked: "Add authentication"      │
│                                                 │
│ Yesterday                                       │
│ ─────────────────────────────────────────────── │
│ 18:30  🎉  Session created                      │
│        └─ Repo: lawless-ai                      │
└─────────────────────────────────────────────────┘
```

**Features:**
- Chronological timeline of all session events
- Event types:
  - 🤖 Claude actions (edits, commands, tool usage)
  - 📝 User actions (file opens, edits)
  - 📤 Git operations (commits, pushes, PRs)
  - 🚀 Deployments (started, completed, failed)
  - 🗄️ Database (migrations, queries)
  - 💬 Conversations (messages to/from Claude)
  - ⚙️ System events (server start/stop, errors)
- **Filter by type**: Show only certain event types
- **Search**: Find events by keyword
- **Click to navigate**: Click event to jump to relevant pane/file
- **Export**: Download activity log as JSON/CSV

**Event Storage:**
```typescript
interface ActivityEvent {
  id: string;
  session_id: string;
  timestamp: Date;
  type: 'claude_action' | 'user_action' | 'git' | 'deployment' | 'database' | 'conversation' | 'system';
  subtype: string;  // e.g., 'file_edit', 'commit', 'migration_applied'
  summary: string;  // Human-readable summary
  details: any;     // Full event details
  related_file?: string;
  related_pane?: number;
}
```

#### 5.2 Preview Upgrade (Optional)

If WebSocket tunnel proves limiting, upgrade to reverse proxy:

```bash
# DNS: *.preview.lawless.ai → oracle server IP
# SSL: Wildcard cert via Let's Encrypt (certbot with DNS challenge)

# Nginx config
server {
    server_name ~^(?<session>[^-]+)-(?<port>\d+)\.preview\.lawless\.ai$;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 5.3 Security Hardening

- [ ] **RLS policies** for all new tables (mcp_configurations, unsaved_changes, activity_log, port_assignments)
- [ ] **Audit logging** for sensitive operations (env var changes, migrations, deployments)
- [ ] **Rate limiting** on API endpoints (especially Vercel/GitHub API proxies)
- [ ] **SQL injection protection** in query editor (parameterized via Supabase MCP)
- [ ] **Input sanitization** for all user inputs
- [ ] **CORS configuration** for preview tunnel

#### 5.4 Performance Optimization

- [ ] **Lazy load** all pane contents (implemented in Phase 1)
- [ ] **Virtualize** long lists (file tree, deployment list, activity log) using @tanstack/react-virtual
- [ ] **Debounce** API calls (file search, query execution)
- [ ] **Web Workers** for syntax highlighting in large files
- [ ] **IndexedDB caching** for file contents and activity log
- [ ] **Single WebSocket** connection multiplexed for all real-time features

#### 5.5 Testing

- [ ] Unit tests for core utilities (event bus, offline queue, port assignment)
- [ ] Integration tests for API routes
- [ ] E2E tests for critical flows:
  - Create session → edit file → commit → deploy
  - Claude edits file → user reviews → commit
  - Migration detected → apply → verify
- [ ] Manual QA checklist

#### 5.6 Documentation

- [ ] User guide for IDE features
- [ ] Keyboard shortcuts reference card
- [ ] Troubleshooting guide
- [ ] Architecture documentation for future development

### Deliverables
- [ ] Activity pane with timeline
- [ ] Event filtering and search
- [ ] Click-to-navigate from events
- [ ] Activity export
- [ ] (Optional) Reverse proxy upgrade
- [ ] RLS policies for all new tables
- [ ] Audit logging
- [ ] Rate limiting
- [ ] Virtualized lists
- [ ] Web Worker for syntax highlighting
- [ ] Comprehensive test suite
- [ ] User documentation

---

## Technical Specifications

### Frontend Dependencies

```json
{
  // State Management
  "zustand": "^4.x",

  // Data Fetching
  "@tanstack/react-query": "^5.x",

  // Code Editor
  "@codemirror/lang-javascript": "^6.x",
  "@codemirror/lang-typescript": "^6.x",
  "@codemirror/lang-css": "^6.x",
  "@codemirror/lang-html": "^6.x",
  "@codemirror/lang-json": "^6.x",
  "@codemirror/lang-markdown": "^6.x",
  "@codemirror/lang-sql": "^6.x",
  "codemirror": "^6.x",
  "@codemirror/theme-one-dark": "^6.x",
  "@codemirror/merge": "^6.x",  // For diff view

  // Layout
  "react-resizable-panels": "^2.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",

  // Virtualization
  "@tanstack/react-virtual": "^3.x",

  // Utilities
  "idb": "^8.x",  // IndexedDB wrapper
  "cmdk": "^1.x"  // Command palette
}
```

### Backend Dependencies

```json
{
  "chokidar": "^3.x",     // File watching for migrations
  "ws": "^8.x"            // WebSocket for preview tunnel (already have)
}
```

### Oracle Server Requirements

- Node.js 20+
- Ports 3000-3099 available for dev servers
- Sufficient resources for multiple concurrent dev servers
- (Optional) Nginx with wildcard SSL for reverse proxy upgrade

---

## Database Schema

### New Tables

```sql
-- IDE Sessions (extends existing workspace_sessions)
ALTER TABLE workspace_sessions ADD COLUMN IF NOT EXISTS
  port INTEGER,
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  pane_state JSONB DEFAULT '{}',
  notes TEXT DEFAULT '';

-- Automation Configuration (per user)
CREATE TABLE automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(github_username) ON DELETE CASCADE,
  auto_apply_migrations BOOLEAN DEFAULT false,
  auto_fix_deployments BOOLEAN DEFAULT false,
  auto_resolve_conflicts BOOLEAN DEFAULT false,
  auto_restart_server BOOLEAN DEFAULT true,
  session_expiration_days INTEGER DEFAULT 7,
  query_editor_readonly BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Unsaved File Changes (for persistence across sessions)
CREATE TABLE unsaved_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(github_username) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  base_sha TEXT,  -- SHA of the file when editing started
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, file_path)
);

-- Activity Log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(github_username) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'claude_action', 'user_action', 'git', 'deployment', 'database', 'conversation', 'system'
  event_subtype TEXT NOT NULL,  -- 'file_edit', 'commit', 'migration_applied', etc.
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  related_file TEXT,
  related_pane INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Port Assignments
CREATE TABLE port_assignments (
  port INTEGER PRIMARY KEY CHECK (port >= 3000 AND port <= 3099),
  session_id TEXT UNIQUE,
  user_id TEXT REFERENCES users(github_username) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- Prompt Templates (user-configurable)
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(github_username) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);
```

### Indexes

```sql
CREATE INDEX idx_sessions_expires ON workspace_sessions(expires_at);
CREATE INDEX idx_sessions_user ON workspace_sessions(user_id);
CREATE INDEX idx_unsaved_session ON unsaved_changes(session_id);
CREATE INDEX idx_unsaved_user ON unsaved_changes(user_id);
CREATE INDEX idx_activity_session ON activity_log(session_id, created_at DESC);
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_type ON activity_log(event_type, created_at DESC);
CREATE INDEX idx_port_user ON port_assignments(user_id);
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsaved_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can manage own automation config"
  ON automation_config FOR ALL
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can manage own unsaved changes"
  ON unsaved_changes FOR ALL
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can view own activity"
  ON activity_log FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own activity"
  ON activity_log FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can manage own ports"
  ON port_assignments FOR ALL
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can manage own templates"
  ON prompt_templates FOR ALL
  USING (user_id = auth.uid()::text);
```

### Supabase Scheduled Function (Session Cleanup)

```sql
-- Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
DECLARE
  expired_session RECORD;
BEGIN
  -- Process each expired session
  FOR expired_session IN
    SELECT id, user_id, branch FROM workspace_sessions WHERE expires_at < now()
  LOOP
    -- Log the cleanup
    INSERT INTO activity_log (session_id, user_id, event_type, event_subtype, summary, details)
    VALUES (
      expired_session.id,
      expired_session.user_id,
      'system',
      'session_expired',
      'Session expired and cleaned up',
      jsonb_build_object('branch', expired_session.branch)
    );

    -- Delete related data
    DELETE FROM unsaved_changes WHERE session_id = expired_session.id;
    DELETE FROM port_assignments WHERE session_id = expired_session.id;
    DELETE FROM activity_log WHERE session_id = expired_session.id AND created_at < now() - INTERVAL '30 days';
  END LOOP;

  -- Delete the sessions
  DELETE FROM workspace_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule to run daily at 3am UTC
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 3 * * *',
  'SELECT cleanup_expired_sessions()'
);
```

---

## API Endpoints

### Session Management
- `POST /api/ide/sessions` - Create new IDE session
- `GET /api/ide/sessions` - List user's sessions
- `GET /api/ide/sessions/:id` - Get session details
- `PATCH /api/ide/sessions/:id` - Update session state (panes, notes, etc.)
- `DELETE /api/ide/sessions/:id` - Delete session (cleanup worktree, release port)

### Port Management
- `POST /api/ide/ports/assign` - Assign port to session
- `DELETE /api/ide/ports/:port` - Release port
- `GET /api/ide/ports/available` - Get next available port

### File Operations
- `GET /api/ide/files/:owner/:repo/:branch/*path` - Get file content
- `PUT /api/ide/files/:owner/:repo/:branch/*path` - Save file (to GitHub)
- `POST /api/ide/files/commit` - Commit file changes
- `GET /api/ide/files/search` - Search across files (via GitHub API)
- `GET /api/ide/files/diff` - Get diff between versions

### Unsaved Changes
- `POST /api/ide/unsaved` - Save unsaved changes
- `GET /api/ide/unsaved/:sessionId` - Get unsaved changes for session
- `DELETE /api/ide/unsaved/:sessionId/:filePath` - Clear unsaved change

### Activity Log
- `GET /api/ide/activity/:sessionId` - Get activity for session
- `POST /api/ide/activity` - Log activity event
- `GET /api/ide/activity/export/:sessionId` - Export activity as JSON/CSV

### Automation Config
- `GET /api/ide/config` - Get user's automation config
- `PATCH /api/ide/config` - Update automation config

### Prompt Templates
- `GET /api/ide/templates` - Get user's prompt templates
- `POST /api/ide/templates` - Create template
- `PATCH /api/ide/templates/:id` - Update template
- `DELETE /api/ide/templates/:id` - Delete template

### Migrations
- `GET /api/ide/migrations/:projectId` - List migrations with status
- `POST /api/ide/migrations/:projectId/apply` - Apply pending migration
- `GET /api/ide/migrations/detect` - Check for new migrations

### Deployments (via Vercel API)
- `GET /api/vercel/deployments/:projectId` - List deployments
- `GET /api/vercel/deployments/:projectId/logs/:deploymentId` - Get build logs
- `POST /api/vercel/deployments/:projectId/rollback` - Rollback to previous
- `GET /api/vercel/env/:projectId` - List env vars
- `POST /api/vercel/env/:projectId` - Create env var
- `PATCH /api/vercel/env/:projectId/:envId` - Update env var
- `DELETE /api/vercel/env/:projectId/:envId` - Delete env var

### Preview Tunnel
- `WS /api/ide/preview/tunnel/:sessionId` - WebSocket tunnel for preview

---

## Implementation Order (Reordered)

### Sprint 1: Foundation & Chat (2 weeks)
**Focus: Get Claude working first - it's the core**

- IDE route and 6-pane layout skeleton
- Zustand store + TanStack Query setup
- Event bus implementation
- Pane collapse/resize/reorder
- Keyboard shortcuts + Command palette
- AI Chat pane (Terminal + Workspace modes)
- AI Context visibility panel
- Prompt templates
- Session management with notes
- IndexedDB for offline persistence

### Sprint 2: File Editor (2 weeks)
**Focus: Validate the GitHub editing flow**

- File tree with search
- CodeMirror 6 editor
- Multi-tab editing
- Split view
- Diff view
- Auto-save (IndexedDB + server)
- Commit workflow
- PR creation
- Merge conflict UI + Claude resolution

### Sprint 3: Preview (1 week)
**Focus: Prove the local dev loop**

- WebSocket tunnel implementation
- Port assignment system
- Preview pane with Local/Deployed toggle
- Server status indicator
- Hot reload through tunnel
- Vercel preview integration

### Sprint 4: Database & Deployments (2 weeks)
**Focus: Monitoring and management**

- Database pane (migrations, query editor, schema)
- Deployments pane (logs, env vars, rollback)
- Cross-pane event integration
- "Fix It" button for failed deployments
- Toast notifications

### Sprint 5: Activity & Polish (2 weeks)
**Focus: Timeline, security, performance**

- Activity pane with timeline
- Event filtering and search
- RLS policies for all tables
- Audit logging
- Rate limiting
- Performance optimization (virtualization, web workers)
- (Optional) Reverse proxy upgrade
- Testing
- Documentation

---

## Success Criteria

### MVP (End of Sprint 3)
- [ ] Can create session with notes
- [ ] Can chat with Claude in Terminal or Workspace mode
- [ ] Can see Claude's context (files, tools)
- [ ] Can edit files with split view and diff view
- [ ] Can commit to GitHub
- [ ] Can preview running dev server (local)
- [ ] Keyboard shortcuts work
- [ ] Command palette works

### Full Release (End of Sprint 5)
- [ ] All 6 panes fully functional
- [ ] Activity timeline captures all events
- [ ] Cross-pane integration via event bus
- [ ] Optimistic UI for all actions
- [ ] Offline resilience with IndexedDB
- [ ] Automation toggles work
- [ ] Session persistence and recovery
- [ ] Production-ready security (RLS, rate limiting)
- [ ] Comprehensive test coverage
- [ ] User documentation

---

## Resolved Decisions

1. **Vercel Integration**: Use Vercel API directly with stored tokens. No separate MCP.

2. **Session Cleanup**: Supabase scheduled function with configurable expiration (default 7 days).

3. **Preview Approach**:
   - Phase 3: WebSocket tunnel (simpler, no infrastructure changes)
   - Phase 5: Optional upgrade to reverse proxy if needed

4. **State Management**: Zustand for simplicity and performance.

5. **Data Fetching**: TanStack Query for caching, retries, and optimistic updates.

6. **Port Range**: Expanded to 3000-3099 (100 concurrent sessions).

7. **6th Pane**: Activity/Timeline pane for session history.

8. **Sprint Order**: Reordered to prioritize core loop (Chat → Edit → Preview → Commit).

---

## Appendix: File Structure

```
/app/
├── ide/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── components/
│   │   ├── IDELayout.tsx
│   │   ├── PaneContainer.tsx
│   │   ├── PaneHeader.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── SessionSelector.tsx
│   │   ├── IDEHeader.tsx
│   │   └── panes/
│   │       ├── ChatPane/
│   │       │   ├── index.tsx
│   │       │   ├── TerminalMode.tsx
│   │       │   ├── WorkspaceMode.tsx
│   │       │   ├── ContextPanel.tsx
│   │       │   ├── PromptTemplates.tsx
│   │       │   └── SessionHistory.tsx
│   │       ├── EditorPane/
│   │       │   ├── index.tsx
│   │       │   ├── FileTree.tsx
│   │       │   ├── FileSearch.tsx
│   │       │   ├── CodeEditor.tsx
│   │       │   ├── SplitView.tsx
│   │       │   ├── DiffView.tsx
│   │       │   ├── CommitModal.tsx
│   │       │   ├── PRModal.tsx
│   │       │   └── ConflictResolver.tsx
│   │       ├── PreviewPane/
│   │       │   ├── index.tsx
│   │       │   ├── LocalPreview.tsx
│   │       │   ├── DeployedPreview.tsx
│   │       │   └── MiniConsole.tsx
│   │       ├── DatabasePane/
│   │       │   ├── index.tsx
│   │       │   ├── MigrationList.tsx
│   │       │   ├── MigrationAlert.tsx
│   │       │   ├── QueryEditor.tsx
│   │       │   └── SchemaViewer.tsx
│   │       ├── DeploymentsPane/
│   │       │   ├── index.tsx
│   │       │   ├── DeploymentList.tsx
│   │       │   ├── DeploymentAlert.tsx
│   │       │   ├── LogViewer.tsx
│   │       │   ├── EnvVarManager.tsx
│   │       │   └── RollbackModal.tsx
│   │       └── ActivityPane/
│   │           ├── index.tsx
│   │           ├── Timeline.tsx
│   │           ├── EventFilter.tsx
│   │           └── EventSearch.tsx
│   ├── stores/
│   │   └── ideStore.ts
│   ├── lib/
│   │   ├── eventBus.ts
│   │   ├── offlineQueue.ts
│   │   └── queryClient.ts
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── usePaneResize.ts
│   │   ├── useSessionPersistence.ts
│   │   ├── useOfflineStatus.ts
│   │   └── useEventBus.ts
│   └── styles/
│       └── ide.css
├── api/
│   ├── ide/
│   │   ├── sessions/
│   │   ├── ports/
│   │   ├── files/
│   │   ├── unsaved/
│   │   ├── activity/
│   │   ├── config/
│   │   ├── templates/
│   │   ├── migrations/
│   │   └── preview/
│   └── vercel/
│       ├── deployments/
│       └── env/
└── integrations/
    └── components/
        └── AutomationConfig.tsx
```

---

*Document Version: 2.0*
*Created: January 2025*
*Last Updated: January 2025*

---

## Changelog

### v2.0 (Major Update)
- **Added 6th pane**: Activity/Timeline for session history
- **Event bus architecture**: Decoupled cross-pane communication
- **State management**: Switched to Zustand for simplicity
- **Data fetching**: Added TanStack Query with optimistic updates
- **Lazy loading strategy**: Progressive component loading
- **Offline resilience**: IndexedDB caching + offline queue
- **Command palette**: Cmd+Shift+P for quick actions
- **AI Context panel**: Show what Claude can see
- **Prompt templates**: Quick-insert common prompts
- **Session notes**: Persist context for resuming
- **Split view**: View two files side-by-side
- **Diff view**: Compare file versions
- **File search**: Cmd+Shift+F across repo
- **WebSocket tunnel**: Simpler initial preview implementation
- **Expanded port range**: 3000-3099 (100 sessions)
- **Security hardening**: RLS, audit logging, rate limiting
- **Reordered sprints**: Prioritize core loop (Chat → Edit → Preview)

### v1.1
- Clarified Vercel integration uses direct API calls with stored tokens (no MCP)
- Added session cleanup via Supabase scheduled function with configurable expiration
- Updated Browser Preview pane to show BOTH local dev server AND Vercel deployment previews
- Added Local/Deployed toggle to preview pane
- Added session expiration settings to Integrations page
- Added Supabase scheduled function SQL for cleanup job
