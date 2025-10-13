# FEAT #433: Add Support for Prompt Endpoints in UI

## Executive Summary
This implementation plan outlines the user journey and technical requirements for integrating prompt management capabilities into the Orchestra UI. The backend already provides comprehensive prompt endpoints with versioning, search, and public sharing capabilities. This plan focuses on creating an intuitive, Apple-like UX for managing prompts that can be referenced and reused across agents.

---

## Current State Analysis

### Backend Infrastructure (Complete)
**File:** `backend/src/services/prompt.py`

The backend provides a robust prompt service with:
- ✅ Versioned prompt storage (revision system)
- ✅ Public/private prompt sharing
- ✅ Search and filtering capabilities
- ✅ User-scoped and public namespaces
- ✅ PostgreSQL store integration

**Available Endpoints:**
- `POST /prompts/search` - Query prompts with filters
- `POST /prompts` - Create new prompt
- `GET /prompts/{prompt_id}` - View public prompt (HTML)
- `PUT /prompts/{prompt_id}/public` - Toggle public visibility
- `POST /prompts/{prompt_id}/v` - Create revision
- `GET /prompts/{prompt_id}/v` - List revisions
- `DELETE /prompts/{prompt_id}/v/{v}` - Delete revision

### Frontend Gap Analysis
**Missing Components:**
- ❌ Prompt service (`frontend/src/lib/services/promptService.ts`)
- ❌ Prompt management pages
- ❌ Prompt context provider
- ❌ Prompt selection UI in agent creation
- ❌ Prompt library browser
- ❌ Prompt editor with versioning

---

## User Journey Map

### 1. Discover Prompts
**Entry Points:**
- Navigation menu: "Prompts" or "Prompt Library"
- Agent creation form: "Browse Prompts" button
- Quick search: Global search includes prompts

**User Flow:**
```
Home → Prompts Library → Browse/Search → Select/Preview → Use or Edit
```

### 2. Browse Prompt Library
**Page:** `/prompts`

**Layout (Similar to Agents Index):**
```
┌─────────────────────────────────────────────────────┐
│ [House] [Color Mode]          [Search] [+ New]      │
│                                                       │
│ Prompts                                              │
│ Discover and reuse system prompts for your agents   │
│                                                       │
│ [Search prompts by name...]                          │
│                                                       │
│ Showing all 24 prompts | [My Prompts] [Public]      │
│                                                       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ Prompt  │ │ Prompt  │ │ Prompt  │ │ Prompt  │   │
│ │ Card    │ │ Card    │ │ Card    │ │ Card    │   │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────┘
```

**Prompt Card Components:**
- Name (bold, 2-line clamp)
- First 100 chars of content (muted, 3-line clamp)
- Public/Private badge
- Version indicator (v3)
- Updated date
- "Used in 5 agents" indicator
- Quick actions: Edit, Copy, Delete

**File References:**
- Pattern similar to: `frontend/src/pages/agents/index.tsx:31-277`
- Card structure: `frontend/src/pages/agents/index.tsx:136-245`

### 3. Create New Prompt
**Page:** `/prompts/create`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [Back]                        [Save] [Save as Copy] │
│                                                       │
│ ┌─ Basic Information ──────────────────────────────┐│
│ │                                                   ││
│ │ Name: [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]  ││
│ │                                                   ││
│ │ Content:                          [Maximize] [URL]││
│ │ ┌───────────────────────────────────────────────┐││
│ │ │                                               │││
│ │ │  Monaco Editor                                │││
│ │ │  (Markdown with syntax highlighting)          │││
│ │ │                                               │││
│ │ └───────────────────────────────────────────────┘││
│ │                                                   ││
│ │ [○ Private] [◉ Public]                           ││
│ │                                                   ││
│ └───────────────────────────────────────────────────┘│
│                                                       │
│ ┌─ Preview ─────────────────────────────────────────┐│
│ │ Rendered prompt content...                        ││
│ └───────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Features:**
- Real-time character count
- Markdown preview toggle
- URL import (like agent form)
- Variable placeholder detection (`{{variable}}`)
- Template suggestions
- Auto-save drafts (local storage)

**File References:**
- Pattern similar to: `frontend/src/components/forms/agents/agent-create-form.tsx:61-605`
- Monaco editor: `frontend/src/components/forms/agents/agent-create-form.tsx:554-565`
- Fullscreen dialog: `frontend/src/components/forms/agents/agent-create-form.tsx:493-589`

### 4. Edit Prompt with Versioning
**Page:** `/prompts/:promptId/edit`

**Enhanced Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [Back]  v5 [v4 v3 v2 v1]     [Update] [New Version] │
│                                                       │
│ ┌─ Current Version (v5) ────────────────────────────┐│
│ │ Name: [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]  ││
│ │ Content: [Monaco Editor...]                       ││
│ │ Updated: 2 hours ago                              ││
│ └───────────────────────────────────────────────────┘│
│                                                       │
│ ┌─ Version History ─────────────────────────────────┐│
│ │ v5  Current    2 hours ago      [View] [Restore]  ││
│ │ v4  Previous   1 day ago        [View] [Restore]  ││
│ │ v3  Beta       3 days ago       [View] [Restore]  ││
│ └───────────────────────────────────────────────────┘│
│                                                       │
│ ┌─ Usage ───────────────────────────────────────────┐│
│ │ Used in 3 agents:                                 ││
│ │ • Customer Support Bot (v5)                       ││
│ │ • Sales Assistant (v4)                            ││
│ │ • FAQ Agent (v5)                                  ││
│ └───────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Versioning UX:**
- "Update" button: Updates current version (same v number)
- "New Version" button: Creates v+1
- Version dropdown: Quick switch between versions
- Diff view: Compare versions side-by-side
- Restore version: Creates new version from old one

### 5. Select Prompt in Agent Form
**Location:** `frontend/src/components/forms/agents/agent-create-form.tsx`

**Current State:**
- System Message: Large textarea (line 307-314)
- Fullscreen editor with URL fetch (line 493-589)

**Enhanced UX:**
```
┌─ Basic Configuration ──────────────────────────────┐
│ Name: [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]  │
│                                                     │
│ System Message:                                     │
│ [📝 Write Custom] [📚 Use Saved Prompt]            │
│                                                     │
│ ┌─ Selected: "Customer Support Expert" (v5) ──────┐│
│ │ You are a helpful customer support expert...    ││
│ │ [Preview] [Edit] [Unlink]                       ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ OR                                                  │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ Custom system message...                      │  │
│ │                                               │  │
│ └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Prompt Selection Modal:**
```
┌─ Select Prompt ─────────────────────────────────────┐
│ [Search prompts...]                    [Close]      │
│                                                       │
│ [My Prompts] [Public] [All]                          │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ◉ Customer Support Expert (v5)                  │ │
│ │   You are a helpful customer support expert...  │ │
│ │   Updated 2 hours ago • Private                 │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ ○ Pirate Assistant (v2)                         │ │
│ │   You are a helpful assistant that speaks...    │ │
│ │   Updated 5 days ago • Public                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ [Cancel]                            [Use Selected]   │
└─────────────────────────────────────────────────────┘
```

**File References:**
- Agent form location: `frontend/src/components/forms/agents/agent-create-form.tsx:289-319`
- Modal pattern: Similar to ToolSelectionModal at line 592-602

### 6. Share Public Prompt
**Feature:** Public prompt viewing (no auth required)

**URL:** `/prompts/{prompt_id}` (renders HTML)

**Page Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [Orchestra Logo]                   [Use This Prompt] │
│                                                       │
│ Customer Support Expert                              │
│ By @username • Updated 2 hours ago                   │
│                                                       │
│ ┌─ Prompt Content ──────────────────────────────────┐│
│ │                                                   ││
│ │ You are a helpful customer support expert who   ││
│ │ specializes in resolving customer issues with   ││
│ │ empathy and efficiency...                        ││
│ │                                                   ││
│ └───────────────────────────────────────────────────┘│
│                                                       │
│ [Copy to Clipboard] [View Raw] [Sign in to Use]     │
└─────────────────────────────────────────────────────┘
```

**Backend Integration:**
- Already implemented: `backend/src/routes/v0/prompt/__init__.py:65-75`
- Returns HTML via `raw_html` formatter

---

## Technical Implementation Plan

### Phase 1: Core Infrastructure
**Priority: Critical**

#### 1.1 Create Prompt Service
**File:** `frontend/src/lib/services/promptService.ts`

```typescript
import apiClient from "@/lib/utils/apiClient";

export type Prompt = {
  id?: string;
  name: string;
  content: string;
  public: boolean;
  v?: number;
  slug?: string;
  updated_at?: string;
};

export type PromptSearch = {
  limit?: number;
  offset?: number;
  sort?: string;
  sort_order?: string;
  filter?: {
    id?: string;
    v?: number;
    public?: boolean;
  };
};

export default class PromptService {
  private static readonly BASE_URL = "/prompts";

  // Search prompts
  static async search(params: PromptSearch = {}) {
    const response = await apiClient.post(`${this.BASE_URL}/search`, {
      limit: params.limit || 500,
      offset: params.offset || 0,
      sort: params.sort || "updated_at",
      sort_order: params.sort_order || "desc",
      filter: params.filter || {},
    });
    return response;
  }

  // Create prompt
  static async create(prompt: Prompt) {
    const response = await apiClient.post(this.BASE_URL, prompt);
    return response;
  }

  // Create revision
  static async createRevision(promptId: string, prompt: Partial<Prompt>) {
    const response = await apiClient.post(
      `${this.BASE_URL}/${promptId}/v`,
      prompt
    );
    return response;
  }

  // List revisions
  static async listRevisions(promptId: string) {
    const response = await apiClient.get(`${this.BASE_URL}/${promptId}/v`);
    return response;
  }

  // Delete revision
  static async deleteRevision(promptId: string, version: number) {
    const response = await apiClient.delete(
      `${this.BASE_URL}/${promptId}/v/${version}`
    );
    return response;
  }

  // Toggle public
  static async togglePublic(promptId: string) {
    const response = await apiClient.put(
      `${this.BASE_URL}/${promptId}/public`
    );
    return response;
  }

  // Get single prompt (convenience method)
  static async get(promptId: string, version?: number) {
    const filter: any = { id: promptId };
    if (version) filter.v = version;
    const response = await this.search({ filter });
    return response.data.prompts[0] || null;
  }
}

export const promptService = new PromptService();
```

**Reference Pattern:** `frontend/src/lib/services/agentService.ts:20-119`

#### 1.2 Create Prompt Context
**File:** `frontend/src/context/PromptContext.tsx`

```typescript
import { createContext, useContext, useState, useEffect } from "react";
import promptService, { Prompt } from "@/lib/services/promptService";

type PromptContextType = {
  prompts: Prompt[];
  selectedPrompt: Prompt | null;
  setSelectedPrompt: (prompt: Prompt | null) => void;
  refreshPrompts: () => Promise<void>;
  isLoading: boolean;
};

const PromptContext = createContext<PromptContextType | undefined>(undefined);

export const PromptProvider = ({ children }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshPrompts = async () => {
    setIsLoading(true);
    try {
      const response = await promptService.search();
      setPrompts(response.data.prompts || []);
    } catch (error) {
      console.error("Failed to fetch prompts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshPrompts();
  }, []);

  return (
    <PromptContext.Provider
      value={{
        prompts,
        selectedPrompt,
        setSelectedPrompt,
        refreshPrompts,
        isLoading,
      }}
    >
      {children}
    </PromptContext.Provider>
  );
};

export const usePromptContext = () => {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("usePromptContext must be used within PromptProvider");
  }
  return context;
};
```

**Reference Pattern:** Similar to `frontend/src/context/AgentContext.tsx`

---

### Phase 2: Prompt Library UI
**Priority: High**

#### 2.1 Prompts Index Page
**File:** `frontend/src/pages/prompts/index.tsx`

**Components Needed:**
- Search bar with filter toggles (My/Public/All)
- Prompt cards grid (responsive)
- Empty state
- Loading skeleton

**Key Features:**
- Search by name and content
- Filter by public/private
- Sort by updated date, name
- Pagination (if > 50 prompts)

**Reference Pattern:** `frontend/src/pages/agents/index.tsx:31-277`

**Differences from Agent Page:**
- No subagent/tool badges
- Show prompt preview (first 100 chars)
- Version indicator badge
- Public/Private toggle button

#### 2.2 Prompt Card Component
**File:** `frontend/src/components/cards/PromptCard.tsx`

```tsx
<Card onClick={() => navigate(`/prompts/${prompt.id}`)}>
  <CardHeader>
    <div className="flex justify-between">
      <FileText className="h-5 w-5" />
      <Badge>v{prompt.v}</Badge>
    </div>
    <CardTitle>{prompt.name}</CardTitle>
    <CardDescription>
      {prompt.content.substring(0, 100)}...
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex justify-between">
      <Badge variant={prompt.public ? "default" : "secondary"}>
        {prompt.public ? "Public" : "Private"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {formatDate(prompt.updated_at)}
      </span>
    </div>
  </CardContent>
</Card>
```

---

### Phase 3: Prompt Creation & Editing
**Priority: High**

#### 3.1 Create Prompt Page
**File:** `frontend/src/pages/prompts/create.tsx`

**Form Schema:**
```typescript
const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  public: z.boolean().default(false),
});
```

**Components:**
- Name input
- Content Monaco editor
- Public/Private toggle
- URL fetch button (reuse from agent form)
- Preview panel (markdown rendering)
- Save button

**Reference Pattern:** `frontend/src/components/forms/agents/agent-create-form.tsx:61-108`

#### 3.2 Edit Prompt Page
**File:** `frontend/src/pages/prompts/[promptId]/edit.tsx`

**Additional Features:**
- Version selector dropdown
- "Update" vs "New Version" buttons
- Version history list
- Diff viewer (optional)
- Usage indicator (which agents use this prompt)

**Reference Pattern:** Similar to create, with versioning logic

#### 3.3 Prompt Form Component
**File:** `frontend/src/components/forms/prompts/prompt-form.tsx`

**Reusable form used by both create and edit pages**

---

### Phase 4: Agent Integration
**Priority: Critical**

#### 4.1 Enhance Agent Form with Prompt Selection
**File:** `frontend/src/components/forms/agents/agent-create-form.tsx`

**Changes Required:**

**Line 68-69:** Add prompt state
```typescript
const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
```

**Line 86-89:** Update prompt handling
```typescript
// If using saved prompt, reference it
prompt: selectedPrompt ? `{{prompt:${selectedPrompt.id}:v${selectedPrompt.v}}}` : values.systemMessage.trim(),
```

**Line 289-319:** Enhance System Message section
```typescript
<FormField
  control={form.control}
  name="systemMessage"
  render={({ field }) => (
    <FormItem>
      <div className="flex items-center justify-between">
        <FormLabel>System Message</FormLabel>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsPromptModalOpen(true)}
          >
            <Library className="h-3 w-3 mr-1" />
            Browse Prompts
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openFullscreen}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Show selected prompt */}
      {selectedPrompt && (
        <div className="p-3 border rounded-md bg-muted/50">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-medium text-sm">{selectedPrompt.name}</p>
              <p className="text-xs text-muted-foreground">v{selectedPrompt.v}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPrompt(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {selectedPrompt.content}
          </p>
        </div>
      )}

      <FormControl>
        <Textarea
          {...field}
          disabled={!!selectedPrompt}
          placeholder={
            selectedPrompt
              ? "Using saved prompt..."
              : "Enter custom system message..."
          }
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### 4.2 Prompt Selection Modal
**File:** `frontend/src/components/modals/PromptSelectionModal.tsx`

```tsx
export function PromptSelectionModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (prompt: Prompt) => void;
}) {
  const { prompts, isLoading } = usePromptContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "public">("all");

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filter === "public" && !p.public) return false;
      if (filter === "mine" && p.public) return false;
      return true;
    });
  }, [prompts, searchQuery, filter]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Prompt</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <Input
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Filter tabs */}
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "mine" ? "default" : "outline"}
            onClick={() => setFilter("mine")}
          >
            My Prompts
          </Button>
          <Button
            variant={filter === "public" ? "default" : "outline"}
            onClick={() => setFilter("public")}
          >
            Public
          </Button>
        </div>

        {/* Prompt list */}
        <ScrollArea className="h-96">
          {filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="p-3 border rounded-md mb-2 cursor-pointer hover:bg-muted"
              onClick={() => {
                onSelect(prompt);
                onClose();
              }}
            >
              <div className="flex justify-between">
                <h4 className="font-medium">{prompt.name}</h4>
                <Badge>v{prompt.v}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {prompt.content}
              </p>
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

**Reference Pattern:** `frontend/src/components/modals/ToolSelectionModal.tsx`

---

### Phase 5: Navigation & Routes
**Priority: Medium**

#### 5.1 Add Route Definitions
**File:** `frontend/src/App.tsx` or router config

```typescript
<Route path="/prompts" element={<PromptsIndexPage />} />
<Route path="/prompts/create" element={<PromptCreatePage />} />
<Route path="/prompts/:promptId/edit" element={<PromptEditPage />} />
<Route path="/prompts/:promptId" element={<PromptViewPage />} />
```

#### 5.2 Add Navigation Menu Item
**File:** Navigation component (wherever agents nav is defined)

```tsx
<NavItem to="/prompts" icon={<FileText />}>
  Prompts
</NavItem>
```

**Reference:** Find where "Assistants" nav is defined

---

### Phase 6: Advanced Features
**Priority: Low (Nice to have)**

#### 6.1 Prompt Templates
**File:** `frontend/src/components/prompts/TemplateGallery.tsx`

Pre-built prompt templates:
- Customer Support
- Sales Assistant
- Technical Writer
- Code Reviewer
- Creative Writer

#### 6.2 Variable Management
Detect and manage variables in prompts:
- `{{variable_name}}` detection
- Variable list UI
- Default values
- Type hints

#### 6.3 Prompt Analytics
- Usage tracking (which agents use this prompt)
- Version popularity
- Performance metrics (if available)

#### 6.4 Collaborative Features
- Comments on prompts
- Fork/Clone functionality
- Rating system
- Community prompts marketplace

---

## Backend Modifications Required

### 1. Add Agent-Prompt Relationship
**File:** `backend/src/services/assistant.py`

**Current:** Agent stores prompt as plain text in `prompt` field

**Enhancement:** Support both inline and referenced prompts

```python
# Pattern: {{prompt:prompt_id:v5}}
def resolve_prompt_reference(prompt_text: str, user_id: str) -> str:
    """
    Resolve prompt references to actual content.
    Pattern: {{prompt:prompt_id:v5}}
    """
    import re
    pattern = r'\{\{prompt:([a-f0-9-]+):v(\d+)\}\}'

    def replace_reference(match):
        prompt_id = match.group(1)
        version = int(match.group(2))
        # Fetch prompt from store
        prompt = await prompt_service.get(prompt_id, version)
        return prompt.content if prompt else match.group(0)

    return re.sub(pattern, replace_reference, prompt_text)
```

**Add to:** Thread/LLM execution flow

### 2. Add Prompt Usage Tracking (Optional)
**File:** `backend/src/services/prompt.py`

```python
async def get_usage(self, prompt_id: str) -> list[dict]:
    """Get list of agents using this prompt"""
    # Query assistants that reference this prompt
    # Return: [{"agent_id": "...", "agent_name": "...", "version": 5}]
```

---

## Database Considerations

**Current Storage:** LangGraph Store (Postgres or In-Memory)

**No schema changes required** - existing infrastructure supports all features.

**Potential Optimization:**
- Add index on `namespace` + `updated_at` for faster sorting
- Consider separate table for prompt-agent relationships (future)

---

## Testing Strategy

### Unit Tests
- Prompt service CRUD operations
- Version management logic
- Public/private filtering
- Search functionality

### Integration Tests
- Prompt creation flow
- Agent form with prompt selection
- Version history navigation
- Public prompt sharing

### E2E Tests (Playwright)
1. Navigate to prompts library
2. Create new prompt
3. Edit and create new version
4. Use prompt in agent creation
5. Toggle prompt public/private
6. Search and filter prompts

**Playwright Test File:** `e2e/prompts.spec.ts`

---

## UI/UX Design Principles

### 1. Consistency with Existing Design
- Match agent card styling
- Use existing color scheme
- Reuse button/input components
- Follow current layout patterns

### 2. Progressive Disclosure
- Simple view by default
- Advanced features in expandable sections
- Minimize cognitive load

### 3. Immediate Feedback
- Real-time search
- Optimistic updates
- Loading states
- Success/error toasts

### 4. Keyboard Shortcuts (Future)
- `Cmd/Ctrl + K`: Quick search
- `Cmd/Ctrl + N`: New prompt
- `Esc`: Close modals

---

## Performance Considerations

### 1. Lazy Loading
- Load prompts on demand
- Virtual scrolling for large lists
- Pagination (50 items per page)

### 2. Caching
- Cache prompt list in context
- LocalStorage for drafts
- Optimistic updates

### 3. Debouncing
- Search input (300ms)
- Auto-save (2s)

---

## Security & Privacy

### 1. Public Prompts
- Warning before making public
- Can't make public if contains sensitive info
- Public URL requires no auth
- Private prompts require auth

### 2. Permissions
- Users can only edit their own prompts
- Public prompts are read-only for others
- Admin role can manage all prompts (future)

---

## Migration Strategy

### Phase 1: Backend Ready ✅
- All endpoints exist
- Service layer complete
- No migration needed

### Phase 2: Frontend Foundation
1. Create prompt service
2. Create context provider
3. Add to App providers

### Phase 3: Basic UI
1. Prompts index page
2. Create/edit pages
3. Navigation links

### Phase 4: Agent Integration
1. Enhance agent form
2. Add prompt selection modal
3. Test end-to-end flow

### Phase 5: Polish & Advanced Features
1. Templates
2. Analytics
3. Collaboration features

---

## Success Metrics

### MVP Success Criteria
- [ ] Users can create prompts
- [ ] Users can browse prompt library
- [ ] Users can use saved prompts in agents
- [ ] Version management works
- [ ] Public sharing works

### Engagement Metrics
- Number of prompts created per user
- Prompt reuse rate
- Public prompt views
- Version creation frequency

### Quality Metrics
- Prompt creation time < 30s
- Search results < 200ms
- Zero data loss in versioning
- 100% feature parity with backend

---

## Risk Assessment

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Version conflicts | High | Optimistic locking, user warnings |
| Large prompt content | Medium | Character limits, pagination |
| Slow search | Medium | Debouncing, indexing, pagination |

### UX Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex versioning UI | High | Progressive disclosure, tooltips |
| Confusion with agent prompts | High | Clear labeling, inline help |
| Prompt selection overwhelming | Medium | Good search, filters, templates |

---

## Open Questions

1. **Prompt Variables:** Should we support variable substitution in prompts?
   - Suggestion: Yes, use `{{variable}}` syntax
   - Requires: Variable management UI, default values

2. **Prompt Composition:** Should users be able to chain/compose prompts?
   - Example: Base prompt + specialization prompt
   - Could wait for v2

3. **Agent Prompt Relationship:** Should agents store prompt reference or content?
   - Suggestion: Store reference, resolve at runtime
   - Benefits: Updates propagate, version tracking

4. **Prompt Locking:** Should we prevent editing prompts used by active agents?
   - Suggestion: No, but warn user and create new version

5. **Public Prompt Moderation:** Do we need approval workflow for public prompts?
   - Suggestion: Not for MVP, add later if needed

---

## File Checklist

### New Files to Create
- [ ] `frontend/src/lib/services/promptService.ts`
- [ ] `frontend/src/context/PromptContext.tsx`
- [ ] `frontend/src/pages/prompts/index.tsx`
- [ ] `frontend/src/pages/prompts/create.tsx`
- [ ] `frontend/src/pages/prompts/[promptId]/edit.tsx`
- [ ] `frontend/src/pages/prompts/[promptId]/view.tsx`
- [ ] `frontend/src/components/forms/prompts/prompt-form.tsx`
- [ ] `frontend/src/components/cards/PromptCard.tsx`
- [ ] `frontend/src/components/modals/PromptSelectionModal.tsx`
- [ ] `frontend/src/lib/entities/prompt.ts` (types)

### Files to Modify
- [ ] `frontend/src/components/forms/agents/agent-create-form.tsx` (lines 68-69, 86-89, 289-319)
- [ ] `frontend/src/App.tsx` (add routes)
- [ ] Navigation component (add prompts link)
- [ ] `backend/src/services/assistant.py` (add prompt reference resolution)

### Files to Review
- [x] `backend/src/services/prompt.py`
- [x] `backend/src/routes/v0/prompt/__init__.py`
- [x] `backend/src/routes/v0/prompt/revision.py`
- [x] `frontend/src/lib/services/agentService.ts` (pattern reference)
- [x] `frontend/src/pages/agents/index.tsx` (pattern reference)
- [x] `frontend/src/components/forms/agents/agent-create-form.tsx`

---

## Timeline Estimate

### Sprint 1 (Week 1)
- Day 1-2: Core infrastructure (service, context)
- Day 3-4: Prompts index page
- Day 5: Prompt create page

### Sprint 2 (Week 2)
- Day 1-2: Prompt edit page with versioning
- Day 3-4: Agent form integration
- Day 5: Testing and bug fixes

### Sprint 3 (Week 3)
- Day 1-2: Polish UI/UX
- Day 3: Public sharing features
- Day 4-5: Documentation and final testing

**Total Estimate:** 3 weeks for MVP

---

## Conclusion

This implementation plan provides a comprehensive roadmap for integrating prompt management into the Orchestra UI. The backend infrastructure is already complete, requiring only frontend development to unlock this powerful feature. By following Apple's design principles of simplicity and progressive disclosure, we'll create an intuitive interface that makes prompt management a delightful experience.

The phased approach ensures we deliver core functionality quickly while leaving room for advanced features. The pattern references to existing code (especially the agent management flow) will accelerate development and maintain consistency.

**Next Steps:**
1. Review and approve this plan
2. Create GitHub issues for each phase
3. Assign developers to Phase 1 tasks
4. Begin implementation with prompt service creation

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Author:** Claude (Elite UX Designer)
**Status:** Ready for Review
