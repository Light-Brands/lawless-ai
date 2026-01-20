# Local IDE Agent - Implementation Plan

> **Agent-First Development.** A minimal, user-friendly AI development environment that lets you talk to Claude and see changes in real-time. Focus on the conversation, not the complexity.

## Table of Contents

1. [Vision & Positioning](#vision--positioning)
2. [Architecture Overview](#architecture-overview)
3. [First-Run Setup & Service Connections](#first-run-setup--service-connections)
4. [Project Onboarding Sequence](#project-onboarding-sequence)
5. [Complete Tooling Reference](#complete-tooling-reference)
6. [Core Differentiators](#core-differentiators-vs-hosted-ide)
7. [Phase 1: Foundation & Agent Core](#phase-1-foundation--agent-core)
8. [Phase 2: Browser Integration & Click-to-Edit](#phase-2-browser-integration--click-to-edit)
9. [Phase 3: Polish & Distribution](#phase-3-polish--distribution)
10. [Technical Specifications](#technical-specifications)
11. [Database Schema](#database-schema)
12. [Deployment & Distribution](#deployment--distribution)

---

## Vision & Positioning

### What Is the Local IDE Agent?

A **minimal, agent-first development environment** designed for maximum usability and adoption. Talk to Claude, see your app update in real-time. That's it.

**Design Philosophy: Simplicity Drives Adoption**
- Two panes: Chat + Browser. Nothing else visible by default.
- File editor is there when you need it, hidden when you don't.
- Deployments happen automatically when you push to GitHub.
- User-friendly interface that anyone can use, not just developers.

**Core Connections:**
- **One GitHub repo** - Your code lives here, push to deploy
- **One Supabase database** - Your data
- **One Vercel project** - Auto-deploys from GitHub

```
┌─────────────────────────────────────────────────────────────────┐
│                    Local IDE Agent                               │
│                    http://localhost:3001                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│   │                     │  │                                 │  │
│   │    💬 AI Chat       │  │      🌐 Live Browser            │  │
│   │                     │  │                                 │  │
│   │  "Make the header   │  │  ┌─────────────────────────┐   │  │
│   │   blue and add a    │  │  │                         │   │  │
│   │   login button"     │  │  │    Your App Preview     │   │  │
│   │                     │  │  │                         │   │  │
│   │  ┌───────────────┐  │  │  │   [Click any element    │   │  │
│   │  │ Claude is     │  │  │  │    to edit with AI]    │   │  │
│   │  │ making changes│  │  │  │                         │   │  │
│   │  │ ████████░░ 80%│  │  │  └─────────────────────────┘   │  │
│   │  └───────────────┘  │  │                                 │  │
│   │                     │  │  ● Services: ✓ ✓ ✓ ✓           │  │
│   │  [Type here...]     │  │  ● Last deploy: 2 min ago       │  │
│   │                     │  │                                 │  │
│   └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                  │
│   📁 [Show Files]  ─────────────────────────────  [⚙️ Settings]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Hidden by default (accessible via "Show Files"):
┌─────────────────────────────────────────────────────────────────┐
│   ┌─────────────────────┐  ┌─────────────────┐  ┌───────────┐  │
│   │ 💬 Chat             │  │ 📝 File Editor  │  │ 🌐 Browser│  │
│   └─────────────────────┘  └─────────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Deployment Philosophy: Git Push = Auto Deploy

**No deploy buttons.** When you push to GitHub, Vercel automatically deploys.

```
┌────────────────────────────────────────────────────────────────┐
│                    Deployment Flow                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. You: "Add a contact form to the homepage"                  │
│                      ↓                                          │
│   2. Claude makes the changes                                   │
│                      ↓                                          │
│   3. You see it live in the browser (HMR)                       │
│                      ↓                                          │
│   4. You: "Looks good, let's ship it"                           │
│                      ↓                                          │
│   5. Claude: git commit && git push                             │
│                      ↓                                          │
│   6. Vercel auto-deploys (GitHub integration)                   │
│                      ↓                                          │
│   7. Status shows: "Deployed ✓"                                 │
│                                                                 │
│   That's it. No buttons. No complexity.                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Why Local?

| Aspect | Hosted IDE | Local IDE Agent |
|--------|-----------|-----------------|
| **Complexity** | 6 panes, full IDE | 2 panes, minimal UI |
| **Focus** | Power users | Everyone |
| **Deployment** | Click to deploy | Git push auto-deploys |
| **Ownership** | We manage | User owns everything |
| **Data** | Through our servers | Stays on user machine |
| **Learning Curve** | Higher | Near zero |

### User Journey

```
1. User creates project on Lawless AI platform
   └── Gets a project with Local IDE Agent included

2. User runs: npm install && npm run dev
   └── App starts on :3000, IDE starts on :3001

3. User opens http://localhost:3001
   └── Sees: Chat on left, their app on right. That's it.

4. User talks to Claude
   └── "Make the header blue" → sees it change instantly

5. User says "Ship it"
   └── Claude commits and pushes → Vercel auto-deploys

No complexity. No learning curve. Just conversation and results.
```

---

## Architecture Overview

### Project Structure

When a user creates a new project, it comes pre-scaffolded with the Local IDE Agent:

```
my-project/
├── .lawless/                          # IDE Agent (hidden by default)
│   ├── ide/                           # IDE frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx          # Main IDE interface
│   │   │   │   ├── layout.tsx
│   │   │   │   └── api/              # Local API routes
│   │   │   │       ├── ai/           # Claude integration
│   │   │   │       ├── files/        # File operations
│   │   │   │       ├── github/       # GitHub operations
│   │   │   │       ├── supabase/     # Database operations
│   │   │   │       └── vercel/       # Deployment operations
│   │   │   ├── components/
│   │   │   │   ├── ChatPane/
│   │   │   │   ├── EditorPane/
│   │   │   │   ├── PreviewPane/
│   │   │   │   └── ServiceStatus/
│   │   │   ├── lib/
│   │   │   │   ├── claude.ts         # Claude API client
│   │   │   │   ├── github.ts         # GitHub API client
│   │   │   │   ├── supabase.ts       # Supabase client
│   │   │   │   └── vercel.ts         # Vercel API client
│   │   │   └── stores/
│   │   │       └── ideStore.ts
│   │   ├── package.json              # IDE dependencies
│   │   └── next.config.js
│   │
│   ├── config/                        # Service connections
│   │   ├── services.json             # GitHub, Supabase, Vercel config
│   │   └── agent.json                # Agent configuration
│   │
│   └── context/                       # AI context files
│       ├── CLAUDE.md                 # Project-specific instructions
│       ├── agents/                   # ai-coding-config agents
│       ├── commands/                 # ai-coding-config commands
│       └── skills/                   # ai-coding-config skills
│
├── src/                               # User's actual application
│   └── ...
├── package.json                       # Project package.json
├── .env.local                         # User's env vars (including API keys)
└── lawless.config.js                  # IDE configuration
```

### Service Integration Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      Local IDE Agent                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Service Connectors                     │    │
│  │                                                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │   Claude    │  │   GitHub    │  │  Supabase   │      │    │
│  │  │  Connector  │  │  Connector  │  │  Connector  │      │    │
│  │  │             │  │             │  │             │      │    │
│  │  │ • Chat      │  │ • Push      │  │ • Query     │      │    │
│  │  │ • Agents    │  │ • Pull      │  │ • Migrate   │      │    │
│  │  │ • Tools     │  │ • PRs       │  │ • Schema    │      │    │
│  │  │ • Context   │  │ • Branches  │  │ • RLS       │      │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │    │
│  │         │                │                │              │    │
│  │  ┌──────┴────────────────┴────────────────┴──────┐      │    │
│  │  │              Unified Tool Interface            │      │    │
│  │  │                                                │      │    │
│  │  │  Claude has access to ALL service tools:       │      │    │
│  │  │  • read_file, write_file, search_files        │      │    │
│  │  │  • git_commit, git_push, create_pr            │      │    │
│  │  │  • db_query, db_migrate, db_schema            │      │    │
│  │  │  • deploy, get_logs, set_env                  │      │    │
│  │  └────────────────────────────────────────────────┘      │    │
│  │                                                          │    │
│  │  ┌─────────────┐                                         │    │
│  │  │   Vercel    │                                         │    │
│  │  │  Connector  │                                         │    │
│  │  │             │                                         │    │
│  │  │ • Deploy    │                                         │    │
│  │  │ • Logs      │                                         │    │
│  │  │ • Env Vars  │                                         │    │
│  │  │ • Domains   │                                         │    │
│  │  └─────────────┘                                         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## First-Run Setup & Service Connections

When users first open the Local IDE Agent, they're guided through a **Setup Wizard** that connects all their services. This creates the ultimate local development experience with everything integrated from day one.

### Setup Wizard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Welcome to Your IDE                           │
│                                                                  │
│  Let's connect your services to unlock the full power of your   │
│  AI-powered development environment.                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Step 1 of 4                                             │    │
│  │  ━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  🤖 Connect Claude (Anthropic)                                   │
│  ─────────────────────────────────────                           │
│  Claude is your AI assistant that powers code generation,        │
│  debugging, and intelligent suggestions.                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Anthropic API Key                                       │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ sk-ant-api03-...                            👁   │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  📖 Get your API key at console.anthropic.com            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                                    [Skip for now]  [Continue →]  │
└─────────────────────────────────────────────────────────────────┘
```

### Setup Steps

```
Step 1: Claude (Anthropic)     → AI capabilities
Step 2: GitHub                 → Code repository access
Step 3: Supabase              → Database operations
Step 4: Vercel                → Deployments
         ↓
   🎉 Setup Complete!
   All services connected. Start building!
```

### Service Connection Cards

After setup, users can manage connections via the **Settings** page, similar to the main Lawless AI integrations page.

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings → Service Connections                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐         │
│  │ 🤖 Claude (Anthropic)  │  │ 🐙 GitHub              │         │
│  │                        │  │                        │         │
│  │ ● Connected            │  │ ● Connected            │         │
│  │                        │  │                        │         │
│  │ Model: claude-sonnet-4 │  │ Repo: owner/my-app     │         │
│  │ Usage: 125K tokens     │  │ Branch: main           │         │
│  │                        │  │                        │         │
│  │ [Manage] [Disconnect]  │  │ [Manage] [Disconnect]  │         │
│  └────────────────────────┘  └────────────────────────┘         │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐         │
│  │ 🗄️ Supabase            │  │ ▲ Vercel               │         │
│  │                        │  │                        │         │
│  │ ● Connected            │  │ ● Connected            │         │
│  │                        │  │                        │         │
│  │ Project: my-app-db     │  │ Project: my-app        │         │
│  │ Tables: 12             │  │ Domain: my-app.vercel  │         │
│  │                        │  │                        │         │
│  │ [Manage] [Disconnect]  │  │ [Manage] [Disconnect]  │         │
│  └────────────────────────┘  └────────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Claude (Anthropic) Connection

```typescript
// Connection Configuration
interface ClaudeConnection {
  apiKey: string;                    // ANTHROPIC_API_KEY
  model: string;                     // Default: claude-sonnet-4-20250514
  maxTokens: number;                 // Default: 8096
  temperature: number;               // Default: 0.7
}

// Verification Flow
async function verifyClaudeConnection(apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });

  if (!response.ok) throw new Error('Invalid API key');
  return { connected: true, model: 'claude-sonnet-4-20250514' };
}
```

**Setup UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Connect Claude (Anthropic)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Claude is your AI coding assistant. It powers:                  │
│  • Code generation and editing                                   │
│  • Intelligent debugging                                         │
│  • Architecture suggestions                                      │
│  • 24 specialized agents from ai-coding-config                   │
│                                                                  │
│  Anthropic API Key:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ sk-ant-api03-...                                    👁   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Model Selection:                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ claude-sonnet-4-20250514 (Recommended)              ▼   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  • Sonnet: Best balance of speed and capability                 │
│  • Opus: Most powerful, higher cost                             │
│  • Haiku: Fastest, lower cost                                   │
│                                                                  │
│  📖 Get your API key: https://console.anthropic.com/settings/keys│
│                                                                  │
│                               [Test Connection]  [Save & Continue]│
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Connection

```typescript
// Connection Configuration
interface GitHubConnection {
  token: string;                     // GITHUB_TOKEN (Personal Access Token)
  owner: string;                     // Repository owner
  repo: string;                      // Repository name
  defaultBranch: string;             // Default: main
}

// Verification Flow
async function verifyGitHubConnection(token: string, owner: string, repo: string) {
  const octokit = new Octokit({ auth: token });

  // Verify token and repo access
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const { data: userData } = await octokit.users.getAuthenticated();

  return {
    connected: true,
    user: userData.login,
    repo: repoData.full_name,
    permissions: repoData.permissions,
  };
}
```

**Required Scopes:** `repo` (Full control of private repositories)

**Setup UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🐙 Connect GitHub                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GitHub integration enables:                                     │
│  • Reading and writing files                                     │
│  • Creating commits and branches                                 │
│  • Opening pull requests                                         │
│  • Managing repository settings                                  │
│                                                                  │
│  Personal Access Token:                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx            👁   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Repository:                                                     │
│  ┌──────────────────────┐  ┌────────────────────────────────┐   │
│  │ owner                │  │ repository-name                 │   │
│  └──────────────────────┘  └────────────────────────────────┘   │
│                                                                  │
│  📖 Create token: https://github.com/settings/tokens/new         │
│     Required scope: repo                                         │
│                                                                  │
│                               [Test Connection]  [Save & Continue]│
└─────────────────────────────────────────────────────────────────┘
```

### Supabase Connection

```typescript
// Connection Configuration
interface SupabaseConnection {
  projectUrl: string;                // NEXT_PUBLIC_SUPABASE_URL
  anonKey: string;                   // NEXT_PUBLIC_SUPABASE_ANON_KEY
  serviceRoleKey: string;            // SUPABASE_SERVICE_ROLE_KEY
  projectRef: string;                // Project reference (from URL)
}

// Verification Flow
async function verifySupabaseConnection(url: string, serviceKey: string) {
  const client = createClient(url, serviceKey);

  // Test connection with a simple query
  const { data, error } = await client.from('information_schema.tables')
    .select('table_name')
    .limit(1);

  if (error && error.code !== 'PGRST116') throw error;

  // Get table count
  const { count } = await client.from('information_schema.tables')
    .select('*', { count: 'exact', head: true })
    .eq('table_schema', 'public');

  return { connected: true, tableCount: count };
}
```

**Setup UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🗄️ Connect Supabase                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Supabase provides your database. Connection enables:            │
│  • Running SQL queries                                           │
│  • Viewing and modifying schema                                  │
│  • Applying migrations                                           │
│  • Managing Row Level Security                                   │
│                                                                  │
│  Project URL:                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ https://xxxxxxxxxxxx.supabase.co                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Anon Key:                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...              👁   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Service Role Key (for admin operations):                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...              👁   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  📖 Find these in: Supabase Dashboard → Settings → API           │
│                                                                  │
│                               [Test Connection]  [Save & Continue]│
└─────────────────────────────────────────────────────────────────┘
```

### Vercel Connection

```typescript
// Connection Configuration
interface VercelConnection {
  token: string;                     // VERCEL_TOKEN
  projectId: string;                 // Project ID from Vercel
  teamId?: string;                   // Optional team ID
}

// Verification Flow
async function verifyVercelConnection(token: string, projectId: string) {
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error('Invalid token or project');

  const project = await response.json();
  return {
    connected: true,
    project: project.name,
    framework: project.framework,
    latestDeployment: project.latestDeployments?.[0]?.url,
  };
}
```

**Required Scopes:**
- `user:read` - Read user information
- `deployments:read` - View deployments
- `deployments:write` - Trigger deployments
- `projects:read` - View project settings
- `logs:read` - View deployment logs

**Setup UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ▲ Connect Vercel                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Vercel hosts your deployments. Connection enables:              │
│  • Triggering deployments                                        │
│  • Viewing build logs                                            │
│  • Managing environment variables                                │
│  • Rolling back to previous versions                             │
│                                                                  │
│  Access Token:                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ xxxxxxxxxxxxxxxxxxxxxxxx                             👁   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Project ID:                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxx                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Team ID (optional, for team projects):                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ team_xxxxxxxxxxxxxxxxxxxxxxxxxxxx                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  📖 Create token: https://vercel.com/account/tokens              │
│  📖 Find Project ID: Project Settings → General                  │
│                                                                  │
│                               [Test Connection]  [Save & Continue]│
└─────────────────────────────────────────────────────────────────┘
```

### Token Storage (Local & Secure)

All tokens are stored locally in `.env.local` - they never leave the user's machine.

```bash
# .env.local (auto-generated by setup wizard)

# Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-api03-...

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=username
GITHUB_REPO=my-project

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel
VERCEL_TOKEN=...
VERCEL_PROJECT_ID=prj_...
VERCEL_TEAM_ID=team_...  # optional
```

### Connection Status API

```typescript
// .lawless/ide/src/app/api/status/route.ts
export async function GET() {
  const status = {
    claude: await checkClaudeConnection(),
    github: await checkGitHubConnection(),
    supabase: await checkSupabaseConnection(),
    vercel: await checkVercelConnection(),
    devServer: await checkDevServer(),
    setupComplete: false,
  };

  status.setupComplete =
    status.claude.connected &&
    status.github.connected &&
    status.supabase.connected &&
    status.vercel.connected;

  return Response.json(status);
}

interface ConnectionStatus {
  claude: {
    connected: boolean;
    model?: string;
    error?: string;
  };
  github: {
    connected: boolean;
    repo?: string;
    user?: string;
    error?: string;
  };
  supabase: {
    connected: boolean;
    tableCount?: number;
    error?: string;
  };
  vercel: {
    connected: boolean;
    project?: string;
    latestDeployment?: string;
    error?: string;
  };
  devServer: {
    running: boolean;
    port?: number;
  };
  setupComplete: boolean;
}
```

---

## Project Onboarding Sequence

After services are connected, Claude guides users through a **Project Onboarding** sequence that creates foundational documents before any code is written. This ensures every project starts with clarity and direction.

### Onboarding Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECT ONBOARDING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Services Connected ✓                                           │
│          ↓                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  STEP 1: Project Plan                                    │   │
│   │  "Let's define what we're building"                      │   │
│   │  → Creates: docs/PROJECT_PLAN.md                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│          ↓                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  STEP 2: Brand Guidelines                                │   │
│   │  "Let's define how it looks and feels"                   │   │
│   │  → Creates: docs/BRAND_GUIDELINES.md                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│          ↓                                                       │
│   Ready to Build!                                                │
│   Claude uses these docs as context for all future work          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Project Plan Creation

Claude has a conversational interview to understand the project, then generates a comprehensive plan.

**The Conversation:**
```
┌─────────────────────────────────────────────────────────────────┐
│  💬 Chat                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Claude: "Welcome! Before we start building, let's create a      │
│  project plan so I understand exactly what you're trying to      │
│  achieve. I'll ask you a few questions."                         │
│                                                                  │
│  Claude: "First, what's the name of your project?"               │
│                                                                  │
│  User: "TaskFlow"                                                │
│                                                                  │
│  Claude: "Great name! In one sentence, what does TaskFlow do?"   │
│                                                                  │
│  User: "It's a task management app for small teams"              │
│                                                                  │
│  Claude: "Who is the primary user? What problem are they         │
│  experiencing that TaskFlow solves?"                             │
│                                                                  │
│  User: "Small business owners who are overwhelmed managing       │
│  tasks across spreadsheets and sticky notes"                     │
│                                                                  │
│  Claude: "What are the 3-5 core features that would make         │
│  TaskFlow valuable in its first version?"                        │
│                                                                  │
│  User: "Task creation, team assignment, due dates, and a         │
│  simple dashboard to see what's overdue"                         │
│                                                                  │
│  Claude: "Perfect. Let me create your project plan..."           │
│                                                                  │
│  [Creating docs/PROJECT_PLAN.md...]                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Generated Document: docs/PROJECT_PLAN.md**

```markdown
# TaskFlow - Project Plan

## Vision
A simple, focused task management app that helps small business owners
escape the chaos of spreadsheets and sticky notes.

## Problem Statement
Small business owners struggle to track tasks across their team. They're
using a mix of spreadsheets, sticky notes, and memory - leading to missed
deadlines, duplicated work, and constant "did you do that?" conversations.

## Target User
- **Primary**: Small business owners (1-20 employees)
- **Context**: Managing day-to-day operations, often wearing multiple hats
- **Pain Point**: No single source of truth for what needs to get done

## Core Features (MVP)

### 1. Task Creation
- Quick-add tasks with title and description
- Set due dates with calendar picker
- Add priority levels (High, Medium, Low)

### 2. Team Assignment
- Assign tasks to team members
- View tasks by assignee
- Reassign with drag-and-drop

### 3. Due Date Tracking
- Visual due date indicators
- Overdue highlighting
- Calendar view option

### 4. Dashboard
- "What's overdue" section (most important)
- "Due today" section
- "Coming up this week" section
- Team workload at a glance

## Success Metrics
- User can create a task in under 10 seconds
- User can see all overdue items in one glance
- Team members receive clear notifications

## Technical Approach
- Next.js for the frontend
- Supabase for database and auth
- Vercel for hosting
- Mobile-responsive design

## Out of Scope (for now)
- Time tracking
- Recurring tasks
- Integrations with other tools
- Mobile native apps

## Open Questions
- Should we have projects/categories for tasks?
- Email notifications vs. in-app only?
- Free tier limits?

---
*Generated during project onboarding. Update as the project evolves.*
```

### Interview Questions (Customizable)

Claude uses these questions as a guide, adapting based on responses:

```typescript
const projectPlanQuestions = [
  {
    question: "What's the name of your project?",
    field: "name",
    followUp: "Great name! Is there a story behind it?"
  },
  {
    question: "In one sentence, what does {name} do?",
    field: "oneLiner",
    followUp: "Perfect. Who specifically is this for?"
  },
  {
    question: "Who is your primary user? What's their biggest pain point?",
    field: "targetUser",
    followUp: "How are they solving this problem today?"
  },
  {
    question: "What are the 3-5 core features for the first version?",
    field: "coreFeatures",
    followUp: "Which one is the most important? The 'killer feature'?"
  },
  {
    question: "How will you know if {name} is successful?",
    field: "successMetrics",
    followUp: "Any specific numbers or goals in mind?"
  },
  {
    question: "What should we explicitly NOT build in the first version?",
    field: "outOfScope",
    followUp: "Good - keeping focus is crucial for shipping"
  },
  {
    question: "Any open questions or things you're unsure about?",
    field: "openQuestions",
    followUp: "We can figure these out as we build"
  }
];
```

---

### Step 2: Brand Guidelines Creation

After the project plan, Claude guides users through defining visual identity.

**The Conversation:**
```
┌─────────────────────────────────────────────────────────────────┐
│  💬 Chat                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Claude: "Now let's define how TaskFlow looks and feels. These   │
│  brand guidelines will help me make consistent design decisions  │
│  as we build."                                                   │
│                                                                  │
│  Claude: "What mood or feeling should TaskFlow convey?           │
│  For example: professional, playful, minimal, bold, friendly?"   │
│                                                                  │
│  User: "Clean and professional but not boring. Friendly."        │
│                                                                  │
│  Claude: "If TaskFlow were a person, how would they dress?"      │
│                                                                  │
│  User: "Smart casual - like a startup founder. Put together      │
│  but approachable"                                               │
│                                                                  │
│  Claude: "Do you have any brand colors in mind, or should I      │
│  suggest some based on the mood?"                                │
│                                                                  │
│  User: "I like blue but open to suggestions"                     │
│                                                                  │
│  Claude: "Blue is great for trust and productivity. I'll pair    │
│  it with a warm accent. What about typography - modern and       │
│  geometric, or more traditional and readable?"                   │
│                                                                  │
│  User: "Modern but very readable - our users aren't designers"   │
│                                                                  │
│  Claude: "Perfect. Let me create your brand guidelines..."       │
│                                                                  │
│  [Creating docs/BRAND_GUIDELINES.md...]                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Generated Document: docs/BRAND_GUIDELINES.md**

```markdown
# TaskFlow - Brand Guidelines

## Brand Personality

### Voice & Tone
- **Personality**: Friendly professional - like a helpful coworker
- **Tone**: Clear, encouraging, never condescending
- **Language**: Simple and direct, avoid jargon

### Brand Attributes
- ✓ Clean & organized (but not sterile)
- ✓ Professional (but approachable)
- ✓ Efficient (but not cold)
- ✓ Trustworthy (but not corporate)

### The "Smart Casual" Principle
TaskFlow should feel like a startup founder at a coffee meeting:
put-together but relaxed, competent but friendly.

---

## Color Palette

### Primary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| **Ocean Blue** | `#2563EB` | Primary actions, links, focus states |
| **Deep Navy** | `#1E3A5F` | Headers, important text |
| **White** | `#FFFFFF` | Backgrounds, cards |

### Secondary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| **Warm Coral** | `#F97316` | Accents, notifications, CTAs |
| **Soft Gray** | `#F3F4F6` | Backgrounds, borders |
| **Text Gray** | `#6B7280` | Secondary text |

### Status Colors
| Color | Hex | Usage |
|-------|-----|-------|
| **Success Green** | `#10B981` | Completed, success states |
| **Warning Amber** | `#F59E0B` | Due soon, warnings |
| **Error Red** | `#EF4444` | Overdue, errors |

### Color Usage Rules
- Ocean Blue is the hero - use it for primary actions
- Warm Coral is the accent - use sparingly for emphasis
- Never use pure black (#000) - use Deep Navy instead
- Maintain high contrast for accessibility (WCAG AA minimum)

---

## Typography

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale
| Name | Size | Weight | Usage |
|------|------|--------|-------|
| **Display** | 36px | 700 | Page titles |
| **Heading 1** | 24px | 600 | Section headers |
| **Heading 2** | 20px | 600 | Card titles |
| **Body** | 16px | 400 | Default text |
| **Body Small** | 14px | 400 | Secondary text |
| **Caption** | 12px | 500 | Labels, metadata |

### Typography Rules
- Line height: 1.5 for body text, 1.2 for headings
- Maximum line length: 65-75 characters for readability
- Use font-weight 500+ for any text on colored backgrounds

---

## Spacing & Layout

### Spacing Scale (8px base)
```
4px   - Tight (icon padding)
8px   - Small (text spacing)
16px  - Medium (element padding)
24px  - Large (section spacing)
32px  - XL (card padding)
48px  - 2XL (section gaps)
```

### Layout Principles
- Cards have 24px padding and 8px border radius
- Consistent 16px gaps between form elements
- 48px minimum touch targets for mobile

---

## Components

### Buttons
- **Primary**: Ocean Blue background, white text, subtle shadow
- **Secondary**: White background, Ocean Blue text, border
- **Danger**: Error Red background for destructive actions
- Border radius: 6px
- Padding: 12px 24px

### Cards
- White background
- 1px border in Soft Gray
- 8px border radius
- Subtle shadow on hover

### Forms
- 40px input height
- 8px border radius
- Focus ring in Ocean Blue
- Error states in Error Red

---

## Iconography

### Style
- Use Lucide icons (or similar line-style icons)
- 24px default size
- 1.5px stroke weight
- Match text color

### Common Icons
- ✓ Check for completed
- ● Circle for in progress
- ○ Empty circle for not started
- ⚠ Warning triangle for overdue

---

## Voice Examples

### Do Say
- "Task created!" (clear, brief)
- "Looks like this is overdue - want to update the date?" (helpful)
- "Your team's crushing it this week" (encouraging)

### Don't Say
- "Task successfully created in the database" (too technical)
- "ERROR: Task overdue" (alarming)
- "Invalid input" (unhelpful)

---

## Implementation Notes

### CSS Variables
```css
:root {
  /* Colors */
  --color-primary: #2563EB;
  --color-primary-dark: #1E3A5F;
  --color-accent: #F97316;
  --color-bg: #FFFFFF;
  --color-bg-secondary: #F3F4F6;
  --color-text: #1E3A5F;
  --color-text-secondary: #6B7280;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;

  /* Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;

  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Tailwind Config (if using)
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-dark': '#1E3A5F',
        accent: '#F97316',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
};
```

---
*Generated during project onboarding. Update as the brand evolves.*
```

### Brand Interview Questions

```typescript
const brandGuidelineQuestions = [
  {
    question: "What mood or feeling should {name} convey? (e.g., professional, playful, minimal, bold)",
    field: "mood",
    followUp: "Any brands you admire that have a similar feel?"
  },
  {
    question: "If {name} were a person, how would they dress and speak?",
    field: "personality",
    followUp: "This helps me understand the brand's character"
  },
  {
    question: "Do you have brand colors in mind, or should I suggest some?",
    field: "colors",
    options: ["I have specific colors", "Suggest based on mood", "No preference"],
    followUp: "Any colors to definitely avoid?"
  },
  {
    question: "Typography preference: modern/geometric or traditional/readable?",
    field: "typography",
    options: ["Modern & geometric", "Traditional & readable", "Mix of both"],
    followUp: "Should it feel more like a tech product or a friendly tool?"
  },
  {
    question: "Are there any existing brand assets (logo, colors) we need to match?",
    field: "existingAssets",
    followUp: "Share any files or links and I'll incorporate them"
  },
  {
    question: "Who are your competitors? How should {name} look different?",
    field: "differentiation",
    followUp: "Knowing what to avoid is as important as knowing what to do"
  }
];
```

---

### How Claude Uses These Documents

Once created, these documents become part of Claude's context for ALL future interactions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT LOADING                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When user says: "Create the dashboard page"                     │
│                                                                  │
│  Claude automatically loads:                                     │
│  ├── docs/PROJECT_PLAN.md (knows the features)                  │
│  ├── docs/BRAND_GUIDELINES.md (knows the design system)         │
│  └── .lawless/context/CLAUDE.md (knows the codebase)            │
│                                                                  │
│  Claude then creates a dashboard that:                           │
│  ✓ Shows "What's overdue" prominently (from PROJECT_PLAN)       │
│  ✓ Uses Ocean Blue for primary actions (from BRAND_GUIDELINES)  │
│  ✓ Follows the existing component patterns (from codebase)      │
│                                                                  │
│  This is the magic: Claude maintains consistency automatically  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Onboarding State Machine

```typescript
// .lawless/ide/src/lib/onboarding.ts

type OnboardingStep =
  | 'services'           // Service connections (existing)
  | 'project-plan'       // NEW: Project plan interview
  | 'brand-guidelines'   // NEW: Brand guidelines interview
  | 'complete';          // Ready to build

interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  projectPlan?: {
    name: string;
    oneLiner: string;
    targetUser: string;
    coreFeatures: string[];
    successMetrics: string[];
    outOfScope: string[];
    openQuestions: string[];
  };
  brandGuidelines?: {
    mood: string;
    personality: string;
    colors: ColorPalette;
    typography: TypographyConfig;
    differentiation: string;
  };
}

// Check if onboarding is complete
export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.completedSteps.includes('project-plan') &&
         state.completedSteps.includes('brand-guidelines');
}

// Get next step
export function getNextStep(state: OnboardingState): OnboardingStep {
  if (!state.completedSteps.includes('services')) return 'services';
  if (!state.completedSteps.includes('project-plan')) return 'project-plan';
  if (!state.completedSteps.includes('brand-guidelines')) return 'brand-guidelines';
  return 'complete';
}
```

### Skip Options

Users can skip onboarding steps, but Claude will gently remind them:

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 Chat (later, when user asks to build something)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "Create a login page"                                     │
│                                                                  │
│  Claude: "I can create that! I noticed we haven't set up brand   │
│  guidelines yet. Want me to:                                     │
│                                                                  │
│  1. Use sensible defaults for now (I'll make it look good)       │
│  2. Quick brand setup first (5 min - better consistency)         │
│                                                                  │
│  Either way, I'll build you a great login page."                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Files Created by Onboarding

```
project-root/
├── docs/
│   ├── PROJECT_PLAN.md        # Created in Step 1
│   └── BRAND_GUIDELINES.md    # Created in Step 2
├── src/
│   └── styles/
│       └── brand.css          # Optional: Generated CSS variables
└── tailwind.config.js         # Updated with brand colors (if using Tailwind)
```

---

## Complete Tooling Reference

The Local IDE Agent gives Claude access to a comprehensive set of tools. Here's the complete reference of everything Claude can do.

### Tool Categories Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAUDE'S TOOL ARSENAL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📁 FILE OPERATIONS (7 tools)                                    │
│  ├─ read_file          Read file contents                        │
│  ├─ write_file         Create or update files                    │
│  ├─ delete_file        Remove files                              │
│  ├─ move_file          Rename/move files                         │
│  ├─ search_files       Search across codebase                    │
│  ├─ list_directory     List folder contents                      │
│  └─ get_file_info      Get file metadata                         │
│                                                                  │
│  🔀 GIT OPERATIONS (9 tools)                                     │
│  ├─ git_status         Current repo state                        │
│  ├─ git_diff           View changes                              │
│  ├─ git_log            Commit history                            │
│  ├─ git_commit         Create commits                            │
│  ├─ git_push           Push to remote                            │
│  ├─ git_pull           Pull from remote                          │
│  ├─ git_branch         Branch operations                         │
│  ├─ git_checkout       Switch branches                           │
│  └─ create_pr          Open pull request                         │
│                                                                  │
│  🗄️ DATABASE OPERATIONS (7 tools)                                │
│  ├─ db_query           Execute SQL                               │
│  ├─ db_schema          View table structure                      │
│  ├─ db_tables          List all tables                           │
│  ├─ db_migrate         Apply migrations                          │
│  ├─ db_seed            Insert test data                          │
│  ├─ db_backup          Export data                               │
│  └─ db_rls             Manage RLS policies                       │
│                                                                  │
│  🚀 DEPLOYMENT OPERATIONS (6 tools)                              │
│  ├─ deploy             Trigger deployment                        │
│  ├─ deployment_status  Check build status                        │
│  ├─ deployment_logs    View build logs                           │
│  ├─ rollback           Revert to previous                        │
│  ├─ env_vars           Manage environment                        │
│  └─ domains            Manage custom domains                     │
│                                                                  │
│  🔧 SYSTEM OPERATIONS (4 tools)                                  │
│  ├─ run_command        Execute shell commands                    │
│  ├─ run_tests          Execute test suite                        │
│  ├─ run_lint           Run linting                               │
│  └─ run_build          Build the project                         │
│                                                                  │
│  TOTAL: 33 TOOLS                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Operations (7 tools)

```typescript
// 1. read_file - Read file contents
{
  name: 'read_file',
  description: 'Read the contents of a file. Returns the file content as a string.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path relative to project root (e.g., "src/app/page.tsx")'
      },
      encoding: {
        type: 'string',
        enum: ['utf-8', 'base64'],
        default: 'utf-8',
        description: 'File encoding (use base64 for binary files)'
      }
    },
    required: ['path']
  }
}

// 2. write_file - Create or update files
{
  name: 'write_file',
  description: 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      content: { type: 'string', description: 'Content to write to the file' },
      createDirectories: {
        type: 'boolean',
        default: true,
        description: 'Create parent directories if they don\'t exist'
      }
    },
    required: ['path', 'content']
  }
}

// 3. delete_file - Remove files
{
  name: 'delete_file',
  description: 'Delete a file from the project.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to delete' }
    },
    required: ['path']
  }
}

// 4. move_file - Rename or move files
{
  name: 'move_file',
  description: 'Move or rename a file.',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Current file path' },
      to: { type: 'string', description: 'New file path' }
    },
    required: ['from', 'to']
  }
}

// 5. search_files - Search across codebase
{
  name: 'search_files',
  description: 'Search for text patterns across project files. Returns matching files and lines.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (supports regex)' },
      glob: {
        type: 'string',
        default: '**/*',
        description: 'File pattern to search (e.g., "**/*.ts", "src/**/*.tsx")'
      },
      caseSensitive: { type: 'boolean', default: false },
      maxResults: { type: 'number', default: 50 }
    },
    required: ['query']
  }
}

// 6. list_directory - List folder contents
{
  name: 'list_directory',
  description: 'List contents of a directory.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        default: '.',
        description: 'Directory path (defaults to project root)'
      },
      recursive: { type: 'boolean', default: false },
      includeHidden: { type: 'boolean', default: false }
    }
  }
}

// 7. get_file_info - Get file metadata
{
  name: 'get_file_info',
  description: 'Get metadata about a file (size, modified date, permissions).',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' }
    },
    required: ['path']
  }
}
```

### Git Operations (9 tools)

```typescript
// 1. git_status - Current repo state
{
  name: 'git_status',
  description: 'Get the current git status including staged, unstaged, and untracked files.',
  input_schema: {
    type: 'object',
    properties: {}
  }
}

// 2. git_diff - View changes
{
  name: 'git_diff',
  description: 'Show differences between commits, branches, or working directory.',
  input_schema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'What to diff against (e.g., "HEAD", "main", commit SHA)'
      },
      path: {
        type: 'string',
        description: 'Specific file or directory to diff'
      },
      staged: {
        type: 'boolean',
        default: false,
        description: 'Show only staged changes'
      }
    }
  }
}

// 3. git_log - Commit history
{
  name: 'git_log',
  description: 'Get commit history.',
  input_schema: {
    type: 'object',
    properties: {
      limit: { type: 'number', default: 10 },
      branch: { type: 'string', description: 'Branch to show history for' },
      path: { type: 'string', description: 'Show history for specific file' },
      author: { type: 'string', description: 'Filter by author' }
    }
  }
}

// 4. git_commit - Create commits
{
  name: 'git_commit',
  description: 'Stage files and create a commit.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to stage (defaults to all changed files)'
      },
      all: {
        type: 'boolean',
        default: false,
        description: 'Stage all changed files (git add -A)'
      }
    },
    required: ['message']
  }
}

// 5. git_push - Push to remote
{
  name: 'git_push',
  description: 'Push commits to remote repository.',
  input_schema: {
    type: 'object',
    properties: {
      branch: { type: 'string', description: 'Branch to push (defaults to current)' },
      setUpstream: {
        type: 'boolean',
        default: true,
        description: 'Set upstream tracking'
      },
      force: {
        type: 'boolean',
        default: false,
        description: 'Force push (use with caution)'
      }
    }
  }
}

// 6. git_pull - Pull from remote
{
  name: 'git_pull',
  description: 'Pull changes from remote repository.',
  input_schema: {
    type: 'object',
    properties: {
      branch: { type: 'string', description: 'Branch to pull (defaults to current)' },
      rebase: { type: 'boolean', default: false }
    }
  }
}

// 7. git_branch - Branch operations
{
  name: 'git_branch',
  description: 'List, create, or delete branches.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'create', 'delete'],
        default: 'list'
      },
      name: { type: 'string', description: 'Branch name (for create/delete)' },
      from: { type: 'string', description: 'Base branch (for create)' }
    }
  }
}

// 8. git_checkout - Switch branches
{
  name: 'git_checkout',
  description: 'Switch to a different branch or restore files.',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Branch name or commit SHA' },
      create: {
        type: 'boolean',
        default: false,
        description: 'Create branch if it doesn\'t exist'
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific files to restore'
      }
    },
    required: ['target']
  }
}

// 9. create_pr - Open pull request
{
  name: 'create_pr',
  description: 'Create a pull request on GitHub.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'PR title' },
      body: { type: 'string', description: 'PR description (markdown)' },
      head: { type: 'string', description: 'Branch with changes' },
      base: { type: 'string', default: 'main', description: 'Target branch' },
      draft: { type: 'boolean', default: false }
    },
    required: ['title', 'head']
  }
}
```

### Database Operations (7 tools)

```typescript
// 1. db_query - Execute SQL
{
  name: 'db_query',
  description: 'Execute a SQL query against the Supabase database. Returns results as JSON.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query to execute' },
      params: {
        type: 'array',
        items: { type: 'string' },
        description: 'Query parameters for prepared statements'
      },
      readOnly: {
        type: 'boolean',
        default: false,
        description: 'Enforce read-only mode (SELECT only)'
      }
    },
    required: ['query']
  }
}

// 2. db_schema - View table structure
{
  name: 'db_schema',
  description: 'Get the schema for a specific table or all tables.',
  input_schema: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'Table name (omit for all tables)'
      },
      includeConstraints: { type: 'boolean', default: true },
      includeIndexes: { type: 'boolean', default: true }
    }
  }
}

// 3. db_tables - List all tables
{
  name: 'db_tables',
  description: 'List all tables in the public schema with row counts.',
  input_schema: {
    type: 'object',
    properties: {
      includeRowCounts: { type: 'boolean', default: true }
    }
  }
}

// 4. db_migrate - Apply migrations
{
  name: 'db_migrate',
  description: 'Apply a database migration from the supabase/migrations folder.',
  input_schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'Migration filename (e.g., "20240101_add_users.sql")'
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Show what would be executed without applying'
      }
    },
    required: ['file']
  }
}

// 5. db_seed - Insert test data
{
  name: 'db_seed',
  description: 'Insert seed data into a table.',
  input_schema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      data: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of rows to insert'
      },
      upsert: {
        type: 'boolean',
        default: false,
        description: 'Update existing rows on conflict'
      }
    },
    required: ['table', 'data']
  }
}

// 6. db_backup - Export data
{
  name: 'db_backup',
  description: 'Export table data to JSON.',
  input_schema: {
    type: 'object',
    properties: {
      tables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tables to backup (omit for all)'
      },
      outputPath: { type: 'string', description: 'File path to save backup' }
    }
  }
}

// 7. db_rls - Manage RLS policies
{
  name: 'db_rls',
  description: 'View or create Row Level Security policies.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'create', 'drop'],
        default: 'list'
      },
      table: { type: 'string', description: 'Table name' },
      policy: { type: 'string', description: 'Policy name (for create/drop)' },
      definition: { type: 'string', description: 'Policy SQL (for create)' }
    }
  }
}
```

### Deployment Operations (6 tools)

```typescript
// 1. deploy - Trigger deployment
{
  name: 'deploy',
  description: 'Trigger a deployment to Vercel.',
  input_schema: {
    type: 'object',
    properties: {
      branch: { type: 'string', default: 'main', description: 'Branch to deploy' },
      environment: {
        type: 'string',
        enum: ['production', 'preview'],
        default: 'preview'
      }
    }
  }
}

// 2. deployment_status - Check build status
{
  name: 'deployment_status',
  description: 'Get status of recent deployments.',
  input_schema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'string', description: 'Specific deployment ID' },
      limit: { type: 'number', default: 5, description: 'Number of recent deployments' }
    }
  }
}

// 3. deployment_logs - View build logs
{
  name: 'deployment_logs',
  description: 'Get build logs for a deployment.',
  input_schema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'string', description: 'Deployment ID' },
      type: {
        type: 'string',
        enum: ['build', 'runtime'],
        default: 'build'
      }
    },
    required: ['deploymentId']
  }
}

// 4. rollback - Revert to previous deployment
{
  name: 'rollback',
  description: 'Rollback to a previous deployment.',
  input_schema: {
    type: 'object',
    properties: {
      deploymentId: {
        type: 'string',
        description: 'Deployment ID to rollback to'
      },
      environment: {
        type: 'string',
        enum: ['production', 'preview'],
        default: 'production'
      }
    },
    required: ['deploymentId']
  }
}

// 5. env_vars - Manage environment variables
{
  name: 'env_vars',
  description: 'List, create, update, or delete environment variables on Vercel.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'set', 'delete'],
        default: 'list'
      },
      key: { type: 'string', description: 'Variable name' },
      value: { type: 'string', description: 'Variable value (for set)' },
      environment: {
        type: 'array',
        items: { type: 'string', enum: ['production', 'preview', 'development'] },
        default: ['production', 'preview'],
        description: 'Target environments'
      }
    }
  }
}

// 6. domains - Manage custom domains
{
  name: 'domains',
  description: 'List or configure custom domains.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'add', 'remove', 'verify'],
        default: 'list'
      },
      domain: { type: 'string', description: 'Domain name (for add/remove/verify)' }
    }
  }
}
```

### System Operations (4 tools)

```typescript
// 1. run_command - Execute shell commands
{
  name: 'run_command',
  description: 'Execute a shell command in the project directory.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
      cwd: { type: 'string', description: 'Working directory (relative to project)' },
      timeout: { type: 'number', default: 30000, description: 'Timeout in milliseconds' }
    },
    required: ['command']
  }
}

// 2. run_tests - Execute test suite
{
  name: 'run_tests',
  description: 'Run the project\'s test suite.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Test file pattern (e.g., "**/*.test.ts")' },
      coverage: { type: 'boolean', default: false },
      watch: { type: 'boolean', default: false }
    }
  }
}

// 3. run_lint - Run linting
{
  name: 'run_lint',
  description: 'Run linting on the codebase.',
  input_schema: {
    type: 'object',
    properties: {
      fix: { type: 'boolean', default: false, description: 'Auto-fix issues' },
      path: { type: 'string', description: 'Specific path to lint' }
    }
  }
}

// 4. run_build - Build the project
{
  name: 'run_build',
  description: 'Run the project build process.',
  input_schema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['development', 'production'],
        default: 'production'
      }
    }
  }
}
```

### ai-coding-config Integration

In addition to the 33 tools above, Claude has access to the full **ai-coding-config** ecosystem:

#### Agents (24 specialized AI agents)

| Agent | Purpose | When Triggered |
|-------|---------|----------------|
| `autonomous-developer` | Complete tasks independently | Complex multi-step tasks |
| `debugger` | Investigate and fix bugs | Test failures, errors |
| `security-reviewer` | Find vulnerabilities | Security audits, sensitive code |
| `test-engineer` | Write comprehensive tests | After new features |
| `performance-reviewer` | Optimize efficiency | Slow code, N+1 queries |
| `architecture-auditor` | Review design patterns | Major refactors |
| `error-handling-reviewer` | Ensure proper error handling | Try/catch, error flows |
| `logic-reviewer` | Find correctness issues | Complex logic |
| `ux-designer` | Polish user experience | UI components |
| `design-reviewer` | Review UI quality | Frontend changes |
| `style-reviewer` | Check code conventions | Code style |
| `empathy-reviewer` | User experience perspective | User-facing features |
| `prompt-engineer` | Write effective prompts | AI integrations |
| `simplifier` | Reduce complexity | Over-engineered code |
| `git-writer` | Write commit messages | Git operations |
| `comment-analyzer` | Review documentation | Code comments |
| `test-analyzer` | Review test quality | Test coverage |
| `test-runner` | Run and report tests | After changes |
| `robustness-reviewer` | Production readiness | Before deployment |
| `site-keeper` | Monitor health | Production issues |
| `observability-reviewer` | Logging and monitoring | Debug patterns |
| `seo-specialist` | SEO optimization | Public pages |
| `mobile-ux-reviewer` | Mobile experience | Responsive design |
| `library-advisor` | Technology choices | Dependency decisions |

#### Commands (18 workflow commands)

| Command | Purpose |
|---------|---------|
| `/autotask` | Complete task autonomously and open PR |
| `/multi-review` | Multi-agent code review |
| `/troubleshoot` | Debug production errors |
| `/verify-fix` | Confirm fixes work |
| `/session` | Save/resume sessions |
| `/repo-tooling` | Set up linting/CI |
| `/brainstorm` | Explore options before coding |
| `/research` | Web research for current info |
| `/handoff-context` | Generate context for new session |
| `/load-rules` | Load task-specific rules |
| `/address-pr-comments` | Handle PR feedback |
| `/cleanup-worktree` | Clean up git worktrees |
| `/generate-llms-txt` | Generate llms.txt for AI |
| `/ai-coding-config` | Interactive setup |
| `/create-prompt` | Write optimized prompts |
| `/personality-change` | Change AI personality |
| `/setup-environment` | Initialize dev environment |
| `/product-intel` | Research competitors |

#### Skills (7 specialized skills)

| Skill | Purpose |
|-------|---------|
| `systematic-debugging` | Root cause analysis |
| `brainstorming` | Explore options before implementation |
| `research` | Web research for current information |
| `playwright-browser` | Browser automation and testing |
| `youtube-transcript-analyzer` | Extract insights from videos |
| `skill-creator` | Create new skills |
| `brainstorm-synthesis` | M-of-N synthesis on complex problems |

---

## Core Differentiators (vs Hosted IDE)

### Agent-First, Not IDE-First

| Feature | Hosted IDE | Local IDE Agent |
|---------|-----------|-----------------|
| **Default View** | 6 collapsible panes | 2 panes (Chat + Browser) |
| **File Editor** | Always visible | Hidden by default |
| **Deployment** | Deploy button | Git push auto-deploys |
| **Target User** | Power users | Everyone |
| **Complexity** | Full IDE | Minimal, conversational |
| **Learning Curve** | Medium | Near zero |

### Design Principles

**1. Conversation is the Interface**
- Users talk to Claude, not to an IDE
- The chat pane is the primary interaction point
- Everything else supports the conversation

**2. Browser Shows Results**
- See your app live, updated in real-time
- Click on any component to edit it with Claude
- Visual feedback is immediate

**3. Files are Implementation Details**
- Most users don't need to see files
- Claude handles file operations
- Power users can reveal the file editor

**4. Deployment is Invisible**
- No deploy buttons
- Git push triggers Vercel auto-deploy
- Status bar shows deployment state

### The 2-Pane Default Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Local IDE Agent - Agent-First Design                            │
├─────────────────────────────┬───────────────────────────────────┤
│                             │                                   │
│        💬 Chat Pane         │        🌐 Browser Pane            │
│        (Primary)            │        (Visual Feedback)          │
│                             │                                   │
│  ┌───────────────────────┐  │  ┌─────────────────────────────┐  │
│  │                       │  │  │                             │  │
│  │  Conversation with    │  │  │    Live App Preview         │  │
│  │  Claude               │  │  │                             │  │
│  │                       │  │  │    [Click any element       │  │
│  │  • Ask questions      │  │  │     to edit with AI]        │  │
│  │  • Request changes    │  │  │                             │  │
│  │  • See what Claude    │  │  │                             │  │
│  │    is doing           │  │  │                             │  │
│  │                       │  │  │                             │  │
│  └───────────────────────┘  │  └─────────────────────────────┘  │
│                             │                                   │
│  ┌───────────────────────┐  │  ┌─────────────────────────────┐  │
│  │ Type a message...     │  │  │ Services: ● ● ● ●           │  │
│  └───────────────────────┘  │  │ Deploy: ✓ Live (2m ago)     │  │
│                             │  └─────────────────────────────┘  │
│                             │                                   │
├─────────────────────────────┴───────────────────────────────────┤
│  [📁 Show Files]                              [⚙️ Settings]      │
└─────────────────────────────────────────────────────────────────┘
```

### Expanded 3-Pane Layout (Optional)

When user clicks "Show Files":

```
┌─────────────────────────────────────────────────────────────────┐
│  Local IDE Agent - Files Visible                                 │
├───────────────┬─────────────────────────┬───────────────────────┤
│               │                         │                       │
│  💬 Chat      │    📝 File Editor       │    🌐 Browser         │
│               │                         │                       │
│  [Narrower]   │  ┌───────────────────┐  │  ┌─────────────────┐  │
│               │  │ // page.tsx       │  │  │                 │  │
│  ┌─────────┐  │  │                   │  │  │  Live Preview   │  │
│  │ Chat    │  │  │ export default    │  │  │                 │  │
│  │ history │  │  │ function Page() { │  │  │                 │  │
│  │         │  │  │   return (        │  │  │                 │  │
│  └─────────┘  │  │     <div>...</div>│  │  │                 │  │
│               │  │   )               │  │  │                 │  │
│  ┌─────────┐  │  │ }                 │  │  └─────────────────┘  │
│  │ Input   │  │  └───────────────────┘  │                       │
│  └─────────┘  │  ┌───────────────────┐  │  ┌─────────────────┐  │
│               │  │ 📁 File Tree      │  │  │ Services Status │  │
│               │  └───────────────────┘  │  └─────────────────┘  │
├───────────────┴─────────────────────────┴───────────────────────┤
│  [📁 Hide Files]                              [⚙️ Settings]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation & Agent Core

### Goals
- Create the minimal, agent-first Local IDE Agent
- 2-pane layout (Chat + Browser) with optional file editor
- First-run setup wizard connecting all services
- Claude integration with full tool suite
- Git push = auto-deploy workflow

### Tasks

#### 1.1 IDE Agent Package Structure

```typescript
// .lawless/ide/package.json
{
  "name": "@lawless/local-ide",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001"
  },
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "@anthropic-ai/sdk": "^0.x",
    "@supabase/supabase-js": "^2.x",
    "@octokit/rest": "^20.x",
    "zustand": "^4.x",
    "monaco-editor": "^0.x"
  }
}
```

#### 1.2 Service Configuration

```typescript
// .lawless/config/services.json
{
  "github": {
    "owner": "{{GITHUB_OWNER}}",
    "repo": "{{GITHUB_REPO}}",
    "token_env": "GITHUB_TOKEN"  // Reference to .env.local
  },
  "supabase": {
    "url_env": "NEXT_PUBLIC_SUPABASE_URL",
    "anon_key_env": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "service_role_env": "SUPABASE_SERVICE_ROLE_KEY"
  },
  "vercel": {
    "project_id": "{{VERCEL_PROJECT_ID}}",
    "token_env": "VERCEL_TOKEN"
  },
  "claude": {
    "api_key_env": "ANTHROPIC_API_KEY",
    "model": "claude-sonnet-4-20250514"
  }
}
```

#### 1.3 Agent Configuration

```typescript
// .lawless/config/agent.json
{
  "version": "1.0.0",
  "name": "Local IDE Agent",
  "capabilities": {
    "file_operations": true,
    "git_operations": true,
    "database_operations": true,
    "deployment_operations": true
  },
  "automation": {
    "auto_commit": false,
    "auto_deploy": false,
    "auto_migrate": false
  },
  "context": {
    "include_patterns": ["src/**/*", "*.config.*", "package.json"],
    "exclude_patterns": ["node_modules/**", ".next/**", ".lawless/ide/**"]
  }
}
```

#### 1.4 Project Scaffolding Script

```bash
#!/bin/bash
# scripts/scaffold-local-ide.sh

PROJECT_NAME=$1
GITHUB_REPO=$2
SUPABASE_PROJECT=$3
VERCEL_PROJECT=$4

echo "Scaffolding Local IDE Agent for $PROJECT_NAME..."

# Create .lawless directory structure
mkdir -p .lawless/{ide,config,context}

# Copy IDE template
cp -r $TEMPLATE_DIR/ide/* .lawless/ide/

# Generate service config
cat > .lawless/config/services.json << EOF
{
  "github": {
    "owner": "$(echo $GITHUB_REPO | cut -d'/' -f1)",
    "repo": "$(echo $GITHUB_REPO | cut -d'/' -f2)",
    "token_env": "GITHUB_TOKEN"
  },
  "supabase": {
    "project_ref": "$SUPABASE_PROJECT",
    "url_env": "NEXT_PUBLIC_SUPABASE_URL",
    "anon_key_env": "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  },
  "vercel": {
    "project_id": "$VERCEL_PROJECT",
    "token_env": "VERCEL_TOKEN"
  },
  "claude": {
    "api_key_env": "ANTHROPIC_API_KEY"
  }
}
EOF

# Copy ai-coding-config context
cp -r ~/.ai_coding_config/.claude/* .lawless/context/

# Update project package.json with IDE scripts
npm pkg set scripts.ide="cd .lawless/ide && npm run dev"
npm pkg set scripts.dev:all="concurrently \"npm run dev\" \"npm run ide\""

echo "Done! Run 'npm run dev:all' to start both your app and the IDE."
```

#### 1.5 Agent-First Layout Component

```tsx
// .lawless/ide/src/app/page.tsx
'use client';

import { useState } from 'react';
import { ChatPane } from '@/components/ChatPane';
import { BrowserPane } from '@/components/BrowserPane';
import { EditorPane } from '@/components/EditorPane';
import { StatusBar } from '@/components/StatusBar';
import { useIDEStore } from '@/stores/ideStore';

export default function LocalIDE() {
  const { showFiles, setShowFiles } = useIDEStore();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Chat Pane - Always visible, primary interaction */}
        <div className={`${showFiles ? 'w-[300px]' : 'w-[400px]'} border-r bg-white flex flex-col transition-all`}>
          <ChatPane />
        </div>

        {/* Editor Pane - Hidden by default */}
        {showFiles && (
          <div className="w-[400px] border-r bg-white flex flex-col">
            <EditorPane />
          </div>
        )}

        {/* Browser Pane - Live preview of the app */}
        <div className="flex-1 flex flex-col bg-white">
          <BrowserPane />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles(!showFiles)}
      />
    </div>
  );
}
```

#### 1.6 Minimal Status Bar

```tsx
// .lawless/ide/src/components/StatusBar.tsx
'use client';

import { useServiceStatus } from '@/hooks/useServiceStatus';
import { useDeploymentStatus } from '@/hooks/useDeploymentStatus';

interface StatusBarProps {
  showFiles: boolean;
  onToggleFiles: () => void;
}

export function StatusBar({ showFiles, onToggleFiles }: StatusBarProps) {
  const services = useServiceStatus();
  const deployment = useDeploymentStatus();

  return (
    <div className="h-12 border-t bg-white px-4 flex items-center justify-between">
      {/* Left: Toggle Files */}
      <button
        onClick={onToggleFiles}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <span>📁</span>
        <span>{showFiles ? 'Hide Files' : 'Show Files'}</span>
      </button>

      {/* Center: Service Status */}
      <div className="flex items-center gap-3">
        <ServiceDot label="Claude" connected={services.claude} />
        <ServiceDot label="GitHub" connected={services.github} />
        <ServiceDot label="Supabase" connected={services.supabase} />
        <ServiceDot label="Vercel" connected={services.vercel} />
      </div>

      {/* Right: Deployment Status + Settings */}
      <div className="flex items-center gap-4">
        <DeploymentIndicator status={deployment} />
        <button className="text-gray-600 hover:text-gray-900">
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

function ServiceDot({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center gap-1" title={`${label}: ${connected ? 'Connected' : 'Disconnected'}`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-500 hidden sm:inline">{label}</span>
    </div>
  );
}

function DeploymentIndicator({ status }: { status: { state: string; url?: string; time?: string } }) {
  const stateColors = {
    live: 'text-green-600',
    building: 'text-yellow-600',
    error: 'text-red-600',
    idle: 'text-gray-500',
  };

  const stateIcons = {
    live: '✓',
    building: '⏳',
    error: '✗',
    idle: '○',
  };

  return (
    <div className={`text-sm ${stateColors[status.state as keyof typeof stateColors] || 'text-gray-500'}`}>
      <span>{stateIcons[status.state as keyof typeof stateIcons] || '○'}</span>
      <span className="ml-1">{status.state === 'live' && status.time ? `Live (${status.time})` : status.state}</span>
    </div>
  );
}
```

#### 1.6 First-Run Setup Wizard

```tsx
// .lawless/ide/src/app/setup/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClaudeSetup } from '@/components/Setup/ClaudeSetup';
import { GitHubSetup } from '@/components/Setup/GitHubSetup';
import { SupabaseSetup } from '@/components/Setup/SupabaseSetup';
import { VercelSetup } from '@/components/Setup/VercelSetup';
import { SetupComplete } from '@/components/Setup/SetupComplete';

const STEPS = ['claude', 'github', 'supabase', 'vercel', 'complete'] as const;
type Step = typeof STEPS[number];

export default function SetupWizard() {
  const [step, setStep] = useState<Step>('claude');
  const [connections, setConnections] = useState({
    claude: false,
    github: false,
    supabase: false,
    vercel: false,
  });
  const router = useRouter();

  // Check if setup is already complete
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.setupComplete) {
          router.push('/');
        }
      });
  }, []);

  const currentStep = STEPS.indexOf(step);
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleStepComplete = (service: keyof typeof connections) => {
    setConnections(prev => ({ ...prev, [service]: true }));
    const nextIndex = STEPS.indexOf(step) + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    }
  };

  const handleSkip = () => {
    const nextIndex = STEPS.indexOf(step) + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to Your IDE
          </h1>
          <p className="text-gray-500 mt-2">
            Let's connect your services to unlock the full power of your
            AI-powered development environment.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        {step === 'claude' && (
          <ClaudeSetup
            onComplete={() => handleStepComplete('claude')}
            onSkip={handleSkip}
          />
        )}
        {step === 'github' && (
          <GitHubSetup
            onComplete={() => handleStepComplete('github')}
            onSkip={handleSkip}
          />
        )}
        {step === 'supabase' && (
          <SupabaseSetup
            onComplete={() => handleStepComplete('supabase')}
            onSkip={handleSkip}
          />
        )}
        {step === 'vercel' && (
          <VercelSetup
            onComplete={() => handleStepComplete('vercel')}
            onSkip={handleSkip}
          />
        )}
        {step === 'complete' && (
          <SetupComplete
            connections={connections}
            onFinish={() => router.push('/')}
          />
        )}
      </div>
    </div>
  );
}
```

#### 1.7 Service Connection Component (Claude Example)

```tsx
// .lawless/ide/src/components/Setup/ClaudeSetup.tsx
'use client';

import { useState } from 'react';

interface ClaudeSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function ClaudeSetup({ onComplete, onSkip }: ClaudeSetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setError(null);

    try {
      const response = await fetch('/api/setup/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">
          🤖
        </div>
        <div>
          <h2 className="text-lg font-semibold">Connect Claude (Anthropic)</h2>
          <p className="text-sm text-gray-500">
            Claude powers all AI features in your IDE
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-sm mb-2">What you'll unlock:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Intelligent code generation and editing</li>
          <li>• 24 specialized AI agents (debugging, security, testing...)</li>
          <li>• 18 workflow commands (/autotask, /multi-review...)</li>
          <li>• Natural language to code translation</li>
        </ul>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anthropic API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="claude-sonnet-4-20250514">
              Claude Sonnet 4 (Recommended)
            </option>
            <option value="claude-opus-4-20250514">
              Claude Opus 4 (Most powerful)
            </option>
            <option value="claude-3-5-haiku-20241022">
              Claude 3.5 Haiku (Fastest)
            </option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Sonnet offers the best balance of speed and capability
          </p>
        </div>

        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          📖 Get your API key at console.anthropic.com
          <span>↗</span>
        </a>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
        <button
          onClick={testConnection}
          disabled={!apiKey || testing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {testing ? (
            <>
              <span className="animate-spin">⏳</span>
              Testing...
            </>
          ) : (
            'Save & Continue'
          )}
        </button>
      </div>
    </div>
  );
}
```

#### 1.8 Settings Page for Service Management

```tsx
// .lawless/ide/src/app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ServiceCard } from '@/components/Settings/ServiceCard';

interface ServiceStatus {
  connected: boolean;
  details?: Record<string, any>;
  error?: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<{
    claude: ServiceStatus;
    github: ServiceStatus;
    supabase: ServiceStatus;
    vercel: ServiceStatus;
  }>({
    claude: { connected: false },
    github: { connected: false },
    supabase: { connected: false },
    vercel: { connected: false },
  });

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(setStatus);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-gray-500 mb-8">
        Manage your service connections and IDE preferences
      </p>

      <h2 className="text-lg font-semibold mb-4">Service Connections</h2>

      <div className="grid grid-cols-2 gap-4">
        <ServiceCard
          icon="🤖"
          name="Claude (Anthropic)"
          description="AI assistant powering code generation"
          connected={status.claude.connected}
          details={status.claude.details}
          onManage={() => {/* open modal */}}
          onDisconnect={() => {/* disconnect */}}
        />

        <ServiceCard
          icon="🐙"
          name="GitHub"
          description="Code repository and version control"
          connected={status.github.connected}
          details={status.github.details}
          onManage={() => {/* open modal */}}
          onDisconnect={() => {/* disconnect */}}
        />

        <ServiceCard
          icon="🗄️"
          name="Supabase"
          description="Database and backend services"
          connected={status.supabase.connected}
          details={status.supabase.details}
          onManage={() => {/* open modal */}}
          onDisconnect={() => {/* disconnect */}}
        />

        <ServiceCard
          icon="▲"
          name="Vercel"
          description="Deployment and hosting"
          connected={status.vercel.connected}
          details={status.vercel.details}
          onManage={() => {/* open modal */}}
          onDisconnect={() => {/* disconnect */}}
        />
      </div>
    </div>
  );
}
```

#### 1.9 Setup API Endpoints

```typescript
// .lawless/ide/src/app/api/setup/claude/route.ts
import { writeEnvVariable } from '@/lib/env';

export async function POST(req: Request) {
  const { apiKey, model } = await req.json();

  // Verify the API key works
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json(
        { error: error.error?.message || 'Invalid API key' },
        { status: 400 }
      );
    }

    // Save to .env.local
    await writeEnvVariable('ANTHROPIC_API_KEY', apiKey);
    await writeEnvVariable('CLAUDE_MODEL', model);

    return Response.json({ success: true, model });
  } catch (error) {
    return Response.json(
      { error: 'Failed to verify API key' },
      { status: 500 }
    );
  }
}

// .lawless/ide/src/lib/env.ts
import fs from 'fs/promises';
import path from 'path';

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd().replace('/.lawless/ide', '');
const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');

export async function writeEnvVariable(key: string, value: string) {
  let content = '';

  try {
    content = await fs.readFile(ENV_FILE, 'utf-8');
  } catch {
    // File doesn't exist, will create
  }

  const lines = content.split('\n');
  const keyIndex = lines.findIndex(line => line.startsWith(`${key}=`));

  if (keyIndex >= 0) {
    lines[keyIndex] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  await fs.writeFile(ENV_FILE, lines.filter(Boolean).join('\n') + '\n');
}

export async function readEnvVariable(key: string): Promise<string | null> {
  try {
    const content = await fs.readFile(ENV_FILE, 'utf-8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
```

### Deliverables
- [ ] IDE agent package template
- [ ] **2-pane agent-first layout (Chat + Browser)**
- [ ] **Optional 3-pane with file editor toggle**
- [ ] **Minimal status bar with service/deploy status**
- [ ] First-run setup wizard with 4-step flow
- [ ] Claude connection setup with model selection
- [ ] GitHub connection setup with token verification
- [ ] Supabase connection setup with project linking
- [ ] Vercel connection setup with project verification
- [ ] **Project Onboarding: Project Plan interview & generation**
- [ ] **Project Onboarding: Brand Guidelines interview & generation**
- [ ] **docs/ folder with PROJECT_PLAN.md and BRAND_GUIDELINES.md**
- [ ] **Context loading for onboarding docs in all Claude interactions**
- [ ] Settings page for managing connections
- [ ] Full Claude tool suite (files, git, db, deploy)
- [ ] **Git push = auto-deploy workflow**
- [ ] Secure token storage in .env.local

---

## Phase 2: Browser Integration & Click-to-Edit

### Goals
- Interactive browser preview with component inspection
- Click any element to load its context into Claude
- Real-time HMR updates for instant visual feedback
- The "magic" moment: click, describe, see it change

### Core Experience

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE CLICK-TO-EDIT EXPERIENCE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. User enables "Inspect Mode" (🎯 button)                     │
│      └─ Browser pane enters inspection state                     │
│                                                                  │
│   2. User hovers over components                                 │
│      └─ Blue highlight appears around components                 │
│      └─ Tooltip shows component name: "<HeroSection>"            │
│                                                                  │
│   3. User clicks a component                                     │
│      └─ Selection panel appears with component info              │
│      └─ Source file identified via React fiber + source maps     │
│                                                                  │
│   4. User clicks "Edit with Claude"                              │
│      └─ Component code loaded into chat context                  │
│      └─ User types: "Make this header blue"                      │
│                                                                  │
│   5. Claude edits the file                                       │
│      └─ HMR triggers automatically                               │
│      └─ User sees change in browser instantly                    │
│                                                                  │
│   This is the core loop: Click → Describe → See it change        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Deliverables
- [ ] Browser pane with inspect mode toggle
- [ ] Component overlay/highlight on hover
- [ ] React fiber traversal for component detection
- [ ] Source map integration for file location
- [ ] Component selection panel
- [ ] "Edit with Claude" button that loads context
- [ ] Chat context injection for selected components
- [ ] HMR integration for instant updates
- [ ] Inspector injection script for iframe preview

---

## Technical Reference: AI Integration (Phase 1)

> The following code is implemented in Phase 1 as part of the agent core.

### Claude Integration

```typescript
// .lawless/ide/src/lib/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { tools } from './tools';
import { loadContext } from './context';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chat(messages: Message[], projectPath: string) {
  const context = await loadContext(projectPath);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8096,
    system: context.systemPrompt,
    messages,
    tools: tools.definitions,
  });

  // Handle tool calls
  if (response.stop_reason === 'tool_use') {
    const toolResults = await executeTools(response.content, projectPath);
    return chat([...messages, { role: 'assistant', content: response.content }, ...toolResults], projectPath);
  }

  return response;
}
```

#### 2.2 Tool Definitions

```typescript
// .lawless/ide/src/lib/tools/index.ts

export const tools = {
  definitions: [
    // File Operations
    {
      name: 'read_file',
      description: 'Read the contents of a file in the project',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to project root' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: 'Write content to a file in the project',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'search_files',
      description: 'Search for text across project files',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          glob: { type: 'string', description: 'File pattern to search (default: **/*)'  }
        },
        required: ['query']
      }
    },

    // Git Operations
    {
      name: 'git_status',
      description: 'Get current git status',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'git_commit',
      description: 'Commit staged changes',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } }
        },
        required: ['message']
      }
    },
    {
      name: 'git_push',
      description: 'Push commits to remote',
      input_schema: {
        type: 'object',
        properties: {
          branch: { type: 'string' }
        }
      }
    },
    {
      name: 'create_pr',
      description: 'Create a pull request',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          base: { type: 'string', default: 'main' },
          head: { type: 'string' }
        },
        required: ['title', 'head']
      }
    },

    // Database Operations
    {
      name: 'db_query',
      description: 'Execute a SQL query against the Supabase database',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          params: { type: 'array' }
        },
        required: ['query']
      }
    },
    {
      name: 'db_schema',
      description: 'Get the database schema',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'db_migrate',
      description: 'Apply a database migration',
      input_schema: {
        type: 'object',
        properties: {
          migration_file: { type: 'string' }
        },
        required: ['migration_file']
      }
    },

    // Deployment Operations
    {
      name: 'deploy',
      description: 'Trigger a deployment to Vercel',
      input_schema: {
        type: 'object',
        properties: {
          branch: { type: 'string', default: 'main' }
        }
      }
    },
    {
      name: 'get_deployment_status',
      description: 'Get the status of recent deployments',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'get_deployment_logs',
      description: 'Get logs from a deployment',
      input_schema: {
        type: 'object',
        properties: {
          deployment_id: { type: 'string' }
        },
        required: ['deployment_id']
      }
    },
    {
      name: 'set_env_var',
      description: 'Set an environment variable on Vercel',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          environment: { type: 'string', enum: ['production', 'preview', 'development'] }
        },
        required: ['key', 'value']
      }
    }
  ]
};
```

#### 2.3 Context Loading

```typescript
// .lawless/ide/src/lib/context.ts
import fs from 'fs/promises';
import path from 'path';
import glob from 'fast-glob';

export async function loadContext(projectPath: string) {
  const contextDir = path.join(projectPath, '.lawless', 'context');

  // Load CLAUDE.md
  const claudeMd = await fs.readFile(path.join(contextDir, 'CLAUDE.md'), 'utf-8')
    .catch(() => '');

  // Load available agents
  const agentFiles = await glob('agents/*.md', { cwd: contextDir });
  const agents = await Promise.all(
    agentFiles.map(async (file) => ({
      name: path.basename(file, '.md'),
      content: await fs.readFile(path.join(contextDir, file), 'utf-8')
    }))
  );

  // Load available commands
  const commandFiles = await glob('commands/*.md', { cwd: contextDir });
  const commands = await Promise.all(
    commandFiles.map(async (file) => ({
      name: path.basename(file, '.md'),
      content: await fs.readFile(path.join(contextDir, file), 'utf-8')
    }))
  );

  // Build system prompt
  const systemPrompt = `
${claudeMd}

## Available Agents
${agents.map(a => `- ${a.name}`).join('\n')}

## Available Commands
${commands.map(c => `- /${c.name}`).join('\n')}

## Project Context
Working directory: ${projectPath}
This is a local IDE agent with direct access to files, git, database, and deployments.
`;

  return {
    systemPrompt,
    agents,
    commands,
  };
}
```

#### 2.4 Chat Pane Component

```tsx
// .lawless/ide/src/components/ChatPane/index.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { ToolUseIndicator } from './ToolUseIndicator';
import { ContextPanel } from './ContextPanel';

export default function ChatPane() {
  const [input, setInput] = useState('');
  const [showContext, setShowContext] = useState(false);
  const { messages, isLoading, activeTools, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex justify-between items-center">
        <h2 className="font-semibold">AI Assistant</h2>
        <button
          onClick={() => setShowContext(!showContext)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {showContext ? 'Hide Context' : 'Show Context'}
        </button>
      </div>

      {/* Context Panel (collapsible) */}
      {showContext && <ContextPanel />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {activeTools.length > 0 && (
          <ToolUseIndicator tools={activeTools} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Claude anything..."
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

### Deliverables
- [ ] Claude API integration
- [ ] Tool calling system with all tool definitions
- [ ] Tool execution handlers (files, git, db, deploy)
- [ ] Context loading from .lawless/context
- [ ] Chat pane UI
- [ ] Message rendering with markdown
- [ ] Tool use indicators
- [ ] Context visibility panel

---

## Service Integrations (Reference - Now in Phase 1)

> **Note:** Service integrations are now part of Phase 1's setup wizard. This section is kept as technical reference.

### Technical Implementation Details
- GitHub connector (read/write files, branches, PRs)
- Supabase connector (queries, migrations, schema)
- Vercel connector (deploy, logs, env vars)
- Service status monitoring

### Tasks

#### 3.1 GitHub Connector

```typescript
// .lawless/ide/src/lib/connectors/github.ts
import { Octokit } from '@octokit/rest';
import { loadServiceConfig } from '../config';

export class GitHubConnector {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    const config = loadServiceConfig('github');
    this.octokit = new Octokit({ auth: process.env[config.token_env] });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async getFile(path: string, ref?: string) {
    const { data } = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref,
    });

    if ('content' in data) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    throw new Error('Not a file');
  }

  async updateFile(path: string, content: string, message: string, branch: string) {
    // Get current file SHA
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });
      if ('sha' in data) sha = data.sha;
    } catch (e) {
      // File doesn't exist, creating new
    }

    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha,
    });
  }

  async getBranches() {
    const { data } = await this.octokit.repos.listBranches({
      owner: this.owner,
      repo: this.repo,
    });
    return data;
  }

  async createBranch(name: string, fromBranch = 'main') {
    const { data: ref } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${fromBranch}`,
    });

    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${name}`,
      sha: ref.object.sha,
    });
  }

  async createPR(title: string, body: string, head: string, base = 'main') {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head,
      base,
    });
    return data;
  }

  async getStatus() {
    try {
      const { data } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return { connected: true, repo: data.full_name };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }
}
```

#### 3.2 Supabase Connector

```typescript
// .lawless/ide/src/lib/connectors/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadServiceConfig } from '../config';

export class SupabaseConnector {
  private client: SupabaseClient;
  private serviceClient: SupabaseClient;

  constructor() {
    const config = loadServiceConfig('supabase');

    // Regular client for user operations
    this.client = createClient(
      process.env[config.url_env]!,
      process.env[config.anon_key_env]!
    );

    // Service role client for admin operations
    this.serviceClient = createClient(
      process.env[config.url_env]!,
      process.env[config.service_role_env]!
    );
  }

  async query(sql: string, params?: any[]) {
    // Use the REST API for raw SQL
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({ query: sql, params }),
      }
    );
    return response.json();
  }

  async getSchema() {
    const sql = `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    return this.query(sql);
  }

  async getMigrations() {
    // Read from supabase/migrations directory
    const fs = await import('fs/promises');
    const path = await import('path');
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();
    const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');

    try {
      const files = await fs.readdir(migrationsDir);
      return files.filter(f => f.endsWith('.sql')).sort();
    } catch {
      return [];
    }
  }

  async applyMigration(filename: string) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();
    const migrationPath = path.join(projectRoot, 'supabase', 'migrations', filename);

    const sql = await fs.readFile(migrationPath, 'utf-8');
    return this.query(sql);
  }

  async getStatus() {
    try {
      const { data, error } = await this.client.from('_health_check').select('*').limit(1);
      if (error && error.code !== 'PGRST116') throw error;
      return { connected: true };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }
}
```

#### 3.3 Vercel Connector

```typescript
// .lawless/ide/src/lib/connectors/vercel.ts
import { loadServiceConfig } from '../config';

export class VercelConnector {
  private token: string;
  private projectId: string;
  private baseUrl = 'https://api.vercel.com';

  constructor() {
    const config = loadServiceConfig('vercel');
    this.token = process.env[config.token_env]!;
    this.projectId = config.project_id;
  }

  private async fetch(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }

  async getDeployments(limit = 10) {
    return this.fetch(`/v6/deployments?projectId=${this.projectId}&limit=${limit}`);
  }

  async getDeployment(id: string) {
    return this.fetch(`/v13/deployments/${id}`);
  }

  async getDeploymentLogs(id: string) {
    return this.fetch(`/v2/deployments/${id}/events`);
  }

  async triggerDeployment(ref = 'main') {
    // Trigger via webhook or API
    return this.fetch(`/v13/deployments`, {
      method: 'POST',
      body: JSON.stringify({
        name: this.projectId,
        project: this.projectId,
        gitSource: {
          ref,
          type: 'github',
        },
      }),
    });
  }

  async getEnvVars() {
    return this.fetch(`/v9/projects/${this.projectId}/env`);
  }

  async setEnvVar(key: string, value: string, target: string[] = ['production', 'preview']) {
    return this.fetch(`/v10/projects/${this.projectId}/env`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        target,
        type: 'encrypted',
      }),
    });
  }

  async getStatus() {
    try {
      const data = await this.fetch(`/v9/projects/${this.projectId}`);
      if (data.error) throw new Error(data.error.message);
      return { connected: true, project: data.name };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }
}
```

#### 3.4 Service Status Component

```tsx
// .lawless/ide/src/components/ServiceStatus/index.tsx
'use client';

import { useEffect, useState } from 'react';

interface ServiceState {
  github: { connected: boolean; details?: string };
  supabase: { connected: boolean; details?: string };
  vercel: { connected: boolean; details?: string };
  devServer: { running: boolean; port?: number };
}

export default function ServiceStatus() {
  const [status, setStatus] = useState<ServiceState>({
    github: { connected: false },
    supabase: { connected: false },
    vercel: { connected: false },
    devServer: { running: false },
  });

  useEffect(() => {
    const checkStatus = async () => {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const StatusDot = ({ connected }: { connected: boolean }) => (
    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
  );

  return (
    <div className="p-3 space-y-2">
      <h3 className="font-semibold text-sm text-gray-600">Services</h3>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot connected={status.github.connected} />
          <span>GitHub</span>
          {status.github.details && (
            <span className="text-gray-400 text-xs">{status.github.details}</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <StatusDot connected={status.supabase.connected} />
          <span>Supabase</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <StatusDot connected={status.vercel.connected} />
          <span>Vercel</span>
          {status.vercel.details && (
            <span className="text-gray-400 text-xs">{status.vercel.details}</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${status.devServer.running ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span>Dev Server</span>
          {status.devServer.running && status.devServer.port && (
            <span className="text-gray-400 text-xs">:{status.devServer.port}</span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="pt-2 border-t mt-3">
        <button
          className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => fetch('/api/deploy', { method: 'POST' })}
        >
          Deploy to Vercel
        </button>
      </div>
    </div>
  );
}
```

### Deliverables
- [ ] GitHub connector (files, branches, PRs)
- [ ] Supabase connector (queries, schema, migrations)
- [ ] Vercel connector (deploy, logs, env vars)
- [ ] Service status API endpoint
- [ ] Service status UI component
- [ ] Quick deploy button
- [ ] Connection testing on startup

---

## Development Experience (Reference - Now in Phase 1 & 2)

> **Note:** Editor/file browser functionality is optional (Phase 1). Click-to-edit is Phase 2. This section is kept as technical reference.

### Technical Implementation Details
- File editor with Monaco (optional, hidden by default)
- File tree browser (optional, hidden by default)
- Live preview integration (Phase 2)
- Interactive component selection (Phase 2)

### Tasks

#### 4.1 Editor Pane

```tsx
// .lawless/ide/src/components/EditorPane/index.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FileTree from './FileTree';
import { useFileStore } from '@/stores/fileStore';

const MonacoEditor = dynamic(() => import('./MonacoEditor'), { ssr: false });

interface EditorPaneProps {
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}

export default function EditorPane({ selectedFile, onFileSelect }: EditorPaneProps) {
  const { files, openFile, saveFile, fileContent, isDirty } = useFileStore();
  const [showTree, setShowTree] = useState(true);

  useEffect(() => {
    if (selectedFile) {
      openFile(selectedFile);
    }
  }, [selectedFile, openFile]);

  const handleSave = async () => {
    if (selectedFile && fileContent) {
      await saveFile(selectedFile, fileContent);
    }
  };

  // Keyboard shortcut for save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFile, fileContent]);

  return (
    <div className="flex h-full">
      {/* File Tree */}
      {showTree && (
        <div className="w-[250px] border-r overflow-auto">
          <FileTree
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
          />
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {/* Tab bar */}
        {selectedFile && (
          <div className="h-10 border-b flex items-center px-3 gap-2">
            <button
              onClick={() => setShowTree(!showTree)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              📁
            </button>
            <span className="text-sm">
              {selectedFile}
              {isDirty && <span className="text-orange-500 ml-1">●</span>}
            </span>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="ml-auto px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}

        {/* Monaco */}
        <div className="flex-1">
          {selectedFile ? (
            <MonacoEditor
              path={selectedFile}
              value={fileContent || ''}
              onChange={(value) => useFileStore.setState({ fileContent: value, isDirty: true })}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 4.2 File Tree Component

```tsx
// .lawless/ide/src/components/EditorPane/FileTree.tsx
'use client';

import { useState, useEffect } from 'react';
import { useFiles } from '@/hooks/useFiles';

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export default function FileTree({ onFileSelect, selectedFile }: FileTreeProps) {
  const { files, isLoading, refresh } = useFiles();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['src']));
  const [search, setSearch] = useState('');

  const toggleExpand = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpanded(next);
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expanded.has(node.path);
    const isSelected = selectedFile === node.path;

    // Filter by search
    if (search && !node.path.toLowerCase().includes(search.toLowerCase())) {
      if (node.type === 'file') return null;
      // For directories, check if any children match
      const hasMatch = node.children?.some(child =>
        child.path.toLowerCase().includes(search.toLowerCase())
      );
      if (!hasMatch) return null;
    }

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 ${
            isSelected ? 'bg-blue-100' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpand(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
        >
          {node.type === 'directory' ? (
            <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
          ) : (
            <span className="w-3" />
          )}
          <span className="text-sm">
            {node.type === 'directory' ? '📁' : '📄'} {node.name}
          </span>
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </div>

      {/* Header */}
      <div className="p-2 border-b flex justify-between items-center">
        <span className="text-xs text-gray-500 uppercase">Files</span>
        <button onClick={refresh} className="text-xs text-blue-600 hover:underline">
          Refresh
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : (
          files.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
}
```

#### 4.3 Monaco Editor Wrapper

```tsx
// .lawless/ide/src/components/EditorPane/MonacoEditor.tsx
'use client';

import { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

// Language detection
function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    sql: 'sql',
    py: 'python',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return langMap[ext || ''] || 'plaintext';
}

export default function MonacoEditor({ path, value, onChange }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create editor
    editorRef.current = monaco.editor.create(containerRef.current, {
      value,
      language: getLanguage(path),
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 2,
      wordWrap: 'on',
    });

    // Listen for changes
    editorRef.current.onDidChangeModelContent(() => {
      const newValue = editorRef.current?.getValue();
      if (newValue !== undefined) {
        onChange(newValue);
      }
    });

    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  // Update content when file changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
      monaco.editor.setModelLanguage(
        editorRef.current.getModel()!,
        getLanguage(path)
      );
    }
  }, [path, value]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

#### 4.4 Preview Pane

```tsx
// .lawless/ide/src/components/PreviewPane/index.tsx
'use client';

import { useState, useEffect } from 'react';

export default function PreviewPane() {
  const [url, setUrl] = useState('http://localhost:3000');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkServer = async () => {
    try {
      const response = await fetch('http://localhost:3000', { mode: 'no-cors' });
      setIsLoading(false);
      setError(null);
    } catch (e) {
      setError('Dev server not running');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    setIsLoading(true);
    const iframe = document.getElementById('preview-frame') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-10 border-b flex items-center px-3 gap-2">
        <span className="text-sm font-medium">Preview</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border rounded"
        />
        <button
          onClick={refresh}
          className="p-1 hover:bg-gray-100 rounded"
        >
          🔄
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-gray-100 rounded"
        >
          ↗
        </a>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-white">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <p className="mb-4">{error}</p>
            <p className="text-sm">Run <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code> to start the dev server</p>
          </div>
        ) : (
          <iframe
            id="preview-frame"
            src={url}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
          />
        )}
      </div>
    </div>
  );
}
```

#### 4.5 Interactive Component Selection (Click-to-Edit)

A powerful inspection layer that lets users click on any component in the browser preview and immediately start editing it with Claude. This creates the ultimate visual development experience.

```
┌─────────────────────────────────────────────────────────────────┐
│ Preview                [🎯 Inspect] [↻]                     [↗] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │    ┌──────────────────────────────────┐                  │    │
│  │    │ ┌────────────────────────────────┼──────────────┐   │    │
│  │    │ │  Hero Section                  │ ← Highlighted│   │    │
│  │    │ │  ═══════════════               │   on hover   │   │    │
│  │    │ │  Welcome to My App             │              │   │    │
│  │    │ │  [Get Started]                 │              │   │    │
│  │    │ └────────────────────────────────┼──────────────┘   │    │
│  │    │                                  │                  │    │
│  │    │  ┌─────────┐ ┌─────────┐         │                  │    │
│  │    │  │ Card 1  │ │ Card 2  │         │                  │    │
│  │    │  └─────────┘ └─────────┘         │                  │    │
│  │    └──────────────────────────────────┘                  │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📍 Selected: <HeroSection>                               │    │
│  │    src/components/HeroSection.tsx:12                     │    │
│  │    [Open in Editor] [✨ Edit with Claude] [View Props]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**How It Works:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLICK-TO-EDIT FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. USER ENABLES INSPECT MODE                                    │
│     └─ Click "🎯 Inspect" button in preview header               │
│                                                                  │
│  2. COMPONENT OVERLAY ACTIVATES                                  │
│     └─ Hover highlights components with blue bounding box        │
│     └─ Shows component name tooltip (e.g., "<HeroSection>")      │
│                                                                  │
│  3. USER CLICKS A COMPONENT                                      │
│     └─ Component selection panel appears below preview           │
│     └─ Source file identified via React fiber + source maps      │
│                                                                  │
│  4. CONTEXT LOADED INTO CHAT                                     │
│     └─ Component code, props, and styles extracted               │
│     └─ Chat pane receives full context                           │
│     └─ User types what they want to change                       │
│                                                                  │
│  5. REAL-TIME UPDATES                                            │
│     └─ Claude edits the component file                           │
│     └─ HMR (Hot Module Replacement) updates preview              │
│     └─ User sees changes instantly - no refresh needed           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Enhanced Preview Pane with Inspect Mode:**

```tsx
// .lawless/ide/src/components/PreviewPane/index.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ComponentSelectionPanel } from './ComponentSelectionPanel';
import { useIDEStore } from '@/stores/ideStore';

interface ComponentInfo {
  displayName: string;
  source: {
    fileName: string;
    lineNumber: number;
    columnNumber: number;
  } | null;
  props: Record<string, any>;
  boundingRect: DOMRect;
}

export default function PreviewPane() {
  const [url, setUrl] = useState('http://localhost:3000');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { openFile, sendChatMessage, setComponentContext } = useIDEStore();

  // Inject inspector script when inspect mode changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'SET_INSPECT_MODE',
      enabled: inspectMode,
    }, '*');
  }, [inspectMode]);

  // Listen for component selection from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'COMPONENT_SELECTED') {
        setSelectedComponent(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle "Edit with Claude" click
  const handleEditWithClaude = async (component: ComponentInfo) => {
    if (!component.source) return;

    // Read the component source file
    const response = await fetch('/api/files/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: component.source.fileName }),
    });
    const { content: sourceCode } = await response.json();

    // Set context for chat
    setComponentContext({
      type: 'component',
      displayName: component.displayName,
      file: component.source.fileName,
      line: component.source.lineNumber,
      sourceCode,
      props: component.props,
    });

    // Focus chat input - user can now describe changes
    document.getElementById('chat-input')?.focus();
  };

  const handleOpenInEditor = (path: string, line: number) => {
    openFile(path, line);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="h-10 border-b flex items-center px-3 gap-2">
        <span className="text-sm font-medium">Preview</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border rounded"
        />

        {/* Inspect Mode Toggle */}
        <button
          onClick={() => {
            setInspectMode(!inspectMode);
            if (inspectMode) setSelectedComponent(null);
          }}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
            inspectMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          🎯 {inspectMode ? 'Inspecting' : 'Inspect'}
        </button>

        <button
          onClick={() => {
            const iframe = iframeRef.current;
            if (iframe) iframe.src = iframe.src;
          }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          ↻
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-gray-100 rounded"
        >
          ↗
        </a>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-white relative">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <p className="mb-4">{error}</p>
            <p className="text-sm">
              Run <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code>
            </p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            id="preview-frame"
            src={url}
            className={`w-full h-full border-0 ${inspectMode ? 'cursor-crosshair' : ''}`}
            onLoad={() => {
              setIsLoading(false);
              // Inject inspector script on load
              if (inspectMode) {
                iframeRef.current?.contentWindow?.postMessage({
                  type: 'SET_INSPECT_MODE',
                  enabled: true,
                }, '*');
              }
            }}
          />
        )}

        {/* Component Selection Panel */}
        {selectedComponent && (
          <ComponentSelectionPanel
            component={selectedComponent}
            onOpenInEditor={handleOpenInEditor}
            onEditWithClaude={handleEditWithClaude}
            onClose={() => setSelectedComponent(null)}
          />
        )}
      </div>

      {/* Inspect Mode Hint */}
      {inspectMode && !selectedComponent && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
          Click on any component to select it
        </div>
      )}
    </div>
  );
}
```

**Component Selection Panel:**

```tsx
// .lawless/ide/src/components/PreviewPane/ComponentSelectionPanel.tsx
interface ComponentSelectionPanelProps {
  component: ComponentInfo;
  onOpenInEditor: (path: string, line: number) => void;
  onEditWithClaude: (component: ComponentInfo) => void;
  onClose: () => void;
}

export function ComponentSelectionPanel({
  component,
  onOpenInEditor,
  onEditWithClaude,
  onClose,
}: ComponentSelectionPanelProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">📍</span>
          <span className="font-mono font-medium">
            &lt;{component.displayName}&gt;
          </span>
          {component.source && (
            <span className="text-gray-500 text-sm">
              {component.source.fileName}:{component.source.lineNumber}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() =>
            component.source &&
            onOpenInEditor(component.source.fileName, component.source.lineNumber)
          }
          disabled={!component.source}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
        >
          Open in Editor
        </button>

        <button
          onClick={() => onEditWithClaude(component)}
          disabled={!component.source}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 flex items-center gap-1"
        >
          ✨ Edit with Claude
        </button>

        <button
          onClick={() => {
            // Show props in modal or panel
            console.log('Props:', component.props);
          }}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          View Props ({Object.keys(component.props).length})
        </button>
      </div>
    </div>
  );
}
```

**Inspector Injection Script:**

```typescript
// .lawless/ide/public/inspector.js
// This script is injected into the user's app via Next.js middleware or manually

(function() {
  const HIGHLIGHT_COLOR = 'rgba(59, 130, 246, 0.3)';
  const BORDER_COLOR = 'rgb(59, 130, 246)';

  let inspectMode = false;
  let highlightOverlay = null;

  // Find React fiber from DOM element
  function findReactFiber(element) {
    const key = Object.keys(element).find(
      k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    return key ? element[key] : null;
  }

  // Extract component info
  function getComponentInfo(element) {
    const fiber = findReactFiber(element);
    if (!fiber) return null;

    let current = fiber;
    while (current) {
      if (current.type && typeof current.type !== 'string') {
        const source = current._debugSource || current.type._source;
        return {
          displayName:
            current.type.displayName || current.type.name || 'Anonymous',
          source: source
            ? {
                fileName: source.fileName,
                lineNumber: source.lineNumber,
                columnNumber: source.columnNumber || 0,
              }
            : null,
          props: current.memoizedProps || {},
          boundingRect: element.getBoundingClientRect(),
        };
      }
      current = current.return;
    }
    return null;
  }

  // Create highlight overlay
  function createHighlight(rect, name) {
    if (!highlightOverlay) {
      highlightOverlay = document.createElement('div');
      highlightOverlay.id = 'lawless-inspector-overlay';
      document.body.appendChild(highlightOverlay);
    }

    highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 999999;
      background: ${HIGHLIGHT_COLOR};
      border: 2px solid ${BORDER_COLOR};
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      transition: all 0.1s ease;
    `;

    highlightOverlay.innerHTML = `
      <div style="
        position: absolute;
        top: -24px;
        left: 0;
        background: ${BORDER_COLOR};
        color: white;
        padding: 2px 8px;
        font-size: 12px;
        font-family: ui-monospace, monospace;
        border-radius: 4px;
        white-space: nowrap;
      ">${name}</div>
    `;
  }

  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!inspectMode) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element.id === 'lawless-inspector-overlay') return;

    const info = getComponentInfo(element);
    if (info) {
      createHighlight(info.boundingRect, `<${info.displayName}>`);
    } else {
      clearHighlight();
    }
  }

  function handleClick(e) {
    if (!inspectMode) return;

    e.preventDefault();
    e.stopPropagation();

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    const info = getComponentInfo(element);
    if (info) {
      window.parent.postMessage(
        { type: 'COMPONENT_SELECTED', payload: info },
        '*'
      );
    }
  }

  // Listen for messages from IDE
  window.addEventListener('message', (e) => {
    if (e.data.type === 'SET_INSPECT_MODE') {
      inspectMode = e.data.enabled;
      document.body.style.cursor = inspectMode ? 'crosshair' : '';
      if (!inspectMode) clearHighlight();
    }
  });

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);

  console.log('[Lawless Inspector] Ready');
})();
```

**Real-Time Update Flow:**

```
User clicks        Claude edits       HMR detects        Preview
component    →     the file      →    file change   →   updates
    │                  │                   │               │
    │                  │                   │               │
    ▼                  ▼                   ▼               ▼
┌────────┐       ┌────────┐         ┌────────┐      ┌────────┐
│ Select │       │ Write  │         │ Next.js│      │ Iframe │
│<Button>│ ────▶ │Button. │ ─────▶  │ HMR    │ ───▶ │reflects│
│        │       │tsx     │         │ Push   │      │change  │
└────────┘       └────────┘         └────────┘      └────────┘
                                                         │
                                                         │
                                              User sees change
                                              instantly! ⚡
```

This creates a truly visual development experience where users can:
1. See their app running live
2. Click any component they want to change
3. Tell Claude what they want (in natural language)
4. Watch the changes appear in real-time

#### 4.6 Local File Operations

```typescript
// .lawless/ide/src/lib/files.ts
import fs from 'fs/promises';
import path from 'path';
import glob from 'fast-glob';

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd().replace('/.lawless/ide', '');

export async function readFile(filePath: string): Promise<string> {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  return fs.readFile(fullPath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  await fs.unlink(fullPath);
}

export async function listFiles(pattern = '**/*'): Promise<string[]> {
  const files = await glob(pattern, {
    cwd: PROJECT_ROOT,
    ignore: [
      'node_modules/**',
      '.next/**',
      '.lawless/ide/**',
      '.git/**',
      '*.lock',
    ],
    dot: false,
  });
  return files;
}

export async function getFileTree(): Promise<TreeNode[]> {
  const files = await listFiles();
  return buildTree(files);
}

function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existing = current.find(n => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
        };
        current.push(existing);
      }

      if (!isFile && existing.children) {
        current = existing.children;
      }
    }
  }

  // Sort: directories first, then files, alphabetically
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => n.children && sortTree(n.children));
  };

  sortTree(root);
  return root;
}
```

### Deliverables
- [ ] Monaco editor integration
- [ ] File tree component with search
- [ ] File read/write via local filesystem
- [ ] Preview pane with iframe
- [ ] Dev server status detection
- [ ] Keyboard shortcuts (Cmd+S to save)
- [ ] Dirty file indicators
- [ ] Language detection for syntax highlighting
- [ ] **Inspect mode toggle in preview header**
- [ ] **Component highlight overlay on hover**
- [ ] **React fiber traversal for component detection**
- [ ] **Source map integration for file location**
- [ ] **Component selection panel with actions**
- [ ] **"Edit with Claude" context loading**
- [ ] **Real-time preview updates via HMR**
- [ ] **Inspector injection script**

---

## Phase 3: Polish & Distribution

### Goals
- Package for distribution (baked into project scaffolds)
- Update mechanism for Local IDE Agent
- User documentation (simple, focused on conversation)
- Error handling and helpful messages

### Design Philosophy Reminders

```
┌─────────────────────────────────────────────────────────────────┐
│                    POLISH CHECKLIST                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Every interaction feels simple and obvious                    │
│  ✓ Errors are friendly and suggest next steps                   │
│  ✓ Default state is minimal (2 panes, no clutter)               │
│  ✓ Power features are available but not prominent               │
│  ✓ Git push = auto deploy (no deploy buttons!)                  │
│  ✓ Status bar tells you everything at a glance                  │
│                                                                  │
│  Target: Someone who's never used a code editor should be       │
│  able to make changes to their app by talking to Claude.        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Deliverables
- [ ] Package distribution script
- [ ] Update check mechanism
- [ ] Simple user onboarding
- [ ] Error messages with recovery suggestions
- [ ] Offline/degraded mode handling
- [ ] Performance optimization

### Tasks

#### 5.1 Package Distribution

```typescript
// scripts/build-local-ide.ts
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const DIST_DIR = 'dist/local-ide';
const TEMPLATE_DIR = 'templates/local-ide';

async function build() {
  console.log('Building Local IDE Agent...');

  // Clean
  await fs.remove(DIST_DIR);
  await fs.ensureDir(DIST_DIR);

  // Build the IDE Next.js app
  execSync('npm run build', {
    cwd: '.lawless/ide',
    stdio: 'inherit'
  });

  // Copy template structure
  await fs.copy(TEMPLATE_DIR, DIST_DIR);

  // Copy built IDE
  await fs.copy('.lawless/ide/.next', path.join(DIST_DIR, '.lawless/ide/.next'));
  await fs.copy('.lawless/ide/package.json', path.join(DIST_DIR, '.lawless/ide/package.json'));
  await fs.copy('.lawless/ide/node_modules', path.join(DIST_DIR, '.lawless/ide/node_modules'));

  // Copy ai-coding-config context
  await fs.copy('~/.ai_coding_config/.claude', path.join(DIST_DIR, '.lawless/context'));

  console.log('Build complete!');
}

build();
```

#### 5.2 lawless.config.js

```javascript
// lawless.config.js (in user's project root)
module.exports = {
  // IDE port (default: 3001)
  idePort: 3001,

  // App dev server port (default: 3000)
  appPort: 3000,

  // Service connections
  services: {
    github: {
      // Configured via .env.local GITHUB_TOKEN
    },
    supabase: {
      // Configured via .env.local SUPABASE_* vars
    },
    vercel: {
      // Configured via .env.local VERCEL_TOKEN
    },
    claude: {
      model: 'claude-sonnet-4-20250514',
      // Configured via .env.local ANTHROPIC_API_KEY
    },
  },

  // Agent behavior
  agent: {
    // Auto-commit after changes (requires explicit save)
    autoCommit: false,

    // Auto-deploy after push to main
    autoDeploy: false,

    // Auto-apply database migrations
    autoMigrate: false,
  },

  // Files to include in AI context
  contextInclude: [
    'src/**/*',
    '*.config.*',
    'package.json',
    'README.md',
  ],

  // Files to exclude from AI context
  contextExclude: [
    'node_modules/**',
    '.next/**',
    '.lawless/ide/**',
  ],
};
```

#### 5.3 Update Mechanism

```typescript
// .lawless/ide/src/lib/updater.ts

const CURRENT_VERSION = require('../../package.json').version;
const UPDATE_CHECK_URL = 'https://api.lawless.ai/ide-agent/version';

export async function checkForUpdates(): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  changelog?: string;
}> {
  try {
    const response = await fetch(UPDATE_CHECK_URL);
    const data = await response.json();

    return {
      hasUpdate: data.version !== CURRENT_VERSION,
      currentVersion: CURRENT_VERSION,
      latestVersion: data.version,
      changelog: data.changelog,
    };
  } catch {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
    };
  }
}

export async function applyUpdate(): Promise<void> {
  // Download and apply update
  const response = await fetch('https://api.lawless.ai/ide-agent/download');
  const data = await response.json();

  // This would typically be handled by a CLI tool:
  // npx @lawless/cli update-ide
  console.log('Update available. Run: npx @lawless/cli update-ide');
}
```

#### 5.4 CLI for Project Creation

```typescript
// packages/cli/src/commands/create.ts
import { Command } from 'commander';
import prompts from 'prompts';
import { scaffoldProject } from '../scaffold';

export const createCommand = new Command('create')
  .description('Create a new Lawless AI project with Local IDE Agent')
  .argument('[name]', 'Project name')
  .action(async (name) => {
    const answers = await prompts([
      {
        type: name ? null : 'text',
        name: 'name',
        message: 'Project name:',
        initial: name,
      },
      {
        type: 'text',
        name: 'githubRepo',
        message: 'GitHub repository (owner/repo):',
      },
      {
        type: 'text',
        name: 'supabaseProject',
        message: 'Supabase project reference:',
      },
      {
        type: 'text',
        name: 'vercelProject',
        message: 'Vercel project ID:',
      },
    ]);

    console.log('\nCreating project...\n');

    await scaffoldProject({
      name: answers.name || name,
      githubRepo: answers.githubRepo,
      supabaseProject: answers.supabaseProject,
      vercelProject: answers.vercelProject,
    });

    console.log(`
✅ Project created successfully!

Next steps:
1. cd ${answers.name || name}
2. Copy .env.example to .env.local and fill in your API keys
3. npm install
4. npm run dev:all

This will start:
- Your app at http://localhost:3000
- The IDE at http://localhost:3001

Happy building!
    `);
  });
```

#### 5.5 Error Handling

```typescript
// .lawless/ide/src/lib/errors.ts

export class ServiceConnectionError extends Error {
  constructor(
    public service: 'github' | 'supabase' | 'vercel' | 'claude',
    message: string,
    public suggestion?: string
  ) {
    super(`${service}: ${message}`);
    this.name = 'ServiceConnectionError';
  }
}

export class MissingConfigError extends Error {
  constructor(
    public key: string,
    public location: '.env.local' | 'lawless.config.js' | 'services.json'
  ) {
    super(`Missing configuration: ${key} in ${location}`);
    this.name = 'MissingConfigError';
  }
}

export function handleError(error: Error): { message: string; action?: string } {
  if (error instanceof ServiceConnectionError) {
    return {
      message: error.message,
      action: error.suggestion || `Check your ${error.service} configuration`,
    };
  }

  if (error instanceof MissingConfigError) {
    return {
      message: error.message,
      action: `Add ${error.key} to ${error.location}`,
    };
  }

  if (error.message.includes('ANTHROPIC_API_KEY')) {
    return {
      message: 'Claude API key not configured',
      action: 'Add ANTHROPIC_API_KEY to .env.local',
    };
  }

  if (error.message.includes('GITHUB_TOKEN')) {
    return {
      message: 'GitHub token not configured',
      action: 'Add GITHUB_TOKEN to .env.local',
    };
  }

  return {
    message: error.message,
  };
}
```

### Deliverables
- [ ] Build script for distribution
- [ ] lawless.config.js schema and defaults
- [ ] Update check mechanism
- [ ] CLI create command
- [ ] Error handling utilities
- [ ] Setup wizard for first run
- [ ] Documentation (README, troubleshooting)

---

## Technical Specifications

### Frontend Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@anthropic-ai/sdk": "^0.x",
    "@supabase/supabase-js": "^2.x",
    "@octokit/rest": "^20.x",
    "zustand": "^4.x",
    "monaco-editor": "^0.x",
    "@monaco-editor/react": "^4.x",
    "fast-glob": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "@types/react": "^18.x"
  }
}
```

### System Requirements

- Node.js 18+
- npm or pnpm
- Git
- 2GB RAM minimum
- Ports 3000 and 3001 available

### Environment Variables

```bash
# .env.local (user's project)

# Claude (required)
ANTHROPIC_API_KEY=sk-ant-...

# GitHub (required for git operations)
GITHUB_TOKEN=ghp_...

# Supabase (required for database features)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel (required for deployments)
VERCEL_TOKEN=...
```

---

## Database Schema

The Local IDE Agent uses **local storage and files** instead of a shared database. Session state is stored in:

```
.lawless/
├── state/
│   ├── chat-history.json      # Conversation history
│   ├── open-files.json        # Currently open files
│   └── preferences.json       # User preferences
└── cache/
    ├── file-tree.json         # Cached file tree
    └── schema.json            # Cached DB schema
```

### State Schema

```typescript
// .lawless/state/chat-history.json
interface ChatHistory {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    toolCalls?: Array<{
      name: string;
      input: any;
      output: any;
    }>;
  }>;
  lastUpdated: string;
}

// .lawless/state/preferences.json
interface Preferences {
  theme: 'light' | 'dark';
  editorFontSize: number;
  autoSave: boolean;
  showHiddenFiles: boolean;
}
```

---

## Deployment & Distribution

### Distribution Methods

1. **Via Lawless Platform** (Primary)
   - User creates project on lawless.ai
   - Downloads scaffolded project with IDE agent included
   - Extracts and runs locally

2. **Via CLI** (Secondary)
   ```bash
   npx @lawless/cli create my-project
   ```

3. **Via Template** (Manual)
   ```bash
   npx create-next-app -e https://github.com/lawless-ai/local-ide-template
   ```

### Update Channels

- **Stable**: Tested releases, default
- **Beta**: Preview features, opt-in
- **Canary**: Latest commits, for testing

```bash
# Check for updates
npx @lawless/cli check-updates

# Apply update
npx @lawless/cli update-ide

# Switch channels
npx @lawless/cli set-channel beta
```

---

## Implementation Order

### Phase 1: Foundation & Agent Core
**Focus: Get the 2-pane agent-first experience working**

- Agent-first 2-pane layout (Chat + Browser)
- Optional 3-pane layout with file editor toggle
- First-run setup wizard for all services
- Claude API integration with full tool suite
- Chat pane with conversation UI
- Browser pane with live preview
- Status bar with service/deploy indicators
- Git push → auto-deploy workflow

### Phase 2: Browser Integration & Click-to-Edit
**Focus: Make visual editing magical**

- Inspect mode for component selection
- Component highlight overlay on hover
- React fiber traversal for component detection
- Source map integration for file location
- Component selection panel
- "Edit with Claude" context loading
- HMR integration for instant updates
- Inspector injection script

### Phase 3: Polish & Distribution
**Focus: Make it feel professional and reliable**

- Package for project scaffolds
- Update mechanism
- User onboarding documentation
- Error handling and recovery
- Performance optimization
- CLI distribution

---

## Success Criteria

### MVP (Phase 1 Complete)
- [ ] 2-pane layout: Chat + Browser (file editor hidden)
- [ ] First-run setup wizard connects all services
- [ ] Can chat with Claude and see responses
- [ ] Claude can read/write files in the project
- [ ] Claude can commit and push to GitHub
- [ ] Git push auto-deploys to Vercel
- [ ] Status bar shows services + deploy state
- [ ] Non-developer can make changes by talking

### Phase 2 Complete
- [ ] Inspect mode highlights components on hover
- [ ] Clicking a component shows selection panel
- [ ] "Edit with Claude" loads component context
- [ ] Changes appear instantly via HMR
- [ ] Can edit any visible component visually

### Full Release (Phase 3 Complete)
- [ ] All tools working (files, git, db, deploy)
- [ ] Optional file editor available when needed
- [ ] Update mechanism working
- [ ] Error messages are friendly and helpful
- [ ] Documentation is simple and clear
- [ ] Someone's mom could use it

---

## Relationship to Hosted IDE

| Feature | Hosted IDE | Local IDE Agent |
|---------|-----------|-----------------|
| **Purpose** | Multi-project workspace management | Single project development |
| **When to use** | Managing multiple repos, teams | Building your app |
| **AI power** | Same Claude, same ai-coding-config | Same Claude, same ai-coding-config |
| **Infrastructure** | We host | User hosts locally |
| **Cost to user** | Subscription | Own API keys |
| **Data location** | Our servers | User's machine |

The Local IDE Agent is the **development environment** users get when they create a project. The Hosted IDE is the **management console** for working across projects.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Lawless AI Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Hosted IDE (/ide)                       │  │
│  │  • Multi-project management                                │  │
│  │  • Session orchestration                                   │  │
│  │  • Team collaboration                                      │  │
│  │  • Activity timeline across projects                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ Creates project                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Local IDE Agent                            │  │
│  │  • Runs on user's machine                                 │  │
│  │  • Single project focus                                   │  │
│  │  • Direct service access                                  │  │
│  │  • Full autonomy                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document Version: 1.4*
*Created: January 2026*
*Last Updated: January 2026*
*Parallel to: IDE_IMPLEMENTATION_PLAN.md v2.3*

---

## Changelog

### v1.4 (Project Onboarding Sequence)
- **Project Plan Interview**: Claude guides users through defining their project before coding
  - Name, vision, target user, pain points
  - Core features for MVP
  - Success metrics and out-of-scope items
  - Generates comprehensive `docs/PROJECT_PLAN.md`
- **Brand Guidelines Interview**: Claude helps define visual identity
  - Mood, personality, and brand attributes
  - Color palette generation with usage rules
  - Typography scale and font recommendations
  - Component styling guidelines
  - Generates `docs/BRAND_GUIDELINES.md` with CSS variables
- **Context-Aware Building**: Onboarding docs automatically loaded into Claude's context
  - Every future interaction references project plan and brand guidelines
  - Consistent design decisions without re-explaining
  - Claude builds features that match the defined vision
- **Skip Option**: Users can skip but Claude gently prompts later
- **Customizable Interview Questions**: Defined question sets that can be adapted

### v1.3 (Agent-First Redesign)
- **2-Pane Default Layout**: Chat + Browser as the primary view
- **Hidden File Editor**: File editor accessible via "Show Files" but hidden by default
- **Simplified Deployment**: Git push = auto-deploy via Vercel GitHub integration (no deploy buttons)
- **User-Friendly Focus**: Designed for adoption, minimal learning curve
- **Consolidated Phases**: Reduced from 5 phases to 3 focused phases
  - Phase 1: Foundation & Agent Core (includes setup wizard, tools, services)
  - Phase 2: Browser Integration & Click-to-Edit (visual editing experience)
  - Phase 3: Polish & Distribution
- **Agent-First Philosophy**: Conversation is the primary interface, not the IDE
- **Updated Success Criteria**: "Someone's mom could use it" as the bar

### v1.2 (Interactive Component Selection)
- **Click-to-Edit Feature**: Click any component in the preview to select it
- **Inspect Mode**: Toggle button to enable component highlighting on hover
- **Component Detection**: React fiber traversal to identify component source files
- **Source Map Integration**: Automatically find the file and line number for any component
- **Component Selection Panel**: Shows component name, file location, and action buttons
- **"Edit with Claude" Flow**: One click loads full component context into chat
- **Real-Time Updates**: HMR ensures changes appear instantly without refresh
- **Inspector Script**: Injection script for component highlighting and selection

### v1.1 (Service Connections & Tooling)
- **First-Run Setup Wizard**: 4-step guided onboarding for connecting all services
- **Claude Connection**: Full Anthropic API integration with model selection (Sonnet/Opus/Haiku)
- **GitHub Connection**: Token-based auth with repository verification
- **Supabase Connection**: Project URL, anon key, and service role key setup
- **Vercel Connection**: Token and project ID configuration
- **Settings Page**: Card-based UI for managing all service connections post-setup
- **Complete Tooling Reference**: Comprehensive documentation of all 33 tools available to Claude
  - 7 File Operations (read, write, delete, move, search, list, info)
  - 9 Git Operations (status, diff, log, commit, push, pull, branch, checkout, PR)
  - 7 Database Operations (query, schema, tables, migrate, seed, backup, RLS)
  - 6 Deployment Operations (deploy, status, logs, rollback, env vars, domains)
  - 4 System Operations (command, tests, lint, build)
- **ai-coding-config Integration**: Full documentation of 24 agents, 18 commands, and 7 skills
- **Secure Token Storage**: All credentials stored locally in .env.local

### v1.0 (Initial Release)
- Basic 3-pane layout (Chat, Editor, Preview)
- Project scaffolding system
- Service connector architecture
- Monaco editor integration
- File tree with search
- Live preview integration
- CLI distribution support
