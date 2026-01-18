# Frontend UI/UX Overhaul Plan
## Goal: Replicate Claude Code CLI Experience in Web UI

---

## Completed Features

### GitHub-like Repository File Browser (Completed)
A full file browser for exploring repositories before opening in workspace.

**Route:** `/repos/[owner]/[repo]`

**Features Implemented:**
- [x] Two-column layout (280px sidebar + flexible content)
- [x] File tree sidebar with collapsible directories
- [x] Directory view with file/folder table
- [x] File viewer with syntax highlighting (highlight.js)
- [x] Breadcrumb navigation for path traversal
- [x] README preview with markdown rendering at root level
- [x] Branch switching - select any branch from dropdown
- [x] "Open in Workspace" button to start coding with Claude
- [x] Responsive design for mobile/tablet
- [x] File type icons for different extensions
- [x] Dark theme matching existing design

**Files Created:**
```
app/api/github/
├── repo/route.ts       # Single repo metadata
├── contents/route.ts   # Directory listing or file content
├── tree/route.ts       # Full recursive file tree
└── readme/route.ts     # README content for preview

app/repos/[owner]/[repo]/
├── page.tsx            # Main browser page
├── loading.tsx         # Loading skeleton
└── components/
    ├── RepoBrowser.tsx     # Main container
    ├── RepoHeader.tsx      # Repo name, stats, breadcrumb, branch selector
    ├── FileTree.tsx        # Left sidebar tree view
    ├── FileTreeItem.tsx    # Recursive tree node
    ├── fileIcons.tsx       # File type icons
    ├── DirectoryView.tsx   # File/folder table
    ├── FileViewer.tsx      # Code viewer with syntax highlighting
    ├── Breadcrumb.tsx      # Path navigation
    └── ReadmePreview.tsx   # Markdown renderer
```

**Data Flow:**
1. Click repo card on `/repos` → Navigate to `/repos/owner/repo`
2. Parallel fetch: repo metadata, tree, branches, root contents, README
3. Click folder → Update `?path=`, fetch children, expand tree
4. Click file → Update `?path=&view=blob`, fetch content, show viewer
5. Switch branch → Reload tree, contents, README for new branch
6. "Open in Workspace" → Navigate to `/workspace/owner/repo`

---

## Phase 1: Understand the Data Stream

### 1.1 Claude CLI Stream Format
The backend uses `claude --print --output-format stream-json --verbose` which outputs structured JSON events.

**Key Event Types to Handle:**
```typescript
interface StreamEvent {
  type: 'assistant' | 'user' | 'result' | 'system';
  subtype?: 'init' | 'tool_use' | 'tool_result' | 'text' | 'thinking';
  tool_name?: string;  // 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Task', etc.
  tool_input?: object;
  content?: string;
  timestamp?: string;
}
```

**Action Items:**
- [ ] SSH into Oracle server and test Claude CLI output format
- [ ] Document all event types and their structures
- [ ] Create TypeScript interfaces for each event type
- [ ] Update backend to parse and forward structured events (not just text chunks)

---

## Phase 2: Backend Modifications

### 2.1 Enhanced Event Parsing
Currently the backend likely just forwards raw text. We need structured events.

**File: `backend/src/server.ts`**

```typescript
// Parse stream-json output and emit structured events
interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  input: {
    file_path?: string;
    command?: string;
    pattern?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
  };
  id: string;
}

interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  output: string;
  success: boolean;
  id: string;
}

interface TextChunkEvent {
  type: 'text';
  content: string;
}

interface ThinkingEvent {
  type: 'thinking';
  content: string;
}
```

**Action Items:**
- [ ] Modify SSE endpoint to parse JSON lines from Claude CLI
- [ ] Emit structured events instead of raw text chunks
- [ ] Include tool invocation details (file paths, commands, etc.)
- [ ] Include tool results (file contents, command output, etc.)

---

## Phase 3: Frontend Component Architecture

### 3.1 New Component Structure

```
app/
├── components/
│   ├── chat/
│   │   ├── ChatMessage.tsx          # Main message wrapper
│   │   ├── AssistantMessage.tsx     # Handles assistant responses
│   │   ├── UserMessage.tsx          # User input display
│   │   └── MessageContent.tsx       # Markdown + tool cards
│   │
│   ├── tools/
│   │   ├── ToolCard.tsx             # Expandable tool wrapper
│   │   ├── ReadTool.tsx             # File read display
│   │   ├── WriteTool.tsx            # File write with diff
│   │   ├── EditTool.tsx             # Inline edit with before/after
│   │   ├── BashTool.tsx             # Command execution + output
│   │   ├── GlobTool.tsx             # File search results
│   │   ├── GrepTool.tsx             # Content search results
│   │   ├── TaskTool.tsx             # Sub-agent status
│   │   └── TodoTool.tsx             # Task list display
│   │
│   ├── code/
│   │   ├── CodeBlock.tsx            # Syntax highlighted code
│   │   ├── DiffView.tsx             # Side-by-side or unified diff
│   │   ├── FileTree.tsx             # File path breadcrumb (DONE - in repo browser)
│   │   └── LineNumbers.tsx          # Line number gutter (DONE - in FileViewer)
│   │
│   └── ui/
│       ├── Collapsible.tsx          # Expand/collapse wrapper
│       ├── StatusIndicator.tsx      # Loading/success/error states
│       ├── ProgressBar.tsx          # For long operations
│       └── CopyButton.tsx           # Copy to clipboard (DONE - in FileViewer)
```

### 3.2 Tool Card Design

Each tool invocation should be a collapsible card:

```
┌─────────────────────────────────────────────────────────┐
│ 📖 Read                                    ▼ Collapse   │
│ src/components/Button.tsx                               │
├─────────────────────────────────────────────────────────┤
│  1 │ import React from 'react';                         │
│  2 │                                                    │
│  3 │ interface ButtonProps {                            │
│  4 │   label: string;                                   │
│  5 │   onClick: () => void;                             │
│ ...│ (42 more lines)                      [Expand All]  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ✏️ Edit                                    ▼ Collapse   │
│ src/components/Button.tsx:15-18                         │
├─────────────────────────────────────────────────────────┤
│ - const handleClick = () => {                           │
│ -   console.log('clicked');                             │
│ - };                                                    │
│ + const handleClick = useCallback(() => {               │
│ +   onClick();                                          │
│ + }, [onClick]);                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 💻 Bash                                    ▼ Collapse   │
│ npm run build                              ⏳ Running    │
├─────────────────────────────────────────────────────────┤
│ > lawless-ai@1.0.0 build                                │
│ > next build                                            │
│                                                         │
│ ✓ Creating optimized production build                   │
│ ✓ Compiled successfully                                 │
│ ✓ Collecting page data                                  │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 4: Core UI Components

### 4.1 ToolCard Component

```tsx
// components/tools/ToolCard.tsx
interface ToolCardProps {
  tool: 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'Task';
  title: string;
  subtitle?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const toolIcons = {
  Read: '📖',
  Write: '📝',
  Edit: '✏️',
  Bash: '💻',
  Glob: '🔍',
  Grep: '🔎',
  Task: '🤖',
};

const statusColors = {
  pending: 'text-gray-400',
  running: 'text-yellow-400 animate-pulse',
  success: 'text-green-400',
  error: 'text-red-400',
};
```

### 4.2 DiffView Component

```tsx
// components/code/DiffView.tsx
interface DiffViewProps {
  oldContent: string;
  newContent: string;
  language: string;
  fileName: string;
  mode: 'unified' | 'split';
}

// Use a library like 'diff' or 'diff2html' for rendering
```

### 4.3 CodeBlock Component

```tsx
// components/code/CodeBlock.tsx
interface CodeBlockProps {
  code: string;
  language: string;
  fileName?: string;
  startLine?: number;
  highlightLines?: number[];
  maxLines?: number;  // Collapse after N lines
  showLineNumbers?: boolean;
}
```

---

## Phase 5: State Management

### 5.1 Message State Structure

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: MessageContent[];
}

type MessageContent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string; collapsed: boolean }
  | { type: 'tool_use'; tool: ToolInvocation }
  | { type: 'tool_result'; result: ToolResult };

interface ToolInvocation {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  expanded: boolean;
}

interface ToolResult {
  id: string;
  toolId: string;
  output: string;
  success: boolean;
}
```

### 5.2 Streaming State Updates

```typescript
// Handle streaming updates to build message content
function useStreamingMessage() {
  const [contents, setContents] = useState<MessageContent[]>([]);

  const handleEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'text':
        // Append to current text block or create new one
        break;
      case 'tool_use':
        // Add new tool card in 'running' state
        break;
      case 'tool_result':
        // Update tool card to 'success' or 'error'
        break;
      case 'thinking':
        // Add collapsible thinking block
        break;
    }
  };

  return { contents, handleEvent };
}
```

---

## Phase 6: Visual Design System

### 6.1 Tool Card Styles

```css
/* Glass morphism tool cards */
.tool-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  margin: 12px 0;
  transition: all 0.2s ease;
}

.tool-card:hover {
  border-color: rgba(168, 85, 247, 0.3);
}

.tool-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.tool-card-body {
  max-height: 400px;
  overflow: auto;
}

.tool-card.collapsed .tool-card-body {
  display: none;
}
```

### 6.2 Code Display Styles

```css
/* Syntax highlighted code blocks */
.code-block {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #0d1117;
  border-radius: 8px;
  overflow: hidden;
}

.code-line {
  display: flex;
  padding: 0 16px;
}

.code-line:hover {
  background: rgba(255, 255, 255, 0.03);
}

.line-number {
  width: 50px;
  color: #484f58;
  text-align: right;
  padding-right: 16px;
  user-select: none;
}

/* Diff styles */
.diff-added {
  background: rgba(46, 160, 67, 0.15);
  border-left: 3px solid #2ea043;
}

.diff-removed {
  background: rgba(248, 81, 73, 0.15);
  border-left: 3px solid #f85149;
}
```

### 6.3 Status Indicators

```css
/* Animated status dots */
.status-running {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Progress spinner for running tools */
.tool-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(168, 85, 247, 0.2);
  border-top-color: #a855f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

---

## Phase 7: Implementation Steps

### Completed
- [x] GitHub-like repository file browser
- [x] File tree sidebar with collapsible directories
- [x] File viewer with syntax highlighting
- [x] Branch switching functionality
- [x] Breadcrumb navigation
- [x] README preview with markdown
- [x] Responsive scrolling fixes
- [x] Integrations page (Vercel, Supabase connections with org/team selection)
- [x] TypeScript interfaces for all stream event types (`app/types/stream.ts`)
- [x] Base `ToolCard` component with expand/collapse
- [x] `CodeBlock` component with syntax highlighting
- [x] `DiffView` component for edits
- [x] `StatusIndicator` component
- [x] Demo page for components (`/demo/tools`)
- [x] `ReadTool` - Display file contents with collapsing
- [x] `WriteTool` - Show new file being created
- [x] `EditTool` - Before/after diff view
- [x] `BashTool` - Command + streaming output
- [x] `GlobTool` - File search results list
- [x] `GrepTool` - Content search with matches highlighted
- [x] `TaskTool` - Sub-agent status display

### In Progress
- [ ] Add keyboard shortcuts (expand all, collapse all)
- [ ] Mobile responsive adjustments for tool cards
- [ ] Performance optimization (virtualization for long outputs)

### Week 1: Backend & Data Layer
1. [ ] SSH to Oracle, capture sample `stream-json` output from Claude CLI
2. [x] Document all event types and structures
3. [ ] Modify `backend/src/server.ts` to parse and emit structured events
4. [x] Create TypeScript interfaces for all event types
5. [ ] Test SSE stream with new structured format

### Week 2: Core Components (COMPLETED)
1. [x] Create base `ToolCard` component with expand/collapse
2. [x] Create `CodeBlock` component with syntax highlighting
3. [x] Create `DiffView` component for edits
4. [x] Create `StatusIndicator` component
5. [x] Set up component demo page

### Week 3: Tool-Specific Components (COMPLETED)
1. [x] `ReadTool` - Display file contents with collapsing
2. [x] `WriteTool` - Show new file being created
3. [x] `EditTool` - Before/after diff view
4. [x] `BashTool` - Command + streaming output
5. [x] `GlobTool` - File search results list
6. [x] `GrepTool` - Content search with matches highlighted

### Week 4: Integration & Polish
1. [x] Integrate components into chat message flow
2. [x] Handle streaming updates (tool starts, completes)
3. [x] Add thinking/reasoning collapsible sections
4. [ ] Add keyboard shortcuts (expand all, collapse all)
5. [ ] Mobile responsive adjustments
6. [ ] Performance optimization (virtualization for long outputs)

### Week 5: Advanced Features
1. [x] File tree sidebar showing touched files (done in repo browser)
2. [ ] Minimap for long code blocks
3. [x] Copy button for code/commands (done in FileViewer)
4. [ ] "Jump to change" navigation
5. [ ] Background task panel (like VS Code terminal)
6. [ ] Real-time command output streaming

---

## Phase 8: Dependencies to Add

```json
{
  "dependencies": {
    "diff": "^5.1.0",           // For computing diffs
    "diff2html": "^3.4.0",      // For rendering diffs
    "prism-react-renderer": "^2.0.0",  // Syntax highlighting
    "react-collapsed": "^4.0.0", // Smooth expand/collapse
    "react-virtualized": "^9.22.0"  // For long lists/outputs
  }
}
```

**Already in use:**
- `highlight.js` - Syntax highlighting (used in FileViewer)
- `marked` - Markdown parsing (used in ReadmePreview)

---

## Phase 9: Example Final UI Flow

### User sends: "Add a loading spinner to the Button component"

**What appears in the chat:**

```
┌─ User ──────────────────────────────────────────────────┐
│ Add a loading spinner to the Button component           │
└─────────────────────────────────────────────────────────┘

┌─ Assistant ─────────────────────────────────────────────┐
│                                                         │
│ I'll add a loading spinner to the Button component.     │
│ Let me first read the current implementation.           │
│                                                         │
│ ┌─ 📖 Read ─────────────────────────── ✓ ─────────────┐ │
│ │ src/components/Button.tsx                           │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │  1 │ import React from 'react';                     │ │
│ │  2 │                                                │ │
│ │  3 │ export function Button({ label, onClick }) {   │ │
│ │  4 │   return (                                     │ │
│ │  5 │     <button onClick={onClick}>                 │ │
│ │  6 │       {label}                                  │ │
│ │    │ ... (12 more lines)              [Show More]  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Now I'll add the loading state and spinner:             │
│                                                         │
│ ┌─ ✏️ Edit ─────────────────────────── ✓ ─────────────┐ │
│ │ src/components/Button.tsx                           │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ @@ -1,8 +1,15 @@                                    │ │
│ │   import React from 'react';                        │ │
│ │ + import { Spinner } from './Spinner';              │ │
│ │                                                     │ │
│ │ - export function Button({ label, onClick }) {      │ │
│ │ + export function Button({ label, onClick, loading })│ │
│ │     return (                                        │ │
│ │ -     <button onClick={onClick}>                    │ │
│ │ -       {label}                                     │ │
│ │ +     <button onClick={onClick} disabled={loading}> │ │
│ │ +       {loading ? <Spinner /> : label}             │ │
│ │       </button>                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ I've added a `loading` prop that shows a spinner when   │
│ true and disables the button to prevent double clicks.  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start Checklist

To begin implementation today:

1. **Capture stream-json output**
   ```bash
   ssh ubuntu@147.224.217.154
   echo "list files" | claude --print --output-format stream-json --verbose 2>&1 | head -100
   ```

2. **Create first component**
   - Start with `ToolCard.tsx` as the foundation
   - Add expand/collapse functionality
   - Style with existing design tokens

3. **Update backend**
   - Parse JSON lines instead of raw text
   - Emit structured events via SSE

4. **Integrate into chat**
   - Update message state to hold structured content
   - Render tool cards inline with text

---

## Success Metrics

- [x] Repository file browser with GitHub-like experience
- [x] File tree navigation with syntax highlighting
- [x] Branch switching capability
- [ ] Tool invocations visible as cards (not raw text)
- [ ] File reads show syntax-highlighted code
- [ ] Edits show before/after diffs
- [ ] Bash commands show live output
- [ ] Cards are collapsible with smooth animation
- [ ] Status indicators show tool progress
- [x] Mobile responsive and performant
