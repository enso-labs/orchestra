# Skill: Gap Analysis

## Purpose
Identify missing requirements, unclear specifications, and areas needing clarification before implementation can proceed confidently.

## Single Responsibility
Find and document gaps between current state and desired end state.

## Invocation
```
skill: gap-analysis
inputs:
  - context: object (from context-extraction)
  - changes: object (from change-detection)
  - target_outcome: string (description of desired end state)
```

## Process

1. **Requirement Completeness Check**
   - Are all user-facing changes documented?
   - Are API contracts defined?
   - Are edge cases addressed?
   - Are error states handled?

2. **Implementation Completeness Check**
   - Backend changes complete?
   - Frontend changes complete?
   - Tests written?
   - Migrations included?

3. **Documentation Completeness Check**
   - User docs updated?
   - API docs current?
   - README changes needed?

4. **Identify Gaps**
   ```yaml
   gaps:
     critical:
       - id: GAP-001
         area: <backend|frontend|docs|tests|config>
         description: <what's missing>
         impact: <why this matters>
         suggested_action: <how to resolve>
     important:
       - id: GAP-002
         ...
     minor:
       - id: GAP-003
         ...
   ```

## Output
Returns prioritized list of gaps with suggested resolutions.

## Gap Categories
- **Critical**: Blocks feature from working
- **Important**: Reduces quality or maintainability
- **Minor**: Nice-to-have improvements
