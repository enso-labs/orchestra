# Plan: Implement React Joyride for User Onboarding

## Context

New users must repeatedly check docs.ruska.ai to learn the UI, which creates friction. This change bakes onboarding directly into the interface using React Joyride guided tours. First-time users get an automatic walkthrough; returning users can re-trigger it via a help (?) button.

## Architecture

### New Files
1. **`frontend/src/context/OnboardingContext.tsx`** - Context provider managing tour state (`run`, `stepIndex`, callbacks)
2. **`frontend/src/hooks/useOnboarding.ts`** - Hook exposing `startTour()`, `isComplete`, tour state
3. **`frontend/src/lib/config/onboardingSteps.ts`** - Step definitions (targets, content, placement)
4. **`frontend/src/components/buttons/HelpButton.tsx`** - `?` icon button to re-trigger tour

### Modified Files
1. **`frontend/package.json`** - Add `react-joyride` dependency
2. **`frontend/src/main.tsx`** - Wrap with `OnboardingProvider` (inside existing providers so it can access auth/settings)
3. **`frontend/src/layouts/chat-layout-v2.tsx`** - Render `<Joyride>` component here (wraps sidebar + main content)
4. **`frontend/src/components/nav/ChatNav.tsx`** - Add `HelpButton` to the nav bar actions
5. **`frontend/src/components/drawers/app-sidebar.tsx`** - Add `data-tour` attributes to key sidebar elements
6. **`frontend/src/pages/chat/ChatPanel.tsx`** - Add `data-tour` attributes to chat input area
7. **`backend/src/schemas/entities/settings.py`** - Add `onboarding_completed: Optional[bool]` field to `UserSettings`, `DefaultsResponse`, `PatchDefaultsRequest`
8. **`frontend/src/lib/services/userSettingsService.ts`** - Add `onboarding_completed` to TypeScript interfaces

## Implementation Steps

### Step 1: Install react-joyride
```bash
cd frontend && npm install react-joyride
```

### Step 2: Backend - Add `onboarding_completed` to settings
**File: `backend/src/schemas/entities/settings.py`**
- Add `onboarding_completed: Optional[bool] = Field(default=None)` to `UserSettings`
- Add `onboarding_completed: Optional[bool] = None` to `DefaultsResponse`
- Add `onboarding_completed: Optional[bool] = Field(default=None)` to `PatchDefaultsRequest`

No migration needed - settings use LangGraph BaseStore (key-value), not SQL tables.

### Step 3: Frontend - Update settings service types
**File: `frontend/src/lib/services/userSettingsService.ts`**
- Add `onboarding_completed: boolean | null` to `DefaultsResponse` interface
- Add `onboarding_completed` to `patchDefaults` data type

### Step 4: Create onboarding steps config
**File: `frontend/src/lib/config/onboardingSteps.ts`**

Define tour steps targeting key UI elements via `data-tour` selectors:

| Step | Target | Content |
|------|--------|---------|
| 1 | `[data-tour="sidebar"]` | Welcome! This is your sidebar - navigate between Assistants, Memories, Projects, and Threads |
| 2 | `[data-tour="assistants-link"]` | Browse and manage your AI assistants here |
| 3 | `[data-tour="memories-link"]` | Store persistent context that your assistants can reference |
| 4 | `[data-tour="projects-section"]` | Organize your work into projects with sources |
| 5 | `[data-tour="threads-section"]` | Your conversation history lives here |
| 6 | `[data-tour="chat-input"]` | Type your message here to start chatting |
| 7 | `[data-tour="chat-nav-actions"]` | Save assistants, share threads, start new conversations, and toggle themes |
| 8 | `[data-tour="settings-popover"]` | Access your settings and preferences |
| 9 | `[data-tour="help-button"]` | Click here anytime to replay this tour |

### Step 5: Create OnboardingContext
**File: `frontend/src/context/OnboardingContext.tsx`**

- State: `run` (boolean), `stepIndex` (number)
- On mount: fetch user settings, check `onboarding_completed`
  - If `false`/`null` → auto-start tour (`run = true`)
  - If `true` → do nothing
- Callback handler: on `TOUR_END` or `SKIP` → call `patchDefaults({ onboarding_completed: true })`
- Expose `startTour()` for the help button to re-trigger
- Use **controlled mode** (`run` + `stepIndex` + `callback`) for full lifecycle control
- Style tooltips to match dark theme (use Joyride's `styles` prop with CSS variable colors)

### Step 6: Add data-tour attributes to UI components

**`frontend/src/components/drawers/app-sidebar.tsx`:**
- `<Sidebar>` → add `data-tour="sidebar"`
- Assistants `<Link>` → add `data-tour="assistants-link"`
- Memories `<Link>` → add `data-tour="memories-link"`
- Projects `<Collapsible>` → add `data-tour="projects-section"`
- Threads `<Collapsible>` → add `data-tour="threads-section"`
- `<SettingsPopover>` wrapper → add `data-tour="settings-popover"`

**`frontend/src/components/nav/ChatNav.tsx`:**
- Actions `<div>` → add `data-tour="chat-nav-actions"`

**`frontend/src/pages/chat/ChatPanel.tsx`:**
- Chat input area → add `data-tour="chat-input"`

### Step 7: Create HelpButton component
**File: `frontend/src/components/buttons/HelpButton.tsx`**

- Renders a `?` icon button (using `HelpCircle` from lucide-react)
- Same styling as other nav buttons (`variant="outline"`, `size="icon"`, `h-9 w-9`)
- `onClick` → calls `startTour()` from OnboardingContext
- Add `data-tour="help-button"` attribute

### Step 8: Wire into ChatNav
**File: `frontend/src/components/nav/ChatNav.tsx`**
- Import and add `<HelpButton />` to the actions row (before the theme toggle)

### Step 9: Mount Joyride in ChatLayout
**File: `frontend/src/layouts/chat-layout-v2.tsx`**
- Import Joyride and useOnboarding
- Render `<Joyride>` with controlled props from context
- Configure: `continuous`, `showSkipButton`, `showProgress`, `disableOverlayClose`, `spotlightClicks`

### Step 10: Wrap with OnboardingProvider
**File: `frontend/src/main.tsx`**
- Add `<OnboardingProvider>` inside `<ChatProvider>` (needs access to auth for settings API calls)

## Joyride Configuration

```tsx
<Joyride
  steps={onboardingSteps}
  run={run}
  stepIndex={stepIndex}
  continuous
  showSkipButton
  showProgress
  disableOverlayClose={false}
  spotlightClicks
  callback={handleJoyrideCallback}
  styles={{
    options: {
      zIndex: 10000,
      primaryColor: 'hsl(var(--primary))',
      backgroundColor: 'hsl(var(--card))',
      textColor: 'hsl(var(--card-foreground))',
      arrowColor: 'hsl(var(--card))',
    },
    tooltip: { borderRadius: '0.75rem' },
    buttonNext: { borderRadius: '0.5rem' },
    buttonBack: { color: 'hsl(var(--muted-foreground))' },
    buttonSkip: { color: 'hsl(var(--muted-foreground))' },
  }}
/>
```

## Verification

### Automated
- `cd backend && make test` — ensure settings schema changes don't break existing tests
- `cd frontend && npm run test` — ensure no regressions
- `cd frontend && npm run build` — ensure clean production build

### Manual (agent-browser)
Use agent-browser to validate the onboarding flow:
1. Navigate to `http://localhost:5173` as a new user (clear `onboarding_completed` in settings)
2. Verify tour auto-starts on first load
3. Click "Next" through each step — verify tooltips point to correct elements
4. Click "Skip" — verify tour stops and `onboarding_completed` is set to `true`
5. Refresh page — verify tour does NOT auto-start
6. Click the `?` help button — verify tour restarts
7. Complete full tour — verify final step highlights the help button
8. Test on mobile viewport — verify tour works with collapsed sidebar

### Key Files
- `frontend/src/context/OnboardingContext.tsx` (new)
- `frontend/src/lib/config/onboardingSteps.ts` (new)
- `frontend/src/components/buttons/HelpButton.tsx` (new)
- `frontend/src/layouts/chat-layout-v2.tsx` (modified)
- `frontend/src/components/nav/ChatNav.tsx` (modified)
- `frontend/src/components/drawers/app-sidebar.tsx` (modified)
- `frontend/src/pages/chat/ChatPanel.tsx` (modified)
- `backend/src/schemas/entities/settings.py` (modified)
- `frontend/src/lib/services/userSettingsService.ts` (modified)
- `frontend/src/main.tsx` (modified)
