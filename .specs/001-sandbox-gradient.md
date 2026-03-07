# Spec 001: Sandbox Popover Gradient Background

## Objective
Add a bottom-to-top gradient background behind the sandbox popover component that fades from opaque at the bottom to 0% opacity at the top.

## Requirements
- CSS gradient applied to the sandbox popover container/backdrop
- Direction: bottom → top (opaque → transparent)
- Should not interfere with popover content readability
- Must work across Chrome, Firefox, Safari

## Implementation Notes
- Use `background: linear-gradient(to top, rgba(0,0,0,0.X) 0%, rgba(0,0,0,0) 100%)`
- Identify the exact sandbox popover component and its backdrop element
- Ensure the gradient doesn't break existing dark/light theme support

## Acceptance
- [ ] Gradient visible behind sandbox popover
- [ ] Fades to fully transparent at top
- [ ] No visual regressions on other components
- [ ] Typecheck passes
