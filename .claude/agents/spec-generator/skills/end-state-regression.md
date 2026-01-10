# Skill: End-State Regression

## Purpose
Work backward from the desired outcome to identify all prerequisites, dependencies, and intermediate steps required to reach the goal.

## Single Responsibility
Decompose the end state into a dependency tree of requirements.

## Invocation
```
skill: end-state-regression
inputs:
  - target_outcome: string (description of desired end state)
  - context: object (from context-extraction)
  - current_state: object (from change-detection)
```

## Process

1. **Define End State Clearly**
   - What does "done" look like?
   - What can users do when this is complete?
   - What has changed in the system?

2. **Identify Final Dependencies**
   - What must be true for the end state to exist?
   - What components must be in place?

3. **Regress Recursively**
   - For each dependency, what are its prerequisites?
   - Continue until reaching current state or existing components

4. **Build Dependency Tree**
   ```yaml
   end_state:
     description: <target outcome>
     acceptance_criteria:
       - <criterion 1>
       - <criterion 2>
     dependency_tree:
       - step: <final step>
         requires:
           - step: <prerequisite>
             status: <exists|in_progress|missing>
             requires:
               - step: <deeper prerequisite>
                 status: <exists|in_progress|missing>
     critical_path:
       - <ordered list of must-complete items>
     parallel_tracks:
       - track: <independent work stream>
         items: [...]
   ```

## Output
Returns dependency tree and critical path for reaching end state.

## Regression Questions
At each level, ask:
- What must exist before this can work?
- What data does this need?
- What services does this call?
- What user actions precede this?
- What system state is assumed?
