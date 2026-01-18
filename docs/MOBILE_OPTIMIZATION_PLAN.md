# Mobile Optimization Plan for Lawless AI

## Executive Summary

Transform Lawless AI into a mobile-first application where mobile is the primary experience. This plan addresses all pages, navigation patterns, and interactions to ensure the mobile experience is exceptional.

---

## Current State Assessment

### What Works Well
- Sidebar transforms to drawer on mobile (< 768px)
- Bottom sheet pattern exists for workspace selection
- Touch targets meet 44x44px minimum
- Safe area insets supported (notch/dynamic island)
- Viewport meta tags properly configured
- Basic responsive breakpoints defined

### Critical Gaps
1. **Desktop-first CSS** - Need to invert to mobile-first
2. **Multi-panel layouts** - Workspace/terminal pages unusable on mobile
3. **Navigation** - No mobile navigation to advanced pages
4. **Page-specific optimization** - Databases, Deployments, Integrations pages have minimal mobile support

---

## Phase 1: Mobile Navigation Overhaul

**Goal:** Ensure all pages are accessible from mobile

### 1.1 Mobile Navigation Menu
- [ ] Add bottom navigation bar for primary actions (Home, Repos, Tools)
- [ ] Add "More" menu for secondary pages (Databases, Deployments, Integrations)
- [ ] Convert sidebar to full-screen mobile menu with all navigation options
- [ ] Add visual indicators for current page

### 1.2 Navigation Structure
```
Bottom Nav (always visible on mobile):
├── Home (Chat) - Primary action
├── Repos - Repository browser
├── Tools - Quick access to common tools
└── More - Opens full menu

Full Menu (slide-up sheet):
├── All navigation from sidebar
├── Databases
├── Deployments
├── Integrations
├── Settings
└── New Project
```

### 1.3 Files to Modify
- `/app/styles/mobile-menu.css` - Enhance mobile menu
- `/app/components/` - Create MobileNav component
- `/app/styles/variables.css` - Add bottom nav height variable

---

## Phase 2: Mobile-First CSS Refactor

**Goal:** Invert CSS to mobile-first approach

### 2.1 Breakpoint Strategy (Mobile-First)
```css
/* Base styles = mobile (< 640px) */
.component { /* mobile styles */ }

/* Small tablets (640px+) */
@media (min-width: 640px) { }

/* Tablets (768px+) */
@media (min-width: 768px) { }

/* Laptops (1024px+) */
@media (min-width: 1024px) { }

/* Desktops (1280px+) */
@media (min-width: 1280px) { }
```

### 2.2 CSS Files to Refactor (Priority Order)
1. [ ] `/app/styles/responsive.css` - Convert all max-width to min-width
2. [ ] `/app/styles/base.css` - Mobile-first layout foundation
3. [ ] `/app/styles/sidebar.css` - Hidden by default, show on desktop
4. [ ] `/app/styles/chat.css` - Optimize for mobile-first
5. [ ] `/app/styles/repos.css` - Single column default
6. [ ] `/app/styles/workspace.css` - Complete mobile redesign
7. [ ] `/app/styles/databases.css` - Mobile optimization
8. [ ] `/app/styles/deployments.css` - Mobile optimization
9. [ ] `/app/styles/repo-browser.css` - Mobile tree view

---

## Phase 3: Page-by-Page Mobile Optimization

### 3.1 Home/Chat Page (`/`)
**Current:** Mostly works, some polish needed
**Priority:** Medium

- [ ] Optimize welcome screen for mobile
- [ ] Ensure message bubbles don't overflow
- [ ] Improve input area for mobile keyboards
- [ ] Add keyboard-aware scrolling
- [ ] Optimize feature cards for single column
- [ ] Make suggestion chips scrollable horizontally

### 3.2 Repos Page (`/repos`)
**Current:** Basic support exists
**Priority:** Medium

- [ ] Full-width search on mobile
- [ ] Single column repo cards
- [ ] Larger touch targets for repo items
- [ ] Pull-to-refresh gesture
- [ ] Sticky header with search

### 3.3 Repository Browser (`/repos/[owner]/[repo]`)
**Current:** Partial support
**Priority:** High

- [ ] Collapsible file tree (drawer or bottom sheet)
- [ ] Full-screen file viewer
- [ ] Swipe gestures for navigation
- [ ] Breadcrumb overflow handling
- [ ] Touch-friendly file selection

### 3.4 Workspace Page (`/workspace/[...repo]`)
**Current:** Minimal mobile support
**Priority:** Critical

- [ ] Single-panel view with tab switching
- [ ] Bottom sheet for file browser
- [ ] Full-screen code editor
- [ ] Collapsible chat panel (slide from right)
- [ ] Floating action button for common actions

### 3.5 Terminal Page (`/terminal/[...repo]`)
**Current:** Minimal mobile support
**Priority:** High

- [ ] Full-screen terminal
- [ ] Touch-friendly keyboard toolbar
- [ ] Copy/paste buttons
- [ ] Command history drawer
- [ ] Landscape optimization

### 3.6 Databases Page (`/databases`)
**Current:** Desktop-only layout
**Priority:** High

- [ ] Card-based database list
- [ ] Bottom sheet for query editor
- [ ] Horizontal scroll for table results
- [ ] Touch-friendly row selection
- [ ] Mobile SQL editor with keyboard

### 3.7 Deployments Page (`/deployments`)
**Current:** Desktop-only layout
**Priority:** Medium

- [ ] Vertical deployment timeline
- [ ] Expandable deployment cards
- [ ] Status badges optimized for mobile
- [ ] Log viewer as full-screen modal

### 3.8 Integrations Page (`/integrations`)
**Current:** Desktop-only layout
**Priority:** Medium

- [ ] Grid of integration cards
- [ ] Search/filter functionality
- [ ] Full-screen connection flow
- [ ] Settings as bottom sheet

### 3.9 New Project Page (`/projects/new`)
**Current:** Basic mobile support
**Priority:** Medium

- [ ] Step-by-step wizard flow
- [ ] Full-width form inputs
- [ ] Mobile-optimized dropdowns
- [ ] Progress indicator

---

## Phase 4: Mobile Interaction Patterns

### 4.1 Gestures to Implement
- [ ] Swipe right to open sidebar/menu
- [ ] Swipe left to close sidebar/menu
- [ ] Pull down to refresh (where applicable)
- [ ] Long press for context menus
- [ ] Pinch to zoom in code viewer

### 4.2 Touch Feedback
- [ ] Active states for all interactive elements
- [ ] Ripple effects on buttons
- [ ] Scale transforms on press
- [ ] Haptic feedback consideration (via API)

### 4.3 Keyboard Handling
- [ ] Auto-scroll when keyboard opens
- [ ] Input field focus management
- [ ] Dismiss keyboard on scroll
- [ ] "Done" button for input fields

---

## Phase 5: Mobile Components Library

### 5.1 New Components to Create
- [ ] `MobileBottomNav` - Fixed bottom navigation
- [ ] `MobileSheet` - Reusable bottom sheet (generalize existing)
- [ ] `MobileDrawer` - Side drawer component
- [ ] `MobileTabs` - Tab bar for multi-panel views
- [ ] `MobileToolbar` - Context-aware action toolbar
- [ ] `PullToRefresh` - Pull to refresh wrapper
- [ ] `SwipeableView` - Swipeable container

### 5.2 Component Specifications

#### MobileBottomNav
```
Height: 56px + safe area bottom
Items: 4-5 max
Active indicator: Top border or filled icon
Badge support: For notifications
```

#### MobileSheet
```
Max height: 90vh
Handle bar: Draggable
Snap points: 25%, 50%, 90%
Backdrop: Blur + dim
Close: Swipe down, tap backdrop, X button
```

#### MobileTabs
```
Position: Below header
Height: 44px
Scroll: Horizontal if > 4 tabs
Indicator: Animated underline
```

---

## Phase 6: Performance Optimization

### 6.1 Mobile-Specific Performance
- [ ] Lazy load off-screen content
- [ ] Reduce animation complexity on mobile
- [ ] Implement virtualized lists for long content
- [ ] Optimize images with srcset
- [ ] Code split by route
- [ ] Preload critical routes

### 6.2 Metrics to Target
- First Contentful Paint: < 1.5s on 3G
- Time to Interactive: < 3s on 3G
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

---

## Phase 7: Testing & Polish

### 7.1 Device Testing Matrix
- [ ] iPhone SE (375px) - Small phone
- [ ] iPhone 14 (390px) - Standard phone
- [ ] iPhone 14 Pro Max (430px) - Large phone
- [ ] iPad Mini (768px) - Small tablet
- [ ] iPad Pro (1024px) - Large tablet
- [ ] Android phones (various)

### 7.2 Orientation Testing
- [ ] Portrait mode for all pages
- [ ] Landscape mode for code/terminal
- [ ] Orientation change handling

### 7.3 Accessibility
- [ ] Touch target sizes (44x44px minimum)
- [ ] Color contrast ratios
- [ ] Focus indicators for keyboard nav
- [ ] Screen reader compatibility
- [ ] Reduced motion support

---

## Implementation Order

### Sprint 1: Navigation & Access (Critical)
1. Mobile bottom navigation bar
2. Full mobile menu with all pages
3. Ensure every page is reachable

### Sprint 2: Core Pages (High Priority)
4. Workspace page mobile redesign
5. Terminal page mobile optimization
6. Repository browser mobile view

### Sprint 3: Supporting Pages (Medium Priority)
7. Databases page mobile layout
8. Deployments page mobile layout
9. Integrations page mobile layout

### Sprint 4: Polish & Components (Final)
10. Mobile-first CSS refactor
11. Gesture support
12. Performance optimization
13. Testing and bug fixes

---

## Success Criteria

- [ ] All pages accessible from mobile navigation
- [ ] No horizontal scrolling on any page
- [ ] All touch targets >= 44x44px
- [ ] Lighthouse mobile score >= 90
- [ ] All forms usable with mobile keyboard
- [ ] File browser usable on mobile
- [ ] Code editor functional on mobile
- [ ] Terminal usable on mobile

---

## Technical Decisions

### Bottom Navigation vs Hamburger Menu
**Decision:** Use both
- Bottom nav for primary 4 actions (always visible)
- Hamburger/full menu for complete navigation
- Rationale: Bottom nav provides quick access, full menu provides completeness

### Bottom Sheet vs Modal
**Decision:** Bottom sheets for all mobile overlays
- Rationale: More natural on mobile, thumb-reachable, progressive disclosure

### Tab Bar vs Dropdown for Multi-Panel
**Decision:** Tab bar with swipeable views
- Rationale: Visible affordance, easy switching, familiar pattern

### CSS Framework
**Decision:** Keep custom CSS, add mobile-first utilities
- Rationale: Already invested, just needs reorganization

---

## Files Reference

### CSS Files (in order of modification priority)
1. `/app/styles/variables.css`
2. `/app/styles/base.css`
3. `/app/styles/responsive.css`
4. `/app/styles/sidebar.css`
5. `/app/styles/mobile-menu.css`
6. `/app/styles/chat.css`
7. `/app/styles/workspace.css`
8. `/app/styles/repo-browser.css`
9. `/app/styles/databases.css`
10. `/app/styles/deployments.css`

### Key React Components
- `/app/page.tsx` - Main chat
- `/app/repos/page.tsx` - Repo list
- `/app/workspace/[...repo]/page.tsx` - Workspace
- `/app/layout.tsx` - Root layout (add bottom nav here)

---

## Notes

- Preserve existing desktop functionality
- Progressive enhancement from mobile base
- Test on real devices, not just simulators
- Consider PWA enhancements after mobile optimization
