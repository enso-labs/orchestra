---
name: reflection
description: |
  Meta-improvement skill that analyzes conversation context and uncommitted git changes
  to propose improvements to the AI agent ecosystem itself (agents, skills, commands).
  Use when the user asks to reflect on the conversation, improve the agent ecosystem,
  or optimize workflows based on patterns observed. This skill ALWAYS acts as supervisor
  first, producing an initial analysis report, then spawns specialized builder agents
  based on user-approved plan. Always requires user approval before making changes.
---

# Reflection

Analyzes conversation context and uncommitted git changes to identify strategic improvements for the AI agent ecosystem (agents, skills, commands), then synchronizes documentation (CLAUDE.md) to reflect changes. This skill is about META-improvement - improving how AI agents themselves work and collaborate.

## Core Insight: Sequential Dependencies

The AI agent ecosystem has a natural dependency chain:
- **Agents** define WHO owns segments of work
- **Skills** define WHAT capabilities agents need to accomplish goals
- **Commands** define HOW to make processes deterministic and efficient

This creates: **Agents → Skills → Commands**

Understanding this chain is critical for determining whether builder agents can run in parallel or must execute sequentially.

## Instructions

### Prerequisites

- Access to conversation history and context
- Git repository with potential uncommitted changes
- Access to Task tool for spawning builder agents when approved
- Existing `.claude/` structure:
  - `.claude/agents/` (specialized sub-agents)
  - `.claude/skills/` (domain knowledge packages)
  - `.claude/commands/` (workflow automation slash commands)
  - `CLAUDE.md` (AI agent instructions)

### Core Philosophy

**This skill is about META-improvement**: Rather than improving project code or user documentation, it improves the AI agent ecosystem itself. The goal is to make future AI interactions more efficient, accurate, and user-friendly by continuously evolving the agent, skill, and command infrastructure.

**Supervisor-First Approach**: This skill ALWAYS starts as a supervisor, analyzing the current state and producing an initial report. Only after user approval does it spawn builder agents to generate specific proposals.

### Workflow

The reflection workflow consists of 4 sequential phases, with the supervisor analysis ALWAYS coming first.

#### Phase 1: Supervisor Initial Report (CRITICAL - Always First)

Before spawning any builder agents, act as supervisor and produce an initial analysis report. This report determines the optimal approach for the rest of the workflow.

**Steps**:

1. **Analyze Conversation Context**
   - Review conversation history for patterns, repeated questions, and emerging workflows
   - Identify successful vs problematic approaches
   - Note domain knowledge gaps or user friction points
   - Look for workflows that could be automated

2. **Analyze Git Changes**
   - Run `git status` to see uncommitted changes
   - Run `git diff` to understand what code changed
   - Focus on architectural/structural changes
   - Identify new patterns, modules, or workflows introduced

3. **Review Current Ecosystem**
   - Count existing agents in `.claude/agents/`
   - Count existing skills in `.claude/skills/`
   - Count existing commands in `.claude/commands/`
   - Identify gaps, overlaps, and optimization opportunities

4. **Produce Initial Report**

Use this exact format:

```markdown
## Reflection Analysis Report

### Observed Context
**Conversation Summary**: [What was discussed, patterns observed, user goals]
**Git Changes**: [What files changed, architectural patterns that emerged]

### Current Ecosystem State
- **Agents**: [count] existing ([list names])
- **Skills**: [count] existing ([list names])
- **Commands**: [count] existing ([list names])

### Identified Opportunities

#### Agents
[Describe gaps or improvements identified, or "No changes needed"]

#### Skills
[Describe gaps or improvements identified, or "No changes needed"]

#### Commands
[Describe gaps or improvements identified, or "No changes needed"]

### Recommendation
**Approach**: [Sequential/Parallel/Agents Only/Skills Only/Commands Only/Skip]
**Reasoning**: [Why this approach is optimal]

### Dependency Assessment
**Can Parallelize**: [Yes/No]
**Reason**: [Explanation of dependencies or independence]
- If YES: Proposed changes are independent improvements that don't rely on each other
- If NO: Changes have dependencies (e.g., new agents need new skills, new commands need new agents)
```

5. **STOP and wait for user decision** - Do NOT proceed to Phase 2 without user approval

#### Phase 2: User Decision Point (CRITICAL - Interactive)

Present the initial report and ask the user which approach to take.

**Use this exact question format**:

```markdown
Based on the analysis above, how should I proceed?

**Options**:
1. **Full Sequential (Recommended if dependencies exist)** - Run agent-builder, then skill-builder, then command-builder in order
2. **Parallel (Fast if no dependencies)** - Run all three builders simultaneously
3. **Agents Only** - Only review and propose agent improvements
4. **Skills Only** - Only review and propose skill improvements
5. **Commands Only** - Only review and propose command improvements
6. **Skip** - No changes needed at this time

Please select an option (1-6):
```

**Wait for user response before proceeding to Phase 3.**

#### Phase 3: Builder Invocation (Conditional Based on User Choice)

Based on the user's selection from Phase 2, invoke builder agents using one of these patterns:

##### Option 1: Full Sequential (Agents → Skills → Commands)

**Step 1: Agent Builder Phase**

1. Invoke agent-builder agent with Task:
   ```
   "Review existing agents in `.claude/agents/` and analyze the conversation context and git changes. Propose:
   - Improvements to existing agents (better instructions, tool access, model selection)
   - New agents based on conversation patterns or emerging needs
   Provide concrete proposals with file paths and justifications."
   ```

2. Wait for agent-builder to complete

3. Present agent proposals to user:
   ```markdown
   ## Agent Proposals

   [List proposals with #A1, #A2, etc. format]

   Which agent improvements should I apply?
   - [ ] Accept All
   - [ ] #A1: [description]
   - [ ] #A2: [description]
   - [ ] Skip All
   ```

4. Apply approved agent changes

**Step 2: Skill Builder Phase** (runs AFTER agent changes applied)

1. Invoke skill-builder agent (now aware of new/updated agents)
2. Wait for skill-builder to complete
3. Present skill proposals to user
4. Apply approved skill changes

**Step 3: Command Builder Phase** (runs AFTER skill changes applied)

1. Invoke command-builder agent (now aware of new/updated agents and skills)
2. Wait for command-builder to complete
3. Present command proposals to user
4. Apply approved command changes

##### Option 2: Parallel (All Builders Simultaneously)

Only use if supervisor determined NO dependencies exist.

**Execute in SINGLE message**:
1. Spawn agent-builder agent
2. Spawn skill-builder agent
3. Spawn command-builder agent

**After all complete**:
1. Consolidate all proposals into single list
2. Present ONE approval question with all proposals
3. Apply approved changes in dependency order (agents first, skills second, commands third)

##### Option 3-5: Single Builder

Invoke only the selected builder (agent-builder, skill-builder, OR command-builder):
1. Spawn the single builder agent
2. Wait for completion
3. Present proposals
4. Apply approved changes

##### Option 6: Skip

No builder agents invoked. End workflow.

#### Phase 4: Sync Documentation (Final Step)

After ALL approved changes from all builder phases are applied, update CLAUDE.md to reflect the new agent ecosystem state.

**CLAUDE.md Updates** (only if changes were applied):

**Update the "AI Agent Workflows" section** (or create if missing):
```markdown
## AI Agent Workflows

### Available Agents
[List all agents with their purposes - updated to reflect new/changed agents]

### Available Skills
[List all skills with their triggers - updated to reflect new/changed skills]

### Available Commands
[List all commands with their usage - updated to reflect new/changed commands]

### Workflow Recommendations
[Update based on new capabilities - how to use the agent ecosystem effectively]
```

**Key Points**:
- CLAUDE.md sync happens LAST, after all builder phases complete
- Only update if changes were actually applied
- Focus on documenting what's available, not how it works (that's in individual files)
- Ensure future AI agents can discover available capabilities
- Keep concise - just list what exists with brief purpose statements

### Proposal Presentation Format

When presenting proposals to the user (in each builder phase), use this format:

```markdown
## [Agent/Skill/Command] Proposals

Based on the builder analysis, here are the recommended improvements:

**Improvements to Existing [Type]**:
- [ ] #[X]1: [Name] - [Brief description]
      **File**: [path]
      **Current**: [what exists now]
      **Proposed**: [what will change]
      **Justification**: [why this helps]
      **Priority**: [High/Medium/Low]

**New [Type] to Create**:
- [ ] #[X]2: [Name] - [Brief description]
      **File**: [path]
      **Proposed**: [what will be created]
      **Justification**: [why this helps]
      **Priority**: [High/Medium/Low]

**Options**:
- [ ] Accept All
- [ ] Custom - I'll specify modifications in my response
- [ ] Skip All

Which improvements should I apply?
```

### Applying Changes

When applying approved changes (in each builder phase):

**For each approved proposal**:

1. **If improving existing agent/skill/command**:
   - Read the current file
   - Apply the specific improvements identified
   - Maintain existing structure and style
   - Preserve formatting

2. **If creating new agent/skill/command**:
   - Use the appropriate builder agent (agent-builder, skill-builder, or command-builder)
   - Follow established patterns from existing files
   - Create with complete structure (frontmatter, instructions, examples)
   - Place in correct directory (`.claude/agents/`, `.claude/skills/`, `.claude/commands/`)

3. **Track what was applied**:
   - Keep list of successfully applied changes
   - Note any errors or issues
   - Prepare summary for user

**Application Order**:
- In Sequential mode: Agents first, then skills, then commands (respects dependencies)
- In Parallel mode: Apply in dependency order even though proposals came simultaneously (agents → skills → commands)
- In Single Builder mode: Apply only that type's changes

### What Builder Agents Should Look For

Guide the spawned builder agents to focus on these areas:

**For agent-builder**:
- **Missing agent specializations**: Are there domains without dedicated agents?
- **Tool access optimization**: Do agents have minimal necessary tools or excessive access?
- **Model selection**: Are agents using optimal models (Sonnet vs Haiku)?
- **Trigger conditions**: Do descriptions clearly state when to invoke?
- **Incomplete protocols**: Are instructions vague or missing steps?
- **Outdated patterns**: Do agents reference old codebase structures?
- **Duplicate responsibilities**: Do multiple agents overlap unnecessarily?

**For skill-builder**:
- **Missing domain knowledge**: Are there areas Claude struggles with repeatedly?
- **Unclear triggers**: Do skill descriptions poorly define when to apply?
- **Insufficient examples**: Do skills lack realistic scenario demonstrations?
- **Outdated instructions**: Do skills reference deprecated patterns?
- **Missing resources**: Would scripts/references/assets help?
- **Degrees of freedom mismatch**: Are critical operations too flexible or vice versa?
- **Excessive length**: Are skills over 5,000 words when they could be concise?

**For command-builder**:
- **Repetitive workflows**: Are users repeatedly asking for the same multi-step processes?
- **Missing slash commands**: Could workflows be automated with new commands?
- **Unclear workflows**: Do existing commands have ambiguous steps?
- **Missing conditions**: Should commands handle more branching scenarios?
- **Poor error handling**: Do commands fail gracefully?
- **Incomplete reports**: Do commands clearly summarize what happened?
- **Workflow friction**: Are there pain points in development that commands could smooth?

### Analysis Sources

The builder agents should analyze both conversation and code:

**Conversation Context Analysis**:
- Look for patterns across multiple interactions
- Identify repeated questions or clarifications needed
- Note successful vs problematic approaches
- Recognize emerging workflows that could be automated
- Detect domain knowledge gaps Claude repeatedly encounters
- Observe user friction points in current workflows

**Git Changes Analysis**:
- Check `git status` for uncommitted changes
- Run `git diff` to see what code changed
- Focus on architectural or structural changes
- Look for new directories, modules, or patterns
- Identify new scripts, commands, or workflows introduced
- Note dependency additions or configuration changes
- Ignore line-level details unless they reveal broader patterns

**Existing Ecosystem Review**:
- Read all existing agents in `.claude/agents/`
- Read all existing skills in `.claude/skills/`
- Read all existing commands in `.claude/commands/`
- Identify gaps, overlaps, and optimization opportunities
- Check for outdated references to moved/renamed files
- Verify tool access follows principle of least privilege
- Assess if model selection is optimal

## Examples

### Example 1: Sequential Workflow with Dependencies

User: "Reflect on our conversation and suggest improvements"

**Phase 1: Supervisor Initial Report**

Assistant analyzes conversation and git changes, then produces:

```markdown
## Reflection Analysis Report

### Observed Context
**Conversation Summary**: Worked on database migration feature, discussed async testing patterns, debugged SQL injection vulnerability
**Git Changes**: Added new migration files, updated database schema, modified authentication endpoints

### Current Ecosystem State
- **Agents**: 7 existing (agent-builder, skill-builder, command-builder, code-review, blog-writer, system-architect, technical-writer)
- **Skills**: 5 existing (reflection, test-backend, test-frontend, manage-app, explaining-code)
- **Commands**: 5 existing (build, plan, prime, worktree, reflection)

### Identified Opportunities

#### Agents
- code-review agent lacks security-specific checklist (missed SQL injection)
- Gap: No specialized database agent for migrations/queries

#### Skills
- test-backend skill missing async testing patterns
- Gap: No database schema design skill

#### Commands
- Repetitive workflow: User manually ran migration steps 3 times
- Gap: No /migrate command to automate this

### Recommendation
**Approach**: Full Sequential
**Reasoning**: New database agent → new database skill → new migrate command that uses both. Clear dependency chain.

### Dependency Assessment
**Can Parallelize**: No
**Reason**: The proposed database command would depend on the database agent and database skill. Must build in Agents → Skills → Commands order.
```

**Phase 2: User Decision Point**

Assistant presents options:

```markdown
Based on the analysis above, how should I proceed?

**Options**:
1. **Full Sequential (Recommended if dependencies exist)** - Run agent-builder, then skill-builder, then command-builder in order
2. **Parallel (Fast if no dependencies)** - Run all three builders simultaneously
3. **Agents Only** - Only review and propose agent improvements
4. **Skills Only** - Only review and propose skill improvements
5. **Commands Only** - Only review and propose command improvements
6. **Skip** - No changes needed at this time

Please select an option (1-6):
```

User: "Option 1 - Full Sequential"

**Phase 3: Builder Invocation - Step 1: Agent Builder**

[Assistant spawns agent-builder agent]

Agent-builder completes and provides proposals. Assistant presents:

```markdown
## Agent Proposals

**Improvements to Existing Agents**:
- [ ] #A1: code-review - Add OWASP Top 10 security checklist
      **File**: `.claude/agents/code-review.md`
      **Current**: General code review without specific security focus
      **Proposed**: Add dedicated security review section with OWASP Top 10 checklist
      **Justification**: Missed SQL injection vulnerability in conversation
      **Priority**: High

**New Agents to Create**:
- [ ] #A2: database-expert - New agent for database operations
      **File**: `.claude/agents/database-expert.md`
      **Proposed**: Specialized agent for migrations, queries, schema design
      **Justification**: Repeated database questions across conversation
      **Priority**: Medium

**Options**:
- [ ] Accept All
- [ ] Custom - I'll specify modifications in my response
- [ ] Skip All

Which improvements should I apply?
```

User: "Accept All"

[Assistant applies #A1 and #A2]

Applied successfully:
- ✓ Updated code-review agent
- ✓ Created database-expert agent

**Phase 3: Builder Invocation - Step 2: Skill Builder**

[Assistant spawns skill-builder agent, now aware of new database-expert agent]

Skill-builder completes. Assistant presents:

```markdown
## Skill Proposals

**Improvements to Existing Skills**:
- [ ] #S1: test-backend - Add async testing patterns
      **File**: `.claude/skills/test-backend/SKILL.md`
      **Current**: Missing guidance on async/await testing
      **Proposed**: Add section on pytest-asyncio patterns
      **Justification**: Struggled with async test setup twice
      **Priority**: High

**New Skills to Create**:
- [ ] #S2: database-design - New skill for database schema design
      **File**: `.claude/skills/database-design/SKILL.md`
      **Proposed**: Best practices for migrations, indexing, normalization
      **Justification**: Would complement new database-expert agent
      **Priority**: Medium

**Options**:
- [ ] Accept All
- [ ] Custom
- [ ] Skip All

Which improvements should I apply?
```

User: "Accept All"

[Assistant applies #S1 and #S2]

Applied successfully:
- ✓ Updated test-backend skill
- ✓ Created database-design skill

**Phase 3: Builder Invocation - Step 3: Command Builder**

[Assistant spawns command-builder agent, now aware of database-expert agent and database-design skill]

Command-builder completes. Assistant presents:

```markdown
## Command Proposals

**New Commands to Create**:
- [ ] #C1: /migrate - Automate database migration workflow
      **File**: `.claude/commands/migrate.md`
      **Proposed**: Generate migration → review with database-expert → apply → verify
      **Justification**: User manually ran migration steps 3 times
      **Priority**: High

**Options**:
- [ ] Accept All
- [ ] Custom
- [ ] Skip All

Which improvements should I apply?
```

User: "Accept All"

[Assistant applies #C1]

Applied successfully:
- ✓ Created /migrate command

**Phase 4: Sync Documentation**

[Assistant updates CLAUDE.md with new agents, skills, and commands]

Updated CLAUDE.md "AI Agent Workflows" section ✓

**Summary**:
- ✓ Updated 1 agent (code-review)
- ✓ Created 1 agent (database-expert)
- ✓ Updated 1 skill (test-backend)
- ✓ Created 1 skill (database-design)
- ✓ Created 1 command (/migrate)
- ✓ Synced CLAUDE.md documentation

All improvements applied successfully. The agent ecosystem now has enhanced security reviews, database expertise, and automated migration workflow.

### Example 2: Parallel Workflow (No Dependencies)

User: "Reflect on the conversation"

**Phase 1: Supervisor Initial Report**

```markdown
## Reflection Analysis Report

### Observed Context
**Conversation Summary**: Discussed code formatting preferences, updated linting rules
**Git Changes**: Modified .prettierrc, updated ESLint config

### Current Ecosystem State
- **Agents**: 8 existing
- **Skills**: 6 existing
- **Commands**: 6 existing

### Identified Opportunities

#### Agents
- No gaps identified, all agents working well

#### Skills
- explaining-code skill could benefit from linting best practices section

#### Commands
- No repetitive workflows observed

### Recommendation
**Approach**: Skills Only (or Parallel if we want all builders to review)
**Reasoning**: Only one improvement needed, isolated to skills domain

### Dependency Assessment
**Can Parallelize**: Yes
**Reason**: The linting improvement to explaining-code skill is independent and doesn't depend on any new agents or impact any commands
```

**Phase 2: User Decision Point**

User: "Option 4 - Skills Only"

**Phase 3: Builder Invocation**

[Assistant spawns only skill-builder]

```markdown
## Skill Proposals

**Improvements to Existing Skills**:
- [ ] #S1: explaining-code - Add linting best practices
      **File**: `.claude/skills/explaining-code/SKILL.md`
      **Current**: Focuses on code explanation, doesn't mention linting
      **Proposed**: Add section on explaining linting rules and auto-formatting
      **Justification**: Recent conversation involved linting configuration
      **Priority**: Low

**Options**:
- [ ] Accept All
- [ ] Skip All
```

User: "Accept All"

[Assistant applies #S1]

**Phase 4: Sync Documentation**

Updated CLAUDE.md ✓

**Summary**:
- ✓ Updated 1 skill (explaining-code)
- ✓ Synced CLAUDE.md

### Example 3: Skip - No Changes Needed

User: "Reflect on our work"

**Phase 1: Supervisor Initial Report**

```markdown
## Reflection Analysis Report

### Observed Context
**Conversation Summary**: Brief status check on current project
**Git Changes**: No uncommitted changes

### Current Ecosystem State
- **Agents**: 8 existing
- **Skills**: 6 existing
- **Commands**: 6 existing

### Identified Opportunities

#### Agents
No improvements needed - all agents up-to-date

#### Skills
No gaps identified

#### Commands
No repetitive workflows observed

### Recommendation
**Approach**: Skip
**Reasoning**: Conversation was brief status check, no patterns emerged that warrant ecosystem changes

### Dependency Assessment
**Can Parallelize**: N/A
**Reason**: No changes recommended
```

**Phase 2: User Decision Point**

User: "Option 6 - Skip"

No builder agents invoked. Reflection complete.

## Guidelines

### Supervisor Analysis Best Practices

**When analyzing conversation context**:
- Look for PATTERNS across multiple interactions, not one-off occurrences
- Identify repeated questions or clarifications as signals of missing knowledge
- Note successful vs problematic approaches
- Recognize emerging workflows that could be automated

**When analyzing git changes**:
- Focus on architectural/structural changes, not line-level details
- Look for new directories, modules, or patterns
- Identify dependency additions or configuration changes that signal new domains
- Ignore formatting-only changes unless they reveal broader patterns

**When making recommendations**:
- Default to **Sequential** when there are cross-dependencies (new agents → new skills → new commands using those)
- Recommend **Parallel** only when improvements are truly independent
- Recommend **Single Builder** when only one domain needs attention
- Recommend **Skip** when conversation was brief or no clear patterns emerged

### Dependency Assessment Guidelines

**Can parallelize when**:
- Improvements are isolated to existing components (no new creations)
- No new agent needs new skills
- No new command depends on new agents/skills
- Changes are truly independent refinements

**Must use sequential when**:
- Creating new agents that will need new skills
- Creating new skills that complement new agents
- Creating new commands that depend on new agents or skills
- Clear dependency chain exists

### Quality Standards for Initial Report

**The supervisor report should**:
- Summarize conversation in 1-2 sentences focused on patterns
- Highlight architectural changes from git, not every file
- Provide accurate counts of current ecosystem
- Identify high-impact opportunities, not minor tweaks
- Make clear recommendation with reasoning
- Honestly assess dependencies

**Avoid**:
- Recommending changes for one-time user requests
- Suggesting minor wording improvements without functional impact
- Creating duplicate capabilities
- Over-engineering simple workflows

### CLAUDE.md Sync Requirements

**Only update CLAUDE.md if changes were actually applied:**

Update or create "AI Agent Workflows" section with:
- List of available agents with brief purposes
- List of available skills with triggering conditions
- List of available commands with usage patterns
- Workflow recommendations for using the ecosystem

**Keep it concise:**
- Focus on WHAT exists, not HOW it works (that's in individual files)
- Ensure future AI agents can discover capabilities
- Don't duplicate detailed instructions from agent/skill/command files

### Quality Standards

**Proposed improvements should be:**
- Specific and actionable with concrete file paths
- Justified by conversation patterns or git changes
- Prioritized (High/Medium/Low) based on impact
- Concise but complete in descriptions
- Non-overlapping with existing capabilities (unless improving them)

**Avoid:**
- Vague suggestions without specific file targets
- Improvements based on one-off user requests
- Duplicate capabilities across multiple agents/skills/commands
- Minor stylistic changes without functional impact
- Over-engineering simple workflows

## Important Notes

### Supervisor-First Approach (CRITICAL)

This skill ALWAYS begins as a supervisor, never jumping directly to builder agents:

1. **Phase 1 is MANDATORY**: Always produce the initial analysis report first
2. **User decides the approach**: Present options and wait for user selection
3. **No assumptions**: Don't assume Sequential/Parallel/Skip - let the user choose based on your analysis

### Interactive Nature (CRITICAL)

This skill has TWO required interaction points:

1. **After Supervisor Report**: User selects which approach (Sequential/Parallel/Single/Skip)
2. **During each Builder Phase**: User approves/rejects each set of proposals

Never make changes without explicit user approval at each phase.

### Understanding the Dependency Chain

**Agents → Skills → Commands** creates natural dependencies:

- **Agents** define WHO: If you create a database-expert agent...
- **Skills** define WHAT: ...it might need a database-design skill...
- **Commands** define HOW: ...and a /migrate command might use both

**When dependencies exist**: Use Sequential mode to build in order
**When independent**: Parallel mode works, but Sequential is safer default

### This is META-Improvement

Remember: This skill is NOT about improving project code or user documentation. It's about improving the AI agent ecosystem itself:

- **Agents**: Specialized sub-agents that execute tasks
- **Skills**: Domain knowledge that guides Claude's behavior
- **Commands**: Slash command workflows for automation

The goal is to make the AI agent infrastructure better, which indirectly improves all future work.

### Sequential vs Parallel Decision Making

**Default to Sequential when**:
- Creating any new agents, skills, or commands (may have dependencies)
- Unclear if changes are truly independent
- User is unsure (Sequential is safer)

**Only recommend Parallel when**:
- All changes are improvements to existing components
- No new creations that could depend on each other
- Changes are clearly isolated to different domains
- Supervisor analysis shows NO dependencies

### Degrees of Freedom

This skill has:
- **Medium degrees of freedom** for supervisor analysis (judgment on patterns and opportunities)
- **High degrees of freedom** for builder agents (what to propose)
- **Low degrees of freedom** when applying changes (must match user's exact approval)

### Context Efficiency

**In Supervisor Report**:
- Keep conversation summary to 1-2 sentences
- Highlight only significant git changes
- Identify 2-4 high-impact opportunities per category
- Be honest about "No changes needed"

**In Builder Proposals**:
- Quality over quantity
- 3-5 well-considered improvements better than 20 minor ones
- Focus on patterns and recurring issues, not one-offs
- Prioritize High-impact changes
