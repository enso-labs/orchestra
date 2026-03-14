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
