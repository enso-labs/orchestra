# Agent-Centric Schedule Interface Implementation Plan

## Overview

This document outlines the comprehensive plan for implementing an agent-centric scheduling interface for the Schedule API in the Ensō Orchestra application. Schedules will be integrated into the existing agent management system, allowing users to create, view, edit, and delete scheduled LLM tasks for their specific agents. This approach provides better organization by keeping agent settings, threads, and schedules together in a unified interface.

## API Analysis

### Backend Schedule API Endpoints

- `GET /schedules` - List user's scheduled jobs (filter by agent)
- `GET /schedules/{job_id}` - Get specific scheduled job
- `POST /schedules` - Create new scheduled job (linked to agent)
- `DELETE /schedules/{job_id}` - Delete scheduled job

### Data Models

```typescript
// Schedule Creation Payload (Agent-Centric)
interface ScheduleCreate {
	trigger: {
		type: "cron";
		expression: string; // e.g., "0 */1 * * *" (minimum 1 hour intervals)
	};
	task: LLMRequest; // Inherits from agent configuration
}

// Schedule Response (Agent-Linked)
interface Schedule {
	id: string;
	trigger: {
		type: "cron";
		expression: string;
	};
	task: LLMRequest;
	next_run_time: string; // ISO datetime
	agent_id?: string; // Link to specific agent
}

// Enhanced Agent Type (with schedules)
interface Agent {
	id?: string;
	name: string;
	description: string;
	model: string;
	prompt: string;
	tools: string[];
	subagents?: Agent[];
	mcp?: object;
	a2a?: object;
	metadata?: object;
	schedules?: Schedule[]; // Agent's associated schedules
	created_at?: string;
	updated_at?: string;
}
```

## Agent-Centric Architecture Plan

### 1. Service Layer Enhancement (`src/lib/services/scheduleService.ts`)

Create schedule service that works within agent context:

```typescript
import apiClient from "@/lib/utils/apiClient";

export interface ScheduleCreate {
  trigger: {
    type: "cron";
    expression: string;
  };
  task: {
    model: string;
    system: string;
    messages: Array<{
      role: "user" | "assistant" | "system" | "tool";
      content: string;
    }>;
    tools?: string[];
    a2a?: Record<string, any>;
    mcp?: Record<string, any>;
    subagents?: Array<any>;
    metadata?: Record<string, any>;
  };
}

// Agent-scoped API functions
export const getAgentSchedules = async (agentId: string): Promise<{ schedules: Schedule[] }>;
export const createAgentSchedule = async (agentId: string, schedule: ScheduleCreate): Promise<{ job: { id: string; next_run_time: string } }>;
export const deleteAgentSchedule = async (agentId: string, scheduleId: string): Promise<void>;
export const getSchedule = async (scheduleId: string): Promise<{ schedule: Schedule }>;
```

### 2. Agent Context Enhancement (`src/hooks/useAgent.ts`)

Extend existing agent hook to include schedule management:

```typescript
export const useAgent = () => {
	// Existing agent state and functions...

	// New schedule-related state
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [schedulesLoading, setSchedulesLoading] = useState(false);

	// New schedule functions
	const fetchAgentSchedules = async (agentId: string) => {
		/* ... */
	};
	const createScheduleForAgent = async (
		agentId: string,
		schedule: ScheduleCreate,
	) => {
		/* ... */
	};
	const deleteAgentSchedule = async (agentId: string, scheduleId: string) => {
		/* ... */
	};

	return {
		// Existing returns...
		schedules,
		schedulesLoading,
		fetchAgentSchedules,
		createScheduleForAgent,
		deleteAgentSchedule,
	};
};
```

### 3. Agent Edit Page Integration

#### A. Enhanced Tab Structure (`src/pages/agents/edit.tsx`)

Add "Schedules" tab to existing agent edit interface:

**Updated Tab Structure:**

- **Chat** - Agent conversation interface
- **Threads** - Agent-specific thread history
- **Config** - Agent settings and configuration
- **Schedules** - Agent-specific scheduled tasks (NEW)

**Implementation:**

```typescript
// Add to existing TabsList
<TabsList>
  <TabsTrigger value="chat">Chat</TabsTrigger>
  <TabsTrigger value="threads">Threads</TabsTrigger>
  <TabsTrigger value="config">Config</TabsTrigger>
  <TabsTrigger value="schedules">Schedules</TabsTrigger>
</TabsList>

// Add new TabsContent
<TabsContent value="schedules" className="flex-1 p-4 h-0">
  <ScrollArea className="h-full flex-1">
    <AgentSchedulesPanel agentId={agentId} />
  </ScrollArea>
</TabsContent>
```

#### B. Agent Schedules Panel (`src/components/panels/AgentSchedulesPanel.tsx`)

New component for managing agent schedules:

**Features:**

- List of agent-specific schedules
- Create new schedule button
- Schedule status indicators
- Quick actions (edit, delete, duplicate)
- Empty state for agents with no schedules

### 4. Components Structure

#### A. Agent Schedule Card (`src/components/cards/AgentScheduleCard.tsx`)

```typescript
interface AgentScheduleCardProps {
	schedule: Schedule;
	agent: Agent;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	onDuplicate: (schedule: Schedule) => void;
}
```

**Features:**

- Shows schedule timing and next run
- Displays task summary (inherited from agent)
- Status indicators (active/paused/error)
- Quick action menu
- Agent context awareness

#### B. Agent Schedule Form (`src/components/forms/AgentScheduleForm.tsx`)

Form component that leverages agent configuration:

**Sections:**

1. **Schedule Information**
   - Schedule name/description
   - Enable/disable toggle

2. **Timing Configuration**
   - Cron expression builder with presets
   - Visual cron expression validator
   - Next run time preview
   - Timezone selector

3. **Task Configuration (Agent-Aware)**
   - **Inherit from Agent** (default): Uses agent's model, prompt, tools
   - **Custom Override**: Allow customization while keeping agent as base
   - Message configuration for the scheduled task
   - Advanced settings override

**Agent Integration Benefits:**

- Pre-populated with agent settings
- Consistent model and tool usage
- Simplified configuration process
- Clear inheritance hierarchy

#### C. Cron Expression Builder (`src/components/forms/CronBuilder.tsx`)

Reusable cron builder component:

**Features:**

- Visual cron builder with dropdowns
- Common presets (daily, weekly, monthly, hourly)
- Real-time validation (minimum 1-hour intervals)
- Human-readable description
- Next 5 run times preview

#### D. Agent Schedule List (`src/components/lists/AgentScheduleList.tsx`)

List component for agent schedules:

**Features:**

- Table and card view modes
- Sorting by next run time, status, created date
- Filtering by status (active/paused/error)
- Bulk actions (enable/disable, delete)
- Loading states and empty states

### 5. Enhanced Agent Service (`src/lib/services/agentService.ts`)

Extend existing agent service to include schedule operations:

```typescript
export default class AgentService {
	// Existing methods...

	// New schedule-related methods
	static async getAgentSchedules(agentId: string) {
		try {
			const response = await apiClient.get(`/schedules?agent_id=${agentId}`);
			return response;
		} catch (error) {
			console.error("Failed to fetch agent schedules:", error);
			throw error;
		}
	}

	static async createAgentSchedule(agentId: string, schedule: ScheduleCreate) {
		try {
			// Enhance schedule with agent context
			const enhancedSchedule = {
				...schedule,
				task: {
					...schedule.task,
					metadata: {
						...schedule.task.metadata,
						agent_id: agentId,
					},
				},
			};
			const response = await apiClient.post("/schedules", enhancedSchedule);
			return response;
		} catch (error) {
			console.error("Failed to create agent schedule:", error);
			throw error;
		}
	}
}
```

### 6. UI/UX Enhancements for Agent Context

#### A. Visual Design

- **Schedule Tab Icon:** `Calendar` or `Clock` from Lucide React
- **Agent Integration Indicators:** Show which settings are inherited vs custom
- **Status Indicators:**
  - Green dot for active schedules
  - Orange for upcoming (next 24h)
  - Red for failed/error states
  - Gray for disabled
  - Blue accent for agent-inherited settings

#### B. User Experience Improvements

- **Agent Context Awareness:** Always show which agent the schedule belongs to
- **Setting Inheritance:** Clear visual indicators for inherited vs overridden settings
- **Quick Actions:**
  - "Create Schedule" button in agent header
  - "Duplicate from Agent Settings" option
  - "Test Schedule" for immediate execution
- **Navigation:** Seamless flow between agent config and schedules

### 7. Agent-Schedule Relationship Management

#### A. Data Consistency

- **Agent Updates:** When agent settings change, show impact on schedules
- **Schedule Inheritance:** Clear rules for what gets inherited vs customized
- **Deletion Handling:** Proper cleanup when agents are deleted

#### B. Agent Configuration Integration

```typescript
// Helper function to create schedule from agent
export const createScheduleFromAgent = (
	agent: Agent,
	cronExpression: string,
	message: string,
): ScheduleCreate => {
	return {
		trigger: {
			type: "cron",
			expression: cronExpression,
		},
		task: {
			model: agent.model,
			system: agent.prompt,
			messages: [{ role: "user", content: message }],
			tools: agent.tools,
			a2a: agent.a2a,
			mcp: agent.mcp,
			subagents: agent.subagents,
			metadata: {
				...agent.metadata,
				agent_id: agent.id,
				inherited_from_agent: true,
			},
		},
	};
};
```

### 8. Enhanced Features for Agent Context

#### A. Schedule Templates by Agent Type

- **Agent-Specific Templates:** Common schedules for different agent types
- **Template Inheritance:** Templates that leverage agent configuration
- **Quick Setup:** One-click schedule creation for common patterns

#### B. Agent Performance Insights

- **Schedule Success Rates:** Per-agent schedule performance
- **Resource Usage:** Track agent resource consumption via schedules
- **Optimization Suggestions:** Recommend schedule timing based on agent usage

#### C. Agent Workflow Integration

- **Multi-Agent Schedules:** Coordinate schedules across related agents
- **Agent Dependencies:** Schedule chains that involve multiple agents
- **Workflow Templates:** Pre-built agent + schedule combinations

### 9. Implementation Priority (Agent-Centric)

#### Phase 1: Core Agent Integration (MVP)

1. ✅ Add "Schedules" tab to agent edit page
2. ✅ Create AgentSchedulesPanel component
3. ✅ Implement agent-scoped schedule service
4. ✅ Basic schedule CRUD within agent context
5. ✅ Agent setting inheritance for schedules

#### Phase 2: Enhanced Agent UX

1. ✅ Agent schedule cards with inheritance indicators
2. ✅ Cron builder with agent-aware presets
3. ✅ Schedule form with agent configuration integration
4. ✅ Agent schedule list with filtering and sorting
5. ✅ Toast notifications and error handling

#### Phase 3: Advanced Agent Features

1. ✅ Agent-specific schedule templates
2. ✅ Multi-agent schedule coordination
3. ✅ Agent performance insights for schedules
4. ✅ Advanced workflow integration

### 10. Technical Implementation Details

#### A. Agent Context Propagation

```typescript
// Ensure agent context is available throughout schedule components
const AgentScheduleProvider = ({ agentId, children }) => {
  const { agent } = useAgentContext();
  const scheduleContext = useAgentSchedules(agentId);

  return (
    <AgentScheduleContext.Provider value={{ agent, ...scheduleContext }}>
      {children}
    </AgentScheduleContext.Provider>
  );
};
```

#### B. Schedule-Agent Synchronization

- **Real-time Updates:** Keep schedules in sync with agent changes
- **Conflict Resolution:** Handle conflicts between agent updates and active schedules
- **Migration Support:** Handle agent configuration changes gracefully

### 11. File Structure (Agent-Centric)

```
src/
├── lib/
│   ├── services/
│   │   ├── agentService.ts              # Enhanced with schedule methods
│   │   └── scheduleService.ts           # Agent-scoped schedule operations
│   └── entities/
│       ├── agent.ts                     # Enhanced agent interface
│       └── schedule.ts                  # Schedule interfaces
├── hooks/
│   ├── useAgent.ts                      # Enhanced with schedule management
│   └── useAgentSchedules.ts             # Agent-specific schedule hook
├── pages/
│   └── agents/
│       └── edit.tsx                     # Enhanced with Schedules tab
├── components/
│   ├── panels/
│   │   └── AgentSchedulesPanel.tsx      # Main agent schedules interface
│   ├── cards/
│   │   └── AgentScheduleCard.tsx        # Agent-aware schedule card
│   ├── forms/
│   │   ├── AgentScheduleForm.tsx        # Agent-integrated schedule form
│   │   └── CronBuilder.tsx              # Reusable cron builder
│   └── lists/
│       └── AgentScheduleList.tsx        # Agent schedule list component
└── context/
    └── AgentScheduleContext.tsx         # Agent-schedule context provider
```

## Benefits of Agent-Centric Approach

### 1. **Improved Organization**

- Schedules are logically grouped with their related agents
- Unified management interface for all agent-related functionality
- Easier to understand the relationship between agents and their automation

### 2. **Better User Experience**

- Consistent configuration inheritance from agents
- Simplified schedule creation process
- Clear visual hierarchy and context

### 3. **Enhanced Functionality**

- Agent settings automatically propagate to schedules
- Better resource management and monitoring
- Easier troubleshooting and debugging

### 4. **Scalability**

- Supports complex multi-agent workflows
- Enables agent-specific optimizations
- Facilitates future agent ecosystem features

This agent-centric approach transforms schedules from a standalone feature into an integrated part of the agent management system, providing a more cohesive and powerful user experience while maintaining the flexibility to create sophisticated automated workflows.
