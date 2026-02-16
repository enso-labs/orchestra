# PRD: Fix Model Select Validation on Assistant Create/Edit (#771)

## Introduction

The ModelSelect component on the assistant create and edit pages does not sync its selected value back to the react-hook-form field, causing a validation error ("Model must be at least 2 characters") that prevents form submission. This broke after merging PR #767.

## Goals

- Fix model selection so it writes to the form field and passes validation
- Ensure both create and edit flows work end-to-end
- Maintain backward compatibility with all other SelectModel usages (chat, etc.)

## User Stories

### US-001: Wire SelectModel value into react-hook-form
**Description:** As a user, I want to select a model from the dropdown on the assistant create page and have the form accept my selection without validation errors.

**Acceptance Criteria:**
- [ ] When a model is selected via SelectModel, the form's `model` field is updated with the selected value
- [ ] Form validation passes after selecting a model
- [ ] Clicking Save after filling all required fields (including model) successfully creates the assistant
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill: navigate to `/assistant/create`, fill form, select model, submit succeeds

### US-002: Fix model pre-population on assistant edit page
**Description:** As a user editing an existing assistant, I want to see the currently configured model pre-selected and be able to change it without validation errors.

**Acceptance Criteria:**
- [ ] When editing an assistant, the SelectModel dropdown shows the assistant's current model as selected
- [ ] The form's `model` field is populated with the existing model value on load
- [ ] Changing the model and saving persists the new selection
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill: navigate to an existing assistant's edit page, verify model shown, change it, save succeeds

## Functional Requirements

- FR-1: SelectModel must accept a callback or ref that writes the selected value into the parent form's field (e.g., via `form.setValue("model", value)` or a controlled `value`/`onChange` prop pattern)
- FR-2: The `agent-create-form.tsx` FormField for `model` must sync SelectModel's selection to react-hook-form state
- FR-3: On edit, `form.setValue("model", agent.model)` must run on load so the field is pre-populated

## Non-Goals

- No changes to the model list or model fetching logic
- No changes to the assistant API endpoints
- No refactoring of SelectModel for standalone/non-context usage (that's #772)

## Technical Considerations

- `SelectModel` currently uses `useChatContext()` internally for state — the fix needs to bridge that context state to the form field
- Simplest approach: add an `onChange` callback prop to `SelectModel` that fires with the selected value, and use it in the form to call `form.setValue("model", selectedValue)`
- The existing `onModelSelected` callback has no arguments — either extend it or add a new prop
- Check that the fix works for both create (empty initial) and edit (pre-populated) flows

## Success Metrics

- Users can create and edit assistants with model selection without validation errors
- No regressions in chat model selector behavior
