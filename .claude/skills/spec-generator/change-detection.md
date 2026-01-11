# Skill: Change Detection

## Purpose
Identify what has changed in the codebase and categorize changes by type, domain, and significance.

## Single Responsibility
Detect and categorize all changes relevant to the current development context.

## Invocation
```
skill: change-detection
inputs:
  - context: object (from context-extraction)
  - depth: string (shallow|deep, default: deep)
```

## Process

1. **Analyze Git Diff**
   - Compare current branch to base
   - Identify added, modified, deleted files
   - Calculate change magnitude

2. **Categorize Changes**
   - By domain: backend, frontend, cli, website, wiki, infrastructure
   - By type: feature, bugfix, refactor, config, docs, tests
   - By risk: low, medium, high

3. **Identify Patterns**
   - Related file clusters
   - Cross-domain impacts
   - Breaking change indicators

4. **Structure Output**
   ```yaml
   changes:
     summary: <one-line change summary>
     magnitude: <small|medium|large>
     categories:
       - domain: backend
         files: [...]
         type: feature
         risk: medium
       - domain: frontend
         files: [...]
         type: feature
         risk: low
     patterns:
       - <pattern description>
     cross_domain_impacts:
       - <impact description>
   ```

## Output
Returns categorized change analysis for downstream skills.

## Significance Assessment Criteria
- **Small**: <5 files, single domain, no API changes
- **Medium**: 5-20 files, 1-2 domains, possible API changes
- **Large**: >20 files, multiple domains, API or schema changes
