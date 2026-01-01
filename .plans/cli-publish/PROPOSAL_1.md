# CI/CD Proposal: NPM Publishing for @ruska/ruska-cli

## Executive Summary

This proposal outlines a comprehensive CI/CD pipeline for publishing the Ruska CLI package to NPM on GitHub tag creation. The solution leverages GitHub Actions with tag-triggered workflows, automated version detection, comprehensive testing gates, and optimized caching strategies to ensure reliable and efficient package releases.

**Key Benefits:**

- Automated publishing triggered by semantic version tags
- Pre-publish quality gates (linting, testing, build verification)
- Consistent caching for faster CI execution
- Secure secrets management via GitHub Secrets
- Rollback capability through NPM deprecation/unpublish mechanisms

---

## Current State Analysis

### Project Structure Analyzed

| File/Directory                    | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `/cli/package.json`               | Package manifest (name: `ruska`, version: `0.0.1`)          |
| `/cli/source/`                    | TypeScript source files                                     |
| `/cli/dist/`                      | Compiled JavaScript output                                  |
| `/cli/.github/workflows/test.yml` | Existing test workflow for Node 22.x                        |
| `/cli/tsconfig.json`              | TypeScript configuration extending `@sindresorhus/tsconfig` |

### Current Package Configuration

```json
{
	"name": "ruska",
	"version": "0.0.1",
	"bin": {"ruska": "dist/cli.js"},
	"type": "module",
	"engines": {"node": ">=18"},
	"files": ["dist"]
}
```

### Identified Gaps

1. **Package Name**: Current name is `ruska` - should be scoped as `@ruska/ruska-cli` for NPM organization namespace
2. **No Publish Workflow**: No existing workflow for NPM publishing
3. **Version Management**: Manual version updates required in `package.json`
4. **No .npmrc**: No registry configuration present
5. **Typo in Scripts**: `"pacakge"` should be `"package"` in package.json

### Existing CI Patterns (from main repository)

The main repository's `.github/workflows/build.yml` already demonstrates:

- Tag-triggered builds (`on: push: tags: - "*"`)
- Node.js 22 setup with caching
- GitHub Container Registry authentication pattern

---

## Proposed GitHub Actions Workflow

### Workflow File: `.github/workflows/publish.yml`

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - 'v*.*.*' # Semantic versioning tags only (v1.0.0, v1.2.3-beta.1, etc.)

permissions:
  contents: read
  id-token: write # Required for NPM provenance

defaults:
  run:
    working-directory: ./cli

jobs:
  ###############################################################
  ## Quality Gates
  ###############################################################
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

  ###############################################################
  ## Version Validation
  ###############################################################
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
          # Extract version from tag (remove 'v' prefix)
          TAG_VERSION="${GITHUB_REF#refs/tags/v}"
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

  ###############################################################
  ## Publish to NPM
  ###############################################################
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

  ###############################################################
  ## Post-Publish Verification
  ###############################################################
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

---

## Alternative Workflow: Monorepo Integration

If you prefer to integrate this workflow into the main repository's workflow structure (at `/.github/workflows/`), use this adjusted version:

### Workflow File: `/.github/workflows/cli-publish.yml`

```yaml
name: CLI - Publish to NPM

on:
  push:
    tags:
      - 'cli-v*.*.*' # CLI-specific tags

permissions:
  contents: read
  id-token: write

jobs:
  publish-cli:
    name: Publish CLI to NPM
    runs-on: ubuntu-latest
    environment: npm-publish
    defaults:
      run:
        working-directory: ./cli
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

      - name: Extract version from tag
        id: version
        run: |
          TAG_VERSION="${GITHUB_REF#refs/tags/cli-v}"
          PKG_VERSION=$(node -p "require('./package.json').version")

          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Version mismatch between tag ($TAG_VERSION) and package.json ($PKG_VERSION)"
            exit 1
          fi

          echo "version=$TAG_VERSION" >> $GITHUB_OUTPUT

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build package
        run: npm run build

      - name: Publish to NPM
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Environment Secrets Required

### GitHub Repository Secrets

| Secret Name | Description          | Where to Get                                             |
| ----------- | -------------------- | -------------------------------------------------------- |
| `NPM_TOKEN` | NPM automation token | npm.js > Access Tokens > Generate New Token > Automation |

### GitHub Environment Setup

1. **Create Environment**: Settings > Environments > New environment > `npm-publish`
2. **Add Protection Rules** (recommended):
   - Required reviewers: Add 1-2 maintainers
   - Wait timer: 0-5 minutes (optional delay before publish)
   - Deployment branches: Tags matching `v*.*.*`

### NPM Token Generation

```bash
# Login to NPM CLI
npm login

# Generate automation token (does not require 2FA for publish)
npm token create --type=automation

# Copy the token and add to GitHub Secrets
```

**Token Permissions Required:**

- Read and write
- Automation type (bypasses 2FA on publish)

---

## Package.json Updates Required

Before the workflow can function, update `/cli/package.json`:

```json
{
	"name": "@ruska/ruska-cli",
	"version": "0.1.0",
	"description": "CLI for Orchestra - AI Agent Orchestration Platform",
	"license": "MIT",
	"bin": {
		"ruska": "dist/cli.js"
	},
	"type": "module",
	"engines": {
		"node": ">=18"
	},
	"repository": {
		"type": "git",
		"url": "git+https://github.com/ruska-ai/orchestra.git",
		"directory": "cli"
	},
	"bugs": {
		"url": "https://github.com/ruska-ai/orchestra/issues"
	},
	"homepage": "https://ruska.ai",
	"keywords": ["cli", "orchestra", "ai", "agents", "ruska"],
	"scripts": {
		"start": "npm run build && node dist/cli.js",
		"format": "prettier --write \"**/*.{ts,tsx,json,md}\" && xo --fix",
		"format:check": "prettier --check .",
		"build": "tsc",
		"dev": "tsc --watch",
		"test": "xo && npm run build && ava",
		"package": "npm i && npm run build && npm link",
		"prepublishOnly": "npm run test && npm run build"
	},
	"files": ["dist"],
	"publishConfig": {
		"access": "public",
		"registry": "https://registry.npmjs.org"
	}
}
```

**Key Changes:**

1. Scoped package name: `@ruska/ruska-cli`
2. Added `repository`, `bugs`, `homepage` fields (required for NPM)
3. Added `keywords` for discoverability
4. Fixed typo: `pacakge` -> `package`
5. Added `prepublishOnly` script for safety
6. Added `publishConfig` for explicit public access

---

## Implementation Steps

### Phase 1: Preparation (Day 1)

1. **Create NPM Organization**

   ```bash
   # Create @ruska organization on npmjs.com
   # Navigate to: https://www.npmjs.com/org/create
   ```

2. **Generate NPM Token**

   ```bash
   npm login
   npm token create --type=automation
   ```

3. **Configure GitHub Secrets**

   - Navigate to: Repository Settings > Secrets and variables > Actions
   - Add `NPM_TOKEN` secret

4. **Create GitHub Environment**
   - Navigate to: Repository Settings > Environments
   - Create `npm-publish` environment
   - Add optional protection rules

### Phase 2: Code Updates (Day 1-2)

1. **Update package.json** with changes outlined above

2. **Create workflow file**

   ```bash
   # For CLI-specific workflow
   mkdir -p cli/.github/workflows
   # Copy publish.yml content to cli/.github/workflows/publish.yml

   # OR for monorepo integration
   # Copy cli-publish.yml to .github/workflows/cli-publish.yml
   ```

3. **Test locally**
   ```bash
   cd cli
   npm run test
   npm run build
   npm pack --dry-run
   ```

### Phase 3: Initial Release (Day 2-3)

1. **Update version for first release**

   ```bash
   cd cli
   npm version 0.1.0 --no-git-tag-version
   ```

2. **Commit and push changes**

   ```bash
   git add .
   git commit -m "feat(cli): prepare for NPM publishing"
   git push origin development
   ```

3. **Create and push tag**

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. **Monitor workflow execution**
   - Navigate to: Actions tab in GitHub
   - Verify all jobs pass
   - Check NPM for published package

### Phase 4: Verification (Day 3)

1. **Verify on NPM**

   ```bash
   npm view @ruska/ruska-cli
   npm info @ruska/ruska-cli
   ```

2. **Test installation**
   ```bash
   npm install -g @ruska/ruska-cli
   ruska --help
   ```

---

## Caching Strategies

### Current Implementation

The workflow uses npm's built-in caching via `actions/setup-node@v4`:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
    cache-dependency-path: cli/package-lock.json
```

### Cache Performance Expectations

| Scenario          | Install Time (uncached) | Install Time (cached) |
| ----------------- | ----------------------- | --------------------- |
| Fresh run         | ~45-60s                 | N/A                   |
| Cached run        | N/A                     | ~5-10s                |
| Partial cache hit | ~15-25s                 | N/A                   |

### Additional Cache Optimization (Optional)

For faster builds, consider adding TypeScript build caching:

```yaml
- name: Cache TypeScript build
  uses: actions/cache@v4
  with:
    path: cli/dist
    key: ${{ runner.os }}-tsc-${{ hashFiles('cli/source/**/*.ts', 'cli/source/**/*.tsx', 'cli/tsconfig.json') }}
    restore-keys: |
      ${{ runner.os }}-tsc-
```

---

## Rollback Strategy

### Scenario 1: Defective Package Published

**Immediate Action - Deprecate:**

```bash
npm deprecate "@ruska/ruska-cli@1.2.3" "This version has a critical bug. Please upgrade to 1.2.4"
```

**If Within 72 Hours - Unpublish:**

```bash
npm unpublish "@ruska/ruska-cli@1.2.3"
```

**Note:** NPM allows unpublish only within 72 hours and if no dependents exist.

### Scenario 2: Incorrect Version Tag

**Delete Tag and Recreate:**

```bash
# Delete remote tag
git push origin :refs/tags/v1.2.3

# Delete local tag
git tag -d v1.2.3

# Create corrected tag
git tag v1.2.4
git push origin v1.2.4
```

### Scenario 3: Workflow Failure Mid-Publish

If the publish job fails after partial execution:

1. Check NPM to see if package was actually published
2. If published with issues, follow Scenario 1
3. If not published, fix the issue and push a new tag

### Emergency Contacts

Document in your runbook:

- NPM support: support@npmjs.com
- GitHub Actions status: https://www.githubstatus.com/

---

## Security Considerations

### Secrets Protection

1. **NPM Token Scope**: Use automation tokens that don't require 2FA
2. **Environment Protection**: Require approvals for production publishes
3. **Branch Protection**: Ensure only authorized users can create tags

### Supply Chain Security

The workflow includes `--provenance` flag for NPM provenance attestation:

```yaml
npm publish --provenance --access public
```

This cryptographically links the published package to its source commit, providing:

- Build transparency
- Tamper evidence
- SLSA Level 2 compliance

### Audit Trail

The workflow creates a summary in the GitHub Actions interface:

- Version published
- Prerelease status
- Link to NPM package

---

## Files Analyzed

| File Path                         | Analysis                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `/cli/package.json`               | Package manifest, identified version 0.0.1, missing npm scope and publish config |
| `/cli/tsconfig.json`              | TypeScript config extending @sindresorhus/tsconfig, output to dist/              |
| `/cli/source/`                    | Source directory with tsx files, tests, components                               |
| `/cli/dist/`                      | Build output containing compiled JavaScript                                      |
| `/cli/.github/workflows/test.yml` | Existing test workflow for Node 22.x                                             |
| `/.github/workflows/build.yml`    | Main repo tag-triggered build pattern                                            |
| `/.github/workflows/test.yml`     | Main repo test patterns with caching                                             |
| `/cli/README.md`                  | CLI documentation and usage examples                                             |

---

## Appendix: Full Tag-Version Release Process

### Semantic Versioning Convention

| Tag Format       | Package Version | NPM Tag  |
| ---------------- | --------------- | -------- |
| `v1.0.0`         | `1.0.0`         | `latest` |
| `v1.1.0-beta.1`  | `1.1.0-beta.1`  | `beta`   |
| `v1.1.0-rc.1`    | `1.1.0-rc.1`    | `next`   |
| `v2.0.0-alpha.1` | `2.0.0-alpha.1` | `alpha`  |

### Release Checklist

- [ ] Update `CHANGELOG.md` with release notes
- [ ] Bump version in `package.json`
- [ ] Run full test suite locally
- [ ] Create PR and merge to main branch
- [ ] Create annotated tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Monitor GitHub Actions workflow
- [ ] Verify package on NPM
- [ ] Test global installation
- [ ] Announce release (if applicable)

---

## Questions for Stakeholders

1. **Package Naming**: Should the package be `@ruska/ruska-cli` or `@ruska/cli`?
2. **Prerelease Tags**: Do you want automatic `beta`/`alpha` tagging on NPM for prerelease versions?
3. **Changelog Generation**: Would you like automated changelog generation from commits?
4. **Slack/Discord Notifications**: Should publish events trigger team notifications?
5. **Dry Run Environment**: Would a staging/dry-run environment be valuable before production publishes?
