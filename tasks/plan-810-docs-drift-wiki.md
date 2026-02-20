# Plan: #810 — Documentation Drift Fix (Wiki)

## Problem
Several wiki pages are out of date with the current Orchestra application. Missing docs for schedules, projects, and the chat page. Existing assistants and memories pages need updates.

## Strategy

### 1. Update Assistants Page (`wiki/docs/assistants/index.md`)
- Add step-by-step walkthrough for configuring a new assistant from the UI
- Document: creating an assistant, setting instructions (AGENTS.md), attaching tools, selecting models
- Add deployment section (using assistants via API and UI)

### 2. Review & Expand Memories Page (`wiki/docs/memories/index.md`)
- Keep as standalone page (it has enough depth to warrant its own section)
- Add UI walkthrough: how to view, create, edit, delete memories from Settings
- Document relationship to AGENTS.md (which is now stored as a memory)
- Cross-reference with agents-md tutorial

### 3. Create Schedules/Crons Page (`wiki/docs/schedules/index.md`)
- New page documenting the Schedules feature (cron-based task scheduling)
- Document: creating schedules, editing, viewing execution history
- Add to Core Features in sidebar

### 4. Create Projects Page (`wiki/docs/projects/index.md`)
- New page documenting the Projects feature
- Document: creating projects, associating threads, project-scoped conversations
- Add to Core Features in sidebar

### 5. Create Chat Page Documentation (`wiki/docs/chat/index.md`)
- Document the main `/chat` page
- ChatInput buttons (left to right): BaseToolMenu (+), File Manager (FolderCode), AgentMenu
- Right side: Model badge, Submit/Dictation button
- Document dictation mode (voice recording with VoiceVisualizer)
- Document image paste/drop, queue panel, keyboard shortcuts

### 6. Update Sidebar (`wiki/sidebars.ts`)
- Add "schedules/index", "projects/index", "chat/index" to Core Features category

## Files Changed
- `wiki/docs/assistants/index.md` (update)
- `wiki/docs/memories/index.md` (update)
- `wiki/docs/schedules/index.md` (new)
- `wiki/docs/projects/index.md` (new)
- `wiki/docs/chat/index.md` (new)
- `wiki/sidebars.ts` (update)
