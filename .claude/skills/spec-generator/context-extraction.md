# Skill: Context Extraction

## Purpose
Extract development intent and context from the codebase using the `context-explorer` agent.

## Single Responsibility
Invoke `context-explorer` and transform its output into structured context data for spec generation.

## Invocation
```
skill: context-extraction
inputs:
  - branch: string (optional, defaults to current branch)
  - base: string (optional, defaults to main/development)
  - focus: string (optional, specific area to focus on)
```

## Process

1. **Invoke Context Explorer**
   ```
   /context-explorer [branch] [options]
   ```

2. **Capture Output**
   - Intent summary
   - Changed files list
   - Commit analysis
   - Documentation deltas

3. **Structure Results**
   ```yaml
   context:
     source_branch: <branch>
     base_branch: <base>
     extraction_timestamp: <ISO timestamp>
     intent:
       summary: <extracted intent>
       confidence: <high|medium|low>
     changes:
       files: [<list of changed files>]
       domains: [<affected domains: backend, frontend, etc>]
       scope: <narrow|moderate|broad>
     evidence:
       commits: [<relevant commit summaries>]
       documentation: [<doc changes if any>]
   ```

## Output
Returns a structured context object that other skills consume.

## Dependencies
- `context-explorer` skill must be available

## Error Handling
- If no changes detected: Return empty context with note
- If context-explorer fails: Return error state with diagnostic info
