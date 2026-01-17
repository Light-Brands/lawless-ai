# Lawless AI Chat

A sleek chat interface for conversing with Lawless AI - powered by Claude CLI, using your subscription instead of API credits. Built with **Next.js** for seamless Vercel deployment.

## Overview

This app creates a web-based chat interface that connects to Claude through the CLI rather than the API. This means:
- **No API costs** - Uses your existing Claude subscription
- **Full Claude capabilities** - Access to Claude's complete feature set
- **Local operation** - Runs entirely on your machine

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Claude CLI** installed and authenticated
   - Install: `npm install -g @anthropic-ai/claude-code` (or your preferred method)
   - Authenticate: Run `claude` and follow the prompts

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build and start production server
npm run build
npm start
```

Then open **http://localhost:3000** in your browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Lawless AI Chat UI                       │    │
│  │  - Next.js React frontend                                │    │
│  │  - Markdown rendering                                    │    │
│  │  - Code syntax highlighting                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/SSE
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js API Routes                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - Manages chat sessions                                 │    │
│  │  - Proxies requests to Claude CLI                        │    │
│  │  - Streams responses back via SSE                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ Subprocess
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Claude CLI                                  │
│  - Uses your subscription credentials                            │
│  - Full Claude capabilities                                      │
│  - No API costs                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts       # Chat endpoint with SSE streaming
│   │   ├── health/
│   │   │   └── route.ts       # Health check endpoint
│   │   └── session/
│   │       ├── route.ts       # Session creation
│   │       └── [sessionId]/
│   │           └── route.ts   # Session deletion
│   ├── globals.css            # Design system styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main chat page
├── lib/
│   ├── constants.ts           # System prompt and constants
│   └── conversations.ts       # Conversation management
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json
└── README.md
```

## Lawless AI Persona

The chat interface embodies the **Lawless AI Solution Architect** persona:

- **Purpose**: Bridge technical complexity and human understanding
- **Voice**: Warm, clear, inviting, playful yet precise
- **Approach**: Start with human relevance, layer in complexity as needed
- **Values**: Dignity > Efficiency, Simplicity > Power, Trust > Speed

## Customization

### Styling

The CSS uses design tokens (CSS custom properties) for easy customization in `app/globals.css`:

```css
:root {
  --color-accent-primary: #8B5CF6;    /* Main accent color */
  --color-abyss-base: #0A0A0F;        /* Background color */
  --color-moonlight: #F5F5F7;         /* Text color */
  /* ... more tokens in globals.css */
}
```

### System Prompt

Modify the `LAWLESS_SYSTEM_PROMPT` in `lib/constants.ts` to adjust the AI's personality and behavior.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/session` | POST | Create new chat session |
| `/api/chat` | POST | Send message (SSE response) |
| `/api/session/:id` | DELETE | Clear session history |

## Vercel Deployment

This project is built with Next.js for seamless Vercel deployment:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

**Important Note:** The default implementation uses Claude CLI, which requires a local environment with Claude CLI installed. When deployed to Vercel:

- The **static frontend** will work correctly
- The **API endpoints** that use Claude CLI will **not function** on Vercel's serverless environment

To make the API work on Vercel, you would need to modify `app/api/chat/route.ts` to use the Claude API instead of CLI:
1. Install the Anthropic SDK: `npm install @anthropic-ai/sdk`
2. Replace the CLI spawn logic with API calls
3. Set `ANTHROPIC_API_KEY` in Vercel environment variables

## Troubleshooting

**"Failed to start Claude CLI"**
- Ensure Claude CLI is installed: `which claude`
- Ensure you're authenticated: Run `claude` directly to check

**No response streaming**
- Check server console for errors
- Verify Claude CLI works directly: `claude -p "Hello"`

**Connection refused**
- Make sure the server is running on port 3000
- Check for port conflicts

## License

Part of the Light-Brands ecosystem.

---

Made with love from Claude ❤️
