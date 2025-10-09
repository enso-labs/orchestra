# Tool Selection Modal - UI/UX Design Plan

## Overview
Design a clean, intuitive tool selection modal for the Agent Create/Edit page that allows users to enable platform tools and external service integrations (Slack, Airtable, MCP, A2A, etc.).

**Design Inspiration**: ChatGPT Connectors interface - clean sidebar navigation with icon-driven grid layout.

---

## Design Analysis: ChatGPT Connectors (Reference)

### Key Observations from Reference Image

**Layout Structure**:
- Left sidebar (280px) with navigation categories
- Main content area with 3-column grid of connector cards
- Clean header with title + subtitle + CTA button
- Ample whitespace between elements

**Visual Design**:
- **Cards**: Large icons (48px) centered above service name
- **Typography**: Service names in clean sans-serif, medium weight
- **Spacing**: Generous padding (40px+ between cards)
- **Colors**: Brand icons in full color against white/light gray background
- **Borders**: Subtle border radius (~12px), light gray borders
- **Hover State**: Likely subtle shadow/border change (not visible in static image)

**What Makes It Work**:
1. **Scannable** - Large icons instantly recognizable
2. **Uncluttered** - No description text cluttering the cards
3. **Predictable** - 3-column grid creates consistent rhythm
4. **Accessible** - High contrast, clear labels, adequate touch targets
5. **Branded** - Actual service logos create trust and familiarity

### Adaptations for Orchestra Tool Selection

We'll adopt this pattern but enhance it for our needs:
- Keep the clean sidebar + grid layout
- Add **subtle descriptions** below tool names (1 line, muted)
- Add **selection state** (checkmark badge, border color change)
- Add **tags** for categorization (small pills below description)
- Maintain the generous spacing and icon-first approach

---

## Core Principles (Apple Design Philosophy)

1. **Clarity** - Make the purpose immediately obvious
2. **Deference** - UI should defer to content, not compete with it
3. **Depth** - Visual layers and realistic motion create hierarchy
4. **Simplicity** - Reduce complexity at every opportunity
5. **Consistency** - Use established patterns from the existing UI

---

## Current State Analysis

### Backend API Structure
- **GET /tools** - Returns platform tool library with metadata
- **POST /tools/mcp/info** - Fetches MCP server tools given config
- **POST /tools/a2a/info** - Fetches A2A agent cards given config
- `ToolService` methods:
  - `default_tools(tools)` - Filter platform tools
  - `tool_details()` - Get all platform tools with metadata
  - `mcp_tools(config)` - Get MCP tools
  - `agent_cards(config)` - Get A2A agent cards
  - `arcade_tools(config)` - Get Arcade tools

### Frontend Current Implementation
- **Agent Model**: `tools: string[]` (simple array of tool names)
- **MCP Config**: JSON object stored in `agent.mcp`
- **A2A Config**: JSON object stored in `agent.a2a`
- **Current Tools UI**: Accordion with JSON editors for MCP/A2A (lines 363-431)
- **Existing Menu Pattern**: `BaseToolMenu.tsx` - dropdown with checkboxes (simple)

### UX Gaps
1. No visual tool browser - users manually edit JSON
2. No discovery mechanism for available tools
3. No validation feedback for configurations
4. No integration between platform tools and external services
5. Tools scattered across accordion items

---

## Proposed Solution: Unified Tool Selection Modal

### 1. Trigger & Entry Point

**Location**: Replace current accordion "Tools" section (line 353-432 in agent-create-form.tsx)

**Trigger Button**:
```tsx
<Button variant="outline" onClick={openToolModal}>
  <Wrench className="h-4 w-4" />
  Manage Tools ({selectedToolsCount})
</Button>
```

**Visual Indicator**: Show count badge of selected tools

---

### 2. Modal Structure

#### Layout (Inspired by ChatGPT Connectors)
```
┌───────────────────────────────────────────────────────────────┐
│  [×]                                                          │
│                                                               │
│  Tools & Integrations                          [Create +]    │
│  Connect tools to extend your agent's capabilities            │
│                                                               │
├─────────────┬─────────────────────────────────────────────────┤
│             │                                                 │
│  General    │  ┌──────┐  ┌──────┐  ┌──────┐                │
│             │  │ Icon │  │ Icon │  │ Icon │                │
│  Platform   │  │ Tool │  │ Tool │  │ Tool │                │
│             │  └──────┘  └──────┘  └──────┘                │
│  MCP        │                                                 │
│             │  ┌──────┐  ┌──────┐  ┌──────┐                │
│  A2A        │  │ Icon │  │ Icon │  │ Icon │                │
│             │  │ Tool │  │ Tool │  │ Tool │                │
│  Arcade     │  └──────┘  └──────┘  └──────┘                │
│             │                                                 │
└─────────────┴─────────────────────────────────────────────────┘
```

**Dimensions**:
- Width: 95vw (max 1400px) - wider to accommodate 3-column grid comfortably
- Height: 90vh (max 900px) - maximize vertical space
- Sidebar: 240px fixed width
- Content: Flex-grow with 48px padding
- Responsive: Sidebar collapses to icons only on tablet, drawer on mobile

**Key Changes from Original**:
- No bottom action bar (cleaner, actions in header or auto-save)
- Larger modal to match reference image's spaciousness
- Header integrated into content area with description text

---

### 3. Sidebar Navigation (Left Panel)

**Categories** (vertical tabs):
- 🏠 **Platform** - Built-in tools (web_search, web_scrape, etc.)
- 🔌 **MCP Servers** - Model Context Protocol integrations
- 🤝 **A2A Agents** - Agent-to-Agent connections
- 🎮 **Arcade** - Arcade toolkit integrations
- ⭐ **Favorites** - User's starred tools (future)

**Visual Style**:
- Minimal text labels with icons
- Active state: Background fill + border accent
- Hover: Subtle background change
- Use existing shadcn navigation menu component

---

### 4. Content Area (Right Panel)

#### 4.1 Platform Tools Tab

**Display Mode**: 3-column grid (matching ChatGPT reference)

**Tool Card Design** (ChatGPT-inspired):
```tsx
┌─────────────────────────────┐
│             [✓]             │
│                             │
│        ┌──────────┐         │
│        │   Icon   │         │
│        │  (48px)  │         │
│        └──────────┘         │
│                             │
│       Tool Name             │
│                             │
│   Brief description text    │
│   in muted color...         │
│                             │
│  [tag] [tag]                │
│                             │
└─────────────────────────────┘
```

**Card Specifications**:
- **Dimensions**: ~280px wide × 220px tall (consistent with reference)
- **Padding**: 24px all sides
- **Icon**: 48px × 48px, centered, with 16px margin-bottom
- **Name**: 16px font-size, semibold, centered, 8px margin-bottom
- **Description**: 13px font-size, muted color, centered, line-height 1.4, 2-line clamp
- **Tags**: 10px text, 6px vertical padding, 12px horizontal, below description
- **Selection Indicator**: Checkmark badge (20px) in top-right corner
  - Hidden when not selected
  - Primary color background with white checkmark when selected
- **Border**: 1px solid border-color, 12px border-radius
- **Background**: White/card background

**Card States**:
- **Default**:
  - Border: `border-border` (subtle gray)
  - Background: `bg-card`
  - Shadow: none
- **Hover**:
  - Border: `border-primary/30`
  - Shadow: `shadow-sm` (subtle lift)
  - Cursor: pointer
  - Transition: all 150ms ease
- **Selected**:
  - Border: `border-primary` (2px)
  - Background: `bg-primary/5`
  - Checkmark badge visible
  - Subtle glow effect

**Grid Layout**:
```css
grid-template-columns: repeat(3, 1fr);
gap: 24px;
padding: 48px;
```

**Search/Filter**:
- Sticky search bar at top of scroll area
- Simple input with search icon
- Real-time filtering (debounced 300ms)
- "No results" state with clear filters action

#### 4.2 MCP Servers Tab

**Two-Step Flow**:

**Step 1: Server Configuration**
```tsx
┌─────────────────────────────────────┐
│ Add MCP Server                      │
│                                     │
│ Server Name: [____________]         │
│                                     │
│ Connection Details:                 │
│ ○ HTTP/SSE                         │
│ ○ WebSocket                        │
│                                     │
│ URL: [_______________________]      │
│                                     │
│ [Templates ▾] [Test Connection]    │
│                    [Add Server] ───→│
└─────────────────────────────────────┘
```

**Step 2: Tool Selection**
- After server added, fetch tools from `/tools/mcp/info`
- Display available tools in grid (same design as Platform tools)
- Allow multi-select from server's tool catalog
- Show server name as section header

**Existing Servers**:
- List configured MCP servers
- Click to view/edit tools
- Remove button with confirmation

**Templates Dropdown**:
- "GitHub MCP"
- "Postgres MCP"
- "Custom..."
- Pre-fills connection details

#### 4.3 A2A Agents Tab

**Agent Card Design** (larger than tool cards):
```tsx
┌──────────────────────────────────────┐
│ [Avatar] Agent Name                  │
│                                      │
│ Description of agent capabilities... │
│                                      │
│ Capabilities:                        │
│ • Capability 1                       │
│ • Capability 2                       │
│                                      │
│ Base URL: example.com/agent     [✓] │
└──────────────────────────────────────┘
```

**Flow**:
1. User enters agent base URL or selects template
2. System fetches agent card via `/tools/a2a/info`
3. Display agent capabilities
4. Toggle to enable/disable agent

**Templates**:
- Pre-configured A2A agents (if available)
- Custom agent URL input

#### 4.4 Arcade Tab

**Similar to Platform Tools**:
- Show available Arcade toolkits
- Grid layout
- Filter by toolkit name
- Multi-select tools within toolkits

---

### 5. Selection Management

#### Status Bar (Bottom of Modal)
```tsx
┌──────────────────────────────────────────────────┐
│ Selected: 5 tools, 2 MCP servers, 1 A2A agent   │
│                                                  │
│ Platform (3) • MCP (2) • A2A (1)                │
└──────────────────────────────────────────────────┘
```

**Visual Feedback**:
- Compact pills showing counts per category
- Click pill to jump to category
- Subtle animation when count changes

#### Quick Preview Drawer (Optional Enhancement)
- Slide-out panel showing selected tools
- Remove individual selections
- Reorder tools (drag-and-drop)

---

### 6. Actions & State Management

**Save Flow**:
1. User clicks "Apply"
2. Modal validates configurations:
   - MCP servers: Check required fields
   - A2A agents: Verify base URL format
   - Platform tools: No validation needed
3. Update agent state:
   ```tsx
   setAgent({
     ...agent,
     tools: [...platformToolIds, ...mcpToolIds, ...arcadeToolIds],
     mcp: mcpConfig,
     a2a: a2aConfig,
   })
   ```
4. Close modal with success feedback

**Cancel Flow**:
- Discard all changes
- Confirm if changes made
- Close modal

**State Persistence**:
- Keep modal state in local component state
- Only update agent context on "Apply"
- Allow draft/work-in-progress mode

---

### 7. Visual Design Specifications

#### Color Palette (Using Existing Theme)
- **Background**: `bg-background`
- **Card Default**: `bg-muted/50`
- **Card Hover**: `bg-muted`
- **Card Selected**: `bg-primary/10`, `border-primary`
- **Text**: `text-foreground` / `text-muted-foreground`
- **Accents**: `border-border` / `border-primary`

#### Typography
- **Modal Title**: 18px, semibold
- **Category Labels**: 14px, medium
- **Tool Name**: 14px, semibold
- **Tool Description**: 12px, regular, muted
- **Tags**: 11px, medium

#### Spacing
- **Modal Padding**: 24px
- **Sidebar Width**: 180px (fixed)
- **Card Gap**: 16px
- **Card Padding**: 16px
- **Section Spacing**: 32px

#### Animations
- **Modal Enter**: Fade + scale from 0.95 to 1.0 (150ms)
- **Card Hover**: Scale 1.01, border color transition (100ms)
- **Card Select**: Background color transition (100ms)
- **Tab Switch**: Fade content (100ms)

---

### 8. Component Architecture

```
ToolSelectionModal/
├── index.tsx                    # Main modal component
├── Sidebar.tsx                  # Category navigation
├── ToolGrid.tsx                 # Platform tools grid
├── ToolCard.tsx                 # Individual tool card
├── McpServerPanel.tsx           # MCP configuration
├── A2aAgentPanel.tsx            # A2A configuration
├── ArcadePanel.tsx              # Arcade tools
├── StatusBar.tsx                # Bottom status/actions
├── hooks/
│   ├── useToolSelection.ts      # Selection state management
│   ├── useMcpTools.ts           # MCP API integration
│   └── useA2aAgents.ts          # A2A API integration
└── types.ts                     # TypeScript definitions
```

---

### 9. Implementation Phases

#### Phase 1: Core Modal & Platform Tools (MVP)
- [ ] Create modal component with sidebar layout
- [ ] Implement Platform tools tab with grid
- [ ] Build tool card component with selection
- [ ] Wire up to existing agent state
- [ ] Add search/filter functionality

#### Phase 2: MCP Integration
- [ ] Create MCP server configuration UI
- [ ] Integrate `/tools/mcp/info` API
- [ ] Display MCP tools after server config
- [ ] Handle server add/edit/remove
- [ ] Load/save templates

#### Phase 3: A2A & Arcade
- [ ] Build A2A agent configuration panel
- [ ] Integrate `/tools/a2a/info` API
- [ ] Add Arcade toolkit integration
- [ ] Implement agent card display

#### Phase 4: Polish & Enhancement
- [ ] Add animations and transitions
- [ ] Implement favorites/recents
- [ ] Add tool validation feedback
- [ ] Create onboarding tooltips
- [ ] Responsive mobile layout

---

### 10. User Flow Example

**Scenario**: User wants to add web search + GitHub MCP + Slack A2A

1. **Open Modal**: Click "Manage Tools" in agent form
2. **Platform Tools**:
   - Grid displays built-in tools
   - User clicks "Web Search" card → Selected (checkmark, blue border)
3. **Switch to MCP Tab**:
   - User clicks "MCP Servers" in sidebar
   - Clicks "Templates" → Selects "GitHub MCP"
   - Form pre-fills with GitHub MCP config
   - Clicks "Add Server"
   - System fetches tools from GitHub MCP
   - Grid shows GitHub-specific tools
   - User selects "search_code", "create_issue"
4. **Switch to A2A Tab**:
   - User enters Slack agent URL
   - System fetches agent card
   - Displays Slack capabilities
   - User toggles agent ON
5. **Review & Apply**:
   - Status bar shows: "Selected: 1 platform, 1 MCP (2 tools), 1 A2A"
   - User clicks "Apply"
   - Modal closes
   - Agent form updates with selected tools

---

### 11. Accessibility & UX Considerations

**Keyboard Navigation**:
- Tab through cards
- Space/Enter to toggle selection
- Arrow keys to navigate grid
- Escape to close modal

**Screen Readers**:
- Announce selection state changes
- Describe tool purpose clearly
- Label all interactive elements

**Error Handling**:
- Network errors: Show retry option
- Invalid configs: Inline validation messages
- Server failures: Graceful degradation

**Loading States**:
- Skeleton cards while fetching
- Progress indicator for server connections
- Disable actions during async operations

**Empty States**:
- No tools available: Helpful message + link to docs
- No search results: Clear filters button
- No servers configured: CTA to add first server

---

### 12. Success Metrics

**User Goals**:
- ✅ Discover available tools easily
- ✅ Configure external integrations without JSON editing
- ✅ Understand what each tool does
- ✅ Enable/disable tools with single click

**Design Goals**:
- ⚡ Fast tool selection (< 30 seconds to add multiple tools)
- 🎯 Clear visual feedback on selections
- 📱 Works seamlessly on all devices
- ♿ Fully accessible via keyboard and screen readers

---

## Technical Notes

### API Integration Points
```typescript
// Fetch platform tools
GET /tools → { tools: ToolDetail[] }

// Fetch MCP tools (requires config)
POST /tools/mcp/info
Body: { "server1": { transport, url, headers } }
Response: { mcp: Tool[] }

// Fetch A2A agent cards
POST /tools/a2a/info
Body: { "agent1": { base_url, agent_card_path } }
Response: { agent_cards: AgentCard[] }
```

### State Shape
```typescript
interface ToolSelectionState {
  platformTools: string[];          // ['web_search', 'web_scrape']
  mcpServers: McpServerConfig[];    // [{ name, url, tools: [] }]
  a2aAgents: A2AAgentConfig[];      // [{ name, base_url, enabled }]
  arcadeTools: string[];            // ['toolkit.tool1']
}
```

### Integration with Existing Form
- Replace accordion "Tools" section (lines 353-432)
- Keep MCP/A2A configs in agent state for backward compatibility
- Merge selected tools into `agent.tools` array
- Maintain existing save/update logic

---

## Design Inspiration References

- **ChatGPT Connectors** (Primary): Icon-first grid, clean sidebar, generous spacing
- **Apple System Settings**: Category sidebar + content area pattern
- **Raycast Extensions**: Clean tool cards with metadata
- **Notion Integrations**: Connection + capability selection flow
- **VS Code Extensions**: Search, filter, and install pattern

---

## Key Design Decisions (Based on ChatGPT Reference)

### What We're Adopting
1. **Icon-First Layout**: Large, centered icons (48px) make tools instantly recognizable
2. **3-Column Grid**: Predictable rhythm, optimal for scanning
3. **Generous Spacing**: 24px gaps between cards, 48px content padding
4. **Minimal Text**: Tool names prominent, descriptions subtle and optional
5. **Clean Sidebar**: Simple category list without icons (cleaner than original plan)
6. **Light Borders**: Subtle borders (1px) that strengthen on hover/selection
7. **No Bottom Bar**: Actions in header or auto-save pattern

### What We're Enhancing
1. **Selection State**: Add checkmark badge + border color change (reference doesn't show selection)
2. **Description Text**: Keep 1-line descriptions for context (reference has none visible)
3. **Tags**: Add category tags below descriptions for better filtering
4. **Search**: Sticky search bar above grid (may exist in reference but not visible)
5. **Configuration UI**: Add forms for MCP/A2A (reference only shows connectors list)

### What We're Avoiding
1. ❌ Dense cards with lots of metadata
2. ❌ Multi-line descriptions that clutter cards
3. ❌ Small icons that are hard to recognize
4. ❌ Tight spacing that feels cramped
5. ❌ Complex multi-step wizards (keep simple)

---

## Next Steps

1. **Review & Approval**: Get stakeholder feedback on this plan
2. **Design Mockups**: Create high-fidelity designs in Figma (optional but recommended)
3. **Component Scaffolding**: Set up modal structure and routing
4. **API Integration**: Wire up tool fetching endpoints
5. **Iterative Development**: Build in phases, test with users
6. **User Testing**: Validate with 3-5 users before Phase 4

---

*This plan prioritizes simplicity and clarity. Every element serves a purpose. Every interaction is intentional. The goal is invisible design that makes tool selection feel effortless.*

**Visual Reference**: See ChatGPT Connectors screenshot for layout, spacing, and card design inspiration.
