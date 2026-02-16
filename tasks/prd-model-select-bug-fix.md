# PRD: Fix Model Select on Assistant Create/Edit Pages

## Introduction

The model select component on the assistant create and edit pages is preventing form submission. After merging PR #767, users can no longer create or edit assistants because selecting a model triggers a validation error ("Model must be at least N characters"). This is a regression bug that blocks core functionality.

## Goals

- Fix the model select validation so assistants can be created and edited successfully
- Ensure the selected model value is correctly passed to the form state
- Maintain existing model selection UX without regression

## User Stories

### US-001: Investigate model select form binding
**Description:** As a developer, I need to understand why the model select value isn't satisfying form validation so I can identify the root cause.

**Acceptance Criteria:**
- [ ] Identify the component(s) responsible for model selection on assistant create/edit pages
- [ ] Determine what changed in PR #767 that caused the regression
- [ ] Document the root cause (e.g., value format mismatch, missing onChange handler, schema change)

### US-002: Fix model select form submission on assistant create
**Description:** As a user, I want to select a model and successfully create an assistant so I can use the platform.

**Acceptance Criteria:**
- [ ] Navigate to `/assistant/create`, fill in form details, select a model, and click save
- [ ] Form submits successfully without validation errors
- [ ] Created assistant has the correct model assigned
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-003: Fix model select form submission on assistant edit
**Description:** As a user, I want to edit an existing assistant's model and save successfully.

**Acceptance Criteria:**
- [ ] Navigate to an existing assistant's edit page
- [ ] Current model is shown as selected
- [ ] Change the model and save — no validation errors
- [ ] Updated assistant reflects the new model
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-004: Verify no regression on other form fields
**Description:** As a user, I want all other assistant form fields to continue working after the fix.

**Acceptance Criteria:**
- [ ] All other fields on create/edit pages submit correctly
- [ ] No new console errors or warnings
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Model select component must pass the selected value in the format expected by form validation schema
- FR-2: Form validation must accept valid model selections without character-length errors
- FR-3: Model select must work on both `/assistant/create` and `/assistant/[id]/edit` pages
- FR-4: Previously saved assistants must display their current model correctly when editing

## Non-Goals

- No changes to the list of available models
- No redesign of the model select UI
- No changes to backend model validation

## Technical Considerations

- Regression introduced by PR #767 — review that diff for changes to model select or form schema
- Check if the model select component is passing an object vs a string value
- Check form validation schema (likely Zod) for model field constraints
- Assistant create and edit pages are in the `@frontend` package

## Success Metrics

- Users can create and edit assistants with any available model without validation errors
- Zero regression on existing assistant form functionality

## Open Questions

- Did PR #767 change the model select component itself, the form schema, or both?
- Are there any other select components affected by the same issue?
