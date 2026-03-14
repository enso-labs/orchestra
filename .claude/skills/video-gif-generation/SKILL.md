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

## Recording Workflow

Follow this lifecycle to record a browser workflow as a `.webm` video file.

### Step 1: Configure the Browser

Apply viewport and display settings before starting the recording (see [Configuration](#configuration) above):

```bash
agent-browser set viewport 1280 720
agent-browser set media light
```

### Step 2: Start Recording

Begin video capture by specifying an output path for the `.webm` file:

```bash
agent-browser record start <output-path>.webm
```

For example: `agent-browser record start demo.webm`

### Step 3: Execute Browser Actions

Perform the workflow steps using agent-browser commands between `record start` and `record stop`. Use any agent-browser actions needed — navigate, click, fill, snapshot, etc.

After each navigation, wait for the page to fully load before continuing:

```bash
agent-browser open <url>
agent-browser wait --load networkidle

agent-browser click @e2
agent-browser wait --load networkidle
```

Use `agent-browser wait --load networkidle` after any action that triggers a page navigation or significant network activity. This ensures the page is fully rendered before the next action, producing a clean recording.

For non-navigation interactions (typing, clicking buttons that update the DOM without navigating), use a short delay if needed:

```bash
agent-browser wait 500
```

### Step 4: Stop Recording

Once all workflow steps are complete, stop the recording:

```bash
agent-browser record stop
```

### Step 5: Verify Output

Confirm the recording was saved successfully by checking the output file exists and is non-empty:

```bash
ls -la <output-path>.webm
```

- **If the file exists and has size > 0**: The recording succeeded. Proceed to GIF conversion (if requested) or report success.
- **If the file is missing or 0 bytes**: The recording failed — report the issue to the user.

### Complete Recording Example

```bash
# 1. Configure
agent-browser set viewport 1280 720
agent-browser set media light

# 2. Start recording
agent-browser record start workflow-demo.webm

# 3. Perform actions
agent-browser open http://localhost:3000
agent-browser wait --load networkidle
agent-browser click @e5
agent-browser wait 500
agent-browser fill @e8 "Hello World"
agent-browser click @e10
agent-browser wait --load networkidle

# 4. Stop recording
agent-browser record stop

# 5. Verify
ls -la workflow-demo.webm
```
