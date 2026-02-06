# PRD: Video & GIF Generation Skill

## Introduction

Create a Claude Code skill that enables product and marketing teams to record browser automation workflows as videos and convert them into high-quality GIFs. The skill wraps the `agent-browser` CLI's recording capabilities and `ffmpeg` post-processing into a reusable, configurable pipeline. Users provide a single prompt describing the workflow they want captured, and Claude orchestrates the full sequence: start recording, execute browser actions, stop recording, and convert to GIF with configurable quality settings.

## Goals

- Provide a reusable Claude Code skill for recording browser workflows as video and converting to GIF
- Support configurable output options: FPS, max width, output format (GIF or WebM)
- Integrate seamlessly with the existing `agent-browser` skill for browser automation
- Keep the workflow simple: one recording session produces one output file
- Enable product/marketing teams to generate demo assets without manual screen recording
- Handle prerequisite checks (ffmpeg, agent-browser) and provide clear error messages

## User Stories

### US-001: Create skill directory and SKILL.md
**Description:** As a developer, I need the skill directory and files created so the skill can be loaded by Claude Code.

**Acceptance Criteria:**
- [ ] Directory created at `.claude/skills/video-gif-generation/`
- [ ] `SKILL.md` created with valid YAML frontmatter (name, description with trigger keywords)
- [ ] Trigger keywords include: "record workflow", "create gif", "record demo", "browser recording", "workflow gif", "screen recording"
- [ ] Skill is under 3,000 words
- [ ] Skill references the `agent-browser` skill for browser automation commands

### US-002: Implement prerequisite validation step
**Description:** As Claude, I need to verify that required tools are installed before attempting a recording so I can provide clear error messages if something is missing.

**Acceptance Criteria:**
- [ ] Skill instructs Claude to check `agent-browser --version` before starting
- [ ] Skill instructs Claude to check `ffmpeg -version` before starting (only needed if GIF output requested)
- [ ] Clear error messages provided if either tool is missing, with install instructions
- [ ] Prerequisite check runs once at the start of the workflow, not repeated for each step

### US-003: Implement recording workflow orchestration
**Description:** As a product team member, I want Claude to record a browser workflow so I get a video file of the automation.

**Acceptance Criteria:**
- [ ] Skill documents the full recording lifecycle: start → execute actions → stop
- [ ] Recording starts with `agent-browser record start <output-path>.webm`
- [ ] Browser actions execute between start and stop (using agent-browser skill commands)
- [ ] `agent-browser wait --load networkidle` used after navigation to ensure pages are fully loaded
- [ ] Recording stops with `agent-browser record stop`
- [ ] Output `.webm` file is verified to exist and be non-empty after recording stops

### US-004: Implement video-to-GIF conversion with configurable options
**Description:** As a product team member, I want to convert the recorded video into a high-quality GIF with options to control size and quality.

**Acceptance Criteria:**
- [ ] Default ffmpeg command uses lanczos scaling for high quality
- [ ] Default FPS is 12
- [ ] Default max width is 800px (aspect ratio preserved)
- [ ] User can override FPS (range: 5-30)
- [ ] User can override max width (range: 320-1920)
- [ ] Palette generation is used for optimal GIF colors (`palettegen` + `paletteuse`)
- [ ] GIF loops infinitely by default (`-loop 0`)
- [ ] Intermediate `.webm` file is deleted after successful GIF conversion

### US-005: Implement output path and naming conventions
**Description:** As a user, I want sensible default output paths so I don't have to specify where to save files.

**Acceptance Criteria:**
- [ ] Default output directory is the current working directory
- [ ] If user provides a name (e.g., "demo"), output is `demo.gif` (or `demo.webm`)
- [ ] If user provides a full path, that path is used as-is
- [ ] Intermediate `.webm` is stored alongside the final output
- [ ] If output file already exists, Claude asks the user before overwriting

### US-006: Implement viewport and display configuration
**Description:** As a product team member, I want to control the browser viewport size and appearance for consistent recordings.

**Acceptance Criteria:**
- [ ] Default viewport is 1280x720 (720p)
- [ ] User can override viewport dimensions
- [ ] Light mode is set by default (`agent-browser set media light`) for professional-looking recordings
- [ ] User can request dark mode if preferred
- [ ] Viewport is configured before recording starts

### US-007: Add error handling for recording failures
**Description:** As a user, I want clear feedback when something goes wrong during recording so I know what happened and how to fix it.

**Acceptance Criteria:**
- [ ] If `agent-browser record start` fails, Claude reports the error and does not attempt further steps
- [ ] If a browser action fails during recording, Claude stops recording, saves what was captured, and reports the failure
- [ ] If `ffmpeg` conversion fails, Claude preserves the `.webm` file and reports the conversion error
- [ ] If the output `.webm` is empty (0 bytes), Claude reports that the recording captured nothing

## Functional Requirements

- FR-1: The skill MUST be located at `.claude/skills/video-gif-generation/SKILL.md` with valid YAML frontmatter
- FR-2: The YAML description MUST include trigger keywords: "record workflow", "create gif", "record demo", "browser recording", "workflow gif"
- FR-3: The skill MUST validate that `agent-browser` is installed before starting any workflow
- FR-4: The skill MUST validate that `ffmpeg` is installed before attempting GIF conversion
- FR-5: The skill MUST use `agent-browser record start <path>.webm` to begin recording
- FR-6: The skill MUST use `agent-browser record stop` to end recording
- FR-7: The skill MUST use `agent-browser wait --load networkidle` after each navigation action
- FR-8: The skill MUST convert `.webm` to GIF using ffmpeg with palette generation and lanczos scaling
- FR-9: The skill MUST support configurable FPS (default 12), max width (default 800px), and output format
- FR-10: The skill MUST set viewport to 1280x720 and light mode before recording starts
- FR-11: The skill MUST clean up intermediate `.webm` files after successful GIF conversion
- FR-12: The skill MUST verify the output file exists and is non-empty after each step
- FR-13: The skill MUST reference the `agent-browser` skill for browser command syntax

## Non-Goals

- No video editing capabilities (trimming, cropping, adding text overlays)
- No support for recording multiple segments and stitching them together
- No audio recording or narration support
- No automatic upload to hosting services (S3, Imgur, etc.)
- No real-time preview of the recording
- No support for formats beyond WebM and GIF (no MP4, AVI, etc.)
- No built-in workflow templates — users describe what to record in natural language

## Design Considerations

### Skill Directory Structure
```
.claude/skills/video-gif-generation/
└── SKILL.md    # Core skill instructions
```

### ffmpeg Command Template
```bash
ffmpeg -i <input>.webm \
  -filter_complex "[0:v] fps=<FPS>,scale=<WIDTH>:-1:flags=lanczos,split [a][b];[a] palettegen [p];[b][p] paletteuse" \
  -loop 0 \
  <output>.gif
```

### Default Configuration Table
| Setting | Default | Range/Options |
|---------|---------|---------------|
| FPS | 12 | 5-30 |
| Max Width | 800px | 320-1920px |
| Output Format | GIF | GIF, WebM |
| Viewport | 1280x720 | Any valid dimensions |
| Color Scheme | Light | Light, Dark |
| Loop | Infinite | Infinite only |

### Integration with agent-browser Skill
This skill depends on the existing `agent-browser` skill for all browser automation commands. The video-gif-generation skill adds the recording and conversion layer on top. Claude should:
1. Load the agent-browser skill for browser command reference
2. Use this skill for the recording/conversion pipeline
3. Combine both skills' instructions when executing a recording workflow

## Technical Considerations

- `agent-browser record start` creates a `.webm` file (VP8/VP9 codec)
- ffmpeg's `palettegen`/`paletteuse` filter chain produces significantly better GIF quality than naive conversion
- Lanczos scaling provides the best quality downscaling for GIFs
- GIF file sizes grow rapidly with resolution and FPS — the defaults (800px, 12fps) balance quality vs. file size
- The `agent-browser` CLI maintains persistent browser state, so recording works across multiple commands
- No additional npm packages or system dependencies beyond agent-browser and ffmpeg

## Success Metrics

- Skill loads correctly when triggered by keywords ("record demo", "create gif", etc.)
- Claude can record a multi-step browser workflow and produce a working GIF in a single conversation
- Output GIFs are under 10MB for typical 10-30 second workflows at default settings
- Product/marketing team members can request recordings without knowing CLI commands
- Error cases produce actionable messages (not cryptic ffmpeg errors)

## Open Questions

- Should the skill support a "dry run" mode that executes the workflow without recording to verify it works first?
- Should there be a file size warning/limit for GIFs (e.g., warn if output exceeds 15MB)?
- Should the skill automatically optimize GIF size if it exceeds a threshold (reduce FPS, reduce width)?
- Should the skill support adding a brief pause/delay at the start and end of the recording for visual polish?
