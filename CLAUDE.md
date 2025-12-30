# CLAUDE.md

This file guidance to AI agents when working with the codebase.

## Project Overview

The root project folder contains the following application:

```yml
backend:
    stack: python, uv, fastapi, langchain, read pyproject.toml for more information.
    description: This is the REST API for the ./frontend and ./cli clients.
    deployment: https://chat.ruska.ai/docs
    commands:
        - `make test` Run ALL test cases.
        - `make format` Format project files. Use after making changes.
        - `make dev` Run dev server.
        - `make seeds.user` Seed default users.
frontend:
    stack: typescript, vite, react, shadcn, tailwind, read package.json for more details.
    description: This is built during CI and bundled into the backend during `.github/build.yml`
    deployment: https://chat.ruska.ai
    commands: See package.json
website:
    stack: typescript, nextjs, shadcn
    description: Our main landing page
    url: https://ruska.ai
    commands: See package.json
wiki:
    stack: typescript, react, docusaurus
    description: Documentation for how to use the application interface of frontend and api of backend.
    url: https://docs.ruska.ai
    commands: See package.json
cli:
    stack: typescript, react-ink
    description: New server-side client we are working on for perform actions against the API
    commands: See package.json
```

The main way external AI Agents find out information about RUSKA will be from the `./website/public/llm.txt` that should ALWAYS reflect the current public documentation for LLM search engines. If something in the application is our of sync with this file we should make sure to update the file the `llm.txt` so that it reflects the most accurate picture of the application and how users can get the MOST out of it.

## Code Style

- Use Python 3.12+ features
- Follow PEP 8 conventions
- Type hints required for all functions
- Use Pydantic for data validation

---

# Repository Guidelines for Orchestra

## Project Structure & Module Organization
- `backend/src` contains the FastAPI stack, with domain logic split into `controllers`, `routes`, `services`, and `repos`, plus shared helpers in `common` and `utils`.
- Database assets live in `backend/migrations` and `backend/seeds`; reusable automation sits under `backend/scripts`.
- `frontend/src` hosts the Vite/React client (`components`, `pages`, `routes`, `tests`), while `docs/`, `deployment/`, and `docker/` hold reference material and ops tooling.

## Build, Test, and Development Commands
- Backend: `uv venv && source .venv/bin/activate && uv sync` installs dependencies, `bash backend/scripts/dev.sh` runs the API with reload, and `uv run pytest` (or `bash backend/scripts/test.sh`) executes the suite.
- Frontend: `cd frontend && npm install`, `npm run dev` for local dev, `npm run build` for production bundles, and `npm run docs` regenerates MkDocs API docs.
- Infrastructure: `docker compose up postgres pgadmin` provisions Postgres + PgAdmin; stop with `docker compose down`.

## Coding Style & Naming Conventions
- Run `pre-commit run --all-files`; hooks call `make format` (Ruff) for Python and Prettier/ESLint for frontend changes.
- Python modules use 4-space indents, `snake_case` files, and typed Pydantic models in `backend/src/schemas`. React code follows Prettier’s 2-space indent; components stay in `PascalCase`, hooks in `camelCase`.

## Testing Guidelines
- Place backend unit specs in `backend/tests/unit` and integration cases in `backend/tests/integration`; seed demo data with `python -m seeds.user_seeder` when needed.
- Frontend tests rely on Vitest and Testing Library (`npm run test`, `npm run test:watch`, `npm run test:coverage` for reports).
- Use descriptive filenames (`tests/routes/test_agents.py`, `src/tests/AgentFlow.test.tsx`) and assert observable behavior.

## Commit & Pull Request Guidelines
- Sign every commit with `git commit -s ...`; keep subject lines imperative and reference issues or tickets when helpful.
- Before opening a PR, ensure `uv run pytest`, `npm run test`, and any affected docs or `.env` samples reflect your changes; squash WIP noise locally.
- PRs target `main`, link tracking issues, provide concise change notes, and include screenshots or API traces for UI-facing work.

## Security & Configuration Tips
- EXTREMELY IMPORTANT: NEVER read a .env* file in your exploration.
