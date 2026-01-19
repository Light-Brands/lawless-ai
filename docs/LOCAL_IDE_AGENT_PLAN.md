# Local IDE Agent - Implementation Plan

> A self-contained, vanilla AI-powered development environment deployed into every user project. 1:1 association with a single repo and database, running locally with full autonomy.

## Table of Contents

1. [Vision & Positioning](#vision--positioning)
2. [Architecture Overview](#architecture-overview)
3. [First-Run Setup & Service Connections](#first-run-setup--service-connections)
4. [Complete Tooling Reference](#complete-tooling-reference)
5. [Core Differentiators](#core-differentiators-vs-hosted-ide)
6. [Phase 1: Foundation & Scaffolding](#phase-1-foundation--scaffolding)
7. [Phase 2: AI Chat & Agent Core](#phase-2-ai-chat--agent-core)
8. [Phase 3: Service Integrations](#phase-3-service-integrations)
9. [Phase 4: Development Experience](#phase-4-development-experience)
10. [Phase 5: Polish & Distribution](#phase-5-polish--distribution)
11. [Technical Specifications](#technical-specifications)
12. [Database Schema](#database-schema)
13. [Deployment & Distribution](#deployment--distribution)

---

## Vision & Positioning

### What Is the Local IDE Agent?

A **self-contained web-based IDE** that gets deployed into every user's project when they create one through Lawless AI. Unlike the hosted IDE which runs on our infrastructure, this runs **locally on the user's machine** and has direct, dedicated access to:

- **One GitHub repo** - The project being developed
- **One Supabase database** - The project's database
- **One Vercel project** - The project's deployments

```
┌─────────────────────────────────────────────────────────────────┐
│                    User's Local Machine                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────────────────────────────────────────────┐     │
│   │              Local IDE Agent                           │     │
│   │                                                        │     │
│   │   ┌──────────┐  ┌──────────┐  ┌──────────┐            │     │
│   │   │ AI Chat  │  │  Editor  │  │ Preview  │            │     │
│   │   │  Pane    │  │   Pane   │  │  Pane    │            │     │
│   │   └────┬─────┘  └────┬─────┘  └────┬─────┘            │     │
│   │        │             │             │                   │     │
│   │   ┌────┴─────────────┴─────────────┴────┐             │     │
│   │   │         Service Connectors           │             │     │
│   │   └────┬─────────────┬─────────────┬────┘             │     │
│   └────────┼─────────────┼─────────────┼────────────────────┘     │
│            │             │             │                          │
│            ▼             ▼             ▼                          │
│       ┌────────┐   ┌──────────┐   ┌────────┐                     │
│       │ GitHub │   │ Supabase │   │ Vercel │                     │
│       │  Repo  │   │    DB    │   │Project │                     │
│       └────────┘   └──────────┘   └────────┘                     │
│                                                                  │
│   Project Root: ~/projects/my-app/                               │
│   IDE URL: http://localhost:3001                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Local?

| Aspect | Hosted IDE | Local IDE Agent |
|--------|-----------|-----------------|
| **Deployment** | Runs on Oracle Cloud | Runs on user's machine |
| **Scope** | Multi-tenant, multi-repo | Single project, single database |
| **Ownership** | We manage infrastructure | User owns everything |
| **Scaling** | Our problem | User's machine capacity |
| **Data** | Passes through our servers | Stays local (API keys too) |
| **Offline** | Requires internet | Works partially offline |
| **Cost** | We pay for compute | User uses own resources |

### User Journey

```
1. User creates project on Lawless AI platform
   └── Selects "Download Project" or "Clone Locally"

2. Project scaffolded with Local IDE Agent baked in
   └── .lawless/ directory contains the IDE agent

3. User runs: npm install && npm run dev
   └── App starts on :3000, IDE starts on :3001

4. User opens http://localhost:3001
   └── Full IDE experience with AI, editor, preview

5. User builds their entire app within this environment
   └── Claude assists, code changes, deploys to Vercel
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

### Simplicity by Constraint

| Feature | Hosted IDE | Local IDE Agent |
|---------|-----------|-----------------|
| Panes | 6 collapsible panes | 3 essential panes |
| Multi-repo | Yes | No (1 repo only) |
| Multi-session | Yes | No (1 session = 1 project) |
| Port management | 100 concurrent sessions | 1 port for app, 1 for IDE |
| Worktrees | Dynamic worktree creation | Direct on main or branches |
| Session expiry | 7-day auto-cleanup | Never (user controls) |

### What We Remove

These features from the hosted IDE are unnecessary for local:

- **Session management** - One project = one session
- **Port assignment system** - Fixed ports (3000 for app, 3001 for IDE)
- **Worktree orchestration** - Work directly on branches
- **Multi-tenant isolation** - User owns everything
- **Deployment pane** - Simplified to status indicator + "Deploy" button
- **Activity timeline** - Git history serves this purpose
- **Automation config** - Simpler on/off toggles

### What We Keep (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│  Local IDE Agent - 3-Pane Layout                                 │
├─────────┬───────────────────────────────────────┬───────────────┤
│         │                                       │               │
│  Pane 1 │              Pane 2                   │    Pane 3     │
│   AI    │           File Editor                 │   Preview     │
│  Chat   │                                       │   + Status    │
│         │                                       │               │
│         │  ┌─────────────────────────────────┐  │  ┌─────────┐  │
│ ┌─────┐ │  │                                 │  │  │         │  │
│ │Chat │ │  │         Code Editor             │  │  │  Live   │  │
│ │     │ │  │         (Monaco/CM6)            │  │  │ Preview │  │
│ │     │ │  │                                 │  │  │         │  │
│ │     │ │  │                                 │  │  │         │  │
│ │     │ │  └─────────────────────────────────┘  │  └─────────┘  │
│ └─────┘ │                                       │               │
│         │  ┌──────────────────┐                 │  ┌─────────┐  │
│ ┌─────┐ │  │    File Tree     │                 │  │ Services│  │
│ │Tools│ │  │                  │                 │  │ Status  │  │
│ └─────┘ │  └──────────────────┘                 │  │ ●●●●    │  │
│         │                                       │  └─────────┘  │
└─────────┴───────────────────────────────────────┴───────────────┘
```

---

## Phase 1: Foundation & Scaffolding

### Goals
- Create the base Local IDE Agent package
- Project scaffolding system
- Service configuration layer
- **First-run setup wizard with service connections**
- Basic 3-pane layout

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

#### 1.5 Basic Layout Component

```tsx
// .lawless/ide/src/app/page.tsx
'use client';

import { useState } from 'react';
import ChatPane from '@/components/ChatPane';
import EditorPane from '@/components/EditorPane';
import PreviewPane from '@/components/PreviewPane';
import ServiceStatus from '@/components/ServiceStatus';

export default function LocalIDE() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="h-screen flex">
      {/* Pane 1: AI Chat */}
      <div className="w-[350px] border-r flex flex-col">
        <ChatPane />
      </div>

      {/* Pane 2: File Editor */}
      <div className="flex-1 flex flex-col">
        <EditorPane
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
        />
      </div>

      {/* Pane 3: Preview + Status */}
      <div className="w-[400px] border-l flex flex-col">
        <div className="flex-1">
          <PreviewPane />
        </div>
        <div className="h-[150px] border-t">
          <ServiceStatus />
        </div>
      </div>
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
- [ ] Service configuration schema
- [ ] Agent configuration schema
- [ ] Scaffolding script
- [ ] 3-pane layout component
- [ ] Basic routing (single page)
- [ ] Environment variable handling
- [ ] **First-run setup wizard with 4-step flow**
- [ ] **Claude connection setup with model selection**
- [ ] **GitHub connection setup with token verification**
- [ ] **Supabase connection setup with project linking**
- [ ] **Vercel connection setup with project verification**
- [ ] **Settings page for managing connections**
- [ ] **API endpoints for each service connection**
- [ ] **Secure token storage in .env.local**

---

## Phase 2: AI Chat & Agent Core

### Goals
- Claude integration with tool calling
- Full tool suite (files, git, db, deploy)
- Context management from project files
- ai-coding-config agent system

### Tasks

#### 2.1 Claude Integration

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

## Phase 3: Service Integrations

### Goals
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

## Phase 4: Development Experience

### Goals
- File editor with Monaco
- File tree browser
- Live preview integration
- Local file system operations

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

#### 4.5 Local File Operations

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

---

## Phase 5: Polish & Distribution

### Goals
- Package for distribution
- Update mechanism
- Documentation
- Error handling and edge cases

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

### Sprint 1: Foundation (1.5 weeks)
- IDE package structure
- Service configuration schema
- Basic 3-pane layout
- Scaffolding script
- Environment variable handling

### Sprint 2: AI Core (2 weeks)
- Claude API integration
- Tool definitions (all tools)
- Tool execution handlers
- Context loading
- Chat pane UI

### Sprint 3: Service Connectors (1.5 weeks)
- GitHub connector
- Supabase connector
- Vercel connector
- Service status component

### Sprint 4: Development Experience (1.5 weeks)
- Monaco editor integration
- File tree component
- Local file operations
- Preview pane
- Keyboard shortcuts

### Sprint 5: Distribution & Polish (1 week)
- Build and packaging
- CLI create command
- Update mechanism
- Documentation
- Error handling

---

## Success Criteria

### MVP
- [ ] Can scaffold new project with Local IDE Agent
- [ ] IDE opens at localhost:3001
- [ ] Can chat with Claude
- [ ] Claude can read/write files
- [ ] Claude can commit and push
- [ ] Can see live preview of app
- [ ] Service status shows connection state

### Full Release
- [ ] All tools working (files, git, db, deploy)
- [ ] Monaco editor with syntax highlighting
- [ ] File tree with search
- [ ] Seamless GitHub integration
- [ ] Supabase queries and migrations
- [ ] Vercel deployments
- [ ] Update mechanism
- [ ] Documentation complete
- [ ] CLI distribution working

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

*Document Version: 1.1*
*Created: January 2026*
*Last Updated: January 2026*
*Parallel to: IDE_IMPLEMENTATION_PLAN.md v2.2*

---

## Changelog

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
