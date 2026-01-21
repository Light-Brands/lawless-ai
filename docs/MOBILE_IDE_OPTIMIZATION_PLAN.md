# Mobile IDE Optimization Plan

## Executive Summary

Transform the Lawless AI IDE into a mobile-first development environment. The IDE has 7 panes (Chat, Editor, Preview, Database, Deployments, Activity, Terminal) that must work seamlessly on mobile devices through a tab-based navigation system with swipe gestures.

---

## Current IDE Architecture

### The 7 Panes

| Pane | ID | Purpose | Mobile Priority |
|------|----|---------|-----------------|
| Chat | 1 | AI conversations | Critical |
| Editor | 2 | Code editing + file tree | Critical |
| Terminal | 7 | Command line | Critical |
| Preview | 3 | Live app preview | High |
| Database | 4 | Supabase tables | Medium |
| Deployments | 5 | Vercel status | Medium |
| Activity | 6 | Git history | Low |

### Current Desktop Behavior
- Horizontal panel layout with `react-resizable-panels`
- Max 5 visible panes at once
- Collapsed panes show as icons in left sidebar
- Default visible: Chat + Editor + Terminal
- Portal system keeps panes mounted when collapsed

### Key Files
- `/app/ide/components/IDELayout.tsx` - Main layout
- `/app/ide/components/IDEHeader.tsx` - Header with repo/session selectors
- `/app/ide/stores/ideStore.ts` - Pane state management
- `/app/ide/styles/layout.css` - Layout styles
- `/app/ide/components/panes/*/index.tsx` - Individual pane components

---

## Mobile Design Philosophy

### Core Principles
1. **Single pane visible at a time** - Full screen real estate for each pane
2. **Tab bar for switching** - Bottom navigation with all 7 panes accessible
3. **Swipe to switch** - Horizontal swipe between adjacent panes
4. **Persistent state** - Panes stay mounted, just hidden
5. **Quick actions** - Floating action button for common tasks

### Mobile Layout Structure
```
┌─────────────────────────┐
│      Mobile Header      │  ← Repo/branch, minimal actions
├─────────────────────────┤
│                         │
│                         │
│      Active Pane        │  ← Full screen, swipeable
│      (1 of 7)           │
│                         │
│                         │
├─────────────────────────┤
│  📱 Bottom Tab Bar      │  ← 5 visible + "More" menu
│  Chat|Code|Term|Prev|⋯  │
└─────────────────────────┘
```

---

## Phase 1: Mobile Detection & Layout Switch

### 1.1 Create Mobile Layout Component

**File:** `/app/ide/components/MobileIDELayout.tsx`

```tsx
// Responsibilities:
// - Render single active pane full-screen
// - Handle swipe gestures between panes
// - Render mobile bottom tab bar
// - Keep all panes mounted (hidden) for state preservation
```

**Tasks:**
- [ ] Create `MobileIDELayout.tsx` component
- [ ] Create `useMobileDetection` hook (check viewport width < 768px)
- [ ] Update `IDELayout.tsx` to conditionally render mobile vs desktop
- [ ] Create `MobileTabBar.tsx` component
- [ ] Create `MobileHeader.tsx` (simplified header)

### 1.2 Mobile Detection Hook

**File:** `/app/ide/hooks/useMobileDetection.ts`

```tsx
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
```

**Tasks:**
- [ ] Create mobile detection hook
- [ ] Add SSR-safe default (assume desktop on server)
- [ ] Consider using CSS media queries as fallback

### 1.3 Update IDE Store for Mobile

**File:** `/app/ide/stores/ideStore.ts`

Add mobile-specific state:
```tsx
// Add to store:
activeMobilePane: number;  // Currently visible pane on mobile
setActiveMobilePane: (pane: number) => void;
mobileTabOrder: number[];  // Order of tabs in bottom bar
```

**Tasks:**
- [ ] Add `activeMobilePane` state (default: 1 = Chat)
- [ ] Add `setActiveMobilePane` action
- [ ] Add `mobileTabOrder` state
- [ ] Persist mobile pane preference

---

## Phase 2: Mobile Bottom Tab Bar

### 2.1 Tab Bar Design

**Layout:** 5 tabs + "More" menu
```
┌──────┬──────┬──────┬──────┬──────┐
│ Chat │ Code │ Term │ Prev │  ⋯   │
│  💬  │  📝  │  >_  │  🌐  │ More │
└──────┴──────┴──────┴──────┴──────┘
```

**"More" menu contents:**
- Database
- Deployments
- Activity

### 2.2 Create Tab Bar Component

**File:** `/app/ide/components/mobile/MobileTabBar.tsx`

**Tasks:**
- [ ] Create tab bar with 5 primary slots
- [ ] Create "More" popup menu for overflow panes
- [ ] Add active tab indicator (top border or filled icon)
- [ ] Add badge support for notifications
- [ ] Handle safe area insets (iPhone notch/home indicator)
- [ ] Add haptic feedback on tab switch (if available)

### 2.3 Tab Bar Styles

**File:** `/app/ide/styles/mobile/tab-bar.css`

```css
.mobile-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom);
  background: #0a0a0c;
  border-top: 1px solid #1a1a1f;
  display: flex;
  z-index: 1000;
}

.mobile-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #666;
  background: transparent;
  border: none;
  padding: 8px 0;
  min-width: 64px;
}

.mobile-tab.active {
  color: #7c3aed;
}

.mobile-tab-icon {
  font-size: 20px;
}

.mobile-tab-label {
  font-size: 10px;
  font-weight: 500;
}
```

**Tasks:**
- [ ] Create mobile tab bar CSS
- [ ] Style active/inactive states
- [ ] Add touch feedback styles
- [ ] Test safe area insets on various devices

---

## Phase 3: Swipe Navigation

### 3.1 Swipe Implementation

**File:** `/app/ide/components/mobile/SwipeablePane.tsx`

Use `react-swipeable` or custom touch handlers:

```tsx
interface SwipeablePaneProps {
  activePaneId: number;
  onSwipeLeft: () => void;   // Next pane
  onSwipeRight: () => void;  // Previous pane
  children: React.ReactNode;
}
```

**Tasks:**
- [ ] Install `react-swipeable` or implement custom touch handling
- [ ] Create `SwipeablePane` wrapper component
- [ ] Add swipe threshold (min 50px swipe to trigger)
- [ ] Add visual feedback during swipe (peek next pane)
- [ ] Prevent swipe when interacting with scrollable content
- [ ] Add swipe animation (slide transition)

### 3.2 Pane Order for Swiping

Define logical swipe order:
```
Chat (1) ←→ Editor (2) ←→ Terminal (7) ←→ Preview (3) ←→ Database (4) ←→ Deployments (5) ←→ Activity (6)
```

**Tasks:**
- [ ] Define mobile pane order in store
- [ ] Allow user to customize swipe order (settings)
- [ ] Skip hidden panes when swiping

---

## Phase 4: Mobile Header

### 4.1 Simplified Mobile Header

**File:** `/app/ide/components/mobile/MobileHeader.tsx`

```
┌─────────────────────────────────┐
│ 🔀 repo/branch  │  ⚙️  👤      │
└─────────────────────────────────┘
```

**Elements:**
- Repo/branch selector (tap to open bottom sheet)
- Session indicator
- Settings button
- User menu

**Tasks:**
- [ ] Create `MobileHeader.tsx`
- [ ] Create repo selector bottom sheet
- [ ] Create session selector bottom sheet
- [ ] Simplify status indicators (single dot)
- [ ] Make header height 48px

### 4.2 Mobile Header Styles

**File:** `/app/ide/styles/mobile/header.css`

**Tasks:**
- [ ] Create mobile header CSS
- [ ] Ensure touch targets are 44x44px minimum
- [ ] Handle notch/dynamic island with safe-area-inset-top

---

## Phase 5: Pane-Specific Mobile Optimizations

### 5.1 Chat Pane (Mobile)

**Current:** Works reasonably well
**Priority:** High polish

**Tasks:**
- [ ] Full-width message input
- [ ] Keyboard-aware scrolling (input rises above keyboard)
- [ ] Larger touch targets for action buttons
- [ ] Optimize message bubbles for narrow viewport
- [ ] Add "scroll to bottom" floating button
- [ ] Collapsible tool call results

### 5.2 Editor Pane (Mobile)

**Current:** Needs significant work
**Priority:** Critical

**Mobile Editor Layout:**
```
┌─────────────────────────┐
│ File: path/to/file.ts  ▼│  ← File selector dropdown
├─────────────────────────┤
│                         │
│    Monaco Editor        │  ← Touch-friendly settings
│    (mobile mode)        │
│                         │
├─────────────────────────┤
│ 📂│ 💾│ ↩️│ ↪️│ 🔍│ ⚙️  │  ← Editor toolbar
└─────────────────────────┘
```

**Tasks:**
- [ ] Create file tree as bottom sheet (not sidebar)
- [ ] Add file selector dropdown in header
- [ ] Configure Monaco for mobile (larger font, touch scroll)
- [ ] Create editor toolbar with common actions
- [ ] Add "open in external editor" option
- [ ] Implement pinch-to-zoom for code
- [ ] Handle virtual keyboard properly

### 5.3 Terminal Pane (Mobile)

**Current:** Needs work
**Priority:** Critical

**Mobile Terminal Layout:**
```
┌─────────────────────────┐
│ Tab 1 │ Tab 2 │ +       │  ← Terminal tabs
├─────────────────────────┤
│                         │
│   Terminal Output       │  ← Scrollable output
│                         │
├─────────────────────────┤
│ $                      ⌨│  ← Input with keyboard toggle
├─────────────────────────┤
│ Tab│Ctrl│↑│↓│ C │ V │...│  ← Special keys toolbar
└─────────────────────────┘
```

**Tasks:**
- [ ] Create special keys toolbar (Tab, Ctrl, arrows, etc.)
- [ ] Larger touch targets for terminal
- [ ] Copy/paste buttons
- [ ] Terminal tabs as horizontal scroll
- [ ] Command history as bottom sheet
- [ ] Landscape mode optimization

### 5.4 Preview Pane (Mobile)

**Current:** Basic iframe
**Priority:** High

**Tasks:**
- [ ] Full-screen preview mode
- [ ] Refresh button in header
- [ ] Port selector dropdown
- [ ] "Open in browser" button
- [ ] Device frame simulation (optional)
- [ ] Handle preview URL bar

### 5.5 Database Pane (Mobile)

**Current:** Desktop-only layout
**Priority:** Medium

**Mobile Database Layout:**
```
┌─────────────────────────┐
│ Table: users          ▼ │  ← Table selector dropdown
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Row 1              →│ │  ← Tap to expand row
│ ├─────────────────────┤ │
│ │ Row 2              →│ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ + Add Row  │  SQL      │  ← Actions
└─────────────────────────┘
```

**Tasks:**
- [ ] Table selector as dropdown
- [ ] Row list view (not table grid)
- [ ] Row detail view (bottom sheet)
- [ ] SQL editor as bottom sheet
- [ ] Horizontal scroll for wide tables (fallback)

### 5.6 Deployments Pane (Mobile)

**Current:** Desktop cards
**Priority:** Medium

**Tasks:**
- [ ] Vertical deployment list
- [ ] Expandable deployment cards
- [ ] Log viewer as full-screen modal
- [ ] Status badges optimized for mobile
- [ ] Pull-to-refresh for deployment list

### 5.7 Activity Pane (Mobile)

**Current:** Basic list
**Priority:** Low

**Tasks:**
- [ ] Vertical commit list
- [ ] Commit detail bottom sheet
- [ ] Diff viewer as full-screen modal
- [ ] Pull-to-refresh

---

## Phase 6: Mobile-Specific Components

### 6.1 Components to Create

| Component | Purpose |
|-----------|---------|
| `MobileBottomSheet.tsx` | Reusable bottom sheet |
| `MobileTabBar.tsx` | Bottom navigation |
| `MobileHeader.tsx` | Simplified header |
| `SwipeablePane.tsx` | Swipe container |
| `MobileToolbar.tsx` | Context-aware toolbar |
| `SpecialKeysToolbar.tsx` | Terminal special keys |
| `MobileFileTree.tsx` | File tree bottom sheet |

### 6.2 Bottom Sheet Component

**File:** `/app/ide/components/mobile/MobileBottomSheet.tsx`

Features:
- Snap points: 25%, 50%, 90%
- Drag to dismiss
- Backdrop blur + dim
- Handle bar
- Max height: 90vh

**Tasks:**
- [ ] Create reusable bottom sheet
- [ ] Add snap point logic
- [ ] Add drag handle
- [ ] Add backdrop with blur
- [ ] Handle keyboard appearance

---

## Phase 7: Mobile CSS Architecture

### 7.1 Mobile CSS Files Structure

```
/app/ide/styles/
├── mobile/
│   ├── index.css         # Import all mobile styles
│   ├── layout.css        # Mobile layout overrides
│   ├── header.css        # Mobile header
│   ├── tab-bar.css       # Bottom tab bar
│   ├── panes/
│   │   ├── chat.css
│   │   ├── editor.css
│   │   ├── terminal.css
│   │   ├── preview.css
│   │   ├── database.css
│   │   ├── deployments.css
│   │   └── activity.css
│   └── components/
│       ├── bottom-sheet.css
│       ├── swipeable.css
│       └── toolbar.css
```

### 7.2 Mobile-First Media Queries

```css
/* Base = mobile */
.ide-layout { /* mobile styles */ }

/* Tablet and up */
@media (min-width: 768px) {
  .ide-layout { /* desktop styles */ }
}
```

**Tasks:**
- [ ] Create mobile CSS directory structure
- [ ] Convert existing CSS to mobile-first
- [ ] Add CSS custom properties for mobile spacing
- [ ] Test on various mobile viewports

---

## Phase 8: Mobile Gestures & Interactions

### 8.1 Touch Gestures

| Gesture | Action |
|---------|--------|
| Swipe left | Next pane |
| Swipe right | Previous pane |
| Swipe down on sheet | Dismiss bottom sheet |
| Long press | Context menu |
| Pull down | Refresh (where applicable) |
| Pinch | Zoom code (editor) |

### 8.2 Haptic Feedback

Use Vibration API where available:
```tsx
const triggerHaptic = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10); // Light tap
  }
};
```

**Tasks:**
- [ ] Add haptic feedback to tab switches
- [ ] Add haptic feedback to gestures
- [ ] Make haptic feedback configurable

---

## Phase 9: Performance Optimization

### 9.1 Mobile Performance Tasks

- [ ] Lazy load non-critical panes (Database, Deployments, Activity)
- [ ] Reduce Monaco editor bundle on mobile
- [ ] Use `requestAnimationFrame` for swipe animations
- [ ] Debounce resize events
- [ ] Optimize images with srcset
- [ ] Add skeleton loaders for pane content

### 9.2 Memory Management

- [ ] Unmount heavy components when backgrounded (Monaco, Terminal)
- [ ] Clear terminal history when hidden
- [ ] Limit chat history in memory

---

## Phase 10: Testing & Polish

### 10.1 Device Testing Matrix

| Device | Viewport | Priority |
|--------|----------|----------|
| iPhone SE | 375px | High |
| iPhone 14 | 390px | High |
| iPhone 14 Pro Max | 430px | High |
| Android (small) | 360px | Medium |
| Android (large) | 412px | Medium |
| iPad Mini | 768px | Low |

### 10.2 Testing Checklist

- [ ] All 7 panes accessible from mobile
- [ ] Swipe navigation works smoothly
- [ ] Tab bar visible and functional
- [ ] No horizontal overflow on any pane
- [ ] Keyboard doesn't cover input fields
- [ ] Touch targets >= 44x44px
- [ ] Safe areas respected (notch, home bar)
- [ ] Landscape mode functional
- [ ] Orientation changes don't break layout

---

## Implementation Order

### Sprint 1: Foundation (Week 1-2)
1. Mobile detection hook
2. Mobile layout component
3. Mobile tab bar
4. Basic pane switching (no swipe yet)

### Sprint 2: Core Panes (Week 3-4)
5. Chat pane mobile optimization
6. Editor pane mobile optimization
7. Terminal pane mobile optimization
8. Mobile header

### Sprint 3: Interactions (Week 5)
9. Swipe navigation
10. Bottom sheet component
11. Preview pane mobile optimization

### Sprint 4: Secondary Panes (Week 6)
12. Database pane mobile optimization
13. Deployments pane mobile optimization
14. Activity pane mobile optimization

### Sprint 5: Polish (Week 7)
15. Gestures & haptics
16. Performance optimization
17. Testing & bug fixes

---

## Success Criteria

- [ ] All 7 panes fully functional on mobile
- [ ] Smooth 60fps swipe transitions
- [ ] No layout shifts or overflow
- [ ] All touch targets >= 44px
- [ ] Terminal usable with mobile keyboard
- [ ] Code editor functional on mobile
- [ ] Preview pane shows live app
- [ ] Database pane allows CRUD operations
- [ ] Lighthouse mobile score >= 85

---

## Technical Decisions

### Single Pane vs Split View
**Decision:** Single pane on phones, optional split on tablets
- Phones: One pane at a time, full screen
- Tablets (768px+): Option for 2-pane split

### Pane Mounting Strategy
**Decision:** Keep all panes mounted, hide with CSS
- Preserves state across switches
- No re-initialization lag
- Memory trade-off acceptable for 7 panes

### Swipe Library
**Decision:** Use `react-swipeable` or native touch events
- Lightweight option preferred
- Must support velocity-based detection
- Cancel swipe if scrolling

### Bottom Sheet Library
**Decision:** Custom implementation
- Full control over behavior
- Matches app design language
- Snap points: 25%, 50%, 90%
