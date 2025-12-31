# SPEC: Remote Development with Cloudflare Tunnels and Claude Code Hooks

## Overview

Create a blog post for the Orchestra website that guides users through setting up a static Cloudflare Tunnel for remote development access, then demonstrates how coupling this with Claude Code hooks creates a powerful agent feedback loop for productivity.

## Context

### Existing Blog Post Patterns
The website already has three blog posts in `website/posts/`:
1. **API Walkthrough** - Step-by-step curl commands for building agents
2. **MCP Tools Connection** - Connecting MCP to Cursor, Claude Desktop, and API
3. **Interactive Charts** - Using content_and_artifact for rich visualizations

All posts follow a consistent structure:
- YAML frontmatter with title, date, excerpt, categories, coverImage, author
- Clear problem statement / "What You'll Build"
- Prerequisites section
- Step-by-step numbered instructions with code blocks
- "Why This Matters" / implications section
- Next steps / call to action
- Links to GitHub and socials

### Cloudflare Tunnel Configuration
Static tunnels require:
- A `config.yaml` with tunnel UUID, credentials file, and ingress rules
- Separate hostnames/subdomains for each service (e.g., `app.domain.com` for frontend:5173, `api.domain.com` for backend:8000)
- DNS CNAME records created via `cloudflared tunnel route dns`
- A catchall rule at the end returning `http_status:404`

### Claude Code Hooks
Hooks are user-defined shell commands that execute at lifecycle events:
- **PreToolUse** - Before a tool runs (can block with exit code 2)
- **PostToolUse** - After a tool completes
- **SessionStart** - When a session begins
- **Stop** - When a session ends

Configuration lives in `~/.claude/settings.json` and can be managed via `/hooks` command.

## Requirements

### Blog Post Content
1. **Title**: "Remote Agent Development with Cloudflare Tunnels and Claude Code Hooks"
2. **Target Audience**: Developers using Claude Code who want to review their dev environment remotely (e.g., from mobile, tablet, or another machine)
3. **Core Value Proposition**: Create a persistent, secure tunnel to your local dev servers AND automate feedback loops with hooks

### Technical Coverage
- Static Cloudflare Tunnel setup (not quick tunnels)
- Multi-service routing (frontend:5173 + backend:8000)
- Claude Code hook examples for remote review workflow:
  - Notification hooks when Claude completes tasks
  - Context injection for remote sessions
  - Auto-formatting/validation hooks
  - Screenshot/preview hooks that work with remote tunnels

### Integration Angle
The "agent feedback loop" concept:
1. Claude Code makes changes locally
2. PostToolUse hook triggers build/test
3. Changes are accessible via Cloudflare Tunnel
4. Developer reviews remotely on any device
5. Developer provides feedback via Claude Code session
6. Loop continues

## Technical Approach

### File Location
`website/posts/remote-dev-cloudflare-tunnel-claude-hooks.md`

### Frontmatter Template
```yaml
---
title: "Remote Agent Development with Cloudflare Tunnels and Claude Code Hooks"
date: "2025-12-30"
excerpt: "Set up persistent Cloudflare Tunnels for remote access to your dev environment, then supercharge it with Claude Code hooks for an automated agent feedback loop."
categories: ["How-To", "Developer Productivity", "Claude Code", "Remote Development"]
coverImage: "TBD"
author:
  name: "Ryan Eggleston"
  picture: "https://avatars.githubusercontent.com/u/40816745?s=96&v=4"
  linkedin:
---
```

### Content Sections
1. Introduction / Problem Statement
2. Prerequisites
3. Part 1: Setting Up a Static Cloudflare Tunnel
   - Install cloudflared
   - Create tunnel
   - Configure multi-service ingress
   - Route DNS
   - Run and validate
4. Part 2: Claude Code Hooks for Remote Review
   - Hook basics overview
   - PostToolUse: Auto-build and notify
   - SessionStart: Inject tunnel URLs as context
   - Stop: Desktop/mobile notification when session ends
5. The Agent Feedback Loop
   - Diagram/explanation of the workflow
   - Practical example scenario
6. Security Considerations
7. Troubleshooting
8. Next Steps

## Dependencies

- Understanding of existing blog post format (read complete)
- Cloudflare Tunnel documentation (researched)
- Claude Code hooks documentation (researched)

## Out of Scope

- Quick/temporary tunnels (trycloudflare.com)
- Cloudflare Access policies (could be mentioned as enhancement)
- Detailed Claude Code hook debugging

---

## Implementation Checklist

- [x] Create blog post file at `website/posts/remote-dev-cloudflare-tunnel-claude-hooks.md`
- [x] Write frontmatter with appropriate metadata
- [x] Write introduction explaining the problem and value proposition
- [x] Write prerequisites section
- [x] Write Part 1: Cloudflare Tunnel setup with code examples
  - [x] Installation steps
  - [x] Tunnel creation commands
  - [x] Multi-service config.yaml example
  - [x] DNS routing commands
  - [x] Running and validating the tunnel
- [x] Write Part 2: Claude Code hooks configuration
  - [x] Hook basics and configuration location
  - [x] PostToolUse auto-build hook example
  - [x] SessionStart context injection hook example
  - [x] Stop notification hook example
- [x] Write "Agent Feedback Loop" section explaining the workflow
- [x] Write Security Considerations section
- [x] Write Troubleshooting section
- [x] Write Next Steps and CTAs
- [x] Review for consistency with existing blog posts
- [x] Verify all code examples are accurate and complete
