# Spec 004: Heartbeat Frontend Dashboard + Chat Integration

## User Story

As a user, I want to see heartbeat status on the Schedules page and understand when a chat message was triggered by a heartbeat — so I have visibility into my agent's periodic awareness.

## Purpose

Add heartbeat configuration UI to the existing Schedules page, a status dashboard for monitoring heartbeat activity, and chat-side treatment for heartbeat-triggered messages.

## Problem Statement

After Specs 002-003, heartbeat is fully functional via API and chat tools, but:
1. There's no visual dashboard for configuring or monitoring heartbeat
2. Chat messages triggered by heartbeat ticks look like regular messages — no visual distinction
3. HEARTBEAT_OK responses (nothing needs attention) clutter the chat

## Technical Approach

### New File: `frontend/src/lib/entities/heartbeat.ts`

TypeScript interfaces matching backend schemas:

```typescript
export interface ActiveHours {
    start: string;  // "HH:MM"
    end: string;    // "HH:MM"
    timezone: string;  // IANA timezone
}

export interface HeartbeatConfig {
    user_id: string;
    assistant_id: string;
    enabled: boolean;
    checklist: string;  // Markdown
    every_seconds: number;
    active_hours: ActiveHours;
    isolated_session: boolean;
    light_context: boolean;
    ack_max_chars: number;
    prompt: string;
    schedule_id: string | null;
}

export interface HeartbeatState {
    last_run_at: string | null;    // ISO datetime
    last_result: string | null;    // "ok" | "escalated" | "skipped"
    consecutive_ok_count: number;
    next_due_at: string | null;    // ISO datetime
    total_ticks: number;
    total_escalations: number;
}

export interface HeartbeatTickResult {
    action: "ok" | "escalated" | "skipped";
    reason: string;
    response: string | null;
    tokens_used: number | null;
    duration_ms: number | null;
    timestamp: string;  // ISO datetime
}

export type HeartbeatInterval =
    | 300      // 5 min
    | 900      // 15 min
    | 1800     // 30 min
    | 3600     // 1 hour
    | 7200     // 2 hours
    | 14400    // 4 hours
    | 28800    // 8 hours
    | 43200    // 12 hours
    | 86400;   // 24 hours

export const HEARTBEAT_INTERVALS: { value: HeartbeatInterval; label: string }[] = [
    { value: 300, label: "Every 5 minutes" },
    { value: 900, label: "Every 15 minutes" },
    { value: 1800, label: "Every 30 minutes" },
    { value: 3600, label: "Every hour" },
    { value: 7200, label: "Every 2 hours" },
    { value: 14400, label: "Every 4 hours" },
    { value: 28800, label: "Every 8 hours" },
    { value: 43200, label: "Every 12 hours" },
    { value: 86400, label: "Every 24 hours" },
];
```

### New File: `frontend/src/lib/services/heartbeatService.ts`

API service following `scheduleService.ts` pattern:

```typescript
import { apiClient } from "@/lib/api";
import type { HeartbeatConfig, HeartbeatState, HeartbeatTickResult } from "@/lib/entities/heartbeat";

export class HeartbeatService {
    private static readonly BASE_URL = "/heartbeat";

    static async getConfig(): Promise<{ config: HeartbeatConfig | null }> {
        const response = await apiClient.get(this.BASE_URL);
        const data = response.data;
        return {
            config: Object.keys(data.config).length > 0 ? data.config : null,
        };
    }

    static async upsertConfig(config: {
        assistant_id: string;
        enabled: boolean;
        checklist: string;
        every_seconds: number;
        active_hours?: { start: string; end: string; timezone?: string };
        isolated_session?: boolean;
        light_context?: boolean;
        ack_max_chars?: number;
        prompt?: string;
    }): Promise<{ config: HeartbeatConfig }> {
        const response = await apiClient.put(this.BASE_URL, config);
        return response.data;
    }

    static async deleteConfig(): Promise<void> {
        await apiClient.delete(this.BASE_URL);
    }

    static async getState(): Promise<{ state: HeartbeatState }> {
        const response = await apiClient.get(`${this.BASE_URL}/state`);
        return response.data;
    }

    static async triggerTick(): Promise<{ result: HeartbeatTickResult }> {
        const response = await apiClient.post(`${this.BASE_URL}/tick`);
        return response.data;
    }

    static async getHistory(limit: number = 20): Promise<{ results: HeartbeatTickResult[] }> {
        const response = await apiClient.get(`${this.BASE_URL}/history`, {
            params: { limit },
        });
        return response.data;
    }
}
```

### New File: `frontend/src/hooks/useHeartbeat.ts`

React hook following `useSchedules.ts` pattern:

```typescript
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { HeartbeatService } from "@/lib/services/heartbeatService";
import type { HeartbeatConfig, HeartbeatState, HeartbeatTickResult } from "@/lib/entities/heartbeat";

export const useHeartbeat = (autoRefreshMs: number = 30000) => {
    const [config, setConfig] = useState<HeartbeatConfig | null>(null);
    const [state, setState] = useState<HeartbeatState | null>(null);
    const [history, setHistory] = useState<HeartbeatTickResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const { config } = await HeartbeatService.getConfig();
            setConfig(config);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchState = useCallback(async () => {
        try {
            const { state } = await HeartbeatService.getState();
            setState(state);
        } catch (err: any) {
            // Silently fail for state refresh
        }
    }, []);

    const fetchHistory = useCallback(async (limit: number = 20) => {
        try {
            const { results } = await HeartbeatService.getHistory(limit);
            setHistory(results);
        } catch (err: any) {
            // Silently fail for history refresh
        }
    }, []);

    const saveConfig = useCallback(async (configData: Parameters<typeof HeartbeatService.upsertConfig>[0]) => {
        try {
            setLoading(true);
            const { config } = await HeartbeatService.upsertConfig(configData);
            setConfig(config);
            toast.success("Heartbeat configuration saved");
            await fetchState();
        } catch (err: any) {
            toast.error(`Failed to save heartbeat config: ${err.message}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchState]);

    const deleteConfig = useCallback(async () => {
        try {
            setLoading(true);
            await HeartbeatService.deleteConfig();
            setConfig(null);
            setState(null);
            setHistory([]);
            toast.success("Heartbeat disabled");
        } catch (err: any) {
            toast.error(`Failed to disable heartbeat: ${err.message}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const triggerTick = useCallback(async () => {
        try {
            const { result } = await HeartbeatService.triggerTick();
            toast.success(`Heartbeat tick: ${result.action}`);
            await fetchState();
            await fetchHistory();
            return result;
        } catch (err: any) {
            toast.error(`Heartbeat tick failed: ${err.message}`);
            throw err;
        }
    }, [fetchState, fetchHistory]);

    // Initial load
    useEffect(() => {
        fetchConfig();
        fetchState();
        fetchHistory();
    }, [fetchConfig, fetchState, fetchHistory]);

    // Auto-refresh state
    useEffect(() => {
        if (!config?.enabled || autoRefreshMs <= 0) return;

        const interval = setInterval(() => {
            fetchState();
            fetchHistory();
        }, autoRefreshMs);

        return () => clearInterval(interval);
    }, [config?.enabled, autoRefreshMs, fetchState, fetchHistory]);

    return {
        config,
        state,
        history,
        loading,
        error,
        fetchConfig,
        fetchState,
        fetchHistory,
        saveConfig,
        deleteConfig,
        triggerTick,
    };
};
```

### Modify: `frontend/src/pages/schedules/index.tsx`

Add a "Heartbeat" section above the existing schedules content. This is a new collapsible section, not a replacement:

```tsx
// New imports at top:
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { HeartbeatSection } from "@/components/heartbeat/HeartbeatSection";

// Inside SchedulesIndexPage, after existing hooks:
const {
    config: heartbeatConfig,
    state: heartbeatState,
    history: heartbeatHistory,
    loading: heartbeatLoading,
    saveConfig: saveHeartbeatConfig,
    deleteConfig: deleteHeartbeatConfig,
    triggerTick,
} = useHeartbeat();

// In the JSX, before the existing schedule content (after stats cards):
<HeartbeatSection
    config={heartbeatConfig}
    state={heartbeatState}
    history={heartbeatHistory}
    loading={heartbeatLoading}
    agents={agents}  // from existing useAgents hook
    onSave={saveHeartbeatConfig}
    onDelete={deleteHeartbeatConfig}
    onTriggerTick={triggerTick}
/>
```

### New File: `frontend/src/components/heartbeat/HeartbeatSection.tsx`

The main heartbeat UI component:

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Heart, ChevronDown, Play, Clock, CheckCircle2, AlertTriangle, SkipForward } from "lucide-react";
import { HEARTBEAT_INTERVALS } from "@/lib/entities/heartbeat";
import type { HeartbeatConfig, HeartbeatState, HeartbeatTickResult } from "@/lib/entities/heartbeat";
import { formatDistanceToNow } from "date-fns";

interface HeartbeatSectionProps {
    config: HeartbeatConfig | null;
    state: HeartbeatState | null;
    history: HeartbeatTickResult[];
    loading: boolean;
    agents: Array<{ id: string; name: string }>;
    onSave: (config: any) => Promise<void>;
    onDelete: () => Promise<void>;
    onTriggerTick: () => Promise<any>;
}

export function HeartbeatSection({
    config,
    state,
    history,
    loading,
    agents,
    onSave,
    onDelete,
    onTriggerTick,
}: HeartbeatSectionProps) {
    const [isOpen, setIsOpen] = useState(!!config?.enabled);
    const [editing, setEditing] = useState(false);

    // Local form state
    const [enabled, setEnabled] = useState(config?.enabled ?? false);
    const [assistantId, setAssistantId] = useState(config?.assistant_id ?? "");
    const [checklist, setChecklist] = useState(config?.checklist ?? "# Heartbeat Checklist\n- Check for urgent items");
    const [everySeconds, setEverySeconds] = useState(config?.every_seconds ?? 3600);
    const [activeStart, setActiveStart] = useState(config?.active_hours?.start ?? "09:00");
    const [activeEnd, setActiveEnd] = useState(config?.active_hours?.end ?? "22:00");

    const handleSave = async () => {
        await onSave({
            assistant_id: assistantId,
            enabled,
            checklist,
            every_seconds: everySeconds,
            active_hours: { start: activeStart, end: activeEnd },
        });
        setEditing(false);
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6" data-testid="heartbeat-section">
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Heart className="h-5 w-5 text-red-500" />
                            <div>
                                <CardTitle className="text-lg">Heartbeat Monitor</CardTitle>
                                <CardDescription>Periodic agent awareness — checks your checklist and only alerts when needed</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {config?.enabled && (
                                <Badge variant="outline" className="text-green-500 border-green-500/30">
                                    Active
                                </Badge>
                            )}
                            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <CardContent className="space-y-6">
                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="heartbeat-toggle">Enable Heartbeat</Label>
                            <Switch
                                id="heartbeat-toggle"
                                data-testid="heartbeat-toggle"
                                checked={enabled}
                                onCheckedChange={setEnabled}
                            />
                        </div>

                        {/* Agent Selector */}
                        <div className="space-y-2">
                            <Label>Agent</Label>
                            <Select value={assistantId} onValueChange={setAssistantId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select agent..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Checklist Editor */}
                        <div className="space-y-2">
                            <Label>Checklist (Markdown)</Label>
                            <Textarea
                                data-testid="heartbeat-checklist"
                                value={checklist}
                                onChange={(e) => setChecklist(e.target.value)}
                                placeholder="# My Checklist&#10;- Check for urgent emails&#10;- Review pending PRs"
                                rows={6}
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* Interval Selector */}
                        <div className="space-y-2">
                            <Label>Check Interval</Label>
                            <Select
                                value={String(everySeconds)}
                                onValueChange={(v) => setEverySeconds(Number(v))}
                                data-testid="heartbeat-interval"
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HEARTBEAT_INTERVALS.map((interval) => (
                                        <SelectItem key={interval.value} value={String(interval.value)}>
                                            {interval.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Active Hours */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Active From</Label>
                                <Input
                                    type="time"
                                    data-testid="active-hours-start"
                                    value={activeStart}
                                    onChange={(e) => setActiveStart(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Active Until</Label>
                                <Input
                                    type="time"
                                    data-testid="active-hours-end"
                                    value={activeEnd}
                                    onChange={(e) => setActiveEnd(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={loading}>
                                Save
                            </Button>
                            {config?.enabled && (
                                <>
                                    <Button variant="outline" onClick={onTriggerTick} disabled={loading}>
                                        <Play className="h-4 w-4 mr-1" /> Test Tick
                                    </Button>
                                    <Button variant="destructive" onClick={onDelete} disabled={loading}>
                                        Disable
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Status Card */}
                        {state && config?.enabled && (
                            <Card className="bg-muted/50">
                                <CardContent className="pt-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Last Run</p>
                                            <p className="font-medium">
                                                {state.last_run_at
                                                    ? formatDistanceToNow(new Date(state.last_run_at), { addSuffix: true })
                                                    : "Never"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Next Due</p>
                                            <p className="font-medium">
                                                {state.next_due_at
                                                    ? formatDistanceToNow(new Date(state.next_due_at), { addSuffix: true })
                                                    : "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Consecutive OKs</p>
                                            <p className="font-medium">{state.consecutive_ok_count}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Total</p>
                                            <p className="font-medium">
                                                {state.total_ticks} ticks / {state.total_escalations} escalations
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Activity Timeline */}
                        {history.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground">Recent Activity</h4>
                                <div className="space-y-1">
                                    {history.slice(0, 10).map((tick, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm py-1">
                                            {tick.action === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                            {tick.action === "escalated" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                                            {tick.action === "skipped" && <SkipForward className="h-4 w-4 text-muted-foreground" />}
                                            <span className="text-muted-foreground">
                                                {new Date(tick.timestamp).toLocaleString()}
                                            </span>
                                            <span>{tick.reason}</span>
                                            {tick.duration_ms && (
                                                <span className="text-muted-foreground ml-auto">{tick.duration_ms}ms</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
```

### Chat Treatment: Heartbeat Messages

Heartbeat-triggered messages are tagged with `{ source: "heartbeat" }` in metadata (set by `HeartbeatService._invoke_agent()` in Spec 002). The chat UI needs to:

1. **Badge**: Show a "Heartbeat" badge on messages from heartbeat ticks
2. **Collapse OK**: HEARTBEAT_OK responses are collapsed by default with "Show heartbeat activity" expander
3. **Escalated**: Full display for escalated responses

#### Modify: Message rendering component

The exact file depends on the current chat message component structure. The changes needed:

```tsx
// In the message rendering component, check metadata:
const isHeartbeat = message.metadata?.source === "heartbeat";
const isHeartbeatOk = isHeartbeat && message.content?.includes("HEARTBEAT_OK");

// Render:
{isHeartbeat && (
    <Badge variant="outline" className="text-red-500 border-red-500/30 text-xs">
        <Heart className="h-3 w-3 mr-1" /> Heartbeat
    </Badge>
)}

{isHeartbeatOk ? (
    <Collapsible>
        <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
                Show heartbeat activity
            </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
            {/* Render message content */}
        </CollapsibleContent>
    </Collapsible>
) : (
    {/* Normal message rendering */}
)}
```

## Component Hierarchy

```
SchedulesIndexPage
├── HeartbeatSection (new)
│   ├── Enable/Disable Toggle (Switch)
│   ├── Agent Selector (Select)
│   ├── Checklist Editor (Textarea)
│   ├── Interval Selector (Select)
│   ├── Active Hours (Input[time] x2)
│   ├── Action Buttons (Save, Test Tick, Disable)
│   ├── Status Card (metrics grid)
│   └── Activity Timeline (list of tick results)
├── Stats Cards (existing)
├── Search/Filters (existing)
└── Calendar/Table/Grid Views (existing)
```

## Acceptance Criteria

1. Heartbeat section appears at top of Schedules page
2. Section is collapsible (default expanded if heartbeat is enabled)
3. Enable/disable toggle controls heartbeat state
4. Agent selector shows available agents
5. Checklist editor accepts markdown input
6. Interval selector offers preset intervals (5min to 24h)
7. Active hours configurable with time inputs
8. Save button persists config and registers schedule
9. "Test Tick" button manually triggers a tick
10. Status card shows last run, next due, consecutive OKs, totals
11. Activity timeline shows recent tick results with icons
12. Chat messages from heartbeat show "Heartbeat" badge
13. HEARTBEAT_OK messages are collapsed by default
14. All heartbeat controls accessible on mobile (375px viewport)

## Test Plan

### Frontend Unit Tests

```typescript
// frontend/src/tests/heartbeat/HeartbeatSection.test.tsx

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HeartbeatSection } from "@/components/heartbeat/HeartbeatSection";
import { vi } from "vitest";

describe("HeartbeatSection", () => {
    const mockAgents = [
        { id: "agent-1", name: "Default Agent" },
        { id: "agent-2", name: "Research Agent" },
    ];

    it("renders collapsed when no config", () => {
        render(<HeartbeatSection config={null} state={null} history={[]} loading={false} agents={mockAgents} onSave={vi.fn()} onDelete={vi.fn()} onTriggerTick={vi.fn()} />);
        expect(screen.getByText("Heartbeat Monitor")).toBeInTheDocument();
    });

    it("shows Active badge when enabled", () => {
        const config = { enabled: true, /* ... */ };
        render(<HeartbeatSection config={config} /* ... */ />);
        expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("calls onSave with form data", async () => {
        const onSave = vi.fn();
        render(<HeartbeatSection config={null} onSave={onSave} /* ... */ />);
        // Fill form and click Save
        fireEvent.click(screen.getByText("Save"));
        await waitFor(() => expect(onSave).toHaveBeenCalled());
    });

    it("calls onTriggerTick when Test Tick clicked", async () => {
        const onTriggerTick = vi.fn();
        // ... render with enabled config, click Test Tick
    });

    it("displays status card with metrics", () => {
        const state = { last_run_at: new Date().toISOString(), consecutive_ok_count: 5, /* ... */ };
        // ... verify metrics displayed
    });

    it("renders activity timeline", () => {
        const history = [{ action: "ok", reason: "All clear", timestamp: new Date().toISOString() }];
        // ... verify timeline entries
    });
});
```

### E2E Validation (agent-browser)

See main plan — Phase 3: Frontend Heartbeat Dashboard + Phase 4: Mobile Viewport Validation.
