# Spec: #823 — Schedule Calendar Mobile Overflow Fix

## Problem

On iPhone XR (414×896), the schedule/cron calendar overflows both axes because:
1. `min-h-[600px]` on calendar container forces vertical overflow
2. `react-big-calendar` toolbar doesn't wrap on narrow screens
3. Calendar grid cells have no max-width constraints
4. Event popup may render outside viewport

## Solution

### 1. Calendar Components (`ScheduleCalendar.tsx`, `CronCalendar.tsx`)
- Replace `min-h-[600px]` with responsive: `min-h-[400px] sm:min-h-[600px]`
- Add `overflow-x-hidden` to prevent horizontal scroll on container
- On mobile, default to `day` or `agenda` view instead of `month` (more usable)

### 2. Calendar CSS (`calendar.css`)
Add mobile breakpoint overrides:

```css
@media (max-width: 480px) {
  /* Toolbar: stack navigation and view buttons */
  .rbc-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .rbc-toolbar .rbc-toolbar-label {
    font-size: 0.875rem;
    text-align: center;
  }
  .rbc-toolbar button {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
  /* Headers: smaller text */
  .rbc-header {
    padding: 0.25rem;
    font-size: 0.6875rem;
  }
  /* Month cells: constrain overflow */
  .rbc-month-view {
    overflow-x: auto;
  }
  .rbc-event {
    font-size: 0.6875rem;
    padding: 1px 3px;
  }
  /* Popup overlay: constrain to viewport */
  .rbc-overlay {
    max-width: calc(100vw - 2rem);
    max-height: 60vh;
    overflow-y: auto;
  }
}
```

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/calendar/ScheduleCalendar.tsx` | Responsive min-height, mobile default view |
| `frontend/src/components/calendar/CronCalendar.tsx` | Same changes |
| `frontend/src/styles/calendar.css` | Mobile breakpoint overrides |

## Testing

- Verify on 414px viewport (iPhone XR): no overflow in either axis
- Verify on desktop: no regression
- Verify toolbar wraps properly on narrow screens
- Verify event popup stays in viewport
