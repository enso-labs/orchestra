# RLM Skill - Recursive Language Model

Process large inputs that exceed single-pass capacity by decomposing tasks into manageable chunks, spawning parallel Haiku sub-agents, and synthesizing results into a unified output.

The RLM pattern uses a two-level supervisor-worker hierarchy: a Sonnet supervisor handles strategic decomposition and final synthesis, while Haiku workers handle focused chunk processing in parallel. This achieves cost reduction (Haiku processes 90%+ of tokens) and speed improvement (parallel execution) while maintaining quality through Sonnet-level synthesis.

## Installation

### Quick Install (project-local)

```bash
curl -fsSL https://raw.githubusercontent.com/ruska-ai/orchestra/master/.claude/skills/rlm/install.sh | bash
```

This installs to `.claude/skills/rlm/` in your current directory.

### Global Install

```bash
curl -fsSL https://raw.githubusercontent.com/ruska-ai/orchestra/master/.claude/skills/rlm/install.sh | bash -s -- --global
```

This installs to `~/.claude/skills/rlm/` so the skill is available across all projects.

## Trigger Phrases

Use any of these to activate the skill:

- `analyze large codebase`
- `recursive analysis`
- `deep analysis`
- `process large input`
- `comprehensive review`
- `rlm`
- `recursive reasoning`
- `review massive document`
- `analyze entire repository`

## Files

| File | Description |
|------|-------------|
| `SKILL.md` | Core skill definition with workflow, strategies, and examples |
| `references/prompt-templates.md` | Reusable prompt templates for sub-agent workers |
| `install.sh` | One-line installer script |

## How It Works

```
Input -> Assess -> Decompose -> Spawn Parallel Haiku Workers -> Evaluate -> Synthesize -> Output
```

1. **Assess** - Determine if input exceeds single-pass capacity (>50 files, >10K lines, or >100K tokens)
2. **Decompose** - Split input using uniform chunking, keyword filtering, or structural decomposition
3. **Spawn Workers** - Launch parallel Haiku sub-agents to process each chunk
4. **Evaluate** - Check completeness and confidence; re-decompose gaps if needed (max 3 iterations)
5. **Synthesize** - Aggregate, deduplicate, and produce a unified output with cross-chunk patterns

## Requirements

- Claude Code with Task tool access (for spawning sub-agents)
- Model access: Sonnet (supervisor) and Haiku (workers)
