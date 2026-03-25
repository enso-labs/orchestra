# AGENTS.md - Decks / Slide Deck

## Project Overview

reveal.js slide deck for [github.com/ruska-ai/orchestra](https://github.com/ruska-ai/orchestra).

- **Live URL:** <https://ruska-ai.github.io/orchestra/>
- **Tech:** Static HTML with reveal.js via CDN - no build step required
- **Edit:** `decks/slides/index.html` directly

## Directory Structure

```
decks/
  README.md            # This directory overview
  AGENTS.md            # Agent guidance (this file)
  CLAUDE.md            # Redirects to AGENTS.md
  index.html           # Redirects to slides/
  slides/
    index.html         # reveal.js deck
    README.md          # Slide editing & animation guide
```

## Local Preview

From the repository root:

```bash
# Option 1 - npx serve (serves on port 3000 by default)
npx serve decks

# Option 2 - Python built-in server
python -m http.server 8080 --directory decks
```

The root `index.html` redirects to `slides/`.

## Testing & Validation with agent-browser

Use the `agent-browser` CLI to verify the slide deck loads and navigates correctly.

### Step-by-step workflow

```bash
# 1. Start a local server in the background
python -m http.server 8080 --directory docs &

# 2. Open the slide deck
agent-browser open http://localhost:8080/slides/

# 3. Verify slide structure loads (accessibility snapshot)
agent-browser snapshot

# 4. Navigate slides
agent-browser press ArrowRight    # Next horizontal slide
agent-browser press ArrowDown     # Next vertical slide

# 5. Test keyboard shortcuts
agent-browser press o             # Overview mode
agent-browser press Escape        # Exit overview
agent-browser press f             # Fullscreen
agent-browser press Escape        # Exit fullscreen

# 6. Check page title
agent-browser get title

# 7. Validate no console errors
agent-browser errors

# 8. Clean up
agent-browser close
kill %1  # Stop background server
```

## Screenshots with agent-browser

Capture slide screenshots for documentation or PR assets:

```bash
# Set viewport to standard presentation size
agent-browser set viewport 1920 1080

# Use light mode for docs
agent-browser set media light

# Navigate to the desired slide first
agent-browser open http://localhost:8080/slides/
agent-browser press ArrowRight  # Navigate as needed

# Capture current slide
agent-browser screenshot docs/slides/screenshots/slide-title.png

# Capture full-page overview (e.g., after pressing 'o' for overview mode)
agent-browser press o
agent-browser screenshot --full docs/slides/screenshots/overview.png
```

## Deployment

Auto-deploys via `.github/workflows/slides.yml`:

- **Trigger:** push to `development` when files in `decks/slides/**` change, or manual `workflow_dispatch`
- **Action:** uploads the entire `decks/` directory as a GitHub Pages artifact
- **Concurrency:** only one deployment runs at a time

## Editing Slides

See [`slides/README.md`](slides/README.md) for the full slide editing, animation, and keyboard shortcut guide.
