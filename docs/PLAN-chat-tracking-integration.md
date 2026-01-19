# Chat Tracking Integration Plan

## Overview

This plan ensures all conversation types are properly tracked, persisted to Supabase, and restorable per user session.

---

## Current State Analysis

### Three Chat Contexts Identified

| Context | Current Storage | Database Link | Issue |
|---------|----------------|---------------|-------|
| **Root Chat** (`/api/chat`) | Backend SQLite only | None | Data lost on server restart |
| **Workspace Chat** (`/api/workspace/chat`) | Supabase `conversations` table | Links to `workspace_sessions` | Working, but needs verification |
| **Claude Workspace Chat** (sidebar sessions) | Local storage + SQLite | Partial | Shows locally but may not sync to DB |

### Key Problems

1. **Root chat doesn't persist to Supabase** - Simple chat endpoint only saves to backend SQLite, not the database
2. **Session continuity gaps** - Users can't reliably return to previous conversations
3. **Sidebar sessions disconnected** - Local sessions shown in sidebar may not sync to database
4. **No unified conversation model** - Different chat types stored differently

---

## Proposed Architecture

### Unified Conversation Model

All conversations should flow through a single model that:
- Links to authenticated user (`user_id`)
- Optionally links to workspace session (`workspace_session_id`)
- Has a conversation type discriminator
- Persists to Supabase with real-time sync

```
┌─────────────────────────────────────────────────────────────┐
│                     User Session                            │
│                         │                                   │
│    ┌────────────────────┼────────────────────┐              │
│    │                    │                    │              │
│    ▼                    ▼                    ▼              │
│ ┌──────────┐     ┌──────────────┐     ┌──────────────┐     │
│ │Root Chat │     │Workspace Chat│     │Claude Direct │     │
│ │(General) │     │(Repo-bound)  │     │(Sidebar)     │     │
│ └────┬─────┘     └──────┬───────┘     └──────┬───────┘     │
│      │                  │                    │              │
│      └──────────────────┼────────────────────┘              │
│                         │                                   │
│                         ▼                                   │
│            ┌────────────────────────┐                       │
│            │  Unified Conversation  │                       │
│            │     Service Layer      │                       │
│            └───────────┬────────────┘                       │
│                        │                                    │
│                        ▼                                    │
│            ┌────────────────────────┐                       │
│            │   Supabase Database    │                       │
│            │   (conversations)      │                       │
│            └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Schema Enhancement

**Goal:** Extend conversation schema to support all chat types

#### 1.1 Add conversation type column

```sql
-- Add to conversations table
ALTER TABLE conversations ADD COLUMN conversation_type TEXT DEFAULT 'workspace';
-- Types: 'root' | 'workspace' | 'direct'

-- Add index for efficient filtering
CREATE INDEX idx_conversations_type ON conversations(user_id, conversation_type);
```

#### 1.2 Add metadata column for flexibility

```sql
-- Store context-specific data (repo info for workspace, etc.)
ALTER TABLE conversations ADD COLUMN metadata JSONB DEFAULT '{}';
```

#### 1.3 Add session restoration fields

```sql
-- Track last active state for session restoration
ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN is_archived BOOLEAN DEFAULT false;
```

**Files to modify:**
- `/supabase/schema.sql` - Add new columns
- `/types/database.ts` - Update TypeScript types
- Create migration file in `/supabase/migrations/`

---

### Phase 2: Backend Unification

**Goal:** Make all chat endpoints save to Supabase

#### 2.1 Update root chat endpoint (`/api/chat`)

Current flow:
```
User → Backend SQLite → Response (lost on restart)
```

New flow:
```
User → Backend → Supabase conversations → Response (persisted)
```

**Changes needed:**

1. Accept `conversationId` parameter (optional, for continuing conversations)
2. Create conversation record in Supabase if new
3. Append messages to existing conversation if continuing
4. Return `conversationId` in response for frontend tracking

```typescript
// backend/src/server.ts - Updated /api/chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, conversationId, userId } = req.body;

  // Get or create conversation in Supabase
  let conversation;
  if (conversationId) {
    conversation = await supabase
      .from('conversations')
      .select()
      .eq('id', conversationId)
      .single();
  } else {
    conversation = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        conversation_type: 'root',
        messages: [],
        title: extractTitle(message)
      })
      .select()
      .single();
  }

  // Process chat and stream response
  // On completion, append messages to conversation
});
```

#### 2.2 Create shared conversation service

**New file:** `/backend/src/services/conversationService.ts`

```typescript
export class ConversationService {
  // Create new conversation
  async create(userId: string, type: ConversationType, metadata?: object): Promise<Conversation>

  // Get conversation by ID
  async get(conversationId: string): Promise<Conversation | null>

  // Get or create for workspace session
  async getOrCreateForWorkspace(userId: string, workspaceSessionId: string): Promise<Conversation>

  // Append messages
  async appendMessages(conversationId: string, messages: Message[]): Promise<void>

  // List user conversations
  async list(userId: string, options?: ListOptions): Promise<Conversation[]>

  // Archive conversation
  async archive(conversationId: string): Promise<void>
}
```

#### 2.3 Supabase client for backend

**New file:** `/backend/src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Files to modify/create:**
- `/backend/src/server.ts` - Update chat endpoints
- `/backend/src/services/conversationService.ts` - New shared service
- `/backend/src/lib/supabase.ts` - Backend Supabase client
- `/backend/.env.example` - Add Supabase env vars

---

### Phase 3: Frontend Integration

**Goal:** Ensure frontend properly tracks and restores conversations

#### 3.1 Update useConversations hook

Extend to handle all conversation types:

```typescript
// hooks/useConversations.ts
export function useConversations({
  userId,
  type, // 'root' | 'workspace' | 'direct' | 'all'
  workspaceSessionId,
  enabled = true,
}: UseConversationsOptions) {
  // Fetch conversations by type
  // Support filtering and pagination
}
```

#### 3.2 Create conversation context provider

**New file:** `/app/contexts/ConversationContext.tsx`

```typescript
export const ConversationContext = createContext<ConversationContextType | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Methods
  const startNewConversation = async (type: ConversationType) => { ... };
  const continueConversation = async (conversationId: string) => { ... };
  const archiveConversation = async (conversationId: string) => { ... };

  return (
    <ConversationContext.Provider value={{ ... }}>
      {children}
    </ConversationContext.Provider>
  );
}
```

#### 3.3 Update sidebar to show all conversations

The sidebar should:
- Show recent conversations grouped by type
- Allow quick switching between conversations
- Support search/filter
- Show conversation previews

#### 3.4 Session restoration on page load

```typescript
// In workspace page or root layout
useEffect(() => {
  // Check for last active conversation
  const lastConversationId = localStorage.getItem('lastConversationId');

  if (lastConversationId) {
    // Verify it exists in DB and belongs to user
    const conversation = await getConversation(lastConversationId);
    if (conversation) {
      setActiveConversation(conversation);
    }
  }
}, []);
```

**Files to modify/create:**
- `/hooks/useConversations.ts` - Extend for all types
- `/app/contexts/ConversationContext.tsx` - New context
- `/app/components/Sidebar.tsx` - Update to show all conversations
- `/app/workspace/[...repo]/page.tsx` - Add restoration logic

---

### Phase 4: Sync & Real-time

**Goal:** Ensure conversations sync across devices/tabs

#### 4.1 Real-time subscriptions

Already have real-time enabled on conversations table. Ensure:

```typescript
// Subscribe to conversation changes
const subscription = supabase
  .channel('conversations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'conversations',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Update local state
  })
  .subscribe();
```

#### 4.2 Optimistic updates with rollback

```typescript
// When sending a message
const sendMessage = async (message: string) => {
  // Optimistically add to UI
  addMessageToUI({ role: 'user', content: message });

  try {
    const response = await fetch('/api/chat', { ... });
    // Stream response and update UI
  } catch (error) {
    // Rollback optimistic update
    removeLastMessage();
    showError('Failed to send message');
  }
};
```

#### 4.3 Offline support (optional enhancement)

```typescript
// Queue messages when offline
if (!navigator.onLine) {
  queueMessage(message);
  showOfflineIndicator();
}

// Process queue when back online
window.addEventListener('online', processPendingMessages);
```

---

### Phase 5: Testing & Verification

#### 5.1 Test scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| New root chat | Creates conversation in DB with type='root' |
| Continue root chat | Loads existing conversation, appends messages |
| New workspace chat | Creates conversation linked to workspace_session |
| Switch workspaces | Loads correct conversation for each workspace |
| Page refresh | Restores last active conversation |
| Multiple tabs | Changes sync across tabs via real-time |
| User logout/login | All conversations persist and restore |
| Server restart | All conversations still accessible |

#### 5.2 Database verification queries

```sql
-- Check conversations are being created
SELECT conversation_type, COUNT(*)
FROM conversations
GROUP BY conversation_type;

-- Check user's conversations
SELECT id, title, conversation_type, created_at, last_message_at
FROM conversations
WHERE user_id = 'USER_ID'
ORDER BY last_message_at DESC;

-- Check messages are being stored
SELECT id, title, jsonb_array_length(messages) as message_count
FROM conversations
WHERE user_id = 'USER_ID';
```

---

## File Changes Summary

### New Files
- `/supabase/migrations/XXXX_conversation_tracking.sql`
- `/backend/src/services/conversationService.ts`
- `/backend/src/lib/supabase.ts`
- `/app/contexts/ConversationContext.tsx`

### Modified Files
- `/supabase/schema.sql` - Add columns
- `/types/database.ts` - Update types
- `/backend/src/server.ts` - Update chat endpoints
- `/hooks/useConversations.ts` - Extend functionality
- `/app/workspace/[...repo]/page.tsx` - Add restoration
- `/app/components/Sidebar.tsx` - Show all conversations
- `/app/layout.tsx` - Add ConversationProvider

### Environment Variables Needed
```
# Backend
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Implementation Order

1. **Schema first** - Add columns and create migration
2. **Backend service** - Create conversation service with Supabase
3. **Update endpoints** - Modify /api/chat to use new service
4. **Frontend context** - Create ConversationProvider
5. **Update hooks** - Extend useConversations
6. **UI updates** - Sidebar and restoration
7. **Testing** - Verify all scenarios
8. **Real-time polish** - Ensure sync works

---

## Success Criteria

- [ ] All chat types persist to Supabase `conversations` table
- [ ] Users can close browser and return to see all past conversations
- [ ] Sidebar shows unified list of all conversation types
- [ ] Clicking a past conversation loads full message history
- [ ] Changes sync across multiple browser tabs
- [ ] No data loss on server restart
- [ ] Proper user isolation (RLS working)
