# Validation Plan: File Persistence Feature (US-001 through US-011)

## Context
The Ralph run completed 11 user stories implementing **file persistence across chat sessions**. Files added to the sandbox editor can now be saved as defaults and auto-restored on new conversations. This plan validates the full end-to-end flow using the `agent-browser` skill against the local dev server at `http://localhost:5173`. Requires backend (`make dev`) and frontend (`npm run dev`) running.

## What We're Validating
- Files added in the editor persist after starting a new chat
- The persist toggle in the composer enables/disables the feature
- The settings page shows file persistence controls
- Files survive a full page reload

## Validation Steps (agent-browser)

### Step 1: Start agent-browser server
```bash
cd skills/agent-browser && npm run start-server &
```

### Step 2: Navigate to app and authenticate
1. `page.goto("http://localhost:5173")` — navigate to the app
2. Take screenshot to assess login state
3. If login required, authenticate (use AI snapshot to find login elements)

### Step 3: Enable file persistence
1. Click the **"Persist"** button in the composer row (look for button with text "Persist" and `HardDrive` icon)
2. Verify it turns **green** (border-green-500/60, text-green-500) — screenshot to confirm
3. Alternative: Go to Settings page, find "File Persistence" card, toggle the switch ON

### Step 4: Ask the agent to write data to a file (Thread 1)
1. In the chat composer, type a prompt asking the agent to create a file with specific data, e.g.:
   > "Create a file called /test-persistence.txt with the content: `The secret code is ALPHA-7742`"
2. Wait for the agent to process and create the file
3. Click the **"Files"** button to open the editor panel and verify the file was created with the correct content
4. Wait ~2 seconds for the debounced auto-sync to fire (1000ms debounce)
5. Screenshot to confirm file exists with expected content

### Step 5: Start a new chat (Thread 2)
1. Click the **"New Chat"** button (Plus icon, title="New Chat") in the top bar
2. Wait for navigation and `loadInitialFiles()` to complete
3. Screenshot the page

### Step 6: Ask the agent to read the persisted file (Thread 2)
1. In the new chat composer, type a prompt asking the agent to read the file, e.g.:
   > "What is the content of /test-persistence.txt? What is the secret code?"
2. Wait for the agent to respond
3. Verify the agent's response contains `The secret code is ALPHA-7742` — proving the file persisted across sessions
4. Screenshot the agent's response as proof

### Step 7: Verify via Files panel (Thread 2)
1. Click the **"Files"** button to open the editor panel
2. Verify `/test-persistence.txt` appears in the file tree
3. Click on it and verify the content matches what was written in Thread 1
4. Screenshot as proof

### Step 8: Verify settings page
1. Navigate to Settings page
2. Find the **"File Persistence"** card
3. Verify the switch is ON
4. Verify it shows **"1 saved file(s)"** (or appropriate count)
5. Screenshot as proof

### Step 9: Cleanup (via UI file panel editor only)
1. Open the **Files** panel in the editor
2. Delete the test file `/test-persistence.txt` using the file tree context menu (right-click > Delete) or the delete action in the editor
3. Go to Settings > File Persistence > Click **"Clear saved files"** to clear backend-persisted copies
4. Toggle persistence OFF
5. Verify file count shows 0

**Important**: All file creation, editing, and deletion must happen through the UI file panel editor — never by editing the filesystem directly.

## Key UI Selectors (for agent-browser ARIA snapshots)
| Element | Identifier |
|---|---|
| Persist toggle (composer) | Button with text "Persist" |
| Files button (composer) | Button with text "Files" |
| New Chat button | Button with title "New Chat" |
| New File button | Plus icon button in file tree header |
| Create File dialog | Input for file path + "Create" button |
| Settings persist toggle | Switch with aria-label "Toggle file persistence" |
| Clear saved files | Button with text "Clear saved files" |

## Critical Files
- `frontend/src/components/status/ThreadPersistFilesToggle.tsx` — persist toggle
- `frontend/src/components/chat/ChatComposer.tsx` — composer layout
- `frontend/src/components/panels/FileEditorPanel.tsx` — file editor
- `frontend/src/components/settings/FilePersistenceSettings.tsx` — settings card
- `frontend/src/context/ChatContext.tsx` — persistence logic
- `backend/src/routes/v0/settings.py` — API endpoints

## Success Criteria
- Agent writes file with known data in Thread 1 (Step 4)
- Agent reads and correctly reports the same data in Thread 2 (Step 6) — proving cross-session persistence
- File is visible in the Files panel in Thread 2 (Step 7)
- Persist toggle shows green/enabled state
- Settings page reflects correct file count
- No console errors or failed API calls during the flow
