# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enso Labs Orchestra is an AI Agent Orchestrator built on LangGraph, powered by MCP (Model Context Protocol) and A2A (Agent-to-Agent) protocols. It provides a FastAPI backend with PostgreSQL database and a React TypeScript frontend.

**Key Architecture:**
- **Backend**: FastAPI with LangGraph for agent orchestration, MCP/A2A protocol support
- **Frontend**: React with TypeScript, Vite, TailwindCSS, Radix UI components
- **Database**: PostgreSQL with Alembic migrations
- **Protocols**: MCP for model context, A2A for agent communication
- **Storage**: MinIO for object storage, with support for various document formats

## Development Commands

### Backend (Python/FastAPI)
```bash
cd backend

# Development server
bash scripts/dev.sh

# Testing
bash scripts/test.sh                    # Run all tests
bash scripts/test.sh tests/unit/        # Run specific test directory
python3 -m pytest -s tests/unit/test_example.py  # Run single test file

# Database migrations
alembic upgrade head                    # Apply all migrations
alembic revision -m "description"       # Create new migration
alembic upgrade +1                      # Apply next migration
alembic downgrade -1                    # Rollback one migration

# Documentation
bash scripts/docs.sh                   # Build MkDocs documentation

# Seeding
python -m seeds.user_seeder            # Seed initial user data
```

### Frontend (React/TypeScript)
```bash
cd frontend

# Development
npm run dev                            # Start dev server
npm run build                          # Production build
npm run preview                        # Preview production build

# Testing
npm run test                           # Run tests once
npm run test:watch                     # Run tests in watch mode
npm run test:coverage                  # Run tests with coverage

# Linting
npm run lint                           # Run ESLint
```

### Docker Services
```bash
# Start database and admin interface
docker compose up postgres pgadmin

# Full stack
docker compose up
```

## Core Architecture

### Backend Structure
- **`src/routes/v0/`**: API endpoints organized by functionality (agent, auth, llm, thread, etc.)
- **`src/services/`**: Business logic (db, oauth, storage, mcp)
- **`src/tools/`**: Agent tools (a2a, agent, api, arcade, memory, retrieval, search, shell, sql)
- **`src/utils/`**: Utilities for agent management, auth, LLM interactions, streaming
- **`src/schemas/`**: Pydantic models for entities and API schemas
- **`src/common/`**: Shared types and client/server utilities

### Frontend Structure
- **`src/pages/`**: Main application pages and route components
- **`src/components/`**: Reusable UI components organized by function
- **`src/hooks/`**: Custom React hooks for state management
- **`src/context/`**: React context providers (Agent, App, Chat, Flow, Theme, Tool)
- **`src/lib/services/`**: API service layer for backend communication
- **`src/lib/utils/`**: Utility functions for formatting, storage, streaming

### Key Technologies
- **LangGraph**: Agent workflow orchestration
- **MCP (Model Context Protocol)**: Tool and context integration
- **A2A (Agent-to-Agent)**: Inter-agent communication
- **FastAPI**: Backend API framework with automatic OpenAPI docs
- **SQLAlchemy + Alembic**: Database ORM and migrations
- **React Query**: Frontend state management and caching

## Environment Setup

Copy example environment files:
```bash
# Backend
cp backend/.example.env backend/.env

# Frontend  
cp frontend/.example.env frontend/.env
```

Required environment variables:
- Database: `DATABASE_URL`
- LLM APIs: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Storage: `MINIO_HOST`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- Auth: OAuth configuration for supported providers

## Testing Strategy

- **Backend**: pytest with separate unit and integration test directories
- **Frontend**: Vitest with React Testing Library
- **Test environments**: Uses `.env.test` for backend test configuration

## Key Protocols

### MCP (Model Context Protocol)
- Provides standardized tool and context integration
- Configured via `src/services/mcp.py`
- Tools include search, shell execution, memory management

### A2A (Agent-to-Agent)
- Enables inter-agent communication and task delegation
- Uses JSON-RPC for message passing
- Defined in `src/common/types.py` with comprehensive type definitions

## Database Schema

- **Users**: Authentication and user management
- **Threads**: Conversation/chat threads
- **Agents**: AI agent configurations and metadata
- **Tools**: Available tools and their configurations
- **Settings**: User and system configuration
- **Tokens**: API token management
- **Servers**: MCP server configurations

Migration files are in `backend/migrations/versions/` with descriptive names indicating schema changes.