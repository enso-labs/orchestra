# Orchestra Commands

Command files (.md) in this directory define reusable workflows that automate common development tasks. Commands are invoked via `/command-name [arguments]` in Claude Code.

## Quick Reference

| Command          | Invocation                | Purpose                               | Arguments                                  |
| ---------------- | ------------------------- | ------------------------------------- | ------------------------------------------ |
| **announce-pr**  | `/announce-pr [pr]`       | Generate social media posts for PRs   | PR number, URL, branch, or empty (current) |
| **build**        | `/build [target]`         | Build backend, frontend, or all       | `backend`, `frontend`, `all` (default)     |
| **plan**         | `/plan [task]`            | Create implementation plan in .plans/ | Task description                           |
| **prime**        | `/prime`                  | Understand project structure          | None                                       |
| **worktree**     | `/worktree [args]`        | Manage git worktrees                  | Worktree operations                        |
| **reflection**   | `/reflection [topic]`     | Reflect on development process        | Topic to reflect on                        |
| **team**         | `/team query="[feature]"` | Multi-agent code analysis             | Feature description + subagent count       |
| **spec:feature** | `/spec:feature [args]`    | Generate feature spec template        | `ISSUE_NUMBER-SHORTDESC`                   |
| **spec:bug**     | `/spec:bug [args]`        | Generate bug spec template            | `ISSUE_NUMBER-SHORTDESC`                   |

## Command Structure

Every command follows this pattern:

```markdown
# Command Name

Brief description of what the command does.

## Variables (optional)

VARIABLE_NAME: $ARGUMENTS

## Workflow

1. _ACTION_ description of step
2. _IF_ condition:
    - Sub-step 1
    - Sub-step 2
3. _ACTION_ another step

## Report

What to output when complete.
```

## Action Verbs

Commands use uppercase action verbs to specify operations:

| Verb           | Usage                        |
| -------------- | ---------------------------- |
| `_DETERMINE_`  | Parse/decide from input      |
| `_READ_`       | Read files for context       |
| `_ANALYZE_`    | Examine content/requirements |
| `_WRITE_`      | Create/modify files          |
| `_RUN_`        | Execute shell commands       |
| `_IF_`         | Conditional execution        |
| `_BREAK DOWN_` | Decompose into parts         |
| `_REPORT_`     | Summarize/output             |

## How to Invoke Commands

### Simple Invocation

```
/prime
```

### With Arguments

```
/build frontend
/plan Add JWT authentication to API
/team query="Implement file upload feature" subagents=3
```

## Relationship to Skills

Commands orchestrate **skills** (located in `.claude/skills/`). Skills are composable, deterministic workflows for specific tasks.

**Command vs Skill**:

-   **Commands**: User-facing workflows, invoked by `/command-name`
-   **Skills**: Internal, composable capabilities used by commands

Example:

-   **Command**: `/team` (user invokes this)
-   **Skill**: `context-explorer/diff-triage.md` (command uses this internally)

## Command Types

### 1. Build/Deploy Commands

Automate build, test, and deployment workflows.

**Example**: `/build backend` → Install deps → Format → Test

### 2. Analysis/Review Commands

Analyze code, review changes, or audit codebase.

**Example**: `/team query="..."` → Multi-agent analysis → Synthesis

### 3. Generation Commands

Generate code, documentation, or configuration.

**Example**: `/plan [task]` → Analyze → Generate SPEC.md

### 4. Planning Commands

Create specs, plans, or documentation.

**Example**: `/plan` → Break down → Write plan

### 5. Exploration Commands

Understand codebase structure or find information.

**Example**: `/prime` → Tree structure → Read docs → Report

## Creating New Commands

To create a new command:

1. **Choose a clear, imperative name** (e.g., `deploy`, `test`, `analyze`)
2. **Define the purpose** in one sentence
3. **Specify variables** if the command accepts arguments
4. **Break down the workflow** into numbered steps with action verbs
5. **Define the report format** for output
6. **Save to** `.claude/commands/[command-name].md`

### Template

```markdown
# Command Name

One sentence describing what this command does.

## Variables

DESCRIPTIVE_NAME: $ARGUMENTS

## Workflow

1. _ACTION_ step description
2. _IF_ condition:
    - RUN `command` to do thing
    - RUN `another command`
3. _ACTION_ final step

## Report

What to summarize when complete:

-   Bullet point 1
-   Bullet point 2
```

## Quality Standards

Every command must:

-   [ ] Have a clear, imperative title
-   [ ] Explain purpose in one sentence
-   [ ] Use action verbs for workflow steps
-   [ ] Define report format
-   [ ] Follow existing patterns in this directory

## Available Commands

### announce-pr.md

**Purpose**: Generate social media announcements (LinkedIn and X.com) for pull requests

**Usage**:

```
/announce-pr              # Current branch/commit
/announce-pr 651          # Specific PR number
/announce-pr https://github.com/ruska-ai/orchestra/pull/651  # PR URL
/announce-pr feat/650-file-treeview-sidebar  # Specific branch
```

**Workflow**:

1. Determine PR source (number, URL, branch, or current)
2. Fetch PR information and diff using gh CLI or git
3. Analyze changes (features, fixes, impact, affected areas)
4. Generate LinkedIn post (1300-3000 chars, professional)
5. Generate X.com post (<280 chars, concise)
6. Format output with character counts and copy instructions

**Output**:

-   PR information summary
-   LinkedIn post (ready to copy)
-   X.com post (ready to copy)
-   Copy instructions

---

### build.md

**Purpose**: Build Orchestra application (backend/frontend/all)

**Usage**:

```
/build              # Build all
/build backend      # Backend only
/build frontend     # Frontend only
```

**Workflow**:

1. Determine build target
2. If backend: Install deps → Format → Test
3. If frontend: Install deps → Build → Test
4. Report results

---

### plan.md

**Purpose**: Create implementation plan and save to .plans/[task-name]/SPEC.md

**Usage**:

```
/plan Add JWT authentication to API
```

**Workflow**:

1. Read relevant files for context
2. Analyze task requirements
3. Break down into sub-tasks
4. Write implementation plan to SPEC.md
5. Write steps as checklist

---

### prime.md

**Purpose**: Understand project structure and file layout

**Usage**:

```
/prime
```

**Workflow**:

1. Run tree command to show structure
2. Read README.md
3. Read backend/\*/README.md
4. Report understanding

---

### worktree.md

**Purpose**: Manage git worktrees for parallel development

**Usage**:

```
/worktree [operation]
```

---

### reflection.md

**Purpose**: Reflect on development process and decisions

**Usage**:

```
/reflection [topic]
```

---

### team.md

**Purpose**: Multi-agent code analysis and proposal system (Rummage)

**Usage**:

```
/team query="Add file upload feature" subagents=3
```

**Workflow**:

1. Initialize context (read plan.md)
2. Generate N agent proposals (ARCHITECT, CRAFTSMAN, GUARDIAN, etc.)
3. Council review (synthesize proposals)
4. Task contract generation (create TASKS.md)
5. Elite builder execution (implement)
6. Test & validation

**Outputs**:

-   `PROPOSAL_<PERSONA>.md` (N files)
-   `REVIEW.md` (council synthesis)
-   `TASKS.md` (implementation contract)

---

### spec/feature.md

**Purpose**: Generate a feature spec template for a new issue

**Usage**:

```
/spec/feature 123-user-dashboard
```

**Workflow**:

1. Parse input into ISSUE_NUMBER and SHORTDESC
2. Generate template at `.claude/specs/feature-[ISSUE_NUMBER]-[SHORTDESC]/SPEC.md`
3. Confirm file creation

**Definition of Done** (before implementation):

-   [ ] Summary clearly articulates what and why
-   [ ] At least one complete user story
-   [ ] 3+ testable acceptance criteria
-   [ ] Out of scope explicitly defined
-   [ ] No ambiguous language

---

### spec/bug.md

**Purpose**: Generate a bug spec template for a new issue

**Usage**:

```
/spec/bug 456-menu-invisible
```

**Workflow**:

1. Parse input into ISSUE_NUMBER and SHORTDESC
2. Generate template at `.claude/specs/bug-[ISSUE_NUMBER]-[SHORTDESC].md`
3. Confirm file creation

**Definition of Done** (before implementation):

-   [ ] Clear summary with impact
-   [ ] Numbered, reproducible steps (minimum 2)
-   [ ] Expected vs actual behavior defined
-   [ ] Bug isolated to single behavior

---

## Integration with Orchestra

### Backend-Focused Commands

-   Python environment: `cd backend && uv sync`
-   Formatting: `make format` or `cd backend && ruff format .`
-   Testing: `make test` or `cd backend && pytest`
-   Type checking: `cd backend && mypy src/`

### Frontend-Focused Commands

-   Dependencies: `cd frontend && npm install`
-   Build: `cd frontend && npm run build`
-   Testing: `cd frontend && npm run test`
-   Linting: `cd frontend && npm run lint`

### Full-Stack Commands

-   Use `_IF_` conditions to handle each target
-   Default to "all" when no target specified
-   Report results for each component separately

## Best Practices

### Do's

-   Match existing command patterns exactly
-   Use action verbs consistently
-   Provide clear report formats
-   Keep workflows sequential and logical
-   Include error handling with `_REPORT_`

### Don'ts

-   Don't create vague steps ("Do the thing")
-   Don't skip report section
-   Don't use overly complex workflows
-   Don't forget to handle conditional logic
-   Don't create commands that duplicate existing ones

## Troubleshooting

### Command not found

-   Check filename matches invocation: `/build` requires `build.md`
-   Ensure file is in `.claude/commands/` directory

### Arguments not passed

-   Verify `Variables` section uses `$ARGUMENTS`
-   Check invocation uses correct syntax

### Workflow unclear

-   Ensure action verbs are used
-   Number steps sequentially
-   Use sub-bullets for conditionals

## Next Steps

1. **Use existing commands** to automate common tasks
2. **Create new commands** following the template above
3. **Compose skills** into reusable command workflows
4. **Document patterns** to help others create commands

For advanced workflows, see:

-   `.claude/skills/` - Composable skill modules
-   `.claude/skills/context-explorer/` - Context extraction skills
-   `.claude/agents/` - Agent definitions

---

**Last Updated**: 2026-01-10
**Maintainer**: Orchestra Development Team
