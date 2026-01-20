# Mobile IDE Optimization Plan

## Executive Summary

Transform the Lawless AI IDE into a mobile-first development experience where users can:
- Configure everything online from their phone
- Develop in terminal with instant preview toggling
- Navigate between major panes via bottom navigation
- Work efficiently with one pane visible at a time

This plan maintains the existing desktop experience while adding a completely reimagined mobile layout.

---

## Core Mobile UX Principles

### 1. Single Pane Focus
- Only one major pane visible at a time (no split views on mobile)
- Fast switching via bottom nav and gestures
- Preserves pane state when switching (portal architecture already supports this)

### 2. Terminal-Centric Development
- Terminal lives at the bottom of the screen (collapsible)
- Other content panes render above the terminal
- Collapse terminal to see full preview/editor/etc.
- Expand terminal to focus on command-line work

### 3. Progressive Disclosure
- AI assistant drawer hidden by default, swipe up to reveal
- Advanced controls collapsed behind menus
- Essential actions always one tap away

---

## Mobile Layout Architecture

### Screen Structure

```
┌─────────────────────────────┐
│  Header (repo + session)    │  ← Minimal: repo name, session indicator, overflow menu
├─────────────────────────────┤
│                             │
│                             │
│     Active Pane Area        │  ← One pane fills this space
│   (Editor/Preview/Chat/     │
│    Database/Deployments)    │
│                             │
│                             │
├─────────────────────────────┤
│  ▼ Terminal (collapsible)   │  ← Always visible, can expand/collapse
│  $ npm run dev              │
│  > Ready on port 3000       │
├─────────────────────────────┤
│ 📝  👁  💬  📊  ...  │  ← Bottom nav for pane switching
└─────────────────────────────┘
```

### Terminal States

**Collapsed Mode** (preview-focused):
```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│                             │
│     Preview/Editor          │
│     (Full Height)           │
│                             │
├─────────────────────────────┤
│ ▲ Terminal ─────────── ⚡   │  ← Collapsed: just a bar with expand handle
├─────────────────────────────┤
│ 📝  👁  💬  📊  ...  │
└─────────────────────────────┘
```

**Expanded Mode** (terminal-focused):
```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│  Preview (collapsed)    ▼   │  ← Minimal pane header, tap to expand
├─────────────────────────────┤
│                             │
│     Terminal                │
│     (Expanded - 70% height) │
│     $ _                     │
│                             │
├─────────────────────────────┤
│ Tab │ Esc │ ⌃C │ ⌃D │ ↑ ↓  │  ← Keyboard toolbar
├─────────────────────────────┤
│ 📝  👁  💬  📊  ...  │
└─────────────────────────────┘
```

**Full Screen Mode** (tap terminal header):
```
┌─────────────────────────────┐
│ Terminal           ✕ Full   │
├─────────────────────────────┤
│                             │
│     Terminal                │
│     (100% - keyboard)       │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│ Tab │ Esc │ ⌃C │ ⌃D │ ↑ ↓  │
├─────────────────────────────┤
│ 📝  👁  💬  📊  ...  │
└─────────────────────────────┘
```

---

## Bottom Navigation Design

### Primary Nav Items (always visible)

| Icon | Pane | Purpose |
|------|------|---------|
| 📝 | Editor | File browser + code editing |
| 👁 | Preview | Local dev server / deployed preview |
| 💬 | Chat | AI assistant conversation |
| 🗄️ | Database | Supabase tables and SQL |
| ⚡ | Terminal | Quick toggle terminal focus (special) |

### Overflow Menu (tap "..." or long-press any item)

| Icon | Pane | Purpose |
|------|------|---------|
| 🚀 | Deployments | Vercel deployment status |
| 📋 | Activity | Session activity log |
| ⚙️ | Settings | IDE settings & preferences |

### Navigation Behavior

1. **Tap** - Switch to that pane (above terminal)
2. **Long-press** - Show pane options (fullscreen, settings)
3. **Terminal icon** - Toggle terminal expand/collapse
4. **Double-tap current** - Toggle fullscreen for current pane

### Visual States

```css
/* Active pane indicator */
.mobile-nav-item.active {
  color: var(--accent-purple);
  border-top: 2px solid var(--accent-purple);
}

/* Terminal indicator when running */
.mobile-nav-terminal.running::after {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--green-500);
  border-radius: 50%;
  position: absolute;
  top: 4px;
  right: 4px;
}
```

---

## Pane-by-Pane Mobile Optimization

### 1. Terminal Pane (Bottom Anchored)

**Current State**: Has mobile keyboard toolbar, but not optimized for bottom-anchored layout

**Mobile Optimizations**:

```tsx
// New terminal height states
type TerminalHeight = 'collapsed' | 'half' | 'expanded' | 'fullscreen';

// Gesture support
- Drag handle to resize
- Swipe up to expand
- Swipe down to collapse
- Double-tap header for fullscreen
```

**Features**:
- Collapsible to single bar (shows last output line)
- Half-screen mode for quick commands
- Full-screen mode for heavy terminal work
- Keyboard toolbar always visible when expanded
- Tab switcher as horizontal scroll

**Tab Management on Mobile**:
```
┌─────────────────────────────────────┐
│ ◀ │ main │ feature/auth │ + │ ▶    │  ← Horizontal scrollable tabs
├─────────────────────────────────────┤
```

### 2. Editor Pane

**Current State**: File tree + editor side-by-side (desktop layout)

**Mobile Layout**:

```
Mode 1: File Browser (default on pane select)
┌─────────────────────────────┐
│  📁 src/                    │
│    📁 components/           │
│      📄 Button.tsx          │
│      📄 Header.tsx          │
│    📁 pages/                │
│      📄 index.tsx      ←tap │
│  📁 public/                 │
└─────────────────────────────┘

Mode 2: File Editor (after file selection)
┌─────────────────────────────┐
│ ← index.tsx            💾 ⋮ │  ← Back button + file name + actions
├─────────────────────────────┤
│ import React from 'react';  │
│                             │
│ export default function() { │
│   return <div>Hello</div>;  │
│ }                           │
│                             │
│ [keyboard]                  │
└─────────────────────────────┘
```

**Key Features**:
- Two distinct modes: file browser vs editor
- Back navigation from editor to browser
- Breadcrumb path display
- Quick file switcher (swipe left/right between open files)
- Floating save button
- Monaco editor with mobile-optimized touch handling

**File Tree Gestures**:
- Tap: Open file / expand folder
- Long-press: Context menu (rename, delete, copy path)
- Swipe right: Quick actions (reveal in terminal, copy path)

### 3. Preview Pane

**Current State**: Local/Deployed toggle with port pills

**Mobile Layout**:

```
┌─────────────────────────────┐
│ Local ────────── Deployed   │  ← Segmented control
├─────────────────────────────┤
│ 🔴 3000 │ 3001 │ 5173      │  ← Port pills (scrollable)
├─────────────────────────────┤
│                             │
│   [iframe preview]          │
│                             │
│                             │
├─────────────────────────────┤
│ ↻ │ ← │ → │ 🔗 │ ⚙️        │  ← Refresh, nav, open external, settings
└─────────────────────────────┘
```

**Features**:
- Touch-friendly refresh/navigation controls
- Pinch-to-zoom in preview
- "Open in browser" prominent for full testing
- Console logs in expandable drawer (swipe up from bottom)
- Device frame previews (iPhone, Android sizes)

**Quick Actions Bar**:
```tsx
<PreviewActions>
  <RefreshButton />
  <BackButton />
  <ForwardButton />
  <OpenExternalButton /> {/* Opens in mobile browser */}
  <DeviceFrameSelector /> {/* None, iPhone, Android */}
</PreviewActions>
```

### 4. Chat Pane (AI Assistant)

**Current State**: Full chat interface with mode toggle

**Mobile Layout**:

```
┌─────────────────────────────┐
│ 💬 AI Chat    Terminal | WS │  ← Mode toggle
├─────────────────────────────┤
│                             │
│ [AI] How can I help?        │
│                             │
│ [You] Add dark mode         │
│                             │
│ [AI] I'll add dark mode...  │
│ ────────────────────────    │
│ 📎 3 files changed          │  ← Expandable diff viewer
│                             │
├─────────────────────────────┤
│ 📷 📎 🎤 │ Type message... │ 🔵│
└─────────────────────────────┘
```

**Features**:
- Inline code blocks with "Apply" buttons
- Expandable file diffs
- Voice input option
- Screenshot attachment (for bug reports)
- Quick prompts drawer (common commands)

**Quick Prompts (swipe up)**:
```
┌─────────────────────────────┐
│ 🔧 Fix this error           │
│ 📝 Explain this code        │
│ ✨ Add a feature            │
│ 🧪 Write tests              │
│ 🔍 Review this file         │
└─────────────────────────────┘
```

### 5. Database Pane

**Current State**: Table browser with SQL editor

**Mobile Layout**:

```
Mode 1: Table Browser
┌─────────────────────────────┐
│ 🔍 Search tables...         │
├─────────────────────────────┤
│ 📊 users (1,234 rows)       │
│ 📊 posts (5,678 rows)       │
│ 📊 comments (12,345 rows)   │
│ 📊 sessions (89 rows)       │
└─────────────────────────────┘

Mode 2: Table View
┌─────────────────────────────┐
│ ← users                🔍 + │
├─────────────────────────────┤
│ id │ email │ name │ ...  ▶ │  ← Horizontal scroll
├─────────────────────────────┤
│ 1  │ a@b.. │ Alice│        │
│ 2  │ c@d.. │ Bob  │        │
│ [tap row to expand]        │
└─────────────────────────────┘

Mode 3: Row Detail
┌─────────────────────────────┐
│ ← Row #1            ✏️ 🗑️  │
├─────────────────────────────┤
│ id: 1                       │
│ email: alice@example.com    │
│ name: Alice                 │
│ created_at: 2024-01-15      │
│ metadata: {...}        [▼]  │
└─────────────────────────────┘

Mode 4: SQL Editor
┌─────────────────────────────┐
│ SQL                    ▶ Run│
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
- Row detail view for editing
- Collapsible SQL editor
- Query history drawer

### 6. Deployments Pane

**Current State**: Vercel deployment list with status

**Mobile Layout**:

```
┌─────────────────────────────┐
│ 🚀 Deployments    main ▼    │  ← Branch filter
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

### 7. Activity Pane

**Current State**: Activity log

**Mobile Layout**:

```
┌─────────────────────────────┐
│ 📋 Activity     Filter ▼    │
├─────────────────────────────┤
│ 🔵 10:32 - File saved       │
│    src/components/Button.tsx│
│ 🟢 10:31 - Server started   │
│    Port 3000                │
│ 🟡 10:30 - AI suggestion    │
│    "Consider adding tests"  │
│ 🔵 10:28 - Terminal command │
│    npm run dev              │
└─────────────────────────────┘
```

---

## Technical Implementation

### Phase 1: Mobile Detection & Layout Switch

**New Component: MobileIDELayout.tsx**

```tsx
// app/ide/components/MobileIDELayout.tsx

import { useMobileDetection } from '@/hooks/useMobileDetection';

export function MobileIDELayout() {
  const [activePane, setActivePane] = useState<PaneId>('editor');
  const [terminalHeight, setTerminalHeight] = useState<TerminalHeight>('collapsed');

  return (
    <div className="mobile-ide-layout">
      {/* Minimal header */}
      <MobileIDEHeader />

      {/* Active pane area */}
      <div className="mobile-pane-area">
        <PaneRenderer paneId={activePane} />
      </div>

      {/* Terminal (always present, variable height) */}
      <MobileTerminal
        height={terminalHeight}
        onHeightChange={setTerminalHeight}
      />

      {/* Bottom navigation */}
      <MobileBottomNav
        activePane={activePane}
        onPaneChange={setActivePane}
        terminalHeight={terminalHeight}
        onTerminalToggle={() => {
          setTerminalHeight(h => h === 'collapsed' ? 'half' : 'collapsed');
        }}
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

### Phase 2: Mobile-Specific Hooks

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

**useMobileTerminal.ts** (extends useTerminal):
```tsx
export function useMobileTerminal() {
  const terminal = useTerminal();

  // Add gesture handling
  const gestureHandlers = useGestureHandlers({
    onSwipeUp: () => expandTerminal(),
    onSwipeDown: () => collapseTerminal(),
    onDoubleTap: () => toggleFullscreen(),
  });

  // Mobile keyboard management
  const keyboardVisible = useKeyboardVisibility();

  return {
    ...terminal,
    ...gestureHandlers,
    keyboardVisible,
  };
}
```

### Phase 3: Store Updates

**ideStore.ts additions**:

```tsx
// Add to IDEStore interface
interface MobileState {
  // Mobile-specific state
  isMobileView: boolean;
  activePane: PaneId;
  terminalHeight: TerminalHeight;

  // Actions
  setActivePane: (pane: PaneId) => void;
  setTerminalHeight: (height: TerminalHeight) => void;
  toggleTerminal: () => void;
}

// Add to store
mobile: {
  isMobileView: false,
  activePane: 'editor',
  terminalHeight: 'collapsed',

  setActivePane: (pane) => set((state) => ({
    mobile: { ...state.mobile, activePane: pane }
  })),

  setTerminalHeight: (height) => set((state) => ({
    mobile: { ...state.mobile, terminalHeight: height }
  })),

  toggleTerminal: () => set((state) => ({
    mobile: {
      ...state.mobile,
      terminalHeight: state.mobile.terminalHeight === 'collapsed' ? 'half' : 'collapsed'
    }
  })),
}
```

### Phase 4: CSS Architecture

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

/* Active Pane Area */
.mobile-pane-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Terminal Container */
.mobile-terminal {
  flex-shrink: 0;
  transition: height 0.2s ease-out;
  border-top: 1px solid var(--border);
}

.mobile-terminal[data-height="collapsed"] {
  height: 40px;
}

.mobile-terminal[data-height="half"] {
  height: 40vh;
}

.mobile-terminal[data-height="expanded"] {
  height: 70vh;
}

.mobile-terminal[data-height="fullscreen"] {
  position: fixed;
  inset: 0;
  height: 100dvh;
  z-index: 100;
}

/* Terminal Drag Handle */
.terminal-drag-handle {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}

.terminal-drag-handle::before {
  content: '';
  width: 32px;
  height: 4px;
  background: var(--muted);
  border-radius: 2px;
}

/* Bottom Navigation */
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
  width: 24px;
  height: 24px;
}

.mobile-nav-item span {
  font-size: 10px;
  margin-top: 2px;
}

/* Keyboard Toolbar */
.mobile-keyboard-toolbar {
  display: flex;
  gap: 4px;
  padding: 8px;
  overflow-x: auto;
  background: var(--muted);
  border-top: 1px solid var(--border);
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
```

---

## Gesture Support

### Terminal Gestures

| Gesture | Action |
|---------|--------|
| Swipe up on terminal | Expand to next height level |
| Swipe down on terminal | Collapse to previous height level |
| Double-tap terminal header | Toggle fullscreen |
| Drag handle | Fine-grained height adjustment |

### Pane Gestures

| Gesture | Action |
|---------|--------|
| Swipe left | Next pane (in nav order) |
| Swipe right | Previous pane (in nav order) |
| Pinch (Preview) | Zoom in/out |
| Long-press | Context menu |

### Implementation with use-gesture

```tsx
import { useGesture } from '@use-gesture/react';

function MobileTerminal({ height, onHeightChange }) {
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
- [ ] Implement mobile-specific CSS
- [ ] Add layout switching logic in `IDELayout.tsx`
- [ ] Create `MobileBottomNav.tsx` component
- [ ] Wire up basic pane switching

### Phase 2: Terminal (Bottom-Anchored)
- [ ] Create `MobileTerminal.tsx` wrapper
- [ ] Implement collapsible/expandable states
- [ ] Add drag handle with gesture support
- [ ] Adapt keyboard toolbar for new layout
- [ ] Add swipe gestures for height control

### Phase 3: Pane Optimization
- [ ] Optimize `EditorPane` for mobile (two-mode layout)
- [ ] Optimize `PreviewPane` for mobile (touch controls)
- [ ] Optimize `ChatPane` for mobile (voice input, quick prompts)
- [ ] Optimize `DatabasePane` for mobile (drill-down navigation)
- [ ] Optimize `DeploymentsPane` for mobile (card layout)
- [ ] Optimize `ActivityPane` for mobile (timeline view)

### Phase 4: Navigation & Gestures
- [ ] Implement swipe navigation between panes
- [ ] Add long-press context menus
- [ ] Implement pinch-to-zoom in Preview
- [ ] Add haptic feedback for interactions
- [ ] Test and refine gesture thresholds

### Phase 5: Polish & Performance
- [ ] Optimize for 60fps animations
- [ ] Add loading states and skeletons
- [ ] Implement offline indicators
- [ ] Test on real devices (iOS Safari, Chrome Android)
- [ ] Handle keyboard appearance/dismissal
- [ ] Add safe area insets for notched phones

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
- [ ] Code editing with autocomplete
- [ ] Preview interaction (scroll, tap, zoom)
- [ ] Chat with long code blocks
- [ ] Database table with many columns
- [ ] Rapid pane switching
- [ ] Background/foreground transitions
- [ ] Slow network conditions
- [ ] Landscape orientation (if supported)

---

## Success Metrics

1. **Time to First Interaction**: < 3s from login to terminal ready
2. **Pane Switch Speed**: < 200ms for visual transition
3. **Terminal Latency**: < 50ms keystroke to display
4. **Touch Responsiveness**: No dropped taps or gestures
5. **Battery Impact**: Minimal background CPU usage

---

## Future Enhancements

1. **Offline Mode**: Cache recent files for offline viewing
2. **Split View on Tablets**: Two panes side-by-side on iPad
3. **Voice Commands**: "Run npm install", "Show preview"
4. **Shortcuts Widget**: iOS/Android home screen widget for quick actions
5. **Push Notifications**: Build complete, error alerts
6. **Bluetooth Keyboard**: Full keyboard support when connected
