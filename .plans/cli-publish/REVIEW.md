# Architecture Council Review: @ruska/ruska-cli CI/CD Implementation

## Executive Summary

This document synthesizes three independent proposals for implementing CI/CD publishing for the `@ruska/ruska-cli` package. After rigorous analysis, we present a unified implementation blueprint that selects the optimal components from each proposal.

**Final Verdict:** A hybrid approach combining Proposal 1's robust CI workflow, Proposal 2's package.json optimization, and Proposal 3's security framework delivers the most maintainable, resilient, and secure solution.

---

## Decision Matrix Analysis

### 1. Which approach provides the cleanest `package.json` maintenance?

| Criterion           | Proposal 1                  | Proposal 2                 | Proposal 3              | Winner |
| ------------------- | --------------------------- | -------------------------- | ----------------------- | ------ |
| Script completeness | Minimal (5 scripts)         | Comprehensive (12 scripts) | External scripts        | **P2** |
| Lifecycle hooks     | `prepublishOnly` only       | Full lifecycle coverage    | Defers to shell scripts | **P2** |
| Metadata fields     | Good (7 fields)             | Excellent (10+ fields)     | Basic                   | **P2** |
| ESM exports         | Not included                | Full exports map           | Not included            | **P2** |
| Typo fix            | Yes (`pacakge` → `package`) | Yes (`pacakge` → `link`)   | References fix          | **P2** |

**Winner: Proposal 2** - Provides the most complete, maintainable package.json structure with proper ESM exports, comprehensive lifecycle scripts, and all necessary metadata fields.

### 2. Which workflow is most resilient to failed builds?

| Criterion                 | Proposal 1                         | Proposal 2     | Proposal 3              | Winner |
| ------------------------- | ---------------------------------- | -------------- | ----------------------- | ------ |
| CI multi-job architecture | 4 parallel jobs with gates         | No CI workflow | Single job              | **P1** |
| Version validation gate   | Tag-to-package.json check          | No             | Via shell script        | **P1** |
| Post-publish verification | Automated NPM check + install test | No             | Manual checklist        | **P1** |
| Manual fallback           | Not provided                       | Not provided   | 5 comprehensive scripts | **P3** |
| Retry mechanisms          | 5-attempt NPM verification         | No             | Documented procedures   | **P1** |

**Winner: Proposal 1 for CI, Proposal 3 for Fallbacks** - Proposal 1's multi-job workflow with quality gates provides the strongest automated resilience, while Proposal 3's manual scripts fill the gap when CI fails.

### 3. Does the `.npmignore` strategy effectively minimize package size?

| Criterion                  | Proposal 1      | Proposal 2                         | Proposal 3        | Winner    |
| -------------------------- | --------------- | ---------------------------------- | ----------------- | --------- |
| `.npmignore` provided      | No              | Yes (comprehensive)                | No                | **P2**    |
| `files` field optimization | `["dist"]` only | `["dist", "!dist/__tests__"]`      | Basic             | **P2**    |
| Test file exclusion        | Not addressed   | Dual approach (.npmignore + files) | Pre-publish check | **P2**    |
| Size reduction estimate    | Not calculated  | ~16% reduction quantified          | Not calculated    | **P2**    |
| Sensitive file protection  | Not addressed   | Explicit patterns                  | Security script   | **P2+P3** |

**Winner: Proposal 2** - Only proposal that provides both `.npmignore` AND `files` field negation patterns, with quantified size reduction analysis.

---

## Conflict Resolution

### Conflict 1: Repository URL

| Proposal | URL                              |
| -------- | -------------------------------- |
| P1       | `github.com/ruska-ai/orchestra`  |
| P2       | `github.com/enso-labs/orchestra` |
| P3       | `github.com/enso-labs/orchestra` |

**Resolution:** Use `github.com/enso-labs/orchestra` (matches actual repository location).

### Conflict 2: Package Scope

| Proposal | Package Name                        |
| -------- | ----------------------------------- |
| P1       | `@ruska/ruska-cli`                  |
| P2       | `ruska` (example), mentions scoping |
| P3       | `@ruska/ruska-cli`                  |

**Resolution:** Use `@ruska/ruska-cli` (scoped packages provide namespace protection and organizational trust).

### Conflict 3: Version Management Approach

| Proposal | Approach                                |
| -------- | --------------------------------------- |
| P1       | CI validates tag matches package.json   |
| P2       | `version`/`postversion` hooks auto-push |
| P3       | Manual `version-bump.sh` script         |

**Resolution:**

- Use P1's CI validation (prevents mismatched publishes)
- Use P2's `version` hook (formats code before commit)
- **Remove** P2's `postversion` hook (conflicts with CI workflow - CI should create tags)
- Use P3's `version-bump.sh` for local development workflow

### Conflict 4: Workflow Location

| Proposal | Location                                                                    |
| -------- | --------------------------------------------------------------------------- |
| P1       | `cli/.github/workflows/publish.yml` OR `/.github/workflows/cli-publish.yml` |
| P3       | `cli/.github/workflows/publish.yml`                                         |

**Resolution:** Use root `/.github/workflows/cli-publish.yml` with `cli-v*.*.*` tag pattern. This:

- Keeps all workflows in one location
- Allows for future package-specific tags
- Matches existing repository patterns

### Conflict 5: NPM Provenance

| Proposal | Provenance                   |
| -------- | ---------------------------- |
| P1       | `--provenance` flag included |
| P3       | Not included                 |

**Resolution:** Include `--provenance` flag (SLSA Level 2 compliance, supply chain security).

---

## Final Implementation Blueprint

### Component Selection Summary

| Component                   | Source      | Rationale                                     |
| --------------------------- | ----------- | --------------------------------------------- |
| **GitHub Actions Workflow** | Proposal 1  | Most robust multi-job architecture with gates |
| **package.json Scripts**    | Proposal 2  | Most comprehensive lifecycle coverage         |
| **package.json Metadata**   | Proposal 2  | Complete ESM exports and discoverability      |
| **.npmignore**              | Proposal 2  | Only comprehensive solution provided          |
| **files Field**             | Proposal 2  | Negation pattern for test exclusion           |
| **Manual Publish Scripts**  | Proposal 3  | Essential CI fallback capability              |
| **Security Architecture**   | Proposal 3  | Token management, 2FA, access control         |
| **Troubleshooting Guide**   | Proposal 3  | Operational documentation                     |
| **Tag Pattern**             | Modified P1 | `cli-v*.*.*` for monorepo clarity             |

---

## Implementation Files

### 1. Updated `package.json` (Source: P2 + P1 modifications)

```json
{
	"name": "@ruska/ruska-cli",
	"version": "0.1.0",
	"description": "CLI for Orchestra - AI Agent Orchestration Platform",
	"license": "MIT",
	"author": "RUSKA <contact@ruska.ai>",
	"homepage": "https://github.com/enso-labs/orchestra/tree/main/cli#readme",
	"repository": {
		"type": "git",
		"url": "git+https://github.com/enso-labs/orchestra.git",
		"directory": "cli"
	},
	"bugs": {
		"url": "https://github.com/enso-labs/orchestra/issues"
	},
	"keywords": [
		"cli",
		"ai",
		"agent",
		"orchestra",
		"ruska",
		"llm",
		"chatbot",
		"assistant"
	],
	"bin": {
		"ruska": "dist/cli.js"
	},
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/cli.d.ts",
			"import": "./dist/cli.js"
		}
	},
	"main": "./dist/cli.js",
	"types": "./dist/cli.d.ts",
	"engines": {
		"node": ">=18"
	},
	"files": ["dist", "!dist/__tests__"],
	"scripts": {
		"start": "npm run build && node dist/cli.js",
		"dev": "tsc --watch",
		"build": "tsc",
		"build:clean": "rm -rf dist && npm run build",
		"format": "prettier --write \"**/*.{ts,tsx,json,md}\" && xo --fix",
		"format:check": "prettier --check .",
		"lint": "xo",
		"test": "npm run lint && npm run build && ava",
		"test:unit": "npm run build && ava",
		"prepack": "npm run build:clean",
		"prepublishOnly": "npm run test && npm run build:clean",
		"version": "npm run format && git add -A",
		"link": "npm install && npm run build && npm link",
		"package:local": "npm run build:clean && npm pack"
	},
	"publishConfig": {
		"access": "public",
		"registry": "https://registry.npmjs.org"
	},
	"dependencies": {
		"fullscreen-ink": "^0.1.0",
		"ink": "^5.0.1",
		"ink-big-text": "^2.0.0",
		"ink-gradient": "^3.0.0",
		"ink-select-input": "^6.2.0",
		"ink-spinner": "^5.0.0",
		"ink-text-input": "^6.0.0",
		"meow": "^11.0.0",
		"react": "^18.2.0"
	},
	"devDependencies": {
		"@sindresorhus/tsconfig": "^3.0.1",
		"@types/react": "^18.0.32",
		"@vdemedes/prettier-config": "^2.0.1",
		"ava": "^5.2.0",
		"chalk": "^5.2.0",
		"eslint-config-xo-react": "^0.27.0",
		"eslint-plugin-react": "^7.32.2",
		"eslint-plugin-react-hooks": "^4.6.0",
		"ink-testing-library": "^3.0.0",
		"prettier": "2.8.8",
		"ts-node": "^10.9.1",
		"tsx": "^4.21.0",
		"typescript": "^5.0.3",
		"xo": "^0.53.1"
	},
	"ava": {
		"files": ["dist/__tests__/**/*.test.js"]
	},
	"xo": {
		"extends": "xo-react",
		"prettier": true,
		"ignores": ["dist/**"],
		"rules": {
			"react/prop-types": "off",
			"unicorn/expiring-todo-comments": "off",
			"ava/no-ignored-test-files": "off"
		}
	},
	"prettier": "@vdemedes/prettier-config"
}
```

**Key Changes from Current State:**

1. Package name changed to `@ruska/ruska-cli`
2. Version bumped to `0.1.0` for first release
3. Added `exports`, `main`, `types` fields
4. Added `publishConfig` for scoped public access
5. Fixed typo: `pacakge` → `link`
6. Added lifecycle scripts: `prepack`, `prepublishOnly`, `version`
7. Added utility scripts: `build:clean`, `lint`, `test:unit`, `package:local`
8. `files` field updated with negation pattern

### 2. `.npmignore` (Source: P2)

Create file at `cli/.npmignore`:

```gitignore
# Source files (TypeScript sources not needed in published package)
source/

# Test files in dist
dist/__tests__/
**/*.test.js
**/*.test.d.ts
**/*.spec.js
**/*.spec.d.ts

# Development configuration
.editorconfig
.eslintignore
.eslintrc
.prettierignore
.prettierrc
tsconfig.json

# CI/CD and editor configs
.github/
.vscode/

# Git files
.git
.gitignore
.gitattributes

# Development files
*.log
*.tmp
.DS_Store
Thumbs.db

# Lock files (npm auto-excludes but being explicit)
package-lock.json

# Development and review docs
PROPOSAL*.md
REVIEW.md
CHANGELOG.md
CONTRIBUTING.md
```

### 3. GitHub Actions Workflow (Source: P1 + modifications)

Create file at `.github/workflows/cli-publish.yml`:

```yaml
name: CLI - Publish to NPM

on:
  push:
    tags:
      - 'cli-v*.*.*' # CLI-specific semantic version tags

permissions:
  contents: read
  id-token: write # Required for NPM provenance

defaults:
  run:
    working-directory: ./cli

jobs:
  #################################################################
  ## Quality Gates - Must pass before publish
  #################################################################
  quality-check:
    name: Quality Gates
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: cli/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run format check
        run: npm run format:check

      - name: Run linter and tests
        run: npm test

      - name: Verify build
        run: npm run build

  #################################################################
  ## Version Validation - Ensure tag matches package.json
  #################################################################
  validate-version:
    name: Validate Version
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.extract.outputs.version }}
      is_prerelease: ${{ steps.extract.outputs.is_prerelease }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Extract and validate version
        id: extract
        run: |
          # Extract version from tag (remove 'cli-v' prefix)
          TAG_VERSION="${GITHUB_REF#refs/tags/cli-v}"
          echo "Tag version: $TAG_VERSION"

          # Read version from package.json
          PKG_VERSION=$(node -p "require('./cli/package.json').version")
          echo "Package version: $PKG_VERSION"

          # Validate versions match
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Version mismatch! Tag version ($TAG_VERSION) does not match package.json version ($PKG_VERSION)"
            echo "Please update package.json version before tagging."
            exit 1
          fi

          # Determine if prerelease
          if [[ "$TAG_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "is_prerelease=false" >> $GITHUB_OUTPUT
          else
            echo "is_prerelease=true" >> $GITHUB_OUTPUT
          fi

          echo "version=$TAG_VERSION" >> $GITHUB_OUTPUT
          echo "Version validated: $TAG_VERSION"
        working-directory: .

  #################################################################
  ## Publish to NPM
  #################################################################
  publish:
    name: Publish to NPM
    runs-on: ubuntu-latest
    needs: [quality-check, validate-version]
    environment:
      name: npm-publish
      url: https://www.npmjs.com/package/@ruska/ruska-cli
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
          cache-dependency-path: cli/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build package
        run: npm run build

      - name: Verify package contents
        run: |
          echo "Package contents:"
          npm pack --dry-run

      - name: Publish to NPM
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create publish summary
        run: |
          echo "## Published Package" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Package:** @ruska/ruska-cli" >> $GITHUB_STEP_SUMMARY
          echo "**Version:** ${{ needs.validate-version.outputs.version }}" >> $GITHUB_STEP_SUMMARY
          echo "**Prerelease:** ${{ needs.validate-version.outputs.is_prerelease }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "[View on NPM](https://www.npmjs.com/package/@ruska/ruska-cli)" >> $GITHUB_STEP_SUMMARY

  #################################################################
  ## Post-Publish Verification
  #################################################################
  verify-publish:
    name: Verify Publication
    runs-on: ubuntu-latest
    needs: [publish, validate-version]
    steps:
      - name: Wait for NPM propagation
        run: sleep 30

      - name: Verify package on NPM
        run: |
          VERSION="${{ needs.validate-version.outputs.version }}"
          echo "Verifying @ruska/ruska-cli@$VERSION on NPM..."

          # Retry up to 5 times with 10s delay
          for i in {1..5}; do
            if npm view "@ruska/ruska-cli@$VERSION" version 2>/dev/null; then
              echo "Package verified on NPM!"
              exit 0
            fi
            echo "Attempt $i: Package not yet available, waiting..."
            sleep 10
          done

          echo "::warning::Package verification timed out. Package may still be propagating."
        working-directory: .

      - name: Test installation
        run: |
          VERSION="${{ needs.validate-version.outputs.version }}"
          npm install -g "@ruska/ruska-cli@$VERSION"
          ruska --help
        working-directory: .
```

### 4. Manual Publish Scripts (Source: P3)

Create directory structure `cli/scripts/publish/` with these files from Proposal 3:

| Script                 | Purpose                                |
| ---------------------- | -------------------------------------- |
| `publish.sh`           | Main manual publish with safety checks |
| `pre-publish-check.sh` | Standalone safety verification         |
| `version-bump.sh`      | Semantic version management            |
| `rollback.sh`          | Emergency deprecation                  |
| `verify-build.sh`      | Build output verification              |

**Note:** Copy scripts verbatim from Proposal 3, Section "Manual Publish Scripts".

### 5. Security Configuration (Source: P3)

#### Required GitHub Secrets

| Secret      | Description                     | Source                                 |
| ----------- | ------------------------------- | -------------------------------------- |
| `NPM_TOKEN` | Automation token for publishing | npmjs.com > Access Tokens > Automation |

#### Required GitHub Environment

Create environment `npm-publish` with:

- **Required reviewers:** 1-2 maintainers (optional but recommended)
- **Deployment branches:** Tags matching `cli-v*.*.*`

#### NPM Organization Setup

1. Create `@ruska` organization at npmjs.com
2. Enable "Require 2FA" for organization members
3. Configure team structure per Proposal 3's security architecture

---

## Implementation Checklist

### Phase 1: Package Configuration (Day 1)

- [ ] Update `cli/package.json` with final configuration above
- [ ] Create `cli/.npmignore` file
- [ ] Create `cli/scripts/publish/` directory structure
- [ ] Add all 5 manual publish scripts from Proposal 3
- [ ] Make scripts executable: `chmod +x cli/scripts/publish/*.sh`
- [ ] Run `npm pack --dry-run` to verify package contents

### Phase 2: NPM Organization Setup (Day 1)

- [ ] Create `@ruska` organization on npmjs.com
- [ ] Enable 2FA for all organization members
- [ ] Generate automation token: `npm token create --type=automation`
- [ ] Document token in team password manager

### Phase 3: GitHub Configuration (Day 2)

- [ ] Add `NPM_TOKEN` to repository secrets
- [ ] Create `npm-publish` environment with protection rules
- [ ] Create `.github/workflows/cli-publish.yml` workflow
- [ ] Verify workflow file syntax with GitHub Actions linter

### Phase 4: Initial Release (Day 2-3)

- [ ] Ensure all tests pass: `cd cli && npm test`
- [ ] Verify build: `npm run build && npm pack --dry-run`
- [ ] Commit all changes: `git commit -am "feat(cli): configure NPM publishing"`
- [ ] Push to development branch
- [ ] Create and merge PR to main
- [ ] Create tag: `git tag cli-v0.1.0`
- [ ] Push tag: `git push origin cli-v0.1.0`
- [ ] Monitor GitHub Actions workflow

### Phase 5: Verification (Day 3)

- [ ] Verify package on NPM: `npm view @ruska/ruska-cli`
- [ ] Test installation: `npm install -g @ruska/ruska-cli`
- [ ] Verify CLI: `ruska --help`
- [ ] Test manual publish script (dry-run): `./scripts/publish/publish.sh --dry-run`

---

## Expected Outcomes

### Package Size

| Metric     | Before   | After  | Source      |
| ---------- | -------- | ------ | ----------- |
| Compressed | 23.8 kB  | ~20 kB | P2 analysis |
| Unpacked   | 108.7 kB | ~95 kB | P2 analysis |
| File count | 50       | 42     | P2 analysis |

### CI Performance

| Metric           | Expected                           | Source         |
| ---------------- | ---------------------------------- | -------------- |
| Quality gate job | 45-60s (uncached), 15-20s (cached) | P1 analysis    |
| Full workflow    | 3-4 minutes                        | P1 estimate    |
| NPM verification | 30-80s                             | P1 retry logic |

### Resilience Features

1. **Version mismatch prevention:** CI validates tag matches package.json
2. **Quality gates:** Tests must pass before publish job runs
3. **Post-publish verification:** Automated NPM availability check
4. **Manual fallback:** 5 scripts for CI failure scenarios
5. **Rollback capability:** Deprecation script with optional unpublish

---

## Questions Resolved

| Question              | Resolution                | Rationale                                   |
| --------------------- | ------------------------- | ------------------------------------------- |
| Package name?         | `@ruska/ruska-cli`        | Namespace protection, organizational trust  |
| Workflow location?    | Root `.github/workflows/` | Consistent with existing patterns           |
| Tag pattern?          | `cli-v*.*.*`              | Monorepo support, package-specific tags     |
| Repository URL?       | `enso-labs/orchestra`     | Matches actual repository                   |
| Changelog automation? | Not included              | Out of scope; consider release-please later |
| Slack notifications?  | Not included              | Out of scope; add via separate workflow     |

---

## Appendix: Proposal Attribution

| Component                 | P1  | P2  | P3  |
| ------------------------- | :-: | :-: | :-: |
| CI workflow architecture  | ✅  |     |     |
| Multi-job quality gates   | ✅  |     |     |
| Version validation        | ✅  |     |     |
| Post-publish verification | ✅  |     |     |
| NPM provenance            | ✅  |     |     |
| package.json scripts      |     | ✅  |     |
| ESM exports configuration |     | ✅  |     |
| Package metadata          |     | ✅  |     |
| .npmignore file           |     | ✅  |     |
| Package size analysis     |     | ✅  |     |
| Manual publish scripts    |     |     | ✅  |
| Security architecture     |     |     | ✅  |
| Token management          |     |     | ✅  |
| Troubleshooting guide     |     |     | ✅  |
| Rollback procedures       | ✅  |     | ✅  |

---

_Document prepared by: Senior Architecture Council_
_Date: 2026-01-01_
_Status: APPROVED FOR IMPLEMENTATION_
