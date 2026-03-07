# Spec 002: Unified File Panel Trigger Component

## Objective
Consolidate multiple FilePanelEditor trigger points into a single unified component that shows basic stats and opens the editor on press.

## Requirements
- Single component replaces all existing trigger points for FilePanelEditor
- Component displays basic stats (e.g., file count, active file name)
- Opens FilePanelEditor on click/press
- Visual style similar to the sandbox popover (consistent UI language)

## Investigation Needed
- Identify all current places that trigger FilePanelEditor
- Determine what "basic stats" are most useful to display
- Decide on component placement (toolbar? sidebar? floating?)

## Acceptance
- [ ] Single component triggers FilePanelEditor
- [ ] Displays basic file stats
- [ ] All previous trigger points removed or redirected
- [ ] Typecheck passes
- [ ] Browser verification passes
