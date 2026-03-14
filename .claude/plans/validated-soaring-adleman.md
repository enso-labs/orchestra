# Plan: Add Epics to Issue #821 Description

## Context

Issue #821 (`feat(docs): Add screenshots for visual walkthrough in wiki documentation`) lists pages that need screenshots added to the wiki docs. Currently it covers: Assistants, Memories, Schedules, Projects, and Chat Page. However, **Epics** is a fully-featured module in the app (with index page, detail page, task management, create modals) and is missing from the issue.

There is also no wiki docs page for Epics yet (`wiki/docs/epics/` does not exist), unlike the other features listed.

## What needs to change

**Update issue #821 body** to add an Epics bullet matching the existing format:

Current list:
- Assistants (`/docs/assistants`)
- Memories (`/docs/memories`)
- Schedules (`/docs/schedules`)
- Projects (`/docs/projects`)
- Chat Page (`/docs/chat`)

Add:
- **Epics** (`/docs/epics`) — screenshots of epic creation, epic grid view, task management within an epic, and task status updates

Also add a corresponding acceptance criterion:
- `[ ] Screenshots captured from chat.ruska.ai for the Epics feature (index + detail pages)`

## Implementation

1. Run `gh issue edit 821` with the updated body that includes the Epics entry in both the Summary list and Acceptance Criteria.

## Key files reference (for screenshot context)

- Epic index page (grid view): `frontend/src/pages/epics/index.tsx`
- Epic detail page (tasks): `frontend/src/pages/epics/EpicDetailPage.tsx`
- Create epic modal: `frontend/src/components/modals/CreateEpicModal.tsx`
- Create task modal: `frontend/src/components/modals/CreateTaskModal.tsx`

## Verification

- Confirm the updated issue at https://github.com/ruska-ai/orchestra/issues/821 shows Epics in both the summary list and acceptance criteria.
