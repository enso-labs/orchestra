# Spec 007: Heartbeat System

## Problem

Orchestra agents can be scheduled via cron, but lack a proactive polling mechanism. OpenClaw's heartbeat pattern — periodic batched checks against a user-maintained checklist — is the highest-value missing feature. All infrastructure exists (memory files, agent execution, TaskIQ). The gap is the configuration schema, polling/dispatch service, and HEARTBEAT.md seeding.

## Dependencies

- Spec 006 (execution history) — heartbeat runs create execution records

## Changes

### 1. HeartbeatConfig schema

**File:** `backend/src/schemas/entities/assistant.py` (or wherever assistant config lives)

```python
class HeartbeatConfig(BaseModel):
    enabled: bool = False
    every: str = "30m"           # "15m"|"30m"|"1h"|"2h"|"4h"
    active_hours_start: str | None = None  # "08:00" (24h format)
    active_hours_end: str | None = None    # "22:00"
    timezone: str = "UTC"
```

Add `heartbeat: HeartbeatConfig | None = None` to the assistant entity schema.

### 2. Heartbeat execution service

**File:** `backend/src/services/heartbeat.py` (new)

```python
async def heartbeat_invoke(user_id: str, assistant_id: str):
    """APScheduler callback for heartbeat interval jobs."""
    # 1. Check active hours (timezone-aware) — skip if outside window
    # 2. Read user's HEARTBEAT.md via MemoryService
    # 3. If empty/blank, log skip, create execution(status='skipped'), return
    # 4. Construct LLMRequest with heartbeat system prompt:
    #    "Review HEARTBEAT.md. If nothing needs attention, respond HEARTBEAT_OK."
    # 5. Dispatch via run_agent_stream.kiq()
    # 6. Create schedule_execution record (status='skipped' if HEARTBEAT_OK)
```

Key behaviors:
- **Active hours check**: Parse `active_hours_start`/`end` with `timezone`, compare to current time. If outside window, skip.
- **Empty HEARTBEAT.md**: Don't waste tokens — log and skip.
- **HEARTBEAT_OK suppression**: If agent response is exactly "HEARTBEAT_OK", mark execution as `skipped` (no notification).

### 3. APScheduler job management on assistant create/update

**File:** `backend/src/services/assistant.py`

When an assistant is created or updated:
- If `heartbeat.enabled` is True, create/update APScheduler interval job with `heartbeat_invoke` as the callback
- Parse `every` field to interval seconds: `{"15m": 900, "30m": 1800, "1h": 3600, "2h": 7200, "4h": 14400}`
- Job ID format: `heartbeat:{assistant_id}`
- If `heartbeat.enabled` is False (or heartbeat is None), remove the APScheduler job if it exists

### 4. Seed HEARTBEAT.md in default memories

**File:** `backend/src/constants/default_memories.py`

Add to `DEFAULT_MEMORIES`:

```python
{
    "key": "HEARTBEAT.md",
    "value": {
        "content": "# HEARTBEAT.md - Proactive Task Checklist\n# Keep empty to skip heartbeat checks and save tokens.\n# Add periodic tasks below:\n",
        "name": "HEARTBEAT.md",
    }
}
```

### 5. Frontend heartbeat config UI

**Files:**
- Agent detail/edit page component — add heartbeat section
- Heartbeat toggle (enabled/disabled)
- Interval picker dropdown (15m, 30m, 1h, 2h, 4h)
- Active hours range inputs (start time, end time)
- Timezone selector

## Files Modified

- `backend/src/schemas/entities/assistant.py` (modified — add HeartbeatConfig)
- `backend/src/services/heartbeat.py` (new)
- `backend/src/services/assistant.py` (modified — sync APScheduler on CRUD)
- `backend/src/constants/default_memories.py` (modified — add HEARTBEAT.md)
- Frontend agent detail component (modified — add heartbeat config UI)

## Verification

```bash
# Enable heartbeat on an agent, populate HEARTBEAT.md
# Wait for interval — verify execution record created
# Empty HEARTBEAT.md — verify skip
# Set active hours to exclude current time — verify skip
# Disable heartbeat — verify APScheduler job removed
make test
```
