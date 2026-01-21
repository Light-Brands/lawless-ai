# Mobile IDE Two-Zone Layout Plan

## Executive Summary

Transform the Lawless AI IDE into a mobile-first development experience where users can:
- Configure everything online from their phone
- Develop via terminal OR chat with AI at the bottom of the screen
- Preview their work in the main pane above
- Quick-flip between coding/chatting and seeing results

This plan maintains the existing desktop experience while adding a completely reimagined mobile layout.

---

## Core Mobile UX Principles

### 1. Two-Zone Layout
- **Main Pane** (top): Content viewing - Preview, Editor, Database, etc.
- **Input Zone** (bottom): Terminal OR Chat - switchable with a toggle
- Clear separation between "viewing" and "doing"

### 2. Input-Centric Development
- Terminal and Chat share the bottom zone (toggle between them)
- Both are collapsible to maximize main pane viewing area
- Expand to focus on typing commands or chatting with AI
- Collapse to see full preview of your work

### 3. Preview-First Default
- Main pane defaults to Preview (see your running app)
- Bottom defaults to Terminal (run commands)
- Natural workflow: code in terminal → see results in preview
- Switch bottom to Chat when you need AI help

---

## Mobile Layout Architecture

### Screen Structure

```
┌─────────────────────────────┐
│  Header (repo + session)    │  ← Minimal: repo name, session indicator, menu
├─────────────────────────────┤
│                             │
│                             │
│     Main Pane Area          │  ← Defaults to Preview
│   (Preview/Editor/Database/ │     Switch via bottom nav
│    Deployments/Activity)    │
│                             │
│                             │
├─────────────────────────────┤
│  ⌨️ Terminal ═══╤═══ 💬 Chat │  ← Toggle switch between Terminal/Chat
├─────────────────────────────┤
│  $ npm run dev              │  ← Active input zone content
│  > Ready on port 3000       │
│  $ _                        │
├─────────────────────────────┤
│ 👁  📝  🗄️  🚀  📋  ⚙️  │  ← Bottom nav (main pane only)
└─────────────────────────────┘
```

### Bottom Zone States

**Collapsed Mode** (preview-focused):
```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│                             │
│                             │
│     Preview                 │
│     (Nearly Full Height)    │
│                             │
│                             │
├─────────────────────────────┤
│ ▲ ⌨️ Terminal ══╤══ 💬 Chat │  ← Collapsed bar with toggle visible
├─────────────────────────────┤
│ 👁  📝  🗄️  🚀  📋  ⚙️  │
└─────────────────────────────┘
```

**Half Mode** (balanced view):
```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│                             │
│     Preview (50%)           │
│                             │
├─────────────────────────────┤
│ ▼ ⌨️ Terminal ══╤══ 💬 Chat │  ← Drag handle + toggle
├─────────────────────────────┤
│  $ npm run dev              │
│  > Ready on port 3000       │
│  $ _                        │
├─────────────────────────────┤
│ Tab │ Esc │ ⌃C │ ⌃D │ ↑ ↓  │  ← Keyboard toolbar (terminal only)
├─────────────────────────────┤
│ 👁  📝  🗄️  🚀  📋  ⚙️  │
└─────────────────────────────┘
```

**Expanded Mode** (input-focused):
```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│  Preview (minimized)    ▼   │  ← Tap to restore
├─────────────────────────────┤
│ ▼ ⌨️ Terminal ══╤══ 💬 Chat │
├─────────────────────────────┤
│                             │
│     Terminal/Chat           │
│     (70% height)            │
│                             │
│                             │
├─────────────────────────────┤
│ Tab │ Esc │ ⌃C │ ⌃D │ ↑ ↓  │
├─────────────────────────────┤
│ 👁  📝  🗄️  🚀  📋  ⚙️  │
└─────────────────────────────┘
```

**Chat Mode** (AI assistant active):
```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│                             │
│     Preview (50%)           │
│                             │
├─────────────────────────────┤
│ ▼ ⌨️ Terminal ══╤══ 💬 Chat │  ← Chat tab active (highlighted)
├─────────────────────────────┤
│ [AI] How can I help?        │
│ [You] Add dark mode         │
│ [AI] I'll add that...       │
├─────────────────────────────┤
│ 📷 📎 │ Type message...  │🔵│  ← Chat input bar
├─────────────────────────────┤
│ 👁  📝  🗄️  🚀  📋  ⚙️  │
└─────────────────────────────┘
```

---

## Bottom Zone Toggle Design

### Terminal ↔ Chat Toggle

The toggle sits at the top of the bottom zone, always visible:

```
┌─────────────────────────────────────┐
│  ⌨️ Terminal        │       💬 Chat  │
│  ━━━━━━━━━━━        │               │  ← Underline shows active
└─────────────────────────────────────┘
```

**Behavior:**
- Tap inactive side to switch
- Active side has accent underline
- Both preserve their state when switching (portal architecture)
- Terminal shows green dot when process running
- Chat shows unread count badge when AI responds

### Visual States

```css
/* Toggle container */
.bottom-zone-toggle {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--background-elevated);
}

.toggle-tab {
  flex: 1;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--muted-foreground);
  border-bottom: 2px solid transparent;
}

.toggle-tab.active {
  color: var(--foreground);
  border-bottom-color: var(--accent-purple);
}

/* Running indicator for terminal */
.toggle-tab.terminal.running::after {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--green-500);
  border-radius: 50%;
  margin-left: 4px;
}

/* Unread badge for chat */
.toggle-tab.chat .unread-badge {
  background: var(--accent-purple);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 4px;
}
```

---

## Bottom Navigation Design

### Purpose: Switch Main Pane Only

The bottom nav controls ONLY the main pane above. Terminal/Chat toggle is separate.

### Nav Items

| Icon | Pane | Purpose | Default |
|------|------|---------|---------|
| 👁 | Preview | Local/deployed preview | **Yes** |
| 📝 | Editor | File browser + code editing | |
| 🗄️ | Database | Supabase tables and SQL | |
| 🚀 | Deployments | Vercel deployment status | |
| 📋 | Activity | Session activity log | |
| ⚙️ | Settings | IDE settings & preferences | |

### Navigation Behavior

1. **Tap** - Switch main pane to that view
2. **Long-press** - Show pane options (fullscreen, refresh, etc.)
3. **Double-tap Preview** - Refresh the preview iframe
4. **Active indicator** - Purple underline on current pane

### Visual Design

```css
/* Bottom navigation */
.mobile-bottom-nav {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-top: 1px solid var(--border);
  background: var(--background);
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  color: var(--muted-foreground);
  transition: color 0.15s;
}

.mobile-nav-item.active {
  color: var(--accent-purple);
}

.mobile-nav-item svg {
  width: 22px;
  height: 22px;
}

.mobile-nav-item span {
  font-size: 9px;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## Pane-by-Pane Mobile Optimization

### Bottom Zone: Terminal + Chat (Shared Space)

The bottom zone contains two panes that share the same space with a toggle to switch between them.

#### Terminal (Bottom Zone - Tab 1)

**Current State**: Has mobile keyboard toolbar, basic mobile support

**Mobile Optimizations**:

```tsx
// Bottom zone height states (shared by Terminal and Chat)
type BottomZoneHeight = 'collapsed' | 'half' | 'expanded' | 'fullscreen';

// Active tab in bottom zone
type BottomZoneTab = 'terminal' | 'chat';
```

**Features**:
- Shares collapsible zone with Chat
- Keyboard toolbar visible when terminal active and expanded
- Tab switcher as horizontal scroll below toggle
- Green dot indicator when process running
- Last output line visible even when collapsed

**Terminal Tab Bar** (when terminal active):
```
┌─────────────────────────────────────┐
│ ◀ │ main │ feature/auth │ + │ ▶    │  ← Horizontal scrollable tabs
├─────────────────────────────────────┤
│  $ npm run dev                      │
│  > Ready on localhost:3000          │
├─────────────────────────────────────┤
│ Tab │ Esc │ ⌃C │ ⌃D │ ↑ │ ↓ │ Clear│  ← Keyboard toolbar
└─────────────────────────────────────┘
```

#### Chat (Bottom Zone - Tab 2)

**Current State**: Full chat interface with mode toggle

**Mobile Layout in Bottom Zone**:

```
┌─────────────────────────────────────┐
│ ▼ ⌨️ Terminal ══╤══ 💬 Chat (2)    │  ← (2) = unread count
├─────────────────────────────────────┤
│ [AI] I'll add dark mode support.    │
│ Here's what I changed:              │
│ ┌─────────────────────────────────┐ │
│ │ 📎 3 files changed          [▼]│ │  ← Expandable diff
│ └─────────────────────────────────┘ │
│ [You] Can you also add a toggle?    │
├─────────────────────────────────────┤
│ 📷 📎 🎤 │ Type message...     │ 🔵 │  ← Chat input
└─────────────────────────────────────┘
```

**Features**:
- Inline code blocks with "Apply" buttons
- Expandable file diffs (tap to see changes)
- Voice input option (microphone button)
- Screenshot attachment for bug reports
- Unread message badge on toggle tab
- Quick prompts accessible via long-press send button

**Quick Prompts (long-press send)**:
```
┌─────────────────────────────┐
│ 🔧 Fix this error           │
│ 📝 Explain this code        │
│ ✨ Add a feature            │
│ 🧪 Write tests              │
│ 🔍 Review changes           │
└─────────────────────────────┘
```

---

### Main Pane Options (Above Bottom Zone)

These panes appear in the main viewing area above the Terminal/Chat bottom zone.

#### Preview Pane (Main - Default)

**Current State**: Local/Deployed toggle with port pills

**Mobile Layout**:

```
┌─────────────────────────────┐
│ Local ═══════╤═══ Deployed  │  ← Segmented control
├─────────────────────────────┤
│ 🟢 3000 │ 3001 │ 5173       │  ← Port pills (scrollable, green = active)
├─────────────────────────────┤
│                             │
│                             │
│   [iframe preview]          │
│   Your running app here     │
│                             │
│                             │
├─────────────────────────────┤
│ ↻  │  ←  │  →  │  🔗  │  ⚙️ │  ← Action bar
└─────────────────────────────┘
```

**Features**:
- Default main pane on mobile (see your work first)
- Touch-friendly action bar (refresh, nav, open external)
- Pinch-to-zoom in preview iframe
- Port pills show all detected dev servers
- "Open in browser" button for full mobile testing
- Local/Deployed toggle for Vercel previews

**Quick Actions**:
- ↻ Refresh preview
- ← → Navigate back/forward in iframe
- 🔗 Open in mobile browser (full experience)
- ⚙️ Preview settings (device frame, zoom level)

#### Editor Pane (Main)

**Current State**: File tree + editor side-by-side (desktop layout)

**Mobile Layout - Two Modes**:

```
Mode 1: File Browser (default when selecting Editor)
┌─────────────────────────────┐
│ 📁 Files           🔍  ⋮    │
├─────────────────────────────┤
│  📁 src/                    │
│    📁 components/           │
│      📄 Button.tsx          │
│      📄 Header.tsx          │
│    📁 pages/                │
│      📄 index.tsx      →    │  ← Tap to open
│  📁 public/                 │
│  📄 package.json            │
└─────────────────────────────┘

Mode 2: File Editor (after selecting a file)
┌─────────────────────────────┐
│ ← index.tsx            💾 ⋮ │  ← Back + filename + save + menu
├─────────────────────────────┤
│ import React from 'react';  │
│                             │
│ export default function() { │
│   return <div>Hello</div>;  │
│ }                           │
│                             │
└─────────────────────────────┘
```

**Key Features**:
- Two distinct modes: file browser vs editor
- Back button returns to file browser
- Breadcrumb path in editor mode
- Swipe left/right between open files
- Floating save button when changes pending
- Monaco editor with mobile touch handling

**File Tree Gestures**:
- Tap: Open file / expand folder
- Long-press: Context menu (rename, delete, copy path)
- Swipe right on file: Quick actions

#### Database Pane (Main)

**Current State**: Table browser with SQL editor

**Mobile Layout - Progressive Drill-Down**:

```
Mode 1: Table Browser
┌─────────────────────────────┐
│ 🗄️ Database         🔍 SQL  │
├─────────────────────────────┤
│ 📊 users (1,234 rows)    →  │
│ 📊 posts (5,678 rows)    →  │
│ 📊 comments (12,345)     →  │
│ 📊 sessions (89 rows)    →  │
└─────────────────────────────┘

Mode 2: Table View
┌─────────────────────────────┐
│ ← users              🔍  +  │
├─────────────────────────────┤
│ id │ email      │ name  │ ▶ │  ← Horizontal scroll
├───┼────────────┼───────┼───┤
│ 1  │ a@b.com   │ Alice │   │  ← Tap row for detail
│ 2  │ c@d.com   │ Bob   │   │
│ 3  │ e@f.com   │ Carol │   │
└─────────────────────────────┘

Mode 3: Row Detail
┌─────────────────────────────┐
│ ← users / Row #1    ✏️  🗑️ │
├─────────────────────────────┤
│ id: 1                       │
│ email: alice@example.com    │
│ name: Alice                 │
│ created_at: 2024-01-15      │
│ metadata: {...}         [▼] │  ← Tap to expand JSON
└─────────────────────────────┘

Mode 4: SQL Editor (tap SQL button)
┌─────────────────────────────┐
│ ← SQL Editor         ▶ Run  │
├─────────────────────────────┤
│ SELECT * FROM users         │
│ WHERE created_at > '2024'   │
│ LIMIT 10;                   │
├─────────────────────────────┤
│ Results (10 rows)           │
│ [table view below]          │
└─────────────────────────────┘
```

**Features**:
- Progressive drill-down (tables → rows → detail)
- Horizontal scroll for wide tables
- Tap row to see/edit full detail
- SQL editor accessible via button
- Query history in slide-up drawer

#### Deployments Pane (Main)

**Current State**: Vercel deployment list with status

**Mobile Layout**:

```
┌─────────────────────────────┐
│ 🚀 Deployments      main ▼  │  ← Branch filter dropdown
├─────────────────────────────┤
│ ✅ abc123 - 2h ago          │
│    "Add dark mode"          │
│    ─────────────────        │
│ 🔄 def456 - Building...     │
│    "Fix login bug"          │
│    ━━━━━━━░░░░ 60%          │
│    ─────────────────        │
│ ✅ ghi789 - 1d ago          │
│    "Initial commit"         │
└─────────────────────────────┘
```

**Features**:
- Clear status indicators (✅ 🔄 ❌)
- Build progress bars
- Tap to view deployment details
- Quick "Redeploy" action
- Build logs in expandable view

#### Activity Pane (Main)

**Current State**: Activity log

**Mobile Layout**:

```
┌─────────────────────────────┐
│ 📋 Activity       Filter ▼  │
├─────────────────────────────┤
│ 🔵 10:32 - File saved       │
│    src/components/Button.tsx│
│ 🟢 10:31 - Server started   │
│    Port 3000                │
│ 🟡 10:30 - AI responded     │
│    "I've added dark mode"   │
│ 🔵 10:28 - Terminal command │
│    npm run dev              │
└─────────────────────────────┘
```

**Features**:
- Timeline view with color-coded events
- Filter by type (files, terminal, AI, server)
- Tap event to see details or jump to related pane

---

## Technical Implementation

### Component: MobileIDELayout

**New Component: MobileIDELayout.tsx**

```tsx
// app/ide/components/MobileIDELayout.tsx

export function MobileIDELayout() {
  // Main pane state (Preview, Editor, Database, etc.)
  const [mainPane, setMainPane] = useState<MainPaneId>('preview');

  // Bottom zone state
  const [bottomZoneHeight, setBottomZoneHeight] = useState<BottomZoneHeight>('half');
  const [bottomZoneTab, setBottomZoneTab] = useState<'terminal' | 'chat'>('terminal');

  return (
    <div className="mobile-ide-layout">
      {/* Minimal header */}
      <MobileIDEHeader />

      {/* Main pane area (Preview, Editor, Database, etc.) */}
      <div className="mobile-main-pane">
        <MainPaneRenderer paneId={mainPane} />
      </div>

      {/* Bottom zone: Terminal + Chat with toggle */}
      <MobileBottomZone
        height={bottomZoneHeight}
        onHeightChange={setBottomZoneHeight}
        activeTab={bottomZoneTab}
        onTabChange={setBottomZoneTab}
      />

      {/* Bottom navigation (controls main pane only) */}
      <MobileBottomNav
        activePane={mainPane}
        onPaneChange={setMainPane}
      />
    </div>
  );
}
```

**Layout Switching in IDELayout.tsx**:

```tsx
// app/ide/components/IDELayout.tsx

export function IDELayout() {
  const isMobile = useMobileDetection();

  if (isMobile) {
    return <MobileIDELayout />;
  }

  return <DesktopIDELayout />; // Current implementation
}
```

### Hooks

**useMobileDetection.ts**:
```tsx
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check viewport width AND touch capability
      const isMobileViewport = window.innerWidth < 768;
      const isTouchDevice = 'ontouchstart' in window;
      setIsMobile(isMobileViewport || (isTouchDevice && window.innerWidth < 1024));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
```

**useBottomZone.ts** (manages Terminal/Chat shared space):
```tsx
export function useBottomZone() {
  const [height, setHeight] = useState<BottomZoneHeight>('half');
  const [activeTab, setActiveTab] = useState<'terminal' | 'chat'>('terminal');

  // Gesture handling for the zone
  const gestureHandlers = useGestureHandlers({
    onSwipeUp: () => setHeight(expandHeight(height)),
    onSwipeDown: () => setHeight(collapseHeight(height)),
  });

  // Track unread chat messages
  const [unreadCount, setUnreadCount] = useState(0);

  // Clear unread when switching to chat
  useEffect(() => {
    if (activeTab === 'chat') setUnreadCount(0);
  }, [activeTab]);

  return {
    height,
    setHeight,
    activeTab,
    setActiveTab,
    unreadCount,
    incrementUnread: () => setUnreadCount(c => c + 1),
    ...gestureHandlers,
  };
}

function expandHeight(current: BottomZoneHeight): BottomZoneHeight {
  const order: BottomZoneHeight[] = ['collapsed', 'half', 'expanded', 'fullscreen'];
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)];
}

function collapseHeight(current: BottomZoneHeight): BottomZoneHeight {
  const order: BottomZoneHeight[] = ['collapsed', 'half', 'expanded', 'fullscreen'];
  const idx = order.indexOf(current);
  return order[Math.max(idx - 1, 0)];
}
```

### Store Updates (ideStore.ts)

**ideStore.ts additions**:

```tsx
// Types
type MainPaneId = 'preview' | 'editor' | 'database' | 'deployments' | 'activity' | 'settings';
type BottomZoneHeight = 'collapsed' | 'half' | 'expanded' | 'fullscreen';
type BottomZoneTab = 'terminal' | 'chat';

// Add to IDEStore interface
interface MobileState {
  // Main pane (top area)
  mainPane: MainPaneId;

  // Bottom zone (Terminal + Chat)
  bottomZoneHeight: BottomZoneHeight;
  bottomZoneTab: BottomZoneTab;
  chatUnreadCount: number;

  // Actions
  setMainPane: (pane: MainPaneId) => void;
  setBottomZoneHeight: (height: BottomZoneHeight) => void;
  setBottomZoneTab: (tab: BottomZoneTab) => void;
  toggleBottomZone: () => void;
  incrementChatUnread: () => void;
  clearChatUnread: () => void;
}

// Add to store
mobile: {
  mainPane: 'preview',  // Default to preview
  bottomZoneHeight: 'half',
  bottomZoneTab: 'terminal',  // Default to terminal
  chatUnreadCount: 0,

  setMainPane: (pane) => set((state) => ({
    mobile: { ...state.mobile, mainPane: pane }
  })),

  setBottomZoneHeight: (height) => set((state) => ({
    mobile: { ...state.mobile, bottomZoneHeight: height }
  })),

  setBottomZoneTab: (tab) => set((state) => ({
    mobile: {
      ...state.mobile,
      bottomZoneTab: tab,
      // Clear unread when switching to chat
      chatUnreadCount: tab === 'chat' ? 0 : state.mobile.chatUnreadCount
    }
  })),

  toggleBottomZone: () => set((state) => ({
    mobile: {
      ...state.mobile,
      bottomZoneHeight: state.mobile.bottomZoneHeight === 'collapsed' ? 'half' : 'collapsed'
    }
  })),

  incrementChatUnread: () => set((state) => ({
    mobile: {
      ...state.mobile,
      chatUnreadCount: state.mobile.bottomZoneTab === 'chat'
        ? 0  // Don't increment if already viewing chat
        : state.mobile.chatUnreadCount + 1
    }
  })),

  clearChatUnread: () => set((state) => ({
    mobile: { ...state.mobile, chatUnreadCount: 0 }
  })),
}
```

### CSS Architecture

**New file: styles/mobile-ide.css**

```css
/* Mobile IDE Root Layout */
.mobile-ide-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* Dynamic viewport height for mobile */
  overflow: hidden;
}

/* Mobile Header */
.mobile-ide-header {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

/* Main Pane Area (Preview, Editor, etc.) */
.mobile-main-pane {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0; /* Allow shrinking */
}

/* Bottom Zone (Terminal + Chat) */
.mobile-bottom-zone {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  background: var(--background);
  transition: height 0.2s ease-out;
}

/* Height states */
.mobile-bottom-zone[data-height="collapsed"] {
  height: 48px; /* Just the toggle bar */
}

.mobile-bottom-zone[data-height="half"] {
  height: 45vh;
}

.mobile-bottom-zone[data-height="expanded"] {
  height: 70vh;
}

.mobile-bottom-zone[data-height="fullscreen"] {
  position: fixed;
  inset: 0;
  height: 100dvh;
  z-index: 100;
}

/* Toggle Bar (Terminal ↔ Chat) */
.bottom-zone-toggle {
  display: flex;
  height: 48px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.bottom-zone-toggle-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  color: var(--muted-foreground);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  cursor: pointer;
}

.bottom-zone-toggle-tab.active {
  color: var(--foreground);
  border-bottom-color: var(--accent-purple);
}

.bottom-zone-toggle-tab svg {
  width: 18px;
  height: 18px;
}

/* Running indicator (green dot for terminal) */
.bottom-zone-toggle-tab.running::after {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--green-500);
  border-radius: 50%;
  margin-left: 4px;
}

/* Unread badge (for chat) */
.bottom-zone-unread-badge {
  background: var(--accent-purple);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* Bottom Zone Content */
.bottom-zone-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

/* Terminal specific */
.bottom-zone-terminal {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.bottom-zone-terminal-tabs {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
}

.terminal-tab {
  padding: 8px 12px;
  font-size: 12px;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  color: var(--muted-foreground);
}

.terminal-tab.active {
  color: var(--foreground);
  border-bottom-color: var(--accent-purple);
}

.terminal-output {
  flex: 1;
  overflow: hidden;
}

/* Chat specific */
.bottom-zone-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}

.chat-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--muted);
  font-size: 14px;
}

/* Keyboard Toolbar (Terminal only) */
.mobile-keyboard-toolbar {
  display: flex;
  gap: 4px;
  padding: 8px;
  overflow-x: auto;
  background: var(--muted);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.mobile-keyboard-toolbar button {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--background);
  border: 1px solid var(--border);
  font-size: 12px;
  font-family: monospace;
}

/* Bottom Navigation (Main Pane Control) */
.mobile-bottom-nav {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-top: 1px solid var(--border);
  background: var(--background);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom); /* iPhone notch */
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  color: var(--muted-foreground);
  transition: color 0.15s;
}

.mobile-nav-item.active {
  color: var(--accent-purple);
}

.mobile-nav-item svg {
  width: 22px;
  height: 22px;
}

.mobile-nav-item span {
  font-size: 9px;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## Gesture Support

### Bottom Zone Gestures

| Gesture | Action |
|---------|--------|
| Swipe up on bottom zone | Expand to next height level |
| Swipe down on bottom zone | Collapse to previous height level |
| Double-tap toggle bar | Toggle fullscreen |
| Tap Terminal/Chat tab | Switch between Terminal and Chat |
| Drag toggle bar | Fine-grained height adjustment |

### Main Pane Gestures

| Gesture | Action |
|---------|--------|
| Swipe left on main pane | Next pane (in nav order) |
| Swipe right on main pane | Previous pane (in nav order) |
| Pinch (Preview) | Zoom in/out |
| Long-press | Context menu |

### Implementation with use-gesture

```tsx
import { useGesture } from '@use-gesture/react';

function MobileBottomZone({ height, onHeightChange, activeTab, onTabChange }) {
  const bind = useGesture({
    onDrag: ({ movement: [, my], direction: [, dy], velocity: [, vy] }) => {
      if (Math.abs(my) > 50 && vy > 0.3) {
        // Significant swipe detected
        if (dy < 0) {
          // Swipe up - expand
          onHeightChange(nextHeight(height));
        } else {
          // Swipe down - collapse
          onHeightChange(prevHeight(height));
        }
      }
    },
    onDoubleTap: () => {
      onHeightChange(height === 'fullscreen' ? 'half' : 'fullscreen');
    },
  });

  return <div {...bind()} className="mobile-terminal" />;
}
```

---

## Mobile Login Flow

### Direct to IDE on Mobile

```tsx
// app/page.tsx or app/layout.tsx

export default function HomePage() {
  const isMobile = useMobileDetection();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && isMobile) {
      // Mobile + logged in = go straight to IDE
      router.push('/ide');
    }
  }, [user, isLoading, isMobile]);

  // Desktop shows normal landing page
  return <LandingPage />;
}
```

### Session Selection on Mobile

When user has multiple repos/sessions:

```
┌─────────────────────────────┐
│ 🏠 Lawless AI               │
├─────────────────────────────┤
│ Recent Workspaces           │
│                             │
│ 📁 lawless-ai/frontend      │
│    Last active: 2h ago      │
│                             │
│ 📁 my-project/main          │
│    Last active: 1d ago      │
│                             │
│ ─────────────────────────── │
│                             │
│ [+ New Workspace]           │
└─────────────────────────────┘
```

---

## Performance Considerations

### 1. Virtual DOM Portaling (Already Implemented)
The current portal architecture keeps all panes mounted but hidden. This is perfect for mobile - we just show one at a time without unmounting.

### 2. Lazy Loading
```tsx
// Dynamic imports for panes not immediately needed
const DatabasePane = dynamic(() => import('./panes/DatabasePane'), {
  loading: () => <PaneLoading />,
});
```

### 3. Touch Optimization
```css
/* Disable text selection on interactive elements */
.mobile-ide-layout button,
.mobile-ide-layout .interactive {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Faster touch response */
.mobile-nav-item {
  touch-action: manipulation;
}
```

### 4. Reduce Animations on Low-Power Mode
```tsx
const prefersReducedMotion = usePrefersReducedMotion();

const terminalTransition = prefersReducedMotion
  ? 'none'
  : 'height 0.2s ease-out';
```

---

## Implementation Phases

### Phase 1: Foundation (Core Layout)
- [ ] Create `MobileIDELayout.tsx` component
- [ ] Add `useMobileDetection` hook
- [ ] Implement `mobile-ide.css` styles
- [ ] Add layout switching logic in `IDELayout.tsx`
- [ ] Create `MobileBottomNav.tsx` component
- [ ] Wire up main pane switching (Preview default)

### Phase 2: Bottom Zone (Terminal + Chat)
- [ ] Create `MobileBottomZone.tsx` component
- [ ] Implement Terminal ↔ Chat toggle
- [ ] Add collapsible/expandable height states
- [ ] Add drag handle with gesture support
- [ ] Integrate existing `useTerminal` hook
- [ ] Add keyboard toolbar (terminal only)
- [ ] Implement chat unread badge counter

### Phase 3: Main Pane Optimization
- [ ] Optimize `PreviewPane` for mobile (default view, touch controls)
- [ ] Optimize `EditorPane` for mobile (file browser ↔ editor modes)
- [ ] Optimize `DatabasePane` for mobile (drill-down navigation)
- [ ] Optimize `DeploymentsPane` for mobile (card layout)
- [ ] Optimize `ActivityPane` for mobile (timeline view)

### Phase 4: Chat Integration in Bottom Zone
- [ ] Adapt `ChatPane` to work in bottom zone
- [ ] Add voice input option
- [ ] Implement quick prompts (long-press send)
- [ ] Add expandable code diffs in messages
- [ ] Wire up unread count to store

### Phase 5: Navigation & Gestures
- [ ] Implement swipe navigation for main pane
- [ ] Add swipe up/down for bottom zone height
- [ ] Implement pinch-to-zoom in Preview
- [ ] Add haptic feedback for interactions
- [ ] Test and refine gesture thresholds

### Phase 6: Polish & Performance
- [ ] Optimize for 60fps animations
- [ ] Add loading states and skeletons
- [ ] Test on real devices (iOS Safari, Chrome Android)
- [ ] Handle virtual keyboard appearance/dismissal
- [ ] Add safe area insets for notched phones
- [ ] Implement reduced motion support

---

## Testing Checklist

### Devices to Test
- [ ] iPhone SE (small screen)
- [ ] iPhone 14/15 Pro (notch/dynamic island)
- [ ] iPad Mini (tablet edge case)
- [ ] Samsung Galaxy S series
- [ ] Pixel phones
- [ ] Budget Android devices (performance)

### Scenarios to Test
- [ ] Terminal typing with virtual keyboard
- [ ] Switching between Terminal and Chat
- [ ] Chat while server running in terminal
- [ ] Preview interaction (scroll, tap, zoom)
- [ ] Code editing with autocomplete
- [ ] Database table with many columns
- [ ] Rapid main pane switching
- [ ] Bottom zone expand/collapse gestures
- [ ] Background/foreground transitions
- [ ] Slow network conditions
- [ ] Chat unread badge updates

---

## Success Metrics

1. **Time to First Interaction**: < 3s from login to preview + terminal ready
2. **Pane Switch Speed**: < 200ms for visual transition
3. **Terminal ↔ Chat Switch**: < 100ms (instant feel)
4. **Terminal Latency**: < 50ms keystroke to display
5. **Touch Responsiveness**: No dropped taps or gestures
6. **Battery Impact**: Minimal background CPU usage

---

## Future Enhancements

1. **Offline Mode**: Cache recent files for offline viewing
2. **Split View on Tablets**: Preview + Terminal/Chat side-by-side on iPad
3. **Voice Commands**: "Run npm install", "Show preview"
4. **Shortcuts Widget**: iOS/Android home screen widget for quick actions
5. **Push Notifications**: Build complete, AI response ready
6. **Bluetooth Keyboard**: Full keyboard support when connected
7. **Picture-in-Picture Preview**: Floating preview while in other apps
