# Build

Build the Orchestra application (backend and/or frontend).

## Variables

BUILD_TARGET: $ARGUMENTS

## Workflow

1. _DETERMINE_ build target from BUILD_TARGET (options: "backend", "frontend", "all"). Default to "all" if not specified.
2. _IF_ building backend or all:
   - RUN `cd backend && uv sync` to install dependencies
   - RUN `cd backend && make format` to format code
   - RUN `cd backend && make test` to verify tests pass
3. _IF_ building frontend or all:
   - RUN `cd frontend && npm install` to install dependencies
   - RUN `cd frontend && npm run build` to create production bundle
   - RUN `cd frontend && npm run test` to verify tests pass
4. _REPORT_ any errors encountered during the build process.

## Report

Summarize build results including:
- Build target(s) completed
- Any warnings or errors
- Output locations (frontend: `frontend/dist`, backend: ready to run)
