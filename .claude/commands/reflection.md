# Reflection

META-improve the AI agent ecosystem by analyzing conversation context and git changes (unstaged, expected to be current work) to propose strategic improvements to agents, skills, commands, and documentation. This command ALWAYS starts with supervisor analysis, then spawns builder agents based on user-approved approach.

## Workflow

### Phase 1: Supervisor Initial Report (ALWAYS FIRST)

1. _ANALYZE_ conversation context:
   - Review conversation history for patterns and repeated questions
   - Identify successful vs problematic approaches
   - Note domain knowledge gaps or user friction points
   - Look for workflows that could be automated

2. _ANALYZE_ git changes:
   - RUN `git status` to see uncommitted changes
   - RUN `git diff` to understand what code changed
   - Focus on architectural/structural changes
   - Identify new patterns, modules, or workflows introduced

3. _REVIEW_ current ecosystem state:
   - Count existing agents in `.claude/agents/`
   - Count existing skills in `.claude/skills/`
   - Count existing commands in `.claude/commands/`
   - Identify gaps, overlaps, and optimization opportunities

4. _PRODUCE_ initial analysis report with:
   - Observed context summary (conversation + git changes)
   - Current ecosystem counts (agents, skills, commands)
   - Identified opportunities per category
   - Recommendation (Sequential/Parallel/Single/Skip)
   - Dependency assessment (can parallelize: yes/no with reason)

5. _STOP_ and wait for user decision

### Phase 2: User Decision Point (INTERACTIVE)

6. _PRESENT_ approach options to user:
   - **Option 1**: Full Sequential (Recommended) - Run agent-builder → skill-builder → command-builder in order
   - **Option 2**: Parallel (Fast) - Run all three builders simultaneously
   - **Option 3**: Agents Only - Only review/propose agent improvements
   - **Option 4**: Skills Only - Only review/propose skill improvements
   - **Option 5**: Commands Only - Only review/propose command improvements
   - **Option 6**: Skip - No changes needed at this time

7. _WAIT_ for user to select option (1-6)

### Phase 3: Builder Invocation (CONDITIONAL)

#### IF Option 1: Full Sequential

8. _INVOKE_ agent-builder agent with Task
9. _PRESENT_ agent proposals to user with #A1, #A2, etc. format
10. _WAIT_ for user approval
11. _APPLY_ approved agent changes
12. _INVOKE_ skill-builder agent with Task (now aware of new/updated agents)
13. _PRESENT_ skill proposals to user with #S1, #S2, etc. format
14. _WAIT_ for user approval
15. _APPLY_ approved skill changes
16. _INVOKE_ command-builder agent with Task (now aware of new/updated agents and skills)
17. _PRESENT_ command proposals to user with #C1, #C2, etc. format
18. _WAIT_ for user approval
19. _APPLY_ approved command changes

#### IF Option 2: Parallel

8. _INVOKE_ all three builder agents IN PARALLEL:
   - Spawn agent-builder agent
   - Spawn skill-builder agent
   - Spawn command-builder agent
9. _CONSOLIDATE_ all proposals into single list
10. _PRESENT_ all proposals in ONE question with sections (Agents, Skills, Commands)
11. _WAIT_ for user approval
12. _APPLY_ approved changes in dependency order (agents first, skills second, commands third)

#### IF Option 3-5: Single Builder

8. _INVOKE_ only the selected builder agent (agent-builder OR skill-builder OR command-builder)
9. _PRESENT_ proposals to user
10. _WAIT_ for user approval
11. _APPLY_ approved changes

#### IF Option 6: Skip

8. No builder agents invoked. End workflow.

### Phase 4: Sync Documentation (FINAL STEP)

20. _IF_ any changes were applied:
    - _UPDATE_ `CLAUDE.md` "AI Agent Workflows" section
    - List all available agents with purposes
    - List all available skills with triggers
    - List all available commands with usage
    - Update workflow recommendations

## Report

Summarize the reflection workflow:
- Supervisor recommendation and user choice
- Number of proposals by category (agents, skills, commands)
- Proposals approved and applied
- Files created or updated
- CLAUDE.md sync status
- Current state of AI agent ecosystem (final counts)
