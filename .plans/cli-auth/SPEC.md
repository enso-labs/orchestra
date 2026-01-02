# CLI Authentication Implementation Plan

## Overview

Implement API token authentication for the Orchestra CLI (`ruska` command). Users will authenticate via `ruska auth` which prompts for an API key and host URL, storing credentials in `~/.ruska/auth.json` for subsequent authenticated requests.

## Context

### Backend API Reference

The backend supports API key authentication via `x-api-key` header:
- **Token Format**: `otk_{32-char-urlsafe-token}` (e.g., `otk_abc123...`)
- **Authentication**: `backend/src/utils/auth.py:90-131` - `verify_credentials()` checks `x-api-key` header first, then falls back to Bearer token
- **Token Management**: `backend/src/routes/v0/api_tokens.py` provides CRUD endpoints:
  - `GET /api/tokens` - List user's API tokens (requires auth)
  - `POST /api/tokens` - Create new API token (requires auth)
  - `DELETE /api/tokens/{token_id}` - Revoke token

### Current CLI Structure

```
cli/
├── source/
│   ├── cli.tsx      # Entry point with meow CLI parser
│   └── app.tsx      # React-Ink TUI application
├── package.json     # Name: "shell", dependencies: ink, meow, react
└── tsconfig.json    # Extends @sindresorhus/tsconfig
```

### CLI Technology Stack
- **Framework**: React-Ink (React for terminal UIs)
- **CLI Parser**: meow
- **Full-screen**: fullscreen-ink

## Requirements

1. **Auth Command**: `ruska auth` prompts for API key and host URL
2. **Config Storage**: Save to `~/.ruska/auth.json`
3. **Multi-Environment**: Support switching between prod/dev/self-hosted APIs
4. **Reusable Auth**: Export utilities for authenticated API requests
5. **MVP Feature**: Fetch and display assistants list to validate authentication

## Design Decisions

### Config File Format (`~/.ruska/auth.json`)

```json
{
  "apiKey": "otk_...",
  "host": "https://chat.ruska.ai"
}
```

### Default Hosts
- **Production**: `https://chat.ruska.ai`
- **Development**: `http://localhost:8000`

### Project Rename
- Rename from `shell` to `ruska` in package.json for CLI branding consistency

## File Structure (New/Modified)

```
cli/
├── source/
│   ├── cli.tsx              # [MODIFY] Add auth command routing
│   ├── app.tsx              # [EXISTING] TUI app (unchanged)
│   ├── commands/
│   │   ├── auth.tsx         # [NEW] Auth command component
│   │   └── assistants.tsx   # [NEW] List assistants command (MVP validation)
│   ├── lib/
│   │   ├── config.ts        # [NEW] Config file read/write utilities
│   │   └── api.ts           # [NEW] API client with auth header injection
│   └── types/
│       └── index.ts         # [NEW] Type definitions (Config, Assistant, etc.)
├── package.json             # [MODIFY] Rename to ruska, add dependencies
└── tsconfig.json            # [EXISTING]
```

## Implementation Details

### 1. Config Module (`lib/config.ts`)

```typescript
// Key functions:
getConfigPath(): string        // Returns ~/.ruska/auth.json
loadConfig(): Promise<Config | null>
saveConfig(config: Config): Promise<void>
clearConfig(): Promise<void>
```

- Use `os.homedir()` for cross-platform home directory
- Use `fs/promises` for async file operations
- Create `~/.ruska` directory if it doesn't exist

### 2. API Client (`lib/api.ts`)

```typescript
// Key functions:
createApiClient(config: Config): ApiClient
fetchAssistants(client: ApiClient): Promise<Assistant[]>
validateApiKey(host: string, apiKey: string): Promise<boolean>
```

- Use native `fetch` (Node 18+) or add `node-fetch` dependency
- Inject `x-api-key` header for all authenticated requests
- Base URL from config host

### 3. Auth Command (`commands/auth.tsx`)

Interactive prompts:
1. **API Key**: Text input (masked/hidden for security)
2. **Host URL**: Select from presets OR custom input
   - Production (https://chat.ruska.ai)
   - Development (http://localhost:8000)
   - Custom...

Flow:
1. Prompt for host selection
2. Prompt for API key
3. Validate API key by calling `GET /api/auth/user`
4. On success: Save config and display confirmation
5. On failure: Display error and prompt to retry

### 4. CLI Entry Point Updates (`cli.tsx`)

Add command routing:
```typescript
// Commands:
// ruska auth       - Configure authentication
// ruska assistants - List assistants (MVP)
// ruska --ui       - Launch TUI (existing)
```

### 5. Assistants Command (`commands/assistants.tsx`)

MVP feature to validate authentication works:
```typescript
// Calls: POST /api/assistants/search
// Body: { filter: {} }
// Headers: { "x-api-key": config.apiKey }
// Displays: List of assistant names/IDs
```

## Dependencies to Add

```json
{
  "dependencies": {
    "ink-text-input": "^6.0.0"  // For API key input
  }
}
```

## Implementation Checklist

- [ ] **1. Project Setup**
  - [ ] 1.1 Rename package from "shell" to "ruska" in package.json
  - [ ] 1.2 Update bin entry to "ruska"
  - [ ] 1.3 Add `ink-text-input` dependency

- [ ] **2. Type Definitions** (`source/types/index.ts`)
  - [ ] 2.1 Define `Config` interface (apiKey, host)
  - [ ] 2.2 Define `Assistant` interface (from backend schema)
  - [ ] 2.3 Define `ApiResponse` types

- [ ] **3. Config Module** (`source/lib/config.ts`)
  - [ ] 3.1 Implement `getConfigPath()`
  - [ ] 3.2 Implement `loadConfig()` with error handling
  - [ ] 3.3 Implement `saveConfig()` with directory creation
  - [ ] 3.4 Implement `clearConfig()`

- [ ] **4. API Client** (`source/lib/api.ts`)
  - [ ] 4.1 Implement base API client with auth header injection
  - [ ] 4.2 Implement `validateApiKey()` using GET /api/auth/user
  - [ ] 4.3 Implement `fetchAssistants()` using POST /api/assistants/search

- [ ] **5. Auth Command** (`source/commands/auth.tsx`)
  - [ ] 5.1 Create host selection UI (production/dev/custom)
  - [ ] 5.2 Create API key input with masking
  - [ ] 5.3 Implement validation flow with user feedback
  - [ ] 5.4 Save config on successful validation
  - [ ] 5.5 Display success/error messages

- [ ] **6. Assistants Command** (`source/commands/assistants.tsx`)
  - [ ] 6.1 Load config and check authentication
  - [ ] 6.2 Fetch assistants from API
  - [ ] 6.3 Display assistants in formatted table/list

- [ ] **7. CLI Entry Point** (`source/cli.tsx`)
  - [ ] 7.1 Add command argument parsing (auth, assistants)
  - [ ] 7.2 Route to appropriate command component
  - [ ] 7.3 Update help text with new commands

- [ ] **8. Testing**
  - [ ] 8.1 Test auth flow with valid API key
  - [ ] 8.2 Test auth flow with invalid API key
  - [ ] 8.3 Test assistants command after authentication
  - [ ] 8.4 Test config persistence across sessions

- [ ] **9. Documentation**
  - [ ] 9.1 Update cli/README.md with new commands
