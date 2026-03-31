# UX Design Guide

> **READ THIS before building any UI feature.**
> These rules are derived from [Laws of UX](https://lawsofux.com) and translate
> psychology-backed principles into concrete, actionable decisions.

---

## Core Principles

### 1. Reduce choices, speed up decisions
*Based on: Hick's Law, Miller's Law, Occam's Razor*

- **Navigation**: Max 7 items per menu level. More than 7 → group into categories or use Command palette (`Command` component).
- **Forms**: Max 5-7 visible fields at a time. Longer forms → split into steps (wizard pattern) or collapsible sections.
- **Action buttons**: 1 primary action per view. Secondary actions go into `DropdownMenu`. DO NOT show 4+ equal-weight buttons side by side.
- **Filters**: Start with 2-3 most-used filters visible. Additional filters behind "More filters" `Popover` or `Sheet`.
- **Settings pages**: Group related settings into `Tabs` or `Accordion`. Never show 20+ toggles on a flat page.

### 2. Make it look like what users already know
*Based on: Jakob's Law, Law of Similarity*

- **Layout patterns**: Use conventions users already know:
  - List page = search bar + filters + table + pagination
  - Detail page = header (title + actions) + content sections
  - Settings page = sidebar nav + content area
  - Dashboard = card grid with key metrics on top
- **Component behavior**: `Dialog` for creation/editing, `AlertDialog` for destructive confirmation, `Sheet` for filters/details panels, `Toast` for success/error feedback. DO NOT invent new patterns when standard ones exist.
- **Icon meaning**: Use universally recognized icons from `lucide-react`. Pencil = edit, Trash = delete, Plus = create, X = close, ChevronDown = expand. DO NOT use abstract or ambiguous icons.
- **Form patterns**: Labels above inputs (not inline). Required fields marked with asterisk. Error messages below the input field in red. Success feedback via `Toast`.

### 3. Make targets easy to hit
*Based on: Fitts's Law, Goal-Gradient Effect*

- **Button sizes**: Min touch target 44x44px on mobile (`size="default"` or larger). Never use `size="sm"` for primary actions on mobile.
- **Click target area**: The entire row in a table/list should be clickable for navigation, not just a small text link. Use `cursor-pointer` on the `<tr>` or card.
- **Spacing between actions**: Destructive actions (Delete) must be visually separated from safe actions (Edit, Save). Use gap or `Separator`. Never place Delete button next to Submit button.
- **Progress indication**: For multi-step flows, show a progress bar or step indicator. Users push harder when they can see the finish line.
- **CTA placement**: Primary action button at bottom-right of forms/dialogs (where users' eyes naturally end). Consistent across all pages.

### 4. Show what's related, separate what's not
*Based on: Law of Proximity, Law of Common Region, Law of Uniform Connectedness*

- **Card grouping**: Related information goes in the same `Card`. Different concerns go in separate cards. DO NOT dump unrelated data into a single card.
- **Section spacing**: Use consistent spacing hierarchy:
  - Within a group: `gap-2` (8px)
  - Between groups: `gap-6` (24px)
  - Between sections: `gap-8` or `Separator`
- **Form grouping**: Related fields grouped with visual boundary (shared `Card` or section header). Email + password together. Address fields together. DO NOT interleave unrelated fields.
- **Visual connection**: Items that act together should look connected. Table row actions belong in the same row. Breadcrumb items connected by separators. Tab content visually attached to its tab trigger.

### 5. Make important things stand out
*Based on: Von Restorff Effect, Serial Position Effect*

- **Visual hierarchy**: 1 primary color per page for the most important action. Everything else neutral. If everything is blue, nothing stands out.
- **Destructive actions**: Always `variant="destructive"` (red). Never the same color as primary actions.
- **Empty states**: When a list/table has no data, show an illustration or icon + helpful message + CTA. Never show a blank white area or just "No data".
- **New/unread indicators**: Use `Badge` with count or dot indicator. Place at top-right corner of the element (consistent position).
- **First and last items matter**: In lists, the first and last items are remembered most. Put the most important item first, secondary important item last.

### 6. Respect user effort and memory
*Based on: Zeigarnik Effect, Peak-End Rule, Doherty Threshold*

- **Response time**: Actions must feel instant (<400ms). Show `Skeleton` loaders immediately. Use optimistic updates for mutations. Spinner only for operations >1s.
- **Unsaved changes**: If a user has unsaved form data, warn before navigation (`beforeunload` event or in-app confirmation). Never silently discard user input.
- **Draft persistence**: For long forms (>5 fields), auto-save to local state. Resume where the user left off.
- **End on a positive note**: After completing a flow (submit form, finish wizard), show a clear success state. The last impression matters most.
- **Error recovery**: After validation errors, keep all valid data filled. Only highlight the fields that need fixing. NEVER clear the entire form on error.

### 7. Be liberal in what you accept
*Based on: Postel's Law, Tesler's Law*

- **Input flexibility**: Accept multiple formats where possible. Phone: `0912345678`, `091-234-5678`, `+84912345678` → normalize internally. Dates: allow both picker and manual typing.
- **Search tolerance**: Search should be case-insensitive, trim whitespace, and tolerate minor typos. Use fuzzy matching or `contains` rather than exact match.
- **Complexity belongs in the system, not the UI**: If there's inherent complexity (complex filtering, data transformation), handle it in the backend/logic layer. The UI should present simple controls. DO NOT expose raw query builders or regex inputs to normal users.
- **Smart defaults**: Pre-fill sensible defaults. Status default = ACTIVE. Date default = today. Pagination default = 20 items. Reduce decisions the user has to make.

---

## Component Decision Patterns

> When you're unsure WHICH component to use, check this section.

### When to use what for overlays

| Scenario | Component | Why |
|----------|-----------|-----|
| Create/edit form (focused task) | `Dialog` | Blocks background, centers attention |
| Destructive confirmation | `AlertDialog` | Requires explicit action, prevents accidents |
| Filters or details panel | `Sheet` (side) | Keeps context visible, easy to dismiss |
| Quick info on hover | `HoverCard` | No click needed, ephemeral |
| Action hint | `Tooltip` | Minimal, non-blocking |
| Success/error feedback | `Toast` / `Sonner` | Non-blocking, auto-dismisses |
| Complex form with many steps | New page (route) | Dialogs are bad for long content |

### When to use what for lists

| Scenario | Component | Why |
|----------|-----------|-----|
| Structured data with columns | `Table` | Scannable, sortable, familiar |
| Cards with mixed content | Card grid | Visual-heavy items (images, stats) |
| Simple text list | Native `<ul>` + styling | Don't over-engineer simple lists |
| Searchable selection | `Command` | Fast filtering with keyboard support |
| Nested/tree data | `Accordion` | Progressive disclosure |

### When to use what for input

| Scenario | Component | Why |
|----------|-----------|-----|
| 2-5 options, all visible | `RadioGroup` | User sees all options at once |
| 2-5 options, space-constrained | `Select` | Compact, still scannable |
| 6+ options | `Select` with search or `Combobox` | Prevent overwhelming choice |
| Yes/no toggle | `Switch` | Binary, instant feedback |
| Multiple selections | `Checkbox` group | Clear multi-select affordance |
| Date selection | `DatePicker` (Calendar + Popover) | Visual calendar, prevents format errors |
| Long text | `Textarea` | Multi-line affordance |
| Constrained number | `Slider` | Visual range, prevents invalid input |

---

## Anti-patterns — NEVER do these

| Anti-pattern | Why it's bad | Do this instead |
|-------------|-------------|-----------------|
| `window.confirm()` for delete | Ugly, no styling, breaks flow | Use `AlertDialog` |
| `window.alert()` for messages | Blocks thread, terrible UX | Use `Toast` / `Sonner` |
| Full-page spinner for 200ms load | Feels broken, janky | Use `Skeleton` loaders per-section |
| Delete button right next to Save | Accidental destructive action | Separate with space or `Separator` |
| 15+ fields on a single form page | Overwhelming, high abandonment | Split into steps or sections |
| Raw error messages from API | "Error 500: Internal Server Error" | Human-readable messages + recovery action |
| Placeholder text as label | Disappears on focus, bad a11y | Use `Label` above input |
| Disabled buttons without explanation | User doesn't know why they can't click | Use `Tooltip` on disabled button explaining why |
| Red color for non-error elements | Confusing — red = danger/error | Reserve red for errors and destructive actions only |
| Auto-playing animations/transitions | Distracting, performance hit | Animate only on user-triggered interactions |
| Infinite scroll for data management | Can't bookmark position, hard to navigate | Use `Pagination` for admin/data views |
| Modal inside modal | Confusing navigation, hard to dismiss | Redesign flow to avoid nesting |

---

## Mandatory Patterns — EVERY feature must implement these

> **These are non-negotiable.** AI agents MUST implement all of these for every UI feature.
> Skipping any of these is a review blocker.

### 1. Mutation feedback (toast)

Every `useApiMutation` MUST have `onSuccess` and `onError` with toast:

```tsx
const mutation = useApiMutation({
  mutationFn: (data) => api.post("/items", data),
  onSuccess: () => {
    toast.success("Item created successfully");
    queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
  },
  onError: (error) => {
    toast.error(error.message || "Failed to create item");
  },
});
```

**Rules:**
- Success toast: describe what happened ("Order updated", "User deleted")
- Error toast: show human-readable message, never raw API error
- Toast on EVERY mutation — create, update, delete, status change, bulk action
- No toast needed for: navigation, filtering, sorting, pagination (read-only actions)

### 2. Stale data invalidation

After ANY mutation, invalidate related queries so other views stay fresh:

```tsx
onSuccess: () => {
  // Invalidate the list AND any detail views
  queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(id) });
  // If mutation affects counts/stats in other views
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
}
```

**Rules:**
- `invalidateQueries` after EVERY successful mutation — list views, detail views, related counts
- Use `refetchOnWindowFocus: true` in React Query config (default) so switching tabs auto-refreshes
- For real-time feel: use `refetchInterval` on dashboards/lists that change frequently
- Optimistic updates for instant feel: `onMutate` → update cache → `onError` → rollback

### 3. Layout and spacing

Buttons and actions MUST have proper spacing:

```tsx
// Action bar — ALWAYS use gap + flex-wrap
<div className="flex flex-wrap items-center gap-2">
  <Button>Save</Button>
  <Button variant="outline">Cancel</Button>
</div>

// Destructive action — SEPARATED from safe actions
<div className="flex flex-wrap items-center justify-between">
  <div className="flex items-center gap-2">
    <Button>Save</Button>
    <Button variant="outline">Cancel</Button>
  </div>
  <Button variant="destructive">Delete</Button>
</div>

// Table row actions — fixed width to prevent overlap
<TableCell className="w-[100px]">
  <div className="flex items-center gap-1">
    <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
    <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
  </div>
</TableCell>
```

**Rules:**
- ALWAYS `gap-2` or `gap-3` between buttons — never put buttons touching each other
- ALWAYS `flex-wrap` on action bars — buttons must wrap on small screens, not overlap
- Table actions: use `size="icon"` buttons in a fixed-width cell
- Cards in grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` — never hardcode exact widths
- Page padding: `p-4 sm:p-6 lg:p-8` — consistent across all pages

### 4. Loading and empty states

```tsx
// Loading — skeleton per section, NOT full-page spinner
if (isLoading) return <ItemListSkeleton />;

// Empty — message + CTA, NOT blank space
if (data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <PackageOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No items yet</h3>
      <p className="text-muted-foreground mt-1 mb-4">Get started by creating your first item.</p>
      <Button onClick={onCreateNew}>
        <Plus className="h-4 w-4 mr-2" /> Create item
      </Button>
    </div>
  );
}

// Button loading — spinner inside button, disable click
<Button disabled={mutation.isPending}>
  {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
  Save
</Button>
```

**Rules:**
- Skeleton loader per-section (not one big spinner for the whole page)
- Empty state with icon + message + CTA button
- Button shows spinner AND disables while mutation is pending
- Never show raw "undefined" or empty table with just headers

### 5. Responsive table

```tsx
// Wrap table in scroll container on mobile
<div className="overflow-x-auto rounded-md border">
  <Table>
    {/* Hide less important columns on mobile */}
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead className="hidden sm:table-cell">Status</TableHead>
        <TableHead className="hidden md:table-cell">Created</TableHead>
        <TableHead className="w-[100px]">Actions</TableHead>
      </TableRow>
    </TableHeader>
  </Table>
</div>
```

---

*Reference: [Laws of UX](https://lawsofux.com) by Jon Yablonski*
*Updated by: [who last updated this file]*
