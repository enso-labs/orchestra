# User Stories

## Issue #680: FEAT: Update README.md (out-of-sync)

### Story 1: Remove Presidio Documentation
**As a** developer setting up Orchestra,
**I want** the README to not reference removed Presidio services,
**So that** I don't waste time trying to configure services that no longer exist.

**Acceptance Criteria:**
- [ ] Remove the "Services (Alpha)" section referencing PRESIDIO_* environment variables (lines ~380-386)
- [ ] Ensure no other references to Presidio remain in the README

### Story 2: Document Makefile Developer Commands
**As a** developer working on Orchestra,
**I want** clear documentation on how to use the Makefile for common tasks,
**So that** I can quickly run tests, format code, and start the development server.

**Acceptance Criteria:**
- [ ] Add a section documenting available Makefile commands
- [ ] Include `make test` - Run ALL test cases
- [ ] Include `make format` - Format project files
- [ ] Include `make dev` - Run dev server
- [ ] Include `make seeds.user` - Seed default users
- [ ] Position this documentation prominently in the Development section

### Story 3: Modernize Development Setup Instructions
**As a** new contributor to Orchestra,
**I want** streamlined development setup instructions using the Makefile,
**So that** I can get started quickly without running multiple manual commands.

**Acceptance Criteria:**
- [ ] Update the "Setup Server Environment" section to prefer Makefile commands
- [ ] Retain the manual uv commands for users who need them
- [ ] Ensure the flow is clear: env setup → docker services → backend → frontend

### Story 4: Document Distributed Worker Configuration (Optional)
**As a** developer deploying Orchestra with distributed workers,
**I want** documentation on the new Redis-based worker configuration,
**So that** I can properly set up distributed LLM streaming.

**Acceptance Criteria:**
- [ ] Add worker-related environment variables if applicable (from PR #657)
- [ ] Document docker-compose services for worker mode if needed
- [ ] This is optional - only if worker documentation is appropriate for README level

## Notes
- PR #676 removed Presidio service entirely - it's replaced by PIIMiddleware (no user configuration needed)
- PR #657 added distributed worker mode with Redis/TaskIQ - check if env vars need documentation
- CLAUDE.md already documents the Makefile commands - README should align with this
- The `.example.env` in backend was updated in PR #657 with new worker-related vars
