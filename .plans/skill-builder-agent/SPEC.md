# Skill Builder Agent - Implementation Plan

## Overview

Create an elite skill-builder agent for building Claude Code skills (self-contained folders of instructions, scripts, and resources that Claude loads dynamically).

## Context Analysis

### Skills vs Commands vs Agents

| Artifact | Location | Structure | Purpose |
|----------|----------|-----------|---------|
| **Skills** | `.claude/skills/[name]/SKILL.md` | Folder with SKILL.md + resources | Contextual knowledge/capabilities |
| **Commands** | `.claude/commands/[name].md` | Single markdown file | Workflow automation (slash commands) |
| **Agents** | `.claude/agents/[name].md` | Single markdown file | Specialized sub-agents with tools |

### Key Insight: Skills Are Different

Skills are **NOT** slash commands or agents. They are:
- **Contextual instruction sets** that enhance Claude's capabilities in specific domains
- **Self-contained folders** with supporting resources (scripts, templates, data)
- **Dynamically loaded** when relevant to the task
- **Domain knowledge** that guides how Claude approaches certain tasks

### Existing Skill Patterns in Orchestra

From analysis of `.claude/skills/`:

1. **explaining-code/SKILL.md** - Simple skill (13 lines)
   - Minimal frontmatter (name, description)
   - Numbered instruction list
   - Focused on methodology

2. **manage-app/SKILL.md** - Complex skill (297 lines)
   - Full frontmatter
   - Title heading matching skill name
   - Prerequisites section
   - Architecture diagrams (ASCII)
   - Workflow section
   - Multiple detailed examples (scenario-based)
   - Important notes / gotchas
   - Reference tables

3. **test-backend/SKILL.md** - Medium skill (125 lines)
   - Full structure
   - Prerequisites and workflow
   - Testing stack documentation
   - Command options table
   - Multiple examples

4. **test-frontend/SKILL.md** - Light skill (66 lines)
   - Similar pattern to test-backend
   - Focused on specific domain

### Anthropic Best Practices (from github.com/anthropics/skills)

**Official Definition**: Skills are modular packages extending Claude's capabilities through specialized knowledge, workflows, and tool integrations—functioning as domain-specific onboarding guides.

**Directory Structure:**
```
skill-name/
├── SKILL.md              # Required: Instructions and metadata
├── scripts/              # Optional: Executable code for deterministic tasks
│   └── init_skill.py
├── references/           # Optional: Documentation loaded contextually
│   └── workflows.md
└── assets/               # Optional: Output-ready files (templates, images)
    └── template.json
```

**SKILL.md Frontmatter:**
```yaml
---
name: skill-name           # Required: lowercase, hyphens
description: |             # Required: When/why to use this skill
  Clear description of what this skill does
  and when Claude should apply it.
license: Complete terms in LICENSE.txt  # Optional
---
```

**Content Sections:**
1. Title (H1) matching skill name
2. Purpose statement
3. Instructions section with workflow
4. Examples section with realistic scenarios
5. Guidelines/best practices
6. Optional: reference tables, gotchas, resources

### Anthropic Key Principles (from skill-creator)

1. **Conciseness**: Context is a shared resource; prioritize information Claude genuinely needs
   - Default assumption: "Claude is already very smart"
   - Don't over-explain what Claude already knows

2. **Degrees of Freedom**: Match specificity to task requirements
   - **High freedom**: Flexible approaches, let Claude decide
   - **Medium freedom**: Patterns with variation allowed
   - **Low freedom**: Fragile/critical operations need exact steps

3. **Progressive Disclosure**: Three-level context loading
   - **Level 1**: Metadata always available (~100 words)
   - **Level 2**: SKILL.md body when triggered (<5k words)
   - **Level 3**: Bundled resources as needed

### Resource Types (Official)

| Directory | Purpose | Loading |
|-----------|---------|---------|
| `scripts/` | Executable code for deterministic, repeated tasks | On demand |
| `references/` | Documentation loaded contextually (schemas, APIs, policies) | Contextual |
| `assets/` | Output-ready files (templates, images, boilerplate) | Not loaded in context |

### Output Patterns (from Anthropic)

**Template Pattern**: Provide format templates with strictness matched to needs
- **Strict**: "ALWAYS use this exact template structure" (for APIs, data formats)
- **Flexible**: "Sensible default format, but use your judgment" (for adaptive contexts)

**Examples Pattern**: When output quality depends on style comprehension
- Provide input/output pairs
- "Examples help Claude understand desired style more clearly than descriptions alone"

### Workflow Patterns (from Anthropic)

**Sequential Workflows**: Ordered steps for linear processes
```
1. Analyze input
2. Process data
3. Validate output
4. Return result
```

**Conditional Workflows**: Branching logic with decision points
```
IF creating new → Creation workflow
IF editing existing → Editing workflow
```

### Official Creation Workflow (6 Steps)

1. **Understand** the skill with concrete examples
2. **Plan** reusable contents
3. **Initialize** using `init_skill.py` (or manually create structure)
4. **Edit** skill components
5. **Package** using `package_skill.py` (optional)
6. **Iterate** based on usage

### Writing Standards (from Anthropic)

- Use imperative/infinitive form ("Analyze the input" not "You should analyze")
- Place triggering information in YAML description, NOT in body
- Include table of contents for reference files exceeding 100 lines
- Avoid deeply nested references; keep one level from SKILL.md

## Requirements

### Skill Builder Agent Must:

1. **Understand Skill Structure**
   - Know the difference between skills, commands, and agents
   - Follow the folder-based structure (SKILL.md + optional resources)
   - Use correct frontmatter format

2. **Explore Before Creating**
   - Analyze existing skills to maintain consistency
   - Understand the domain the skill will cover
   - Identify needed resources/scripts

3. **Create Well-Structured Skills**
   - Proper YAML frontmatter (name, description)
   - Clear instructions with numbered steps
   - Realistic scenario-based examples
   - Reference tables for commands/options
   - Gotchas and important notes

4. **Follow Orchestra Patterns**
   - Match existing skill styles in the codebase
   - Include prerequisites when applicable
   - Document the workflow
   - Provide multiple examples

5. **Support Resource Files**
   - Create supporting scripts when needed
   - Organize data/templates in subdirectories
   - Document any additional resources

### Agent Configuration

```yaml
---
name: skill-builder
description: |
  Elite skill builder for creating Claude Code skills.
  MUST BE USED when user requests creating a new skill,
  building domain expertise, or designing contextual instructions.
  Use PROACTIVELY when discussing skill architecture or
  enhancing Claude's domain capabilities.
tools: Read, Glob, Grep, Edit, Write, Bash
model: sonnet
---
```

## Architecture Design

### Phase 1: Discovery & Analysis

1. Gather requirements from user
2. Explore relevant codebase areas
3. Analyze existing skills for patterns
4. Determine if resources/scripts are needed

### Phase 2: Skill Design

1. Define frontmatter (name, description)
2. Structure the SKILL.md content:
   - Title and purpose
   - Prerequisites (if any)
   - Instructions/workflow
   - Examples (scenario-based)
   - Guidelines and gotchas
   - Reference tables (if applicable)
3. Plan supporting resources

### Phase 3: Implementation

1. Create skill directory
2. Write SKILL.md
3. Create supporting resources (scripts, templates)
4. Validate structure

### Phase 4: Validation

Checklist:
- [ ] Folder exists at `.claude/skills/[skill-name]/`
- [ ] SKILL.md has valid frontmatter
- [ ] Name is lowercase with hyphens
- [ ] Description clearly states when to use
- [ ] Instructions are numbered and actionable
- [ ] Examples are realistic scenarios
- [ ] Resources documented if present

## Differences from Command Builder

| Aspect | Command Builder | Skill Builder |
|--------|----------------|---------------|
| Output | Single .md file | Folder with SKILL.md + resources |
| Purpose | Workflow automation | Domain knowledge/capabilities |
| Invocation | `/command-name` | Automatic when relevant |
| Structure | Variables, Workflow, Report | Instructions, Examples, Guidelines |
| Action verbs | `_READ_`, `_WRITE_`, `_RUN_` | Numbered instructions, prose |

## Implementation Checklist

- [ ] Create agent file at `.claude/agents/skill-builder.md`
- [ ] Add YAML frontmatter with proper configuration
- [ ] Write role definition and expertise section
- [ ] Document skill structure (vs commands/agents)
- [ ] Include Anthropic key principles (conciseness, degrees of freedom, progressive disclosure)
- [ ] Document resource types (scripts/, references/, assets/)
- [ ] Include output patterns (template vs examples)
- [ ] Include workflow patterns (sequential vs conditional)
- [ ] Add writing standards (imperative form, triggering in description)
- [ ] Include skill creation protocol (6 phases from Anthropic)
- [ ] Add Orchestra-specific patterns from existing skills
- [ ] Create quality standards checklist
- [ ] Include example output format
- [ ] Add realistic example scenarios
- [ ] Document supporting resources pattern
- [ ] Add common pitfalls section
- [ ] Validate against agent-builder patterns for consistency
