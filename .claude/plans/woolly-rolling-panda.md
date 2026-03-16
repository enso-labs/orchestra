# Fix react-joyride Dark & Dusk Theme Support

## Context
React-joyride tooltips don't render correctly in dark and dusk (gray) themes. The current implementation passes CSS variable references (`hsl(var(--card))`) as inline style strings to Joyride's `styles.options`. React-joyride internally tries to parse `primaryColor` to derive button hover/active states via JS color math, which fails on unresolved CSS variables. The result: broken button styles and mismatched colors in non-light themes.

Screenshot reference: `specs/joyride-dark.png`

## Approach: Custom Tooltip Component
Use react-joyride's `tooltipComponent` prop to render a fully custom tooltip styled with Tailwind CSS classes that automatically respond to theme changes (`.dark`, `.gray`, `.light` on `<html>`).

This is the officially supported escape hatch. It avoids fragile runtime CSS variable resolution and gives full control over rendering while react-joyride still handles positioning, spotlight, overlay, and step navigation.

## Files to Modify

### 1. NEW: `frontend/src/components/tooltips/JoyrideTooltip.tsx`
Custom tooltip implementing `TooltipRenderProps` from react-joyride.

**Props received** (from react-joyride):
- `continuous`, `index`, `isLastStep`, `size`, `step` (from `BeaconRenderProps`)
- `backProps`, `closeProps`, `primaryProps`, `skipProps` (button event handlers)
- `tooltipProps` (ref + aria attrs for root div)

**Structure:**
```
Root div: bg-card text-card-foreground rounded-xl border border-border shadow-lg p-4
  - Close X button (top-right): text-muted-foreground hover:text-foreground
  - Title (optional): font-semibold text-base
  - Content: text-sm
  - Footer row:
    - Skip (left): text-muted-foreground
    - Progress "N / M" (right): text-xs text-muted-foreground
    - Back button: bg-secondary text-secondary-foreground (matches shadcn Button secondary variant)
    - Next/Last button: bg-primary text-primary-foreground (matches shadcn Button default variant)
```

### 2. MODIFY: `frontend/src/layouts/chat-layout-v2.tsx`
- Import `JoyrideTooltip`
- Add `tooltipComponent={JoyrideTooltip}` prop
- Strip all color-related inline styles, keep only `styles={{ options: { zIndex: 10000 } }}`
- Add `floaterProps={{ hideArrow: true }}` (arrow is rendered by react-floater outside our control; removing it avoids a separate color mismatch)

**Before:**
```tsx
<Joyride
  styles={{
    options: { zIndex: 10000, primaryColor: "hsl(...)", backgroundColor: "hsl(...)", ... },
    tooltip: { borderRadius: "0.75rem" },
    buttonNext: { ... }, buttonBack: { ... }, buttonSkip: { ... },
  }}
/>
```

**After:**
```tsx
<Joyride
  tooltipComponent={JoyrideTooltip}
  floaterProps={{ hideArrow: true }}
  styles={{ options: { zIndex: 10000 } }}
/>
```

## Verification
1. `cd frontend && npm run format && npm run lint`
2. `cd frontend && npm run test`
3. Use `agent-browser` to validate visually:
   - Navigate to chat page
   - Trigger the onboarding tour (click help button)
   - Verify tooltip renders correctly in dark theme
   - Switch to dusk/gray theme, verify tooltip adapts
   - Switch to light theme, verify tooltip still works
   - Step through multiple tour steps to verify navigation buttons work
