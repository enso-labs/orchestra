# Plan: Route App Root to Login (Issue #851)

## Context

Issue #851 aims to hide the default anonymous landing page and make the login page the default entry point at `/`. This optimizes sign-up conversions by immediately presenting users with the login/register experience instead of an anonymous landing page. The user wants to update the issue description using the feature request template format, remove the "theme matching" scope item, and implement the routing change.

## Step 1: Update Issue #851 Description

Update the GitHub issue body using the feature request template format. Remove the "Redesign the app login page to match the `ruska.ai` marketing theme" scope item. Focus the issue on:
- Routing `/` to the Login page
- Removing the anonymous landing page (HomeSection)
- Updating navigation to use intent-based targets

## Step 2: Create Branch `feat/851-route-root-to-login`

Branch from `development`.

## Step 3: Code Changes

### 3a. Route `/` to Login instead of Home
**File:** `frontend/src/routes/AppRoutes.tsx`
- Change the index route from `<Home />` to `<Login />`
- Remove the `Home` import (if Home page is fully removed)

### 3b. Remove Home page and HomeSection
**Files to delete:**
- `frontend/src/pages/Home.tsx`
- `frontend/src/components/sections/home/home-section.tsx`
- `frontend/src/components/sections/home/index.tsx`

### 3c. Update Login page — remove Home button
**File:** `frontend/src/pages/Login.tsx`
- Remove the "Home" button (lines 71-79) since `/` IS now the login page — there's no separate home to navigate to

### 3d. Update NoAuthLayout — hide login link on root path
**File:** `frontend/src/layouts/NoAuthLayout.tsx`
- The layout already hides the Login link on `/login` and `/` (line 16) — no change needed

## Step 4: Create PR targeting `development`

## Verification

1. `npm run build` succeeds in `frontend/`
2. `npm run test` passes
3. Unauthenticated `/` shows Login page
4. Unauthenticated `/login` shows Login page (same)
5. Authenticated `/` redirects to `/chat`
6. No dead imports or references to removed Home/HomeSection
