---
name: video-gif-generation
description: "Record browser workflows as video and convert to high-quality GIFs using agent-browser and ffmpeg. Use when users ask to record workflow, create gif, record demo, browser recording, workflow gif, or screen recording."
---

# Video & GIF Generation

Record browser automation workflows as video (.webm) and optionally convert them to high-quality animated GIFs using `agent-browser` for recording and `ffmpeg` for conversion.

This skill builds on the [agent-browser skill](../agent-browser/SKILL.md) to capture browser interactions as video recordings, then uses ffmpeg's palettegen/paletteuse pipeline to produce optimized GIFs suitable for documentation, PRs, and demos.

## Prerequisites

Before starting a recording workflow, validate that required tools are installed. Run these checks **once** at the beginning — do not repeat them per step.

### 1. Verify agent-browser

Run via Bash:

```bash
agent-browser --version
```

- **If successful**: Proceed to the next check.
- **If it fails**: Stop and tell the user:
  > `agent-browser` is not installed or not on PATH. Install it with:
  > ```
  > npm install -g @anthropic-ai/agent-browser
  > ```
  > Then re-run this workflow.

### 2. Verify ffmpeg (only when GIF output is requested)

Skip this check if the user only wants a `.webm` video file. If GIF conversion is needed, run via Bash:

```bash
ffmpeg -version
```

- **If successful**: Proceed with the workflow.
- **If it fails**: Stop and tell the user:
  > `ffmpeg` is not installed or not on PATH. Install it with:
  > - **Ubuntu/Debian**: `sudo apt install ffmpeg`
  > - **macOS**: `brew install ffmpeg`
  > - **Windows**: Download from https://ffmpeg.org/download.html
  >
  > Then re-run this workflow.

## Configuration

Before starting a recording, configure the browser viewport and display settings. Users can override any default by specifying their preferred values.

### Default Settings

| Setting | Default | Range / Options | agent-browser Command |
|---------|---------|-----------------|----------------------|
| Viewport width | 1280 | 320–1920 px | `agent-browser set viewport <w> <h>` |
| Viewport height | 720 | 240–1080 px | `agent-browser set viewport <w> <h>` |
| Color scheme | light | `light` / `dark` | `agent-browser set media light` or `agent-browser set media dark` |
| GIF FPS | 12 | 5–30 | Used in ffmpeg conversion (not an agent-browser setting) |
| GIF max width | 800 | 320–1920 px | Used in ffmpeg scaling (not an agent-browser setting) |

### Applying Configuration

Run these commands via Bash **before** starting the recording:

```bash
# Set viewport (default 1280x720, or use user-provided dimensions)
agent-browser set viewport 1280 720

# Set color scheme (default light)
agent-browser set media light
```

If the user requests different values (e.g., "record at 1920x1080 in dark mode"), substitute their values:

```bash
agent-browser set viewport 1920 1080
agent-browser set media dark
```

GIF FPS and max width are applied later during the ffmpeg conversion step — store the user's requested values (or the defaults of 12 FPS and 800px max width) for use in that step.
