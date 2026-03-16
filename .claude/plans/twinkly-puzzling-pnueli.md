# Plan: Remove 24h filter from docker system prune in CI deploy

## Context
After CI deploys, `docker system prune -a --filter "until=24h" -f` runs to clean up images. The 24h window is too generous — replaced images linger and fill disk. Shortening to 1h still protects the just-deployed images while reclaiming space much sooner.

## Changes

### 1. `.github/workflows/build.yml` (line 254)
**Before:** `docker system prune -a --filter \"until=24h\" -f`
**After:** `docker system prune -a --filter \"until=1h\" -f`

### 2. `.github/workflows/deploy-docker.yml` (line 134)
**Before:** `docker system prune -a --filter "until=24h" -f`
**After:** `docker system prune -a --filter "until=1h" -f`

## Verification
- Review the diff to confirm only the filter flag was removed
- Next CI deploy should show `docker system prune -a -f` in logs and reclaim more disk space
