# Plan: Commit Spec A & Plan, Open Draft PR with Issue Refs

## Context

Spec A (`specs/spec-a-minimal-backend.md`) defines the OpenShell DeepAgent sandbox backend — a minimal provider integration following the existing Daytona pattern. GitHub issue created:
- **Orchestra:** ruska-ai/orchestra#892 — OpenShell DeepAgent Sandbox Backend (Spec A)

Now we need to commit the spec and plan files and open a draft PR. No code changes.

## Steps

1. Create branch `spec/892-openshell-sandbox` from `development`
2. Stage and commit:
   - `specs/spec-a-minimal-backend.md`
   - `.claude/plans/spec-a-openshell-sandbox.md`
3. Push branch
4. Open draft PR targeting `development` referencing #892

## Verification

- Draft PR exists and is linked to #892
- Only spec and plan files are included (no code changes)
