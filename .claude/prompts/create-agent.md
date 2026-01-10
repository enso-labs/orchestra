You will be generating a complete, production-ready agent system with full scaffolding. This system will create an AI agent with specialized expertise in a particular domain, designed to track changes and maintain clarity about a specific goal or outcome.

Here are the variables you will be working with:

<agent_name>
{{AGENT_NAME}}
</agent_name>

<target_domain>
{{TARGET_DOMAIN}}
</target_domain>

<goal_or_outcome>
{{GOAL_OR_OUTCOME}}
</goal_or_outcome>

<execution_env>
{{EXECUTION_ENV}}
</execution_env>

Your task is to generate a complete agent system that creates an expert agent for navigating the target_domain, tracking its latest changes, and continuously constructing a hyper-focused, up-to-date picture of the desired end state for the goal_or_outcome. This system must follow a repeatable, modular agent-construction workflow suitable for the execution_env environment.

The agent's primary capability must be:
- Becoming an expert at navigating the target_domain
- Tracking latest changes in that domain
- Continuously constructing a hyper-focused, up-to-date picture of the desired end state for the goal_or_outcome
- Explicitly reasoning about what has changed recently and why those changes matter

WORKFLOW REQUIREMENTS:

1. **Agent Creation**
Generate a Markdown file that will be named using the agent_name with a .md extension. This file must explicitly define:
- Mission statement
- Scope of authority (what the agent can and cannot do)
- Knowledge boundaries (what the agent knows and doesn't know)
- Update cadence (how often the agent should refresh its understanding)
- Output guarantees (what users can expect from the agent)

The agent definition must include explicit instructions for the agent to reason about:
- What has changed recently in the target_domain
- Why those changes matter relative to the goal_or_outcome

2. **Skill Scaffolding**
Generate a /skills directory containing individual skill files. Each skill must:
- Be single-responsibility (do one thing well)
- Be explicitly callable by name
- Reduce ambiguity around the end state
- Be documented in its own file

Required skills (at minimum):
- Change detection: Identify what has changed in the target_domain
- Gap analysis: Identify what's missing or unclear
- Assumption invalidation: Challenge and test assumptions
- End-state regression: Work backward from the goal_or_outcome
- Signal vs noise filtering: Distinguish important changes from irrelevant ones

3. **Command Scaffolding**
Generate a /commands directory containing individual command files. Each command must:
- Map to one or more skills
- Accept explicit inputs
- Produce deterministic outputs
- Be documented in its own file

Commands must enable:
- Re-running analysis as new information appears
- Periodic reassessment of the goal_or_outcome
- Progressive refinement across multiple execution cycles

4. **Iterative Regression Requirement**
The agent must be instructed to:
- Regress backward from the goal_or_outcome to identify prerequisites and dependencies
- Identify missing details and unclear assumptions at each step
- Explicitly document what additional clarity is required
- Improve the fidelity of the end-state model with each execution cycle

OUTPUT STRUCTURE:

Your response must generate the following artifacts:
1. A main agent definition file (using agent_name as the filename with .md extension)
2. Multiple skill files in a /skills directory
3. Multiple command files in a /commands directory

Each artifact should be clearly labeled and contain complete, executable content.

CONSTRAINTS:

- Do NOT summarize or provide meta-commentary
- Do NOT explain your reasoning outside of artifacts
- Do NOT ask clarifying questions
- Infer missing details where required and document assumptions inside the artifacts themselves
- Optimize for clarity, repeatability, and long-term reuse
- Output ONLY the generated artifacts with clear labels
- Make the system immediately usable in the execution_env environment

PROCESS:

Before generating the artifacts, use a <scratchpad> to:
1. Analyze the target_domain and goal_or_outcome to determine what specific skills and commands are needed
2. Plan the agent's mission statement and scope
3. Identify at least 5-7 specific skills that would be valuable
4. Identify at least 3-5 specific commands that would be useful
5. Consider what assumptions you're making and where to document them

After your scratchpad planning, generate each artifact clearly labeled with its filename and path. Use this format:

```
=== ARTIFACT: filename ===
[content]
=== END ARTIFACT ===
```

Begin your response with the scratchpad, then generate all artifacts. Do not include any commentary before, between, or after the artifacts beyond the artifact labels themselves.