# Mobile Optimization Plan for Lawless AI

## Executive Summary

A two-tier mobile strategy: the **main app** keeps its current functional mobile layout, while the **IDE** (`/ide/[...repo]`) provides a hyper-refined, purpose-built mobile coding experience. When users enter the IDE, the entire UI transforms into an optimized development environment.

---

## Architecture Overview

```
Main App (/, /repos, /databases, etc.)
├── Current mobile layout (works well)
├── Sidebar → Drawer on mobile
├── Bottom sheet patterns
└── Standard responsive behavior

IDE (/ide/[...repo])
├── Dedicated MobileIDELayout
├── Custom MobileHeader with repo context
├── MobileTabBar for 7-pane navigation
├── Swipe gestures between panes
├── Pull-to-refresh on data panes
└── Touch-optimized controls throughout
```

---

## Part 1: Main App Mobile (Maintain & Polish)

**Status:** Functional, minor enhancements only

### What Works Well (Keep As-Is)
- Sidebar transforms to drawer on mobile (< 768px)
- Bottom sheet pattern for workspace selection
- Touch targets meet 44x44px minimum
- Safe area insets supported (notch/dynamic island)
- Viewport meta tags properly configured
- Navigation to all pages functional

### Minor Enhancements (Low Priority)
- [ ] Pull-to-refresh on `/repos` page
- [ ] Slightly larger touch targets on repo cards
- [ ] Smoother drawer animation
- [ ] Better empty states on mobile

---

## Part 2: IDE Mobile Experience (Primary Focus)

**Status:** Foundation built, needs refinement

### 2.1 Current Implementation

#### Components Built
- `MobileIDELayout` - Container that detects mobile and renders appropriate layout
- `MobileHeader` - Repo name, branch, actions (replaces desktop header)
- `MobileTabBar` - Bottom navigation for 7 panes
- `MobileFileTreeSheet` - Bottom sheet file browser
- `PullToRefresh` - Touch gesture for refreshing data panes

#### CSS Structure
```
app/ide/styles/mobile/
├── index.css          # Main import file
├── layout.css         # Core mobile layout
├── header.css         # Mobile header styles
├── tab-bar.css        # Bottom tab navigation
├── components/
│   ├── bottom-sheet.css
│   ├── swipeable.css
│   └── pull-to-refresh.css
└── panes/
    ├── chat.css
    ├── editor.css
    ├── terminal.css
    ├── preview.css
    ├── database.css
    ├── deployments.css
    └── activity.css
```

### 2.2 The 7 Panes

| # | Pane | Icon | Primary Action | Refresh Action |
|---|------|------|----------------|----------------|
| 1 | Chat | MessageSquare | AI conversation | - |
| 2 | Editor | Code | View/edit files | - |
| 3 | Preview | Eye | View app preview | Reload iframe |
| 4 | Database | Database | Manage data | Reload tables |
| 5 | Deployments | Rocket | Deploy status | Fetch deployments |
| 6 | Activity | Activity | Event log | Reload events |
| 7 | Terminal | Terminal | Run commands | - |

### 2.3 Refinement Checklist

#### Chat Pane
- [ ] Optimize message input for mobile keyboard
- [ ] Auto-scroll to bottom on new messages
- [ ] Collapsible tool call results
- [ ] Quick action chips (horizontally scrollable)
- [ ] Voice input button (future)
- [ ] Haptic feedback on send

#### Editor Pane
- [ ] File tree as bottom sheet (built, needs polish)
- [ ] Horizontal tab scrolling for open files
- [ ] Mobile-optimized Monaco settings
- [ ] Pinch-to-zoom on code
- [ ] Quick actions toolbar (save, format, undo)
- [ ] Syntax highlighting theme optimized for mobile
- [ ] Line number tap to select line

#### Preview Pane
- [ ] Pull-to-refresh (built)
- [ ] Port selector as horizontal pills (built)
- [ ] Device frame selector (iPhone, Android, responsive)
- [ ] Orientation toggle (portrait/landscape)
- [ ] Console as collapsible bottom section
- [ ] Screenshot button

#### Database Pane
- [ ] Pull-to-refresh (built)
- [ ] Table selector as horizontal scroll
- [ ] Card view for rows (vs table view)
- [ ] Swipe to delete row
- [ ] Inline edit with tap
- [ ] SQL query sheet (slide up)
- [ ] Migration runner with status badges

#### Deployments Pane
- [ ] Pull-to-refresh (built)
- [ ] Deployment cards with status indicators
- [ ] Log viewer as full-screen sheet
- [ ] One-tap redeploy
- [ ] Branch filter chips
- [ ] Env var editor sheet

#### Activity Pane
- [ ] Pull-to-refresh (built)
- [ ] Grouped by time (Today, Yesterday, etc.)
- [ ] Filter chips by type
- [ ] Tap to expand details
- [ ] Clear all button
- [ ] Real-time updates indicator

#### Terminal Pane
- [ ] Full-screen terminal experience
- [ ] Custom keyboard toolbar (Tab, Ctrl, arrows, etc.)
- [ ] Command history sheet (swipe up)
- [ ] Copy/paste buttons
- [ ] Clear terminal button
- [ ] Multiple terminal tabs
- [ ] Landscape optimization

---

## Part 3: Gestures & Interactions

### 3.1 Implemented
- [x] Swipe left/right between panes
- [x] Pull-to-refresh on data panes
- [x] Bottom sheet drag-to-dismiss
- [x] Tap tab to switch panes

### 3.2 To Implement
- [ ] Long press on file for context menu
- [ ] Pinch-to-zoom on code editor
- [ ] Swipe to delete (database rows, activity items)
- [ ] Double-tap to zoom preview
- [ ] Three-finger swipe for undo/redo (editor)

### 3.3 Haptic Feedback
- [ ] Tab switch vibration (light)
- [ ] Pull-to-refresh threshold (medium)
- [ ] Destructive actions (heavy)
- [ ] Success confirmations (success pattern)

---

## Part 4: Visual Polish

### 4.1 Animations
- [ ] Smooth pane transitions (spring physics)
- [ ] Tab bar indicator animation
- [ ] Pull indicator bounce
- [ ] Sheet slide-up with backdrop blur
- [ ] Loading skeleton animations

### 4.2 Typography
- [ ] Slightly larger base font on mobile (16px min)
- [ ] Code font optimized for mobile (SF Mono, 14px)
- [ ] Line height adjustments for readability
- [ ] Truncation with ellipsis consistently

### 4.3 Spacing
- [ ] Consistent 16px horizontal padding
- [ ] 12px vertical rhythm
- [ ] Safe area respect on all edges
- [ ] Thumb-zone optimization for key actions

### 4.4 Dark Mode Optimization
- [ ] OLED-friendly true blacks where appropriate
- [ ] Reduced contrast for night coding
- [ ] Syntax highlighting colors tuned for mobile screens

---

## Part 5: Performance

### 5.1 Mobile-Specific Optimizations
- [ ] Lazy load panes (only render active pane)
- [ ] Virtualized lists (activity, deployments, file tree)
- [ ] Debounced scroll handlers
- [ ] Reduced animation on low-power mode
- [ ] Image optimization for previews

### 5.2 Offline Considerations
- [ ] Cache last viewed files
- [ ] Queue actions when offline
- [ ] Offline indicator in header
- [ ] Sync status for pending changes

---

## Part 6: Testing Matrix

### Devices to Test
- [ ] iPhone SE (375px) - Smallest target
- [ ] iPhone 14 (390px) - Standard
- [ ] iPhone 14 Pro Max (430px) - Large
- [ ] iPad Mini (768px) - Tablet threshold
- [ ] Android phones (various aspect ratios)

### Scenarios
- [ ] Cold start to IDE
- [ ] Switch between all 7 panes
- [ ] Edit file and save
- [ ] Run terminal command
- [ ] View deployment logs
- [ ] Query database
- [ ] Pull-to-refresh each pane
- [ ] Rotate device mid-task
- [ ] Background/foreground app
- [ ] Low battery / low-power mode

---

## Implementation Priority

### Phase 1: Core Polish (Current Sprint)
1. Chat pane keyboard optimization
2. Editor file tree sheet refinement
3. Terminal keyboard toolbar
4. Consistent spacing across all panes

### Phase 2: Interactions
5. Long press context menus
6. Pinch-to-zoom on editor
7. Swipe-to-delete gestures
8. Haptic feedback throughout

### Phase 3: Visual Refinement
9. Animation polish
10. Typography pass
11. Dark mode optimization
12. Loading states

### Phase 4: Performance & Testing
13. Lazy loading implementation
14. Device testing
15. Performance profiling
16. Bug fixes

---

## Success Criteria

- [ ] All 7 panes fully functional on mobile
- [ ] No horizontal scroll anywhere
- [ ] All touch targets >= 44x44px
- [ ] Pane switch < 100ms perceived
- [ ] Pull-to-refresh feels native
- [ ] Can complete full dev workflow on phone:
  - Open repo
  - Edit code
  - Run in terminal
  - Preview changes
  - Deploy
  - Monitor activity

---

## Technical Notes

### State Persistence
- Active pane stored in URL hash (`#chat`, `#editor`, etc.)
- Scroll positions preserved per pane
- Form state preserved on pane switch

### Keyboard Handling
- Input focus management on pane switch
- Virtual keyboard detection for layout adjustment
- Dismiss keyboard on pane switch (configurable)

### Orientation
- Portrait: Default, optimized layout
- Landscape: Editor and terminal get more height
- Lock option in settings (future)

---

## Files Reference

### IDE Mobile Components
- `/app/ide/components/mobile/MobileIDELayout.tsx`
- `/app/ide/components/mobile/MobileHeader.tsx`
- `/app/ide/components/mobile/MobileTabBar.tsx`
- `/app/ide/components/mobile/MobileFileTreeSheet.tsx`
- `/app/ide/components/mobile/PullToRefresh.tsx`

### IDE Mobile Styles
- `/app/ide/styles/mobile/` (all files)

### Hooks
- `/app/ide/hooks/useMobileDetection.ts`
- `/app/ide/hooks/useSwipeNavigation.ts` (to create)

---

## Notes

- Main app mobile is "good enough" - don't over-engineer
- IDE mobile is the differentiator - make it exceptional
- Test on real devices, not just simulators
- Prioritize the coding workflow (edit → terminal → preview)
- Consider PWA enhancements after core mobile is solid
