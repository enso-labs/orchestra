# Render Subagent Tool Calls in the UI

## Context

The backend already streams subagent messages with `lc_agent_name` metadata (via `subgraphs=True` in LangGraph). The `handle_multi_mode()` function detects `lc_agent_name` but only logs it — it doesn't include it in the serialized output. The frontend has no concept of subagent attribution.

## Step 1: Preserve lc_agent_name in Backend Serialization

**File**: `backend/src/utils/stream.py` — `handle_multi_mode()`

Currently `_to_dict(msg)` serializes the message but `lc_agent_name` may not survive. Ensure:
- The `lc_agent_name` field is preserved in the dict output
- If not present on the message itself, extract from the chunk metadata and inject it

```python
if agent_name := dict(msg).get("lc_agent_name"):
    msg_dict = _to_dict(msg)
    msg_dict["agent_name"] = agent_name  # explicit field
    return (i0, (msg_dict, i1[1] or None))
```

Also check `_to_dict()` — if using `.model_dump()`, `lc_agent_name` might be in `additional_kwargs` or a custom field.

**File**: `backend/src/utils/messages.py` — `from_message_to_dict()`

Ensure `agent_name` / `lc_agent_name` survives the values-mode serialization too (for checkpoint reload).

## Step 2: Extract agent_name in Frontend Stream Handler

**File**: `frontend/src/hooks/useChat.ts` — `handleMessages()`

In the `streamMode === "messages"` branch, extract `agent_name` from the response:

```ts
const response = payload[1][0];
const agentName = response.agent_name || response.lc_agent_name || null;
// Attach to the response object so it flows into StreamMessageHandler
if (agentName) response.agent_name = agentName;
```

## Step 3: Propagate agent_name Through StreamMessageHandler

**File**: `frontend/src/lib/utils/message.ts`

In `processResponse()`, `toolCall()`, `messageCreate()`, and `messageUpdate()` — ensure `agent_name` is preserved on the history entry:

```ts
public messageCreate(response: any, expectedContent: string) {
    this.history.push({
        ...response,
        content: expectedContent,
        agent_name: response.agent_name || null,
    });
}
```

## Step 4: Preserve agent_name in formatMessages()

**File**: `frontend/src/lib/utils/format.ts`

In `formatMessages()`, ensure the `agent_name` field passes through all branches (user, assistant, tool, AIMessageChunk):

```ts
messageCopy = {
    ...messageCopy,
    agent_name: message.agent_name || null,
    // ... rest of fields
};
```

## Step 5: Create SubagentBadge Component

**File**: `frontend/src/components/badges/SubagentBadge.tsx` (new)

Simple badge showing the subagent name:

```tsx
export function SubagentBadge({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-1.5 mb-1">
            <Bot className="h-3 w-3 text-primary/60" />
            <span className="text-xs font-medium text-primary/60">{name}</span>
        </div>
    );
}
```

## Step 6: Render Subagent Attribution in ChatMessages

**File**: `frontend/src/components/lists/ChatMessages.tsx`

For assistant/AI messages with `agent_name`, render the SubagentBadge above the message content:

```tsx
{message.agent_name && <SubagentBadge name={message.agent_name} />}
```

Optionally add subtle visual nesting (left border or slight indent) for subagent messages.

## Step 7: Render Subagent Attribution in ToolTimeline

**File**: `frontend/src/components/timeline/ToolTimelineItem.tsx`

Show agent_name in the tool call header next to the tool name badge:

```tsx
{message.agent_name && (
    <span className="text-xs text-muted-foreground font-medium">
        via {message.agent_name}
    </span>
)}
```

## Step 8: Tests & Validation

- Add test for `formatMessages` preserving `agent_name`
- Verify with agent-browser using a multi-agent thread
- Verify checkpoint-loaded threads show subagent attribution

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/utils/stream.py` | Modify | Preserve `lc_agent_name` as `agent_name` in serialized output |
| `backend/src/utils/messages.py` | Modify | Preserve `agent_name` in message dict conversion |
| `frontend/src/hooks/useChat.ts` | Modify | Extract `agent_name` from streamed chunks |
| `frontend/src/lib/utils/message.ts` | Modify | Propagate `agent_name` through history entries |
| `frontend/src/lib/utils/format.ts` | Modify | Preserve `agent_name` through formatMessages |
| `frontend/src/components/badges/SubagentBadge.tsx` | New | Subagent name badge component |
| `frontend/src/components/lists/ChatMessages.tsx` | Modify | Render SubagentBadge for subagent messages |
| `frontend/src/components/timeline/ToolTimelineItem.tsx` | Modify | Show subagent attribution on tool calls |
