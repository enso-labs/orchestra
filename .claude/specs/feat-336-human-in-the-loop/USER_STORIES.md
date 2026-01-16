# User Stories

## Issue #336: Add Human-In-The-Loop (HITL) Support

### Story 1: Enable HITL for Sensitive Agent Operations
**As a** platform administrator,
**I want** to configure human approval requirements for specific agent tools,
**So that** sensitive or dangerous operations require explicit user approval before execution.

**Acceptance Criteria:**
- [ ] Agent configuration supports `interrupt_on` parameter to specify which tools require human approval
- [ ] Supported decision types include: approve, edit, and reject
- [ ] Configuration can be applied at both the main agent and subagent levels
- [ ] System properly integrates with a checkpointer for state persistence during interrupts

### Story 2: Handle HITL Interrupts in Chat Flow
**As a** chat platform user,
**I want** to receive notifications when an agent action requires my approval,
**So that** I can review, modify, or reject proposed operations before they execute.

**Acceptance Criteria:**
- [ ] When an agent triggers a HITL interrupt, the user is notified with clear information about the pending action
- [ ] User can view the tool name, arguments, and a description of what the action will do
- [ ] User interface provides buttons/options to approve, edit, or reject the action
- [ ] After user decision, the agent properly resumes execution with the chosen action

### Story 3: Resume Interrupted Agent Sessions
**As a** user returning to an interrupted conversation,
**I want** to resume where I left off and complete pending approvals,
**So that** my workflow isn't lost when I step away during a HITL interrupt.

**Acceptance Criteria:**
- [ ] Checkpointer persists interrupt state using thread_id
- [ ] Returning to a conversation with pending interrupts shows the approval request
- [ ] System supports `Command(resume=...)` pattern for continuing after decisions
- [ ] Multiple pending tool calls can be batched and presented together

### Story 4: Configure HITL via API
**As a** developer integrating with the Orchestra API,
**I want** to configure HITL settings when creating or updating agents,
**So that** I can programmatically control which operations require human oversight.

**Acceptance Criteria:**
- [ ] API endpoint accepts HITL configuration in agent creation/update requests
- [ ] Configuration schema matches deepagents `interrupt_on` parameter structure
- [ ] API returns proper validation errors for invalid HITL configurations
- [ ] HITL settings are persisted with agent configuration in the database

### Story 5: Edit Tool Arguments Before Execution
**As a** user reviewing a HITL interrupt,
**I want** to modify the tool arguments before approving execution,
**So that** I can correct mistakes or adjust parameters without rejecting the entire operation.

**Acceptance Criteria:**
- [ ] Edit decision type is supported in the HITL flow
- [ ] User interface allows modification of tool arguments
- [ ] Modified arguments are validated before execution
- [ ] Agent receives and uses the edited arguments correctly

## Technical Notes

### Dependencies
- `deepagents` package with `create_deep_agent` function
- `langgraph` for checkpointing (MemorySaver for dev, PostgresSaver for production)
- `langgraph.types.Command` for resume functionality

### Key Implementation Patterns
```python
# Configuration example
interrupt_on = {
    "dangerous_tool": {
        "allowed_decisions": ["approve", "edit", "reject"]
    }
}

# Interrupt handling
if result.get("__interrupt__"):
    interrupts = result["__interrupt__"][0].value
    action_requests = interrupts["action_requests"]
    # Present to user and collect decision
    result = agent.invoke(Command(resume={"decisions": decisions}), config)
```

### Edge Cases
- Handle timeout of HITL requests (user doesn't respond)
- Multiple concurrent HITL requests on the same thread
- Subagent HITL configuration inheritance/override
- Network failures during interrupt/resume cycle

## Related Issues
- Main Issue: #336 - Implementing Human-In-The-Loop support
- First Use Case: #635 - Initial HITL implementation ticket
