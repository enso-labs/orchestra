# PRD: Schedule Model Dropdown Selection (#772)

## Introduction

The schedule create/edit page currently requires users to manually type the model key name (e.g., `anthropic:claude-sonnet-4-20250514`) into a text input. This is unintuitive — users shouldn't need to memorize model identifiers. Replace the text input with the existing ModelSelect dropdown component.

## Goals

- Replace the manual model text input with a dropdown on schedule create/edit pages
- Reuse the existing SelectModel component in a standalone mode (outside ChatContext)
- Maintain backward compatibility with existing SelectModel usages in chat

## User Stories

### US-001: Decouple SelectModel from ChatContext
**Description:** As a developer, I need SelectModel to accept model state via props so it can be reused outside of ChatContext (e.g., in schedule forms).

**Acceptance Criteria:**
- [ ] SelectModel accepts optional props: `value` (string), `onChange` (callback), `modelsList` (array)
- [ ] When props are provided, SelectModel uses them instead of `useChatContext()`
- [ ] When props are NOT provided, SelectModel falls back to `useChatContext()` (backward compatible)
- [ ] Existing usages of SelectModel in chat pages continue to work unchanged
- [ ] Typecheck passes

### US-002: Add standalone models list fetcher
**Description:** As a developer, I need a way to fetch available models outside of ChatContext so the schedule form can populate the SelectModel dropdown.

**Acceptance Criteria:**
- [ ] A hook or utility exists to fetch the models list from the `/llm/models` API endpoint
- [ ] Returns the same shape as ChatContext's models array
- [ ] Can be used independently of ChatContext
- [ ] Typecheck passes

### US-003: Replace text input with SelectModel in AgentScheduleForm
**Description:** As a user creating a schedule, I want to select a model from a dropdown instead of typing the model key name manually.

**Acceptance Criteria:**
- [ ] The 'Model' field in `AgentScheduleForm` uses SelectModel component instead of text Input
- [ ] The dropdown shows the same models available in the chat model selector
- [ ] Selected model value is correctly written to the form state (`customModel` field)
- [ ] The agent's current model is shown as placeholder/default when inheriting
- [ ] Model selection persists correctly on form submit
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill: navigate to `/schedules`, create new schedule, verify dropdown works

### US-004: Verify schedule edit loads saved model in dropdown
**Description:** As a user editing an existing schedule, I want the previously selected model to appear pre-selected in the dropdown.

**Acceptance Criteria:**
- [ ] When editing a schedule, the SelectModel dropdown shows the saved model as selected
- [ ] Changing the model and saving persists the new selection
- [ ] Switching between 'Inherit from agent' and custom correctly toggles the dropdown state
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill: edit an existing schedule, verify model shown, change it, save

## Functional Requirements

- FR-1: SelectModel component must support a controlled mode via `value`/`onChange`/`modelsList` props
- FR-2: A `useModels()` hook or similar must fetch from `/llm/models` independently of ChatContext
- FR-3: AgentScheduleForm must use SelectModel with controlled props, connected to react-hook-form's `customModel` field
- FR-4: When `customModel` is empty/null, display placeholder showing the agent's default model

## Non-Goals

- No changes to the schedule backend API
- No changes to the models API endpoint
- No new model filtering or visibility logic for schedules

## Technical Considerations

- `SelectModel` is at `frontend/src/components/lists/SelectModel.tsx`
- It currently imports `useChatContext` for `model`, `setModel`, `models` and `useModelVisibility` for filtering
- Schedule form is at `frontend/src/components/forms/AgentScheduleForm.tsx` — the model Input is around line ~506
- The form uses react-hook-form with `register('customModel')`
- Pattern: add optional controlled props, fall back to context when not provided

## Success Metrics

- Users can select a model from a dropdown when creating/editing schedules
- No regressions in existing chat model selector behavior
- Zero need to manually type model identifiers
