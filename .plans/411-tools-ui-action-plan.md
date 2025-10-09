# Tool Selection Modal - Implementation Action Plan

**Branch**: `feat/411-tools-api`
**Worktree**: `~/enso-labs/deployments/orchestra/.worktrees/feat-411-tools-api`
**Design Reference**: ChatGPT Connectors interface

---

## Phase 1: Core Modal & Platform Tools (MVP)

### Goal
Build functional tool selection modal with platform tools display and selection.

### Tasks

#### 1.1 Component Architecture Setup
**Location**: `frontend/src/components/modals/ToolSelectionModal/`

**Files to Create**:
```
ToolSelectionModal/
├── index.tsx                    # Main modal wrapper
├── Sidebar.tsx                  # Left navigation panel
├── ToolCard.tsx                 # Individual tool card
├── ToolGrid.tsx                 # Grid container for cards
├── PlatformToolsPanel.tsx       # Platform tools view
├── EmptyState.tsx               # No results/empty states
└── types.ts                     # TypeScript interfaces
```

**Actions**:
- [ ] Create directory structure
- [ ] Set up TypeScript types for Tool, ToolCategory, SelectionState
- [ ] Create barrel export in index.tsx

**Types to Define**:
```typescript
interface Tool {
  name: string;
  description: string;
  icon?: string;
  tags: string[];
  metadata?: Record<string, any>;
  category: 'platform' | 'mcp' | 'a2a' | 'arcade';
}

interface ToolSelectionState {
  selectedTools: Set<string>;
  activeCategory: ToolCategory;
  searchQuery: string;
  filterTags: string[];
}

type ToolCategory = 'platform' | 'mcp' | 'a2a' | 'arcade';
```

---

#### 1.2 Build ToolCard Component
**File**: `frontend/src/components/modals/ToolSelectionModal/ToolCard.tsx`

**Requirements**:
- 280px width × 220px height
- 48px centered icon
- Tool name (16px, semibold, centered)
- Description (13px, muted, 2-line clamp, centered)
- Tags (small pills below description)
- Selection checkmark badge (top-right, conditional render)
- Hover states with border color change
- Click to toggle selection

**Props**:
```typescript
interface ToolCardProps {
  tool: Tool;
  isSelected: boolean;
  onToggle: (toolName: string) => void;
}
```

**Implementation Notes**:
- Use shadcn `Card` component as base
- Use Lucide icons or fallback to generic Wrench icon
- Apply Tailwind classes for hover/selected states
- Use `line-clamp-2` for description truncation

**Actions**:
- [ ] Create component skeleton
- [ ] Implement icon rendering logic
- [ ] Add selection state styling
- [ ] Add hover animations (150ms transition)
- [ ] Test click interaction
- [ ] Add aria labels for accessibility

---

#### 1.3 Build ToolGrid Component
**File**: `frontend/src/components/modals/ToolSelectionModal/ToolGrid.tsx`

**Requirements**:
- 3-column grid layout
- 24px gap between cards
- 48px padding
- Responsive: 2 columns on tablet, 1 column on mobile
- Scroll container for overflow

**Props**:
```typescript
interface ToolGridProps {
  tools: Tool[];
  selectedTools: Set<string>;
  onToggleSelection: (toolName: string) => void;
}
```

**Grid CSS**:
```css
grid-template-columns: repeat(3, 1fr);
gap: 24px;
padding: 48px;

@media (max-width: 1024px) {
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 640px) {
  grid-template-columns: 1fr;
}
```

**Actions**:
- [ ] Create grid container with ScrollArea
- [ ] Map tools to ToolCard components
- [ ] Implement responsive breakpoints
- [ ] Add empty state handling
- [ ] Test with varying numbers of tools

---

#### 1.4 Build Sidebar Component
**File**: `frontend/src/components/modals/ToolSelectionModal/Sidebar.tsx`

**Requirements**:
- 240px fixed width
- Vertical list of categories
- Active state highlighting
- Click to switch categories

**Categories**:
```typescript
const categories = [
  { id: 'platform', label: 'Platform', icon: Wrench },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'a2a', label: 'A2A Agents', icon: Users },
  { id: 'arcade', label: 'Arcade', icon: Gamepad2 },
];
```

**Props**:
```typescript
interface SidebarProps {
  activeCategory: ToolCategory;
  onCategoryChange: (category: ToolCategory) => void;
}
```

**Visual Style**:
- Default: `bg-transparent`, `text-muted-foreground`
- Active: `bg-muted`, `text-foreground`, `border-l-2 border-primary`
- Hover: `bg-muted/50`

**Actions**:
- [ ] Create category button list
- [ ] Implement active state styling
- [ ] Add click handlers
- [ ] Add keyboard navigation (arrow keys)
- [ ] Test category switching

---

#### 1.5 Build PlatformToolsPanel Component
**File**: `frontend/src/components/modals/ToolSelectionModal/PlatformToolsPanel.tsx`

**Requirements**:
- Search bar (sticky at top)
- Filter by tags (multi-select)
- Display ToolGrid with filtered tools
- Handle empty/no results states

**Props**:
```typescript
interface PlatformToolsPanelProps {
  tools: Tool[];
  selectedTools: Set<string>;
  onToggleSelection: (toolName: string) => void;
}
```

**State**:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [selectedTags, setSelectedTags] = useState<string[]>([]);
```

**Filtering Logic**:
```typescript
const filteredTools = tools.filter(tool => {
  const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       tool.description.toLowerCase().includes(searchQuery.toLowerCase());
  const matchesTags = selectedTags.length === 0 ||
                     selectedTags.some(tag => tool.tags.includes(tag));
  return matchesSearch && matchesTags;
});
```

**Actions**:
- [ ] Create search input component
- [ ] Implement search filtering (debounced 300ms)
- [ ] Add tag filter UI (optional for MVP)
- [ ] Connect to ToolGrid
- [ ] Add empty state component
- [ ] Test filtering logic

---

#### 1.6 Build Main Modal Component
**File**: `frontend/src/components/modals/ToolSelectionModal/index.tsx`

**Requirements**:
- Dialog wrapper (shadcn Dialog)
- Header with title + close button
- Sidebar + content layout
- Modal dimensions: 95vw × 90vh (max 1400px × 900px)

**Props**:
```typescript
interface ToolSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedTools: string[];
  onApply: (selectedTools: string[]) => void;
}
```

**Layout Structure**:
```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-[1400px] w-[95vw] h-[90vh] max-h-[900px]">
    <DialogHeader>
      <DialogTitle>Tools & Integrations</DialogTitle>
      <p className="text-muted-foreground">
        Connect tools to extend your agent's capabilities
      </p>
    </DialogHeader>

    <div className="flex h-full">
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <div className="flex-1">
        {activeCategory === 'platform' && (
          <PlatformToolsPanel
            tools={platformTools}
            selectedTools={selectedTools}
            onToggleSelection={handleToggle}
          />
        )}
        {/* Other category panels */}
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**Actions**:
- [ ] Create Dialog wrapper
- [ ] Implement header with title/subtitle
- [ ] Build sidebar + content flex layout
- [ ] Add category routing logic
- [ ] Implement close/cancel handlers
- [ ] Add keyboard shortcuts (Esc to close)

---

#### 1.7 Create useToolSelection Hook
**File**: `frontend/src/components/modals/ToolSelectionModal/hooks/useToolSelection.ts`

**Purpose**: Centralize selection state management

**Hook Interface**:
```typescript
function useToolSelection(initialTools: string[]) {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(initialTools)
  );

  const toggleTool = (toolName: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedTools(new Set());

  const selectMultiple = (tools: string[]) => {
    setSelectedTools(new Set([...selectedTools, ...tools]));
  };

  return {
    selectedTools,
    toggleTool,
    clearSelection,
    selectMultiple,
    selectedCount: selectedTools.size,
  };
}
```

**Actions**:
- [ ] Create hook file
- [ ] Implement selection state logic
- [ ] Add toggle/clear/select methods
- [ ] Add derived state (count, isSelected checker)
- [ ] Test with mock data

---

#### 1.8 API Integration
**File**: `frontend/src/lib/services/toolService.ts`

**Create Tool Service**:
```typescript
export interface ToolDetail {
  name: string;
  description: string;
  args: Record<string, any>;
  tags: string[];
  metadata: Record<string, any>;
}

export default class ToolService {
  private static readonly BASE_URL = '/tools';

  static async listTools(): Promise<{ tools: ToolDetail[] }> {
    try {
      const response = await apiClient.get(this.BASE_URL);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      throw error;
    }
  }
}

export const toolService = new ToolService();
```

**Actions**:
- [ ] Create toolService.ts file
- [ ] Implement listTools method
- [ ] Add error handling
- [ ] Test API endpoint connection
- [ ] Add loading/error states to modal

---

#### 1.9 Integrate Modal into Agent Form
**File**: `frontend/src/components/forms/agents/agent-create-form.tsx`

**Changes**:
1. **Remove** accordion Tools section (lines 353-432)
2. **Add** modal trigger button
3. **Add** modal state management
4. **Connect** to agent context

**Code Changes**:
```tsx
// Add state
const [isToolModalOpen, setIsToolModalOpen] = useState(false);

// Replace accordion section with:
<div className="border border-border rounded-lg p-6">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <Wrench className="h-5 w-5 text-foreground" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tools</h2>
        <p className="text-sm text-muted-foreground">
          Configure tool integrations and settings
        </p>
      </div>
    </div>
    <Button
      type="button"
      variant="outline"
      onClick={() => setIsToolModalOpen(true)}
    >
      <Wrench className="h-4 w-4 mr-2" />
      Manage Tools ({agent.tools?.length || 0})
    </Button>
  </div>

  {/* Show selected tools preview */}
  {agent.tools && agent.tools.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {agent.tools.map(tool => (
        <span key={tool} className="px-2 py-1 bg-primary/10 rounded text-sm">
          {tool}
        </span>
      ))}
    </div>
  )}
</div>

{/* Add modal */}
<ToolSelectionModal
  isOpen={isToolModalOpen}
  onClose={() => setIsToolModalOpen(false)}
  initialSelectedTools={agent.tools || []}
  onApply={(selectedTools) => {
    setAgent({ ...agent, tools: selectedTools });
    setIsToolModalOpen(false);
  }}
/>
```

**Actions**:
- [ ] Add modal import
- [ ] Add modal state
- [ ] Replace accordion section
- [ ] Add tool preview badges
- [ ] Connect onApply to agent state
- [ ] Test integration with agent form

---

#### 1.10 Testing & Polish
**Actions**:
- [ ] Test modal open/close
- [ ] Test tool selection/deselection
- [ ] Test search functionality
- [ ] Test responsive layout (desktop, tablet, mobile)
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Verify API integration
- [ ] Add loading skeletons
- [ ] Add error boundary
- [ ] Performance check (large tool lists)

---

## Phase 2: MCP Integration

### Goal
Add MCP server configuration and tool selection.

### Tasks

#### 2.1 Create McpServerPanel Component
**File**: `frontend/src/components/modals/ToolSelectionModal/McpServerPanel.tsx`

**Requirements**:
- List configured MCP servers
- Add new server form
- Template dropdown (GitHub, Postgres, Custom)
- Test connection button
- Fetch and display server tools after config
- Select/deselect server tools

**Actions**:
- [ ] Create server list component
- [ ] Build add server form
- [ ] Implement template dropdown
- [ ] Add connection testing
- [ ] Integrate POST /tools/mcp/info API
- [ ] Display server tools in grid
- [ ] Handle server removal

---

#### 2.2 Create useMcpTools Hook
**File**: `frontend/src/components/modals/ToolSelectionModal/hooks/useMcpTools.ts`

**Purpose**: Manage MCP server state and tool fetching

**Actions**:
- [ ] Create hook for MCP state
- [ ] Implement server add/edit/remove
- [ ] Add API integration for fetching MCP tools
- [ ] Handle loading/error states
- [ ] Validate server configurations

---

#### 2.3 Update Agent State Integration
**Changes**: Update agent.mcp object when servers are configured

**Actions**:
- [ ] Merge MCP config into agent.mcp
- [ ] Update selected tools array with MCP tool IDs
- [ ] Preserve existing MCP configs
- [ ] Test save/load flow

---

## Phase 3: A2A & Arcade Integration

### Goal
Add A2A agent and Arcade toolkit selection.

### Tasks

#### 3.1 Create A2aAgentPanel Component
**File**: `frontend/src/components/modals/ToolSelectionModal/A2aAgentPanel.tsx`

**Requirements**:
- Agent URL input
- Fetch agent card on submit
- Display agent capabilities
- Toggle agent on/off
- Show configured agents list

**Actions**:
- [ ] Create agent input form
- [ ] Integrate POST /tools/a2a/info API
- [ ] Display agent card UI
- [ ] Implement agent toggle
- [ ] Handle agent removal

---

#### 3.2 Create ArcadePanel Component
**File**: `frontend/src/components/modals/ToolSelectionModal/ArcadePanel.tsx`

**Requirements**:
- Display Arcade toolkits
- Select tools within toolkits
- Grid layout (same as platform tools)

**Actions**:
- [ ] Fetch Arcade tools from backend
- [ ] Display in ToolGrid
- [ ] Handle toolkit filtering
- [ ] Integrate with selection state

---

#### 3.3 Update Agent State Integration
**Actions**:
- [ ] Merge A2A config into agent.a2a
- [ ] Add Arcade tool IDs to agent.tools
- [ ] Test multi-category selection

---

## Phase 4: Polish & Enhancement

### Goal
Add animations, error handling, and UX improvements.

### Tasks

#### 4.1 Animations & Transitions
**Actions**:
- [ ] Add modal enter/exit animations (fade + scale)
- [ ] Add card hover animations (scale 1.01, shadow)
- [ ] Add category switch transitions (fade content)
- [ ] Add selection checkmark animation
- [ ] Smooth scroll behavior

---

#### 4.2 Error Handling & Edge Cases
**Actions**:
- [ ] Add error boundaries
- [ ] Network error retry UI
- [ ] Invalid config validation messages
- [ ] Empty state illustrations
- [ ] No search results state
- [ ] Server connection timeout handling

---

#### 4.3 Loading States
**Actions**:
- [ ] Skeleton cards while loading tools
- [ ] Spinner for API requests
- [ ] Progress indicator for server connections
- [ ] Disable interactions during async ops

---

#### 4.4 Accessibility Improvements
**Actions**:
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation (Tab, Space, Enter, Esc, Arrows)
- [ ] Focus management (trap focus in modal)
- [ ] Screen reader announcements
- [ ] Color contrast verification
- [ ] Touch target sizes (minimum 44px)

---

#### 4.5 Mobile Responsive
**Actions**:
- [ ] Sidebar collapses to drawer on mobile
- [ ] Single column grid on mobile
- [ ] Touch-friendly interactions
- [ ] Reduced padding on small screens
- [ ] Test on real devices

---

#### 4.6 Optional Enhancements
**Actions**:
- [ ] Favorites/recent tools
- [ ] Bulk select/deselect
- [ ] Tool usage analytics
- [ ] Onboarding tooltips
- [ ] Keyboard shortcuts help modal
- [ ] Export/import tool configurations

---

## Testing Checklist

### Unit Tests
- [ ] ToolCard component
- [ ] ToolGrid component
- [ ] useToolSelection hook
- [ ] Tool filtering logic
- [ ] API service methods

### Integration Tests
- [ ] Modal open/close flow
- [ ] Tool selection persistence
- [ ] Agent form integration
- [ ] API error handling

### E2E Tests
- [ ] Complete tool selection workflow
- [ ] MCP server configuration
- [ ] A2A agent connection
- [ ] Save and reload agent

### Manual Testing
- [ ] Cross-browser (Chrome, Firefox, Safari, Edge)
- [ ] Mobile devices (iOS, Android)
- [ ] Keyboard-only navigation
- [ ] Screen reader (NVDA, VoiceOver)
- [ ] Network throttling
- [ ] Large datasets (100+ tools)

---

## Success Criteria

### MVP (Phase 1)
- ✅ Modal opens and closes smoothly
- ✅ Platform tools display in grid
- ✅ Users can select/deselect tools
- ✅ Search filters tools correctly
- ✅ Selection persists to agent form
- ✅ Responsive on desktop/tablet/mobile
- ✅ Accessible via keyboard

### Complete (Phase 4)
- ✅ All tool categories functional
- ✅ MCP/A2A configuration works
- ✅ Animations smooth and polished
- ✅ Error states handled gracefully
- ✅ Loading states clear and informative
- ✅ WCAG 2.1 AA compliant
- ✅ < 30 seconds to configure tools
- ✅ Zero critical bugs

---

## Timeline Estimate

**Phase 1 (MVP)**: 2-3 days
- Day 1: Component structure + ToolCard/ToolGrid
- Day 2: Modal layout + PlatformToolsPanel + API
- Day 3: Integration + testing + bug fixes

**Phase 2 (MCP)**: 1-2 days
- MCP panel + API integration + testing

**Phase 3 (A2A/Arcade)**: 1-2 days
- A2A panel + Arcade panel + testing

**Phase 4 (Polish)**: 1-2 days
- Animations + accessibility + edge cases

**Total**: 5-9 days (depending on complexity and feedback)

---

## Notes

- Use existing shadcn components where possible
- Follow Tailwind best practices
- Keep components small and focused
- Test incrementally, don't wait for completion
- Get feedback early from stakeholders
- Document any deviations from plan

---

*Ready to build. Start with Phase 1, Task 1.1.*
