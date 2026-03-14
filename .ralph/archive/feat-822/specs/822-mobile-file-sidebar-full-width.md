# Spec: File system sidebar should open full-width on mobile devices (#822)

## Overview

On mobile devices (< 768px viewport), the file system sidebar tree in the `FileEditorPanel` is too narrow to read file names. The sidebar should expand to full horizontal width on mobile viewports, while remaining its normal resizable width on desktop.

---

## Key Files

- `frontend/src/components/panels/FileEditorPanel.tsx` — Panel layout with `<Panel>` resize config
- `frontend/src/components/panels/FileTree/FileTreeSidebar.tsx` — Sidebar component

## Current State

- **Panel config**: `FileEditorPanel` uses `react-resizable-panels` with the sidebar `<Panel>` at `defaultSize={20}`, `minSize={15}`, `maxSize={35}`
- **Mobile**: No responsive overrides exist — the sidebar stays at 20% width on all viewports, making file names unreadable on small screens
- **Collapse**: The sidebar is collapsible (`collapsible`, `collapsedSize={0}`) with a toggle button

---

## User Stories

### US-001: Full-width sidebar on mobile

**As a** mobile user viewing files in Orchestra,
**I want** the file system sidebar to open at full horizontal width on mobile viewports,
**So that** I can read file names and navigate the tree without rotating my device.

#### Acceptance Criteria

- [ ] On mobile viewports (< 768px), the file tree sidebar panel opens at full width (100% of the panel group)
- [ ] On desktop viewports (≥ 768px), the sidebar retains its current sizing (`defaultSize={20}`, `minSize={15}`, `maxSize={35}`)
- [ ] When the sidebar is open full-width on mobile, the editor panel is effectively hidden behind it
- [ ] The user can still collapse the sidebar on mobile to return to the editor view
- [ ] Typecheck passes (`npx tsc --noEmit` from `frontend/`)
- [ ] Lint passes (`npm run lint` from `frontend/`)

#### Implementation Notes

- Use a `useMediaQuery` hook or `window.matchMedia('(max-width: 767px)')` to detect mobile
- On mobile, override `<Panel>` props: `defaultSize={100}`, `minSize={100}`, `maxSize={100}` (or equivalent approach)
- Alternatively, conditionally render the sidebar as a full-screen overlay on mobile instead of a resizable panel
- The resize handle between sidebar and editor can be hidden on mobile since the sidebar is full-width
- Ensure the collapse/expand toggle still works on mobile to switch between file tree and editor views
