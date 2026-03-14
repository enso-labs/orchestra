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

## Output Paths & Naming

Resolve the output file path before starting the recording workflow.

### Path Resolution Rules

1. **User provides a full path** (e.g., `/home/user/recordings/demo.gif` or `./output/demo.webm`): Use that path as-is.
2. **User provides just a name** (e.g., "demo" or "login-flow"): Save to the current working directory with the appropriate extension.
   - If GIF output is requested: `<cwd>/<name>.gif` (final) and `<cwd>/<name>.webm` (intermediate video).
   - If video-only output is requested: `<cwd>/<name>.webm`.
3. **User provides no name**: Generate a descriptive name based on the workflow (e.g., `login-flow.gif`, `dashboard-demo.webm`).

### Intermediate Video File

When converting to GIF, an intermediate `.webm` video is recorded first. Store it alongside the final output:

- Final GIF: `<output-dir>/<name>.gif`
- Intermediate video: `<output-dir>/<name>.webm`

The intermediate `.webm` is deleted after successful GIF conversion (see the conversion section).

### Overwrite Protection

Before starting the recording, check if the output file(s) already exist:

```bash
ls <output-path>.gif 2>/dev/null
ls <output-path>.webm 2>/dev/null
```

- **If either file exists**: Ask the user for confirmation before proceeding. Do NOT silently overwrite existing files.
- **If neither file exists**: Proceed with the recording.

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

## Video-to-GIF Conversion

Convert a recorded `.webm` video to a high-quality animated GIF using ffmpeg's two-pass palettegen/paletteuse pipeline. This produces significantly better color quality than a single-pass conversion.

### Conversion Command Template

Run this two-pass ffmpeg command via Bash, substituting `<input>`, `<output>`, `<fps>`, and `<max_width>` with actual values:

```bash
ffmpeg -i <input>.webm -filter_complex "[0:v] fps=<fps>,scale=<max_width>:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=full [p];[b][p] paletteuse=dither=sierra2_4a" -loop 0 <output>.gif
```

**Filter breakdown:**

| Filter | Purpose |
|--------|---------|
| `fps=<fps>` | Set output frame rate (default 12, range 5–30) |
| `scale=<max_width>:-1:flags=lanczos` | Scale width to max_width, preserve aspect ratio, use Lanczos resampling for high-quality downscaling |
| `split [a][b]` | Duplicate the stream for two-pass processing |
| `palettegen=stats_mode=full` | Generate an optimal 256-color palette from all frames |
| `paletteuse=dither=sierra2_4a` | Apply the palette with Sierra dithering for smooth gradients |
| `-loop 0` | Loop the GIF infinitely |

### Default Values

Use these defaults unless the user specifies otherwise:

- **FPS**: 12 (range 5–30)
- **Max width**: 800px (range 320–1920)

If the user requests custom values, substitute them in the command. Clamp values to the valid ranges — if a user requests 60 FPS, use 30; if they request 100px width, use 320.

### Example: Convert with Defaults

```bash
ffmpeg -i workflow-demo.webm -filter_complex "[0:v] fps=12,scale=800:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=full [p];[b][p] paletteuse=dither=sierra2_4a" -loop 0 workflow-demo.gif
```

### Example: Convert with Custom Settings

User requests 24 FPS at 1280px max width:

```bash
ffmpeg -i workflow-demo.webm -filter_complex "[0:v] fps=24,scale=1280:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=full [p];[b][p] paletteuse=dither=sierra2_4a" -loop 0 workflow-demo.gif
```

### Post-Conversion Steps

After the ffmpeg command completes:

1. **Verify the GIF exists and is non-empty:**
   ```bash
   ls -la <output>.gif
   ```

2. **Delete the intermediate .webm file** (only after confirming the GIF was created successfully):
   ```bash
   rm <input>.webm
   ```

3. **Report the result** to the user with the output path and file size.

## Error Handling

Handle failures at each stage of the workflow with clear, actionable feedback. The goal is to preserve any partial output and help the user resolve the issue.

### Recording Start Failure

If `agent-browser record start <path>.webm` returns a non-zero exit code or outputs an error:

- **Stop immediately** — do not attempt browser actions.
- Report the error to the user with the exact error message from agent-browser.
- Suggest fixes:
  > Recording failed to start. Possible causes:
  > - agent-browser is not running or has no active page — try `agent-browser open <url>` first.
  > - The output path is not writable — check directory permissions.
  > - Another recording may already be in progress — try `agent-browser record stop` first.

### Browser Action Failure During Recording

If any agent-browser command (click, fill, navigate, etc.) fails while recording is active:

1. **Stop the recording immediately** to save what was captured so far:
   ```bash
   agent-browser record stop
   ```
2. **Check the partial .webm file** — it may contain useful footage up to the failure point:
   ```bash
   ls -la <output-path>.webm
   ```
3. **Report the failure** to the user with:
   - Which action failed and the error message.
   - That a partial recording was saved (if the .webm is non-empty).
   - Suggestion to fix the failing step and re-record.

Do NOT delete the partial .webm — the user may want to review what was captured.

### Empty Recording (0 Bytes)

If the output `.webm` file exists but is 0 bytes after `agent-browser record stop`:

- Report to the user:
  > The recording completed but captured nothing (0-byte file). This usually means:
  > - No browser page was open when recording started — ensure `agent-browser open <url>` runs before `agent-browser record start`.
  > - The recording started and stopped too quickly — add waits between actions.
  > - The browser viewport was not visible — check viewport configuration.
- Delete the empty .webm file.
- Do NOT proceed to GIF conversion.

### FFmpeg Conversion Failure

If the `ffmpeg` command returns a non-zero exit code or outputs an error:

- **Preserve the .webm file** — do NOT delete it. The user can retry conversion or use the video directly.
- Report the error to the user with the exact ffmpeg error output.
- Suggest fixes:
  > GIF conversion failed. The original video has been preserved at `<path>.webm`. Possible causes:
  > - The .webm file may be corrupted — try playing it with `ffplay <path>.webm`.
  > - ffmpeg may not support the codec — try re-recording.
  > - Insufficient disk space — check with `df -h`.
  >
  > You can retry conversion manually:
  > ```
  > ffmpeg -i <input>.webm -filter_complex "[0:v] fps=12,scale=800:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=full [p];[b][p] paletteuse=dither=sierra2_4a" -loop 0 <output>.gif
  > ```
