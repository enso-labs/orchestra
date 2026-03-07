# Fix CI Tests Not Running on Push

## Context
CI tests stopped running on feature branch pushes after commit `9952aa01` (Feb 23) restricted the push trigger in `test.yml` to only `development` and `main` branches. The `pull_request` trigger was also commented out. This means no tests run for any feature branch work.

## Change
**File:** `.github/workflows/test.yml`

1. **Line 5-7**: Change push branch filter from explicit list to wildcard:
   ```yaml
   push:
       branches:
           - "*"
   ```
2. **Leave `pull_request` commented out** — not needed since push covers all branches now.

## Verification
- Push to the current feature branch (`feat/843-sandbox-composer-position`)
- Confirm the Test workflow appears in GitHub Actions
- Verify both `test-frontend` and `test-backend` jobs run
