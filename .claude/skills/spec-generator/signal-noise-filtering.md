# Skill: Signal vs Noise Filtering

## Purpose
Distinguish important changes and information from irrelevant noise to focus specification efforts on what matters.

## Single Responsibility
Filter and prioritize information by relevance to the target outcome.

## Invocation
```
skill: signal-noise-filtering
inputs:
  - context: object (from context-extraction)
  - changes: object (from change-detection)
  - target_outcome: string
```

## Process

1. **Classify Each Change**
   - Is this change directly related to the outcome?
   - Is this change a dependency of the outcome?
   - Is this change incidental/unrelated?

2. **Apply Relevance Filters**
   - Domain relevance: Does it affect the target domain?
   - Temporal relevance: Is it recent enough to matter?
   - Causal relevance: Does it influence the outcome?

3. **Identify Signal**
   ```yaml
   signals:
     high_relevance:
       - item: <change or information>
         relevance: <why this matters>
         action_required: <what to do with this>
     medium_relevance:
       - item: <change or information>
         relevance: <why this might matter>
         action_required: <optional action>
   ```

4. **Document Filtered Noise**
   ```yaml
   noise:
     filtered_out:
       - item: <change or information>
         reason: <why this was filtered>
     watch_list:
       - item: <change or information>
         reason: <why to monitor but not act on>
   ```

## Output
Returns filtered, prioritized information set.

## Noise Indicators
- Formatting-only changes
- Unrelated feature branches merged
- Dependency bumps without functional change
- Test file reorganization
- Documentation for unrelated features
