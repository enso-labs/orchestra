# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Server
- **Development**: `make dev` or `bash scripts/dev.sh` - Starts development server with hot reload and documentation generation
- **Production**: Use `make run` or `bash scripts/run.sh`
- **Manual**: `uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file .env`

### Testing
- **All tests**: `bash scripts/test.sh` - Runs pytest with `.env.test` configuration
- **Single test**: `bash scripts/test.sh tests/path/to/test.py` - Runs specific test file
- **Test command**: `python3 -m pytest -s tests/`

### Building and Deployment
- **Build docs**: `make docs` or `bash scripts/docs.sh`
- **Build container**: `make build` or `bash scripts/build.sh [tag]` - Builds Docker image with optional tag
- **Create tag**: `bash scripts/tag.sh`

### Database
- **Migrations**: Located in `migrations/versions/` using Alembic
- **Migration script**: `bash scripts/db.sh` (check script for specific commands)
- **Auto-migrations**: Run automatically on startup in production/staging environments

## Architecture Overview

### Core Framework
- **Backend**: FastAPI with Python 3.x
- **AI Framework**: LangGraph for building conversational AI workflows
- **Database**: PostgreSQL with SQLAlchemy ORM and Alembic migrations
- **Checkpointing**: LangGraph PostgreSQL checkpointer for conversation state
- **Storage**: MinIO/S3 for file storage

### Key Components

**LangGraph Integration**: 
- Main chatbot logic in `src/flows/chatbot.py` using LangGraph StateGraph
- Conversation state management with `State(TypedDict)` containing annotated messages
- Graph builder pattern with configurable models and system prompts

**Database Architecture**:
- Async PostgreSQL setup with connection pooling
- Dual engine configuration (sync/async) in `src/services/db.py`
- Models: User, Agent, Thread, Revision, Settings, Token, Server
- Repository pattern in `src/repos/` for data access

**API Structure**:
- All routes under `/api` prefix
- Versioned API routes in `src/routes/v0/`
- Key endpoints: agents, threads, tools, auth, storage, settings

**Tools System**:
- Modular tool architecture in `src/tools/`
- Support for: A2A, Agent, API, Arcade, Memory, Retrieval, Search, Shell, SQL
- MCP (Model Context Protocol) integration

**Authentication**:
- JWT-based auth with GitHub OAuth integration
- User token management for various API keys (OpenAI, Anthropic, etc.)
- Token storage in database with encryption

### Configuration
- Environment-based configuration in `src/constants/__init__.py`
- Support for multiple environments (.env, .env.production, .env.test)
- Comprehensive API key management through UserTokenKey enum

### Frontend Integration
- Static file serving with SPA routing fallback
- Documentation served at `/docs` (MkDocs generated)
- Public assets and icons served statically

### Development Notes
- Automatic version detection from git tags/SHA
- Request/response logging middleware with performance tracking
- CORS enabled for development
- Hot reload enabled in development mode