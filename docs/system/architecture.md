# System Architecture

This document provides a comprehensive overview of the Lawless AI platform architecture, covering all major components, their interactions, and data flows.

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Component Architecture](#component-architecture)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Technology Stack](#technology-stack)
- [Security Model](#security-model)
- [Scalability Considerations](#scalability-considerations)

---

## High-Level Overview

Lawless AI is a cloud-hosted AI development environment that combines:

- **Web-based IDE** with multi-pane layout (chat, editor, terminal, preview, database, deployments)
- **Claude Code integration** providing AI-assisted development through natural language
- **Real-time terminal sessions** with persistent WebSocket connections
- **Git worktree isolation** ensuring each session has independent branch-based isolation
- **Dual persistence** with local SQLite for speed and Supabase for cloud sync

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        NPM[Local IDE Package<br/>@lawless-ai/local-ide-agent]
    end

    subgraph "Frontend Layer - Vercel"
        Next[Next.js 14 Application]
        subgraph "API Routes"
            ChatProxy[/api/chat]
            WorkspaceProxy[/api/workspace/*]
            TerminalProxy[/api/terminal/*]
            IntegrationsAPI[/api/integrations/*]
        end
        subgraph "IDE Components"
            ChatPane[Chat Pane]
            EditorPane[Editor Pane]
            TerminalPane[Terminal Pane]
            PreviewPane[Preview Pane]
            DatabasePane[Database Pane]
            DeploymentsPane[Deployments Pane]
        end
    end

    subgraph "Backend Layer - Oracle Cloud"
        Express[Express.js Server :3001]
        subgraph "Services"
            ClaudeCLI[Claude CLI Process]
            PTY[node-pty Terminal]
            GitMgr[Git Worktree Manager]
            ConvService[Conversation Service]
        end
        SQLite[(SQLite DB)]
        Workspaces[/home/ubuntu/workspaces/]
    end

    subgraph "External Services"
        Anthropic[Anthropic API]
        GitHub[GitHub API]
        Supabase[(Supabase PostgreSQL)]
        Vercel[Vercel API]
    end

    Browser --> Next
    NPM --> Browser
    Next --> ChatProxy
    Next --> WorkspaceProxy
    Next --> TerminalProxy
    ChatProxy --> Express
    WorkspaceProxy --> Express
    TerminalProxy --> Express
    Express --> ClaudeCLI
    Express --> PTY
    Express --> GitMgr
    Express --> ConvService
    Express --> SQLite
    GitMgr --> Workspaces
    ClaudeCLI --> Anthropic
    Express --> GitHub
    Express --> Supabase
    IntegrationsAPI --> Supabase
    IntegrationsAPI --> Vercel
    IntegrationsAPI --> GitHub
```

---

## Component Architecture

### 1. Frontend Application (Next.js 14)

The frontend is a Next.js 14 application deployed on Vercel that provides:

| Component | Location | Purpose |
|-----------|----------|---------|
| IDE Layout | `app/ide/components/IDELayout.tsx` | Multi-pane resizable layout |
| Chat Pane | `app/ide/components/panes/ChatPane/` | AI conversation interface |
| Terminal Pane | `app/ide/components/panes/TerminalPane/` | xterm.js terminal |
| Editor Pane | `app/ide/components/panes/EditorPane/` | CodeMirror code editor |
| Preview Pane | `app/ide/components/panes/PreviewPane/` | Live site preview iframe |
| Database Pane | `app/ide/components/panes/DatabasePane/` | Supabase table viewer |
| Deployments Pane | `app/ide/components/panes/DeploymentsPane/` | Vercel deployment status |

#### IDE Layout Architecture

```mermaid
graph LR
    subgraph "IDE Layout"
        direction TB
        Header[IDE Header]
        subgraph "Pane Container"
            Pane1[Chat<br/>Default: 20%]
            Pane2[Editor<br/>Default: 35%]
            Pane3[Preview<br/>Default: 25%]
            Pane4[Terminal<br/>Default: 20%]
        end
        CollapsedBar[Collapsed Pane Icons]
    end

    Header --> PaneContainer
    PaneContainer --> CollapsedBar
    Pane1 <-->|Resize Handle| Pane2
    Pane2 <-->|Resize Handle| Pane3
    Pane3 <-->|Resize Handle| Pane4
```

The pane system supports:
- **Dynamic visibility**: Toggle panes on/off with keyboard shortcuts (Cmd+1-7)
- **Portal-based rendering**: Content persists when panes are collapsed
- **Max 5 panes**: Enforced limit to prevent UI overcrowding
- **Resize handles**: react-resizable-panels for smooth resizing

### 2. Backend Server (Express.js)

The backend is a Node.js Express server running on Oracle Cloud that handles:

| Capability | Implementation | Description |
|------------|----------------|-------------|
| Chat API | `POST /api/chat` | Spawns Claude CLI, streams SSE response |
| Workspace Chat | `POST /api/workspace/chat` | Chat with repository context |
| Terminal Sessions | WebSocket `/ws/terminal` | Real-time PTY streaming |
| Workspace Setup | `POST /api/workspace/setup` | Clone/pull repos, create worktrees |
| Session Management | CRUD `/api/workspace/session/*` | Create, get, list, delete sessions |
| Conversation History | CRUD `/api/conversations/*` | Supabase-backed persistence |
| Git Operations | `/api/workspace/git/*` | Status, commit, push |

#### Backend Process Architecture

```mermaid
graph TB
    subgraph "Express Server"
        direction TB
        MW[Middleware Layer]
        subgraph "Route Handlers"
            ChatRoute[Chat Handler]
            WorkspaceRoute[Workspace Handler]
            TerminalRoute[Terminal Handler]
            ConvRoute[Conversation Handler]
        end
        subgraph "Services"
            ConvSvc[conversationService]
            WsSvc[workspaceSessionService]
        end
    end

    subgraph "Child Processes"
        Claude1[Claude CLI #1]
        Claude2[Claude CLI #2]
        PTY1[PTY Session #1]
        PTY2[PTY Session #2]
    end

    subgraph "Storage"
        SQLite[(SQLite)]
        FS[File System<br/>/home/ubuntu/workspaces/]
    end

    MW --> ChatRoute
    MW --> WorkspaceRoute
    MW --> TerminalRoute
    MW --> ConvRoute
    ChatRoute --> Claude1
    ChatRoute --> Claude2
    TerminalRoute --> PTY1
    TerminalRoute --> PTY2
    ConvRoute --> ConvSvc
    WorkspaceRoute --> WsSvc
    ConvSvc --> SQLite
    WsSvc --> SQLite
    WorkspaceRoute --> FS
    TerminalRoute --> FS
```

### 3. Local IDE Agent Package

The `@lawless-ai/local-ide-agent` npm package enables developers to embed AI assistance in their local development:

```typescript
// User's app layout.tsx
import { LawlessIDEProvider } from '@lawless-ai/local-ide-agent';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <LawlessIDEProvider />}
      </body>
    </html>
  );
}
```

Components exported:
- `ClaudeDrawer` - Collapsible chat sidebar
- `ElementInspector` - DOM inspection tool
- `useChat` - Chat state management hook
- `useIDEStore` - Zustand store for IDE state

---

## Data Flow Diagrams

### Chat Request Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAPI as Next.js API Route
    participant Backend as Express Backend
    participant Claude as Claude CLI
    participant Supabase
    participant SQLite

    User->>Browser: Types message
    Browser->>NextAPI: POST /api/chat
    NextAPI->>NextAPI: Extract GitHub token from Supabase
    NextAPI->>Backend: POST /api/chat (with X-API-Key)
    Backend->>Backend: Get/create conversation
    Backend->>Supabase: Fetch conversation history
    Supabase-->>Backend: History (if available)
    Backend->>SQLite: Fallback: fetch from SQLite
    Backend->>Claude: spawn claude --print --output-format stream-json
    Claude->>Claude: Process with conversation context

    loop Streaming Response
        Claude-->>Backend: JSON stream chunks
        Backend-->>NextAPI: SSE: {type: 'chunk', content}
        NextAPI-->>Browser: SSE forward
        Browser-->>User: Render incremental response
    end

    Claude-->>Backend: Process complete
    Backend->>Supabase: Append messages
    Backend->>SQLite: Save to SQLite (backup)
    Backend-->>NextAPI: SSE: {type: 'done'}
    NextAPI-->>Browser: SSE: done
```

### Terminal Session Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAPI as Next.js API
    participant Backend as Express Backend
    participant PTY as node-pty
    participant Workspace as Git Worktree

    User->>Browser: Open Terminal Pane
    Browser->>NextAPI: GET /api/terminal/config
    NextAPI-->>Browser: {wsUrl: 'wss://...'}
    Browser->>Backend: WebSocket connect /ws/terminal?repo=X&session=Y

    Backend->>Backend: Check if session exists
    alt Session Exists
        Backend->>Backend: Restore PTY session
    else New Session
        Backend->>Workspace: Create git worktree
        Backend->>PTY: spawn('bash', {cwd: worktreePath})
    end

    Backend-->>Browser: {type: 'connected', branchName}

    loop Real-time I/O
        User->>Browser: Types command
        Browser->>Backend: {type: 'input', data}
        Backend->>PTY: pty.write(data)
        PTY-->>Backend: stdout/stderr
        Backend-->>Browser: {type: 'output', data}
        Browser-->>User: Render in xterm.js
    end

    loop Keep-alive
        Browser->>Backend: {type: 'ping'} (every 30s)
        Backend-->>Browser: {type: 'pong'}
    end
```

### Workspace Setup Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant NextAPI
    participant Backend
    participant GitHub
    participant FileSystem as /home/ubuntu/workspaces/

    User->>Frontend: Select repository
    Frontend->>NextAPI: POST /api/workspace/setup
    NextAPI->>Backend: POST /api/workspace/setup (with GitHub token)

    Backend->>FileSystem: Check if repo exists

    alt Repo Not Cloned
        Backend->>GitHub: git clone https://token@github.com/owner/repo.git
        GitHub-->>Backend: Clone complete
        Backend->>FileSystem: Create directory structure
        Note over FileSystem: owner_repo/<br/>├── main/<br/>└── worktrees/
    else Repo Exists
        Backend->>FileSystem: git pull origin main
    end

    Backend->>FileSystem: Configure git user
    Backend-->>NextAPI: {success: true, workspacePath}
    NextAPI-->>Frontend: Setup complete
    Frontend-->>User: Workspace ready
```

### Session Creation Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant NextAPI
    participant Backend
    participant SQLite
    participant Supabase
    participant FileSystem

    Frontend->>NextAPI: POST /api/workspace/session/create
    NextAPI->>Backend: Create session request

    Backend->>Backend: Generate session ID
    Backend->>FileSystem: git worktree add -b session/{id} worktrees/{id}
    Backend->>SQLite: INSERT workspace_session

    alt Supabase Available
        Backend->>Supabase: Create workspace_session record
    end

    Backend-->>NextAPI: {sessionId, branchName, worktreePath}
    NextAPI-->>Frontend: Session created
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| react-resizable-panels | - | Pane layout management |
| @xterm/xterm | - | Terminal emulation |
| CodeMirror | 6.x | Code editor |
| Zustand | 4.x | State management |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime environment |
| Express | 4.x | HTTP server framework |
| node-pty | - | Pseudo-terminal spawning |
| better-sqlite3 | - | Local SQLite database |
| ws | - | WebSocket server |
| uuid | - | Session ID generation |

### Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend Hosting | Vercel | Next.js deployment, CDN |
| Backend Hosting | Oracle Cloud | VM for Express server |
| Database | Supabase | PostgreSQL + Auth |
| CI/CD | GitHub Actions | Automated deployments |
| Process Manager | PM2 | Backend process lifecycle |

### External APIs

| API | Purpose |
|-----|---------|
| Anthropic | Claude AI inference |
| GitHub | Repository access, OAuth |
| Vercel | Deployment management |
| Supabase | Database, authentication |

---

## Security Model

### Authentication Layers

```mermaid
graph TB
    subgraph "User Authentication"
        GH_OAuth[GitHub OAuth]
        Supabase_Auth[Supabase Auth]
    end

    subgraph "API Security"
        API_Key[X-API-Key Header]
        CORS[CORS Whitelist]
    end

    subgraph "Session Security"
        Worktree[Isolated Worktrees]
        Branch[Session Branches]
    end

    GH_OAuth --> Supabase_Auth
    Supabase_Auth --> API_Key
    API_Key --> CORS
    CORS --> Worktree
    Worktree --> Branch
```

### Security Measures

1. **API Key Authentication**
   - All backend endpoints require `X-API-Key` header
   - Key validated via middleware
   - Health endpoints exempted for monitoring

2. **CORS Configuration**
   ```javascript
   const allowedOrigins = [
     process.env.FRONTEND_URL,
     'http://localhost:3000',
     'https://lawless-ai.vercel.app'
   ];
   ```

3. **Session Isolation**
   - Each workspace session gets unique branch: `session/{sessionId}`
   - Git worktrees provide filesystem isolation
   - Terminal PTY processes bound to worktree paths

4. **Token Security**
   - GitHub tokens stored encrypted in Supabase
   - Tokens passed via headers, never in URLs
   - Service role keys server-side only

---

## Scalability Considerations

### Current Architecture (Single Worker)

```mermaid
graph TB
    LB[Load Balancer<br/>Vercel Edge]

    subgraph "Oracle Cloud VM"
        PM2[PM2 Process Manager]
        BE1[Backend Instance]
        SQLite[(SQLite)]
    end

    Supabase[(Supabase)]

    LB --> BE1
    BE1 --> PM2
    BE1 --> SQLite
    BE1 --> Supabase
```

### Horizontal Scaling Path

```mermaid
graph TB
    LB[Load Balancer]

    subgraph "Worker Pool"
        W1[Worker 1<br/>US-East]
        W2[Worker 2<br/>US-West]
        W3[Worker 3<br/>EU]
    end

    subgraph "Shared State"
        Redis[(Redis)]
        Supabase[(Supabase)]
        S3[(Object Storage)]
    end

    LB --> W1
    LB --> W2
    LB --> W3
    W1 --> Redis
    W2 --> Redis
    W3 --> Redis
    W1 --> Supabase
    W2 --> Supabase
    W3 --> Supabase
    W1 --> S3
    W2 --> S3
    W3 --> S3
```

### Scaling Strategies

| Component | Current | Scale Path |
|-----------|---------|------------|
| Backend | Single VM | Kubernetes pods with HPA |
| Database | SQLite + Supabase | Supabase-only with connection pooling |
| File Storage | Local disk | S3/GCS with workspace sync |
| WebSocket | Single server | Redis Pub/Sub for session affinity |
| Claude CLI | Local process | Queue-based with worker pool |

### Performance Considerations

1. **Connection Pooling**: Supabase connections pooled via `@supabase/supabase-js`
2. **SSE Buffering**: Disabled nginx buffering for real-time streaming
3. **WebSocket Keep-alive**: 30-second ping/pong cycle
4. **Terminal History**: Capped at 1000 lines per session
5. **Workspace Cleanup**: Stale worktrees pruned after inactivity

---

## Next Steps

- [Backend Workers Documentation](./backend-workers.md)
- [Local IDE Documentation](./local-ide.md)
- [Orchestration Layer](./orchestration.md)
- [Deployment Workflows](./deployment.md)
