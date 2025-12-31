# SPEC: Textarea for Description Fields in API Tool Form

## Overview

Replace single-line `Input` components with multi-line `Textarea` components for description fields in the API Tools form, allowing users to enter longer, more detailed descriptions.

## Current State

### 1. Tool Description Field (`ApiToolForm.tsx`)

Located at line 184-191:

```tsx
<div className="space-y-2">
    <label className="text-sm font-medium">Description</label>
    <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What does this tool do?"
    />
</div>
```

### 2. Parameter Description Field (`ArgsSchemaBuilder.tsx`)

Located at line 184-192:

```tsx
{
    /* Description */
}
<div className="col-span-5">
    <Input
        value={field.description}
        onChange={(e) => onUpdate({ ...field, description: e.target.value })}
        placeholder="Description"
        className="h-9"
    />
</div>;
```

## Proposed Solution

### Changes Required

#### File 1: `frontend/src/components/modals/ToolSelectionModal/ApiToolForm.tsx`

1. **Import Textarea** - Add `Textarea` to the imports from `@/components/ui/textarea`
2. **Replace Tool Description Input** - Change the description field from `Input` to `Textarea`
3. **Adjust Layout** - Update the grid layout since description will take more vertical space

#### File 2: `frontend/src/components/modals/ToolSelectionModal/components/ArgsSchemaBuilder.tsx`

1. **Import Textarea** - Add `Textarea` to the imports from `@/components/ui/textarea`
2. **Replace Parameter Description Input** - Change the description field in `SchemaRow` from `Input` to `Textarea`
3. **Adjust Styling** - Use appropriate height and resize behavior for the compact row layout

## Design Considerations

### Tool Description Field

-   Use a taller textarea (e.g., 3-4 rows) since this is the main description
-   Allow vertical resizing
-   Change layout from 2-column grid to stacked (full-width description below tool name)

### Parameter Description Field

-   Use a smaller textarea (2 rows minimum) to maintain compact table-like appearance
-   Constrain resize to vertical only to preserve grid alignment
-   Keep the existing grid layout but ensure consistent row alignment

## Implementation Details

### Textarea Styling

```tsx
// Tool Description - more room for detailed description
<Textarea
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  placeholder="What does this tool do? Provide detailed instructions..."
  rows={3}
  className="resize-y"
/>

// Parameter Description - compact but expandable
<Textarea
  value={field.description}
  onChange={(e) => onUpdate({ ...field, description: e.target.value })}
  placeholder="Description"
  rows={2}
  className="min-h-[36px] resize-y"
/>
```

## Out of Scope

-   No backend changes required
-   No changes to the data model/schema
-   No changes to validation logic

---

## Implementation Checklist

-   [ ] **1. Update `ApiToolForm.tsx`**

    -   [ ] Add `Textarea` import from `@/components/ui/textarea`
    -   [ ] Replace Description `Input` with `Textarea`
    -   [ ] Adjust grid layout (move description to full-width row below tool name)

-   [ ] **2. Update `ArgsSchemaBuilder.tsx`**

    -   [ ] Add `Textarea` import from `@/components/ui/textarea`
    -   [ ] Replace description `Input` with `Textarea` in `SchemaRow` component
    -   [ ] Apply compact styling to maintain grid alignment

-   [ ] **3. Test Changes**
    -   [ ] Verify tool description textarea works correctly
    -   [ ] Verify parameter description textarea works correctly
    -   [ ] Check for visual consistency and alignment
    -   [ ] Test on both create and edit modes
