# Repository Guidelines

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
- Copy `.example.env` files to `.env` for backend and frontend, keeping secrets out of Git. `backend/scripts/dev.sh` auto-loads the chosen env file.
- Only point at production services when explicitly approved; the dev script prompts before sourcing `.env.production`.
