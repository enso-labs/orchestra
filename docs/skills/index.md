---
title: Skills
slug: /skills
sidebar_position: 5
---

# Skills

Skills are reusable, markdown-based instruction sets that you can attach to your AI agents. They allow you to define specialized behaviors, domain knowledge, and tool-use patterns that agents automatically follow during conversations.

## Overview

-   **Reusable Instructions**: Define a skill once, use it across multiple agents and threads
-   **SKILL.md Format**: Each skill is a markdown file with YAML frontmatter for metadata
-   **Per-User Scoping**: Each user has their own private skill library, namespaced by user ID
-   **Toggle On/Off**: Enable or disable skills without deleting them
-   **Automatic Injection**: Enabled skills are injected into agent context as `/skills/<name>/SKILL.md` files
-   **Full CRUD API**: Create, read, update, toggle, and delete skills programmatically

## How It Works

The skills lifecycle follows this flow:

1. **Create a Skill** — Define a skill with a name, description, markdown content (the SKILL.md body), and optional metadata like tags and allowed tools
2. **Stored in LangGraph BaseStore** — The skill is persisted in the LangGraph BaseStore, namespaced by user ID
3. **Enable/Disable** — Toggle skills on or off using the API or UI. Disabled skills are preserved but not injected
4. **Automatic Retrieval** — When a conversation starts, `prepare_skill_files()` fetches all enabled skills for the current user
5. **Injected as SKILL.md** — Each enabled skill is reconstructed as a `/skills/<name>/SKILL.md` file with YAML frontmatter and injected into the agent's context
6. **Agent Follows Skills** — The agent reads the skill files and follows the instructions defined within

Skills are injected as the **base layer** of agent context. Memory files override skills, and user-uploaded files override both: `{skills, memories, user files}`.

## Skill Data Model

Each skill has the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Unique identifier in kebab-case (e.g., `code-reviewer`) |
| `description` | string | Yes | Short description (max 1024 characters) |
| `content` | string | Yes | The SKILL.md body — markdown instructions for the agent |
| `tags` | string[] | No | Tags for organization and discovery |
| `disabled` | boolean | No | Whether the skill is disabled (default: `false`) |
| `metadata` | object | No | Arbitrary key-value metadata |
| `allowed_tools` | string[] | No | Tools the skill is allowed to use |
| `license` | string | No | License identifier |
| `compatibility` | string | No | Compatibility information |
| `created_at` | datetime | Auto | Timestamp when the skill was created |
| `updated_at` | datetime | Auto | Timestamp when the skill was last updated |

The `name` field must follow kebab-case format: lowercase alphanumeric characters separated by hyphens (e.g., `my-skill`, `code-review-helper`).

## API Reference

All skill endpoints require authentication via a Bearer token in the `Authorization` header. The base path is `/api/skills`.

### Search Skills

Search and list skills with optional filtering and pagination.

```bash
curl -X 'POST' \
  'http://localhost:8000/api/skills/search' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
  "query": "",
  "limit": 10,
  "offset": 0
}'
```

**Request Body:**

-   `query` (string, default: "") — Search filter for skill name/description
-   `limit` (int, default: 10, max: 100) — Number of skills to return
-   `offset` (int, default: 0) — Number of skills to skip

**Response:**

```json
{
    "skills": [
        {
            "name": "code-reviewer",
            "description": "Reviews code for best practices and common issues",
            "content": "# Code Review Skill\n\nWhen asked to review code...",
            "tags": ["development", "quality"],
            "disabled": false,
            "metadata": {},
            "allowed_tools": [],
            "license": null,
            "compatibility": null,
            "created_at": "2025-01-16T10:30:00Z",
            "updated_at": "2025-01-16T10:30:00Z"
        }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
}
```

### Create a Skill

Create a new skill in your library.

```bash
curl -X 'POST' \
  'http://localhost:8000/api/skills' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
  "name": "code-reviewer",
  "description": "Reviews code for best practices and common issues",
  "content": "# Code Review Skill\n\nWhen asked to review code, follow these steps:\n\n1. Check for security vulnerabilities\n2. Verify error handling\n3. Review naming conventions\n4. Look for performance issues",
  "tags": ["development", "quality"],
  "allowed_tools": ["search"],
  "license": "MIT"
}'
```

**Request Body:**

-   `name` (string, required) — Unique kebab-case identifier
-   `description` (string, required) — Short description (max 1024 chars)
-   `content` (string, required) — Markdown content for the SKILL.md body
-   `tags` (string[], optional) — Tags for organization
-   `allowed_tools` (string[], optional) — Tools this skill can use
-   `license` (string, optional) — License identifier
-   `compatibility` (string, optional) — Compatibility info

**Response (201 Created):**

```json
{
    "name": "code-reviewer",
    "description": "Reviews code for best practices and common issues",
    "content": "# Code Review Skill\n\nWhen asked to review code...",
    "tags": ["development", "quality"],
    "disabled": false,
    "metadata": {},
    "allowed_tools": ["search"],
    "license": "MIT",
    "compatibility": null,
    "created_at": "2025-01-16T10:30:00Z",
    "updated_at": "2025-01-16T10:30:00Z"
}
```

### Get a Skill

Retrieve a specific skill by name.

```bash
curl -X 'GET' \
  'http://localhost:8000/api/skills/code-reviewer' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer <token>'
```

**Response:**

```json
{
    "name": "code-reviewer",
    "description": "Reviews code for best practices and common issues",
    "content": "# Code Review Skill\n\nWhen asked to review code...",
    "tags": ["development", "quality"],
    "disabled": false,
    "metadata": {},
    "allowed_tools": ["search"],
    "license": "MIT",
    "compatibility": null,
    "created_at": "2025-01-16T10:30:00Z",
    "updated_at": "2025-01-16T10:30:00Z"
}
```

### Update a Skill

Update an existing skill. All fields are optional — only provided fields are updated.

```bash
curl -X 'PUT' \
  'http://localhost:8000/api/skills/code-reviewer' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
  "description": "Advanced code review with security focus",
  "content": "# Code Review Skill\n\nPrioritize security vulnerabilities above all else...",
  "tags": ["development", "quality", "security"]
}'
```

**Request Body (all optional):**

-   `description` (string) — Updated description
-   `content` (string) — Updated SKILL.md content
-   `tags` (string[]) — Updated tags
-   `allowed_tools` (string[]) — Updated allowed tools
-   `license` (string) — Updated license
-   `compatibility` (string) — Updated compatibility

**Response:**

```json
{
    "name": "code-reviewer",
    "description": "Advanced code review with security focus",
    "content": "# Code Review Skill\n\nPrioritize security vulnerabilities above all else...",
    "tags": ["development", "quality", "security"],
    "disabled": false,
    "metadata": {},
    "allowed_tools": ["search"],
    "license": "MIT",
    "compatibility": null,
    "created_at": "2025-01-16T10:30:00Z",
    "updated_at": "2025-01-16T14:00:00Z"
}
```

### Toggle a Skill

Toggle a skill's disabled state. If enabled, it becomes disabled; if disabled, it becomes enabled.

```bash
curl -X 'PATCH' \
  'http://localhost:8000/api/skills/code-reviewer/toggle' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer <token>'
```

**Response:**

```json
{
    "name": "code-reviewer",
    "description": "Reviews code for best practices and common issues",
    "content": "# Code Review Skill\n\n...",
    "tags": ["development", "quality"],
    "disabled": true,
    "metadata": {},
    "allowed_tools": ["search"],
    "license": "MIT",
    "compatibility": null,
    "created_at": "2025-01-16T10:30:00Z",
    "updated_at": "2025-01-16T15:00:00Z"
}
```

### Delete a Skill

Permanently delete a skill from your library.

```bash
curl -X 'DELETE' \
  'http://localhost:8000/api/skills/code-reviewer' \
  -H 'Authorization: Bearer <token>'
```

**Response:** `204 No Content`

## Using Skills with Agents

When you start a conversation, Orchestra automatically:

1. Fetches all **enabled** skills for your user account
2. Converts each skill into a `/skills/<name>/SKILL.md` file using `to_skill_md()`, which includes YAML frontmatter with metadata
3. Injects these files into the agent's context alongside memory files

The agent then follows the instructions defined in each skill. For example, a "code-reviewer" skill might instruct the agent to always check for security vulnerabilities before approving code.

### Context Priority Order

When multiple context sources exist, they are layered in this order (later overrides earlier):

1. **Skill files** (`/skills/<name>/SKILL.md`) — Base layer
2. **Memory files** (`/memories.md`) — Override skills
3. **User-uploaded files** — Override both skills and memories

This ensures user-specific context always takes precedence.

## UI Guide

Orchestra provides a full UI for managing skills, accessible from the sidebar navigation.

### Skills List Page (`/skills`)

-   View all your skills with name, description, and tags
-   Search/filter skills by name or description
-   Toggle skills on/off with inline switches
-   Edit or delete skills with action buttons
-   Create new skills with the "Create Skill" button

### Create Skill Page (`/skills/create`)

-   **Editor tab**: Write your SKILL.md content using a Monaco markdown editor
-   **Settings tab**: Configure name (kebab-case), description, tags, allowed tools, license, and enabled/disabled state
-   Submit to create the skill and return to the skills list

### Edit Skill Page (`/skills/:name/edit`)

-   Same two-tab layout as the create page, pre-populated with existing data
-   Toggle and delete controls in the page header
-   Name field is read-only (skill names cannot be changed after creation)

### Quick Access from Chat

The **+** button in the chat input includes a Skills section where you can:

-   See all your skills with toggle switches
-   Quickly enable/disable skills without leaving the conversation
-   Navigate to the full skills management page via "Manage Skills"

## Best Practices

-   **Use descriptive names**: Choose clear kebab-case names that describe the skill's purpose (e.g., `python-best-practices`, `api-security-audit`)
-   **Keep content focused**: Each skill should cover one specific domain or behavior. Create multiple small skills rather than one large one
-   **Use tags for organization**: Tag skills by domain (e.g., `development`, `writing`), language (e.g., `python`, `typescript`), or purpose (e.g., `review`, `generation`)
-   **Write clear instructions**: The `content` field is what the agent reads — write it as clear, actionable instructions in markdown
-   **Disable rather than delete**: If you temporarily don't need a skill, toggle it off instead of deleting it. You can re-enable it later
-   **Leverage allowed_tools**: Specify which tools a skill should use to give the agent clearer guidance

## Related Documentation

-   **[Memories](../memories/index.md)**: Persistent context that layers on top of skills
-   **[Assistants](../assistants/index.md)**: Create AI agents that use your skills
-   **[Tools & Integrations](../tools/tools.md)**: Platform tools that skills can reference
-   **[AGENTS.md](../agents-md/index.md)**: Repository-level agent instructions

---

**Ready to create your first skill?** Use the API above or navigate to `/skills/create` in the Orchestra UI!
