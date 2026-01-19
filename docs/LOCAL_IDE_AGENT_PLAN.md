# Local IDE Agent - Implementation Plan

> A self-contained, vanilla AI-powered development environment deployed into every user project. 1:1 association with a single repo and database, running locally with full autonomy.

## Table of Contents

1. [Vision & Positioning](#vision--positioning)
2. [Architecture Overview](#architecture-overview)
3. [Core Differentiators](#core-differentiators-vs-hosted-ide)
4. [Phase 1: Foundation & Scaffolding](#phase-1-foundation--scaffolding)
5. [Phase 2: AI Chat & Agent Core](#phase-2-ai-chat--agent-core)
6. [Phase 3: Service Integrations](#phase-3-service-integrations)
7. [Phase 4: Development Experience](#phase-4-development-experience)
8. [Phase 5: Polish & Distribution](#phase-5-polish--distribution)
9. [Technical Specifications](#technical-specifications)
10. [Database Schema](#database-schema)
11. [Deployment & Distribution](#deployment--distribution)

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

### Deliverables
- [ ] IDE agent package template
- [ ] Service configuration schema
- [ ] Agent configuration schema
- [ ] Scaffolding script
- [ ] 3-pane layout component
- [ ] Basic routing (single page)
- [ ] Environment variable handling

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

*Document Version: 1.0*
*Created: January 2026*
*Parallel to: IDE_IMPLEMENTATION_PLAN.md v2.2*
