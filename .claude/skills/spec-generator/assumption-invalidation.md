# Skill: Assumption Invalidation

## Purpose
Challenge and test assumptions made during analysis to ensure specifications are grounded in evidence, not speculation.

## Single Responsibility
Identify, document, and validate or invalidate assumptions.

## Invocation
```
skill: assumption-invalidation
inputs:
  - context: object (from context-extraction)
  - changes: object (from change-detection)
  - gaps: object (from gap-analysis)
```

## Process

1. **Extract Implicit Assumptions**
   - What does the code assume about inputs?
   - What does the code assume about system state?
   - What does the code assume about user behavior?
   - What does the code assume about dependencies?

2. **Test Each Assumption**
   - Is there evidence supporting this assumption?
   - Is there evidence contradicting this assumption?
   - Is the assumption documented anywhere?

3. **Categorize Results**
   ```yaml
   assumptions:
     validated:
       - id: ASM-001
         assumption: <what was assumed>
         evidence: <supporting evidence>
         confidence: <high|medium>
     invalidated:
       - id: ASM-002
         assumption: <what was assumed>
         contradiction: <contradicting evidence>
         recommendation: <how to address>
     unverified:
       - id: ASM-003
         assumption: <what was assumed>
         risk_if_wrong: <impact if assumption is false>
         verification_needed: <how to verify>
   ```

## Output
Returns categorized assumptions with validation status.

## Common Assumption Patterns to Check
- "This endpoint already exists"
- "The database schema supports this"
- "The frontend can handle this response format"
- "Users will only use this feature in X way"
- "This dependency is already installed"
- "The auth system covers this case"
