# Proposal 3: Manual Publish Fallbacks, Team Documentation, and Registry Security

## Executive Summary

This proposal establishes a comprehensive security and developer experience framework for publishing the `@ruska/ruska-cli` package to npm. It addresses three critical areas:

1. **Manual Publish Fallback Scripts** - Robust shell scripts with safety checks for when CI/CD fails
2. **Team Documentation** - Complete publishing workflow documentation and checklists
3. **Registry Security** - NPM token management, 2FA requirements, and access control policies

The goal is to ensure that package publishing is secure, auditable, and recoverable even when automated systems fail.

---

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Manual Publish Scripts](#manual-publish-scripts)
3. [Team Documentation](#team-documentation)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Security Audit Checklist](#security-audit-checklist)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Security Architecture

### NPM Token Management

#### Token Types and Use Cases

| Token Type            | Use Case                           | Permissions                  | Expiration   |
| --------------------- | ---------------------------------- | ---------------------------- | ------------ |
| Automation Token      | CI/CD pipelines                    | Publish only                 | 365 days     |
| Granular Access Token | Team members (manual publish)      | Read/Write specific packages | 90 days      |
| Classic Token         | Legacy systems (avoid if possible) | Full account access          | Configurable |

#### Token Hierarchy

```
Organization: @ruska
    |
    +-- Automation Token (CI/CD)
    |   +-- Scope: @ruska/ruska-cli
    |   +-- IP Allowlist: GitHub Actions IPs
    |   +-- 2FA: Not required (automation)
    |
    +-- Team Member Tokens
        +-- Senior Maintainer Token
        |   +-- Scope: @ruska/*
        |   +-- 2FA: Required
        |
        +-- Release Manager Token
            +-- Scope: @ruska/ruska-cli
            +-- 2FA: Required
```

#### Recommended Token Configuration

```bash
# Create a granular access token via npm CLI
npm token create --read-only=false \
                 --cidr-whitelist="" \
                 --description="@ruska/ruska-cli manual publish" \
                 --expiration=90d
```

**Important**: Store tokens securely in a password manager (1Password, Bitwarden, etc.) and never commit them to the repository.

### 2FA Requirements

#### Mandatory 2FA Settings

1. **Organization Level**: Enable "Require two-factor authentication" for all organization members
2. **Package Level**: Enable "Require 2FA for publishing" on `@ruska/ruska-cli`
3. **Token Level**: Use tokens that require 2FA confirmation for sensitive operations

#### Setting Up 2FA for Package Publishing

```bash
# Check current 2FA status
npm profile get

# Enable 2FA for auth and publish
npm profile enable-2fa auth-and-writes

# For automation tokens only (not recommended for humans)
npm profile enable-2fa auth-only
```

### Access Control

#### NPM Organization Team Structure

```yaml
@ruska Organization:
  teams:
    owners:
      description: Full administrative access
      members:
        - organization-owner
      permissions: admin

    maintainers:
      description: Can publish packages
      members:
        - senior-developer-1
        - senior-developer-2
      permissions: read-write

    developers:
      description: Read-only access
      members:
        - developer-1
        - developer-2
        - developer-3
      permissions: read-only
```

#### Package Access Configuration

```bash
# View current package access
npm access list packages @ruska

# Grant publish access to maintainers team
npm access grant read-write @ruska:maintainers @ruska/ruska-cli

# Revoke access from a user
npm access revoke @ruska/ruska-cli username
```

### Scoped Package Security

#### Why Use Scoped Packages

1. **Namespace Protection**: Prevents name squatting and typosquatting attacks
2. **Organization Trust**: Users know the package comes from the official @ruska organization
3. **Unified Access Control**: Manage permissions at the organization level
4. **Clear Ownership**: Explicit association with the organization

#### Package Name Migration

Current: `ruska` (unscoped)
Recommended: `@ruska/ruska-cli` (scoped)

```json
{
	"name": "@ruska/ruska-cli",
	"publishConfig": {
		"access": "public",
		"registry": "https://registry.npmjs.org/"
	}
}
```

---

## Manual Publish Scripts

### Directory Structure

```
cli/
  scripts/
    publish/
      publish.sh          # Main publish script
      verify-build.sh     # Build verification
      pre-publish-check.sh # Pre-publish safety checks
      rollback.sh         # Emergency rollback
      version-bump.sh     # Version management
```

### Main Publish Script

Create the file `cli/scripts/publish/publish.sh`:

```bash
#!/usr/bin/env bash
#
# Manual NPM Publish Script for @ruska/ruska-cli
#
# Usage: ./scripts/publish/publish.sh [--dry-run] [--skip-tests]
#
# This script provides a safe manual fallback for publishing when CI/CD fails.
# It includes comprehensive safety checks and requires explicit confirmation.
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PACKAGE_NAME="@ruska/ruska-cli"
REQUIRED_NODE_VERSION="18"
REQUIRED_BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
DRY_RUN=false
SKIP_TESTS=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run     Perform all checks but do not publish"
            echo "  --skip-tests  Skip running tests (not recommended)"
            echo "  --force       Skip confirmation prompts (use with caution)"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command_exists node; then
        log_error "Node.js is not installed"
        exit 1
    fi

    local node_version
    node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$node_version" -lt "$REQUIRED_NODE_VERSION" ]]; then
        log_error "Node.js version must be >= $REQUIRED_NODE_VERSION (found: $node_version)"
        exit 1
    fi
    log_success "Node.js version: $(node -v)"

    # Check npm
    if ! command_exists npm; then
        log_error "npm is not installed"
        exit 1
    fi
    log_success "npm version: $(npm -v)"

    # Check npm authentication
    if ! npm whoami >/dev/null 2>&1; then
        log_error "Not logged in to npm. Run 'npm login' first."
        exit 1
    fi
    log_success "Logged in as: $(npm whoami)"

    # Check 2FA status
    local tfa_status
    tfa_status=$(npm profile get --json 2>/dev/null | grep -o '"tfa":{"mode":"[^"]*"' | sed 's/.*"mode":"\([^"]*\)"/\1/' || echo "unknown")
    if [[ "$tfa_status" == "auth-and-writes" ]]; then
        log_success "2FA is enabled for auth and writes"
    elif [[ "$tfa_status" == "auth-only" ]]; then
        log_warn "2FA is only enabled for auth (consider enabling for writes)"
    else
        log_warn "2FA status unknown - please verify manually"
    fi

    # Check git
    if ! command_exists git; then
        log_error "git is not installed"
        exit 1
    fi
    log_success "git version: $(git --version)"
}

# Verify git state
check_git_state() {
    log_info "Checking git state..."

    cd "$PROJECT_ROOT"

    # Check for uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "Working directory has uncommitted changes"
        git status --short
        exit 1
    fi
    log_success "Working directory is clean"

    # Check current branch
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "$REQUIRED_BRANCH" ]] && [[ "$FORCE" != "true" ]]; then
        log_error "Must be on '$REQUIRED_BRANCH' branch (currently on '$current_branch')"
        log_info "Use --force to override (not recommended)"
        exit 1
    fi
    log_success "Current branch: $current_branch"

    # Check if branch is up to date with remote
    git fetch origin "$REQUIRED_BRANCH" --quiet
    local local_hash
    local_hash=$(git rev-parse HEAD)
    local remote_hash
    remote_hash=$(git rev-parse "origin/$REQUIRED_BRANCH" 2>/dev/null || echo "")

    if [[ -n "$remote_hash" ]] && [[ "$local_hash" != "$remote_hash" ]]; then
        log_error "Local branch is not in sync with remote"
        log_info "Run 'git pull origin $REQUIRED_BRANCH' first"
        exit 1
    fi
    log_success "Branch is up to date with remote"

    # Check if version tag already exists
    local version
    version=$(node -p "require('./package.json').version")
    if git tag -l "v$version" | grep -q "v$version"; then
        log_error "Git tag v$version already exists"
        exit 1
    fi
    log_success "Version v$version is not yet tagged"
}

# Verify package.json
check_package_json() {
    log_info "Checking package.json..."

    cd "$PROJECT_ROOT"

    # Check package name
    local name
    name=$(node -p "require('./package.json').name")
    log_info "Package name: $name"

    # Check version
    local version
    version=$(node -p "require('./package.json').version")
    log_info "Package version: $version"

    # Check if version is already published
    if npm view "${name}@${version}" version >/dev/null 2>&1; then
        log_error "Version $version is already published to npm"
        exit 1
    fi
    log_success "Version $version is not yet published"

    # Check required fields
    local description
    description=$(node -p "require('./package.json').description || ''")
    if [[ -z "$description" ]]; then
        log_warn "Package description is missing"
    fi

    local license
    license=$(node -p "require('./package.json').license || ''")
    if [[ -z "$license" ]]; then
        log_warn "Package license is missing"
    fi

    # Check files field
    local files
    files=$(node -p "JSON.stringify(require('./package.json').files || [])")
    if [[ "$files" == "[]" ]]; then
        log_warn "No 'files' field specified - entire package will be published"
    fi

    log_success "package.json validation passed"
}

# Clean and install dependencies
prepare_dependencies() {
    log_info "Preparing dependencies..."

    cd "$PROJECT_ROOT"

    # Clean node_modules and reinstall
    if [[ -d "node_modules" ]]; then
        log_info "Removing existing node_modules..."
        rm -rf node_modules
    fi

    log_info "Installing dependencies with npm ci..."
    npm ci

    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warn "Skipping tests (--skip-tests flag set)"
        return 0
    fi

    log_info "Running tests..."

    cd "$PROJECT_ROOT"

    # Run format check
    log_info "Running format check..."
    npm run format:check || {
        log_error "Format check failed. Run 'npm run format' to fix."
        exit 1
    }

    # Run full test suite
    log_info "Running test suite..."
    npm test || {
        log_error "Tests failed"
        exit 1
    }

    log_success "All tests passed"
}

# Build the package
build_package() {
    log_info "Building package..."

    cd "$PROJECT_ROOT"

    # Clean dist directory
    if [[ -d "dist" ]]; then
        log_info "Cleaning dist directory..."
        rm -rf dist
    fi

    # Run build
    npm run build

    # Verify dist exists
    if [[ ! -d "dist" ]]; then
        log_error "Build failed - dist directory not created"
        exit 1
    fi

    # Verify main entry point exists
    local main_file="dist/cli.js"
    if [[ ! -f "$main_file" ]]; then
        log_error "Build failed - main entry point ($main_file) not found"
        exit 1
    fi

    log_success "Build completed successfully"
}

# Show package contents
preview_package() {
    log_info "Package preview..."

    cd "$PROJECT_ROOT"

    echo ""
    echo "Files to be published:"
    echo "======================"
    npm pack --dry-run 2>&1 | grep -E '^\s+' || true
    echo ""

    local tarball_size
    tarball_size=$(npm pack --dry-run 2>&1 | grep -oE 'total files:\s+[0-9]+' || echo "unknown")
    log_info "Package stats: $tarball_size"
}

# Confirm publish
confirm_publish() {
    if [[ "$FORCE" == "true" ]]; then
        log_warn "Skipping confirmation (--force flag set)"
        return 0
    fi

    local version
    version=$(node -p "require('./package.json').version")

    echo ""
    echo "=============================================="
    echo "  READY TO PUBLISH"
    echo "=============================================="
    echo "  Package: $PACKAGE_NAME"
    echo "  Version: $version"
    echo "  Registry: https://registry.npmjs.org/"
    echo "=============================================="
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN - Package will NOT be published"
        return 0
    fi

    read -p "Are you sure you want to publish? (type 'yes' to confirm): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Publish cancelled"
        exit 0
    fi
}

# Publish to npm
publish_package() {
    cd "$PROJECT_ROOT"

    local version
    version=$(node -p "require('./package.json').version")

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would publish $PACKAGE_NAME@$version"
        npm publish --dry-run --access public
        log_success "Dry run completed"
        return 0
    fi

    log_info "Publishing to npm..."

    # Publish with public access (required for scoped packages)
    npm publish --access public

    log_success "Package published successfully!"

    # Create git tag
    log_info "Creating git tag v$version..."
    git tag -a "v$version" -m "Release v$version"

    # Push tag to remote
    log_info "Pushing tag to remote..."
    git push origin "v$version"

    log_success "Git tag v$version created and pushed"
}

# Post-publish verification
verify_publish() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi

    log_info "Verifying publication..."

    cd "$PROJECT_ROOT"

    local version
    version=$(node -p "require('./package.json').version")
    local name
    name=$(node -p "require('./package.json').name")

    # Wait a moment for npm to propagate
    sleep 5

    # Verify package is available
    if npm view "${name}@${version}" version >/dev/null 2>&1; then
        log_success "Verified: ${name}@${version} is available on npm"
    else
        log_warn "Could not verify publication - may take a few minutes to propagate"
    fi

    echo ""
    echo "=============================================="
    echo "  PUBLISH COMPLETE"
    echo "=============================================="
    echo "  Package: $name@$version"
    echo "  npm: https://www.npmjs.com/package/$name"
    echo "  Install: npm install $name@$version"
    echo "=============================================="
}

# Main execution
main() {
    echo ""
    echo "=============================================="
    echo "  NPM Package Publish Script"
    echo "  Package: $PACKAGE_NAME"
    echo "=============================================="
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Running in DRY RUN mode"
    fi

    check_prerequisites
    check_git_state
    check_package_json
    prepare_dependencies
    run_tests
    build_package
    preview_package
    confirm_publish
    publish_package
    verify_publish

    echo ""
    log_success "All done!"
}

# Run main
main "$@"
```

### Pre-Publish Safety Check Script

Create the file `cli/scripts/publish/pre-publish-check.sh`:

```bash
#!/usr/bin/env bash
#
# Pre-Publish Safety Check Script
#
# Performs comprehensive safety checks before publishing.
# Can be used standalone or as part of the main publish script.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_check() {
    echo -n "Checking: $1... "
}

log_pass() {
    echo -e "${GREEN}PASS${NC}"
}

log_fail() {
    echo -e "${RED}FAIL${NC} - $1"
    ((ERRORS++))
}

log_warn() {
    echo -e "${YELLOW}WARN${NC} - $1"
    ((WARNINGS++))
}

cd "$PROJECT_ROOT"

echo ""
echo "Pre-Publish Safety Checks"
echo "========================="
echo ""

# Check 1: No sensitive files in package
log_check "No sensitive files in package"
sensitive_patterns=(
    ".env"
    ".env.*"
    "*.pem"
    "*.key"
    "*.p12"
    "credentials*"
    "secrets*"
    ".npmrc"
    "auth.json"
)

found_sensitive=false
for pattern in "${sensitive_patterns[@]}"; do
    if npm pack --dry-run 2>&1 | grep -q "$pattern"; then
        found_sensitive=true
        break
    fi
done

if [[ "$found_sensitive" == "true" ]]; then
    log_fail "Sensitive files may be included in package"
else
    log_pass
fi

# Check 2: No TODO/FIXME in production code
log_check "No unresolved TODOs in source"
if grep -rn "TODO\|FIXME\|XXX\|HACK" source/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "__tests__" | head -5 | grep -q .; then
    log_warn "Found TODO/FIXME comments in source code"
else
    log_pass
fi

# Check 3: Version follows semver
log_check "Version follows semver"
version=$(node -p "require('./package.json').version")
if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    log_pass
else
    log_fail "Version '$version' does not follow semver"
fi

# Check 4: CHANGELOG updated
log_check "CHANGELOG exists"
if [[ -f "CHANGELOG.md" ]]; then
    log_pass
else
    log_warn "CHANGELOG.md not found"
fi

# Check 5: README exists
log_check "README exists"
if [[ -f "README.md" ]]; then
    log_pass
else
    log_fail "README.md not found"
fi

# Check 6: License file exists
log_check "LICENSE file exists"
if [[ -f "LICENSE" ]] || [[ -f "LICENSE.md" ]] || [[ -f "LICENSE.txt" ]]; then
    log_pass
else
    log_warn "LICENSE file not found"
fi

# Check 7: No console.log in production code
log_check "No debug console.log statements"
if grep -rn "console\.log" source/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "__tests__" | grep -v "// DEBUG" | head -3 | grep -q .; then
    log_warn "Found console.log statements in source code"
else
    log_pass
fi

# Check 8: TypeScript compiles without errors
log_check "TypeScript compilation"
if npm run build >/dev/null 2>&1; then
    log_pass
else
    log_fail "TypeScript compilation failed"
fi

# Check 9: Package size is reasonable
log_check "Package size is reasonable"
pack_output=$(npm pack --dry-run 2>&1)
file_count=$(echo "$pack_output" | grep -oE 'total files:\s+[0-9]+' | grep -oE '[0-9]+' || echo "0")
if [[ "$file_count" -gt 100 ]]; then
    log_warn "Package contains $file_count files (consider reviewing)"
else
    log_pass
fi

# Check 10: Node engine specified
log_check "Node engine specified"
engines=$(node -p "JSON.stringify(require('./package.json').engines || {})")
if [[ "$engines" == "{}" ]]; then
    log_warn "No Node.js engine requirement specified"
else
    log_pass
fi

# Summary
echo ""
echo "========================="
echo "Summary"
echo "========================="
echo -e "Errors:   ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Pre-publish checks FAILED${NC}"
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Pre-publish checks passed with warnings${NC}"
    exit 0
else
    echo -e "${GREEN}All pre-publish checks PASSED${NC}"
    exit 0
fi
```

### Version Bump Script

Create the file `cli/scripts/publish/version-bump.sh`:

```bash
#!/usr/bin/env bash
#
# Version Bump Script
#
# Usage: ./version-bump.sh [major|minor|patch|<version>]
#
# Examples:
#   ./version-bump.sh patch      # 1.0.0 -> 1.0.1
#   ./version-bump.sh minor      # 1.0.0 -> 1.1.0
#   ./version-bump.sh major      # 1.0.0 -> 2.0.0
#   ./version-bump.sh 2.0.0-beta.1  # Set specific version
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$PROJECT_ROOT"

current_version=$(node -p "require('./package.json').version")

echo ""
echo "Version Bump Script"
echo "==================="
echo "Current version: $current_version"
echo ""

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [major|minor|patch|<version>]"
    echo ""
    echo "Examples:"
    echo "  $0 patch         # Bump patch version"
    echo "  $0 minor         # Bump minor version"
    echo "  $0 major         # Bump major version"
    echo "  $0 2.0.0-beta.1  # Set specific version"
    exit 0
fi

bump_type="$1"

case "$bump_type" in
    major|minor|patch)
        echo -e "${BLUE}Bumping $bump_type version...${NC}"
        new_version=$(npm version "$bump_type" --no-git-tag-version --allow-same-version=false)
        new_version="${new_version#v}"
        ;;
    *)
        # Treat as explicit version
        if [[ "$bump_type" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
            echo -e "${BLUE}Setting version to $bump_type...${NC}"
            npm version "$bump_type" --no-git-tag-version --allow-same-version=false
            new_version="$bump_type"
        else
            echo -e "${RED}Invalid version format: $bump_type${NC}"
            exit 1
        fi
        ;;
esac

echo ""
echo -e "${GREEN}Version bumped: $current_version -> $new_version${NC}"
echo ""
echo "Next steps:"
echo "  1. Update CHANGELOG.md with release notes"
echo "  2. Commit changes: git commit -am \"Bump version to $new_version\""
echo "  3. Push to repository: git push origin <branch>"
echo "  4. Create PR or run publish script"
echo ""
```

### Rollback Script

Create the file `cli/scripts/publish/rollback.sh`:

```bash
#!/usr/bin/env bash
#
# Emergency Rollback Script
#
# Usage: ./rollback.sh <version>
#
# This script deprecates a problematic version and instructs users
# to use a previous version.
#
# NOTE: npm does not allow unpublishing packages after 72 hours.
# This script deprecates the version instead.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$PROJECT_ROOT"

PACKAGE_NAME=$(node -p "require('./package.json').name")

if [[ $# -eq 0 ]]; then
    echo ""
    echo "Emergency Rollback Script"
    echo "========================="
    echo ""
    echo "Usage: $0 <version-to-deprecate> [replacement-version]"
    echo ""
    echo "Examples:"
    echo "  $0 1.2.0              # Deprecate version 1.2.0"
    echo "  $0 1.2.0 1.1.0        # Deprecate 1.2.0, recommend 1.1.0"
    echo ""
    echo "Current published versions:"
    npm view "$PACKAGE_NAME" versions --json 2>/dev/null | head -20 || echo "Package not found"
    exit 1
fi

VERSION_TO_DEPRECATE="$1"
REPLACEMENT_VERSION="${2:-}"

echo ""
echo "Emergency Rollback"
echo "=================="
echo "Package: $PACKAGE_NAME"
echo "Version to deprecate: $VERSION_TO_DEPRECATE"
if [[ -n "$REPLACEMENT_VERSION" ]]; then
    echo "Replacement version: $REPLACEMENT_VERSION"
fi
echo ""

# Check if version exists
if ! npm view "${PACKAGE_NAME}@${VERSION_TO_DEPRECATE}" version >/dev/null 2>&1; then
    echo -e "${RED}Version $VERSION_TO_DEPRECATE not found on npm${NC}"
    exit 1
fi

# Confirm action
echo -e "${YELLOW}WARNING: This will mark $VERSION_TO_DEPRECATE as deprecated.${NC}"
echo "Users will see a warning when installing this version."
echo ""
read -p "Are you sure? (type 'deprecate' to confirm): " confirm

if [[ "$confirm" != "deprecate" ]]; then
    echo "Cancelled"
    exit 0
fi

# Build deprecation message
if [[ -n "$REPLACEMENT_VERSION" ]]; then
    DEPRECATION_MSG="This version has critical issues. Please use version $REPLACEMENT_VERSION instead."
else
    DEPRECATION_MSG="This version has critical issues. Please use a previous stable version."
fi

# Deprecate the version
echo ""
echo -e "${BLUE}Deprecating ${PACKAGE_NAME}@${VERSION_TO_DEPRECATE}...${NC}"
npm deprecate "${PACKAGE_NAME}@${VERSION_TO_DEPRECATE}" "$DEPRECATION_MSG"

echo ""
echo -e "${GREEN}Version $VERSION_TO_DEPRECATE has been deprecated${NC}"
echo ""
echo "Next steps:"
echo "  1. Notify users via release channels"
echo "  2. Document the issue in CHANGELOG.md"
echo "  3. If within 72 hours, consider: npm unpublish ${PACKAGE_NAME}@${VERSION_TO_DEPRECATE}"
echo ""

# Option to delete git tag
echo ""
read -p "Delete git tag v$VERSION_TO_DEPRECATE? (y/N): " delete_tag
if [[ "$delete_tag" =~ ^[Yy]$ ]]; then
    git tag -d "v$VERSION_TO_DEPRECATE" 2>/dev/null || true
    git push origin --delete "v$VERSION_TO_DEPRECATE" 2>/dev/null || true
    echo -e "${GREEN}Git tag deleted${NC}"
fi
```

### Verify Build Script

Create the file `cli/scripts/publish/verify-build.sh`:

```bash
#!/usr/bin/env bash
#
# Build Verification Script
#
# Verifies that the build output is correct and functional.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$PROJECT_ROOT"

echo ""
echo "Build Verification"
echo "=================="
echo ""

ERRORS=0

check() {
    echo -n "  $1... "
}

pass() {
    echo -e "${GREEN}OK${NC}"
}

fail() {
    echo -e "${RED}FAILED${NC}"
    ((ERRORS++))
}

# Check dist directory exists
check "dist directory exists"
if [[ -d "dist" ]]; then
    pass
else
    fail
fi

# Check main entry point
check "Main entry point (dist/cli.js)"
if [[ -f "dist/cli.js" ]]; then
    pass
else
    fail
fi

# Check entry point is executable (has shebang)
check "Entry point has shebang"
if head -1 dist/cli.js 2>/dev/null | grep -q "^#!/"; then
    pass
else
    echo -e "${YELLOW}WARN${NC} - No shebang found"
fi

# Check no TypeScript files in dist
check "No .ts files in dist"
if find dist -name "*.ts" -not -name "*.d.ts" | grep -q .; then
    fail
else
    pass
fi

# Check for source maps (optional)
check "Source maps exist"
if find dist -name "*.js.map" | grep -q .; then
    pass
else
    echo -e "${YELLOW}WARN${NC} - No source maps"
fi

# Try to run the CLI with --help
check "CLI runs with --help"
if node dist/cli.js --help >/dev/null 2>&1; then
    pass
else
    fail
fi

# Check package.json bin entry
check "package.json bin entry points to dist/cli.js"
bin_path=$(node -p "require('./package.json').bin?.ruska || ''")
if [[ "$bin_path" == "dist/cli.js" ]]; then
    pass
else
    fail
fi

# Summary
echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Build verification FAILED with $ERRORS errors${NC}"
    exit 1
else
    echo -e "${GREEN}Build verification PASSED${NC}"
    exit 0
fi
```

---

## Team Documentation

### Publishing Workflow

#### Overview

The `@ruska/ruska-cli` package follows a structured release process to ensure quality and security:

```
Feature Branch -> PR -> Review -> Merge to main -> CI Build & Test -> Publish to npm
                                                          |
                                                          v (if CI fails)
                                                   Manual Publish
```

#### Standard Release Process (CI/CD)

1. **Feature Development**

   - Create feature branch from `main`
   - Implement changes with tests
   - Ensure all checks pass locally

2. **Pull Request**

   - Open PR to `main` branch
   - Ensure CI checks pass
   - Get code review approval

3. **Version Bump**

   - Update version in `package.json`
   - Update `CHANGELOG.md`
   - Commit with message: `chore: bump version to X.Y.Z`

4. **Merge and Release**
   - Merge PR to `main`
   - CI automatically builds and publishes
   - Git tag is created automatically

#### Manual Release Process (Fallback)

When CI/CD fails, authorized team members can publish manually:

```bash
# Navigate to CLI directory
cd /path/to/orchestra/cli

# Run the publish script
./scripts/publish/publish.sh

# For testing without publishing
./scripts/publish/publish.sh --dry-run
```

### Pre-Publish Checklist

Before every release, verify:

- [ ] All tests pass locally (`npm test`)
- [ ] Code is formatted (`npm run format:check`)
- [ ] No uncommitted changes in working directory
- [ ] On `main` branch and up to date with remote
- [ ] Version in `package.json` is updated
- [ ] `CHANGELOG.md` is updated with release notes
- [ ] No sensitive data in package (check with `npm pack --dry-run`)
- [ ] README.md is accurate and up to date
- [ ] npm authentication is valid (`npm whoami`)
- [ ] 2FA device is available for OTP

### Post-Publish Verification

After publishing:

- [ ] Verify package on npm: `npm view @ruska/ruska-cli@<version>`
- [ ] Test installation: `npm install -g @ruska/ruska-cli@<version>`
- [ ] Verify CLI works: `ruska --help`
- [ ] Check git tag exists: `git tag -l v<version>`
- [ ] Notify team in communication channels
- [ ] Update documentation if needed

### Version Numbering Guidelines

Follow [Semantic Versioning](https://semver.org/):

| Change Type                        | Version Bump | Example        |
| ---------------------------------- | ------------ | -------------- |
| Bug fixes, patches                 | PATCH        | 1.0.0 -> 1.0.1 |
| New features (backward compatible) | MINOR        | 1.0.0 -> 1.1.0 |
| Breaking changes                   | MAJOR        | 1.0.0 -> 2.0.0 |

**Pre-release versions:**

- Alpha: `1.0.0-alpha.1`
- Beta: `1.0.0-beta.1`
- Release Candidate: `1.0.0-rc.1`

### Required Permissions

| Role                 | npm Access | Git Access | Can Publish |
| -------------------- | ---------- | ---------- | ----------- |
| Maintainer           | Read-Write | Write      | Yes         |
| Developer            | Read-Only  | Write      | No          |
| External Contributor | None       | Fork       | No          |

---

## Troubleshooting Guide

### Authentication Issues

#### Problem: "npm ERR! 403 Forbidden"

**Cause**: Insufficient permissions or invalid token.

**Solution**:

```bash
# Check current login
npm whoami

# If not logged in, login again
npm login --scope=@ruska

# Verify token permissions on npmjs.com
```

#### Problem: "npm ERR! 401 Unauthorized"

**Cause**: Expired or invalid token.

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Remove stored credentials
rm -f ~/.npmrc

# Login again
npm login
```

#### Problem: 2FA OTP rejected

**Cause**: Time sync issue or wrong authenticator.

**Solution**:

1. Ensure device time is synchronized
2. Wait for next OTP cycle (30 seconds)
3. Verify using the correct authenticator app
4. If issues persist, use backup codes

### Build Issues

#### Problem: TypeScript compilation fails

**Cause**: Type errors or missing dependencies.

**Solution**:

```bash
# Clean and reinstall
rm -rf node_modules dist
npm ci

# Check for type errors
npx tsc --noEmit

# If using wrong TypeScript version
npm install typescript@5 --save-dev
```

#### Problem: "Module not found" errors

**Cause**: Missing dependency or incorrect import.

**Solution**:

```bash
# Verify all dependencies are installed
npm ci

# Check for peer dependency issues
npm ls

# Verify imports use correct paths
```

### Publishing Issues

#### Problem: "Version already exists"

**Cause**: Attempting to republish an existing version.

**Solution**:

```bash
# Check published versions
npm view @ruska/ruska-cli versions

# Bump to a new version
./scripts/publish/version-bump.sh patch
```

#### Problem: Package too large

**Cause**: Including unnecessary files.

**Solution**:

1. Review `files` field in `package.json`
2. Add patterns to `.npmignore`
3. Check with `npm pack --dry-run`

```json
{
	"files": ["dist", "README.md", "LICENSE"]
}
```

#### Problem: CI publish job fails

**Cause**: Various CI environment issues.

**Solution**:

1. Check CI logs for specific error
2. Verify NPM_TOKEN secret is set and valid
3. Use manual publish as fallback:
   ```bash
   ./scripts/publish/publish.sh
   ```

### Network Issues

#### Problem: Timeout during publish

**Cause**: Network instability or npm registry issues.

**Solution**:

```bash
# Check npm registry status
curl -I https://registry.npmjs.org/

# Use a different registry mirror (temporary)
npm publish --registry https://registry.npmmirror.com

# Retry with increased timeout
npm publish --fetch-timeout=120000
```

#### Problem: "ECONNRESET" errors

**Cause**: Connection dropped by server.

**Solution**:

```bash
# Wait and retry (usually transient)
sleep 60 && npm publish

# Check for proxy issues
npm config list
```

### Git Issues

#### Problem: Cannot push tag

**Cause**: Tag already exists or permission denied.

**Solution**:

```bash
# Check if tag exists locally
git tag -l v*

# Delete local tag if needed
git tag -d v1.0.0

# Check remote tags
git ls-remote --tags origin
```

#### Problem: Branch out of sync

**Cause**: Local branch behind remote.

**Solution**:

```bash
# Fetch and rebase
git fetch origin main
git rebase origin/main

# Or reset to remote
git reset --hard origin/main
```

---

## Security Audit Checklist

### Monthly Security Review

- [ ] Review npm organization members and remove inactive users
- [ ] Verify all team members have 2FA enabled
- [ ] Rotate automation tokens older than 90 days
- [ ] Review package access permissions
- [ ] Check for any npm security advisories
- [ ] Verify no sensitive data in published packages

### Pre-Release Security Review

- [ ] Run `npm audit` and address vulnerabilities
- [ ] Check dependencies for known CVEs
- [ ] Verify no secrets in code or configuration
- [ ] Review recent dependency updates
- [ ] Check for typosquatting packages in dependencies

### Token Security Checklist

| Check                  | Command            | Expected Result              |
| ---------------------- | ------------------ | ---------------------------- |
| List active tokens     | `npm token list`   | Only recognized tokens       |
| Verify token scopes    | Check on npmjs.com | Minimal required permissions |
| Check token age        | `npm token list`   | No tokens > 365 days         |
| Verify IP restrictions | Check on npmjs.com | CI tokens have IP allowlist  |

### Package Security Checklist

```bash
# Check for known vulnerabilities
npm audit

# Check for outdated packages
npm outdated

# Verify package contents
npm pack --dry-run

# Check for secrets in package
grep -r "api_key\|secret\|password\|token" dist/ || echo "No secrets found"

# Verify package signature (after publish)
npm view @ruska/ruska-cli dist.integrity
```

### Incident Response Procedures

#### If a token is compromised:

1. **Immediate**: Revoke the token on npmjs.com
2. **Notify**: Alert team members immediately
3. **Audit**: Check npm publish history for unauthorized releases
4. **Rotate**: Generate new tokens for all affected systems
5. **Document**: Record incident and remediation steps

#### If a malicious version is published:

1. **Deprecate**: `npm deprecate @ruska/ruska-cli@<version> "Security issue - do not use"`
2. **Unpublish** (if < 72 hours): `npm unpublish @ruska/ruska-cli@<version>`
3. **Notify**: Alert users through all available channels
4. **Investigate**: Determine how the compromise occurred
5. **Remediate**: Fix the security issue and publish a clean version

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

1. Create `scripts/publish/` directory structure
2. Implement main publish script with safety checks
3. Set up npm organization and scoped package
4. Configure 2FA for all team members

### Phase 2: Documentation (Week 2)

1. Create CHANGELOG.md with proper format
2. Document publishing workflow in README
3. Create internal wiki page for release process
4. Train team members on new process

### Phase 3: CI Integration (Week 3)

1. Add publish workflow to GitHub Actions
2. Configure NPM_TOKEN secret
3. Set up release tagging automation
4. Test dry-run in CI

### Phase 4: Monitoring (Week 4)

1. Set up npm package download monitoring
2. Configure security alert notifications
3. Implement automated security audits
4. Document incident response procedures

---

## Appendix A: NPM Configuration Reference

### Recommended `.npmrc` for CI

```ini
# CI-specific npm configuration
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
access=public
git-tag-version=false
commit-hooks=false
```

### Recommended `package.json` additions

```json
{
	"publishConfig": {
		"access": "public",
		"registry": "https://registry.npmjs.org/"
	},
	"repository": {
		"type": "git",
		"url": "https://github.com/enso-labs/orchestra.git",
		"directory": "cli"
	},
	"bugs": {
		"url": "https://github.com/enso-labs/orchestra/issues"
	},
	"homepage": "https://github.com/enso-labs/orchestra/tree/main/cli#readme"
}
```

---

## Appendix B: GitHub Actions Publish Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run (no publish)'
        required: false
        default: 'false'
        type: boolean

jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: cli

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
          cache-dependency-path: cli/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Verify build
        run: ./scripts/publish/verify-build.sh

      - name: Publish (dry run)
        if: ${{ github.event.inputs.dry_run == 'true' }}
        run: npm publish --dry-run --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish
        if: ${{ github.event.inputs.dry_run != 'true' }}
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

_Document prepared by Security & DX Engineer_
_Last updated: 2026-01-01_
