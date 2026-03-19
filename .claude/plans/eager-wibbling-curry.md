# Plan: Commit Spec D & Plan, Open Draft PR with Issue Refs

## Context

Spec D (`specs/spec-d-mcp-sandbox.md`) is finalized. GitHub issues have been created in both repos:
- **Orchestra:** ruska-ai/orchestra#890 — MCP Sandbox Backend for DeepAgents
- **Sandboxes:** ruska-ai/sandboxes#3 — exec_server compatibility changes

Now we need to commit the spec and plan files and open a draft PR. No code changes.

## Steps

1. Create branch `spec/890-mcp-sandbox` from `development`
2. Stage and commit:
   - `specs/spec-d-mcp-sandbox.md`
   - `.claude/plans/eager-wibbling-curry.md`
3. Push branch
4. Open draft PR targeting `development` referencing #890 and ruska-ai/sandboxes#3

## Verification

- Draft PR exists and is linked to #890
- Only spec and plan files are included (no code changes)
