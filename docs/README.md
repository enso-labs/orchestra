# Orchestra Documentation

User-facing documentation for Orchestra, kept in-repo as plain Markdown so it
travels with the code it describes.

> **Source of truth for the published site.** The rendered site at
> [docs.ruska.ai](https://docs.ruska.ai) is still built by the Docusaurus app in
> [`mifunedev/wiki`](https://github.com/mifunedev/wiki), which holds its own copy
> of this Markdown. Until that repo is retired, a docs change that must reach the
> published site has to be applied there as well.

These pages were written for Docusaurus, so a few constructs render as literal
text on GitHub — `:::note` / `:::tip` admonition blocks and the YAML front matter
at the top of each file. The prose, code samples, and images are unaffected.

## Contents

- [Introduction](./index.md)
- [Getting Started](./getting-started.md)
- [Self-Hosting](./self-hosting/index.md)

### Core Features

- [Chat](./chat/index.md)
- [Assistants](./assistants/index.md)
- [Skills](./skills/index.md)
- [Prompts](./prompts/index.md)
- [Threads](./threads/index.md)
- [Schedules](./schedules/index.md)
- [Projects](./projects/index.md)
- [Epics](./epics/index.md)
- [Storage](./storage/index.md)
- [Memories](./memories/index.md)
- [Public Agents](./public-agents/index.md)
- [AGENTS.md](./agents-md/index.md) — [tutorial](./agents-md/tutorial.md)

### Tools & Integrations

- [Tools Overview](./tools/tools.md)
- [Search](./tools/search.md)
- [MCP](./tools/mcp.md)
- [Sandbox](./tools/sandbox.md)
- [A2A](./tools/a2a.md)

### Account & API

- [Settings](./settings/index.md)
- [API Tokens](./api-tokens/index.md)

### Tutorials

- [Sandbox Tutorial](./tools/sandbox-tutorial.md)
- [Memories Tutorial](./memories/tutorial.md)

### Not in the published sidebar

These pages ship in the repo but are not linked from the Docusaurus sidebar:

- [Assistants — AGENTS.md](./assistants/agents-md.md)
- [AGENTS.md Workflow](./tutorials/agents-md-workflow.md)

## Images

Screenshots live in [`img/`](./img), grouped by section, and are referenced with
paths relative to each page so they render when browsing this repo on GitHub.
The Docusaurus copy in `mifunedev/wiki` keeps its own `static/img/` layout and
root-absolute `/img/...` references — that difference is expected, and it is the
one place the two copies intentionally diverge.
