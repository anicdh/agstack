# UI Spec: [Feature Name]

> Created during sprint planning. Agent-frontend follows this spec during implementation.
> Agent-ux validates against this spec at sprint end.
> Updated when new tasks modify this feature in later sprints.

## Pages

### [Page Name] — `/route/path`

**Layout:**
- Page padding: `p-6`
- Sections: [header, content, footer]

**Header:**
- Container: `flex justify-between items-center`
- Left: `h1` "[Page Title]" + `Badge` with count (if applicable)
- Right: Primary action `Button` "[Action]" with `[Icon]` icon

**Content:**
<!-- Describe the main content area — table, form, cards, etc. -->

**Table** (if applicable):
- Wrapper: `overflow-x-auto rounded-md border`
- Columns: [Column 1], [Column 2], ... , Actions (`w-[100px]`)
- Mobile: hide [columns] with `hidden sm:table-cell`
- Row click: navigates to detail page (if applicable)
- Actions per row: [Edit (icon ghost), Delete (icon ghost destructive)]

**Form** (if applicable):
- Wrapper: `Dialog` or full page (specify which)
- Fields: [field name: component type, validation rule]
- Submit: `Button` with loading spinner + disable while pending
- Cancel: `Button variant="outline"`
- On success: toast "[message]" + `invalidateQueries` + close dialog
- On error: toast error + keep form data + highlight invalid fields

**Empty state:**
- Icon: `[LucideIconName]` `h-12 w-12 text-muted-foreground`
- Title: "[No items yet]"
- Description: "[Get started by...]"
- CTA: `Button` "[Create first item]"

**Loading state:**
- Skeleton: [N] rows matching table structure / card placeholders

**Error state:**
- Toast for API errors
- Inline error for form validation

## Interactions

### [Action Name] — e.g., "Create Order"
- Trigger: [Button click / menu item / etc.]
- Opens: `Dialog` with [form fields]
- On submit: `POST /api/v1/[resource]`
- On success: toast "[Created successfully]" + `invalidateQueries([keys])` + close dialog
- On error: toast error message

### [Action Name] — e.g., "Delete Order"
- Trigger: Trash icon button in table row
- Opens: `AlertDialog` with confirmation message
- Confirm: `DELETE /api/v1/[resource]/:id`
- On success: toast "[Deleted]" + `invalidateQueries([keys])`
- On error: toast error message

## Responsive Behavior
- Desktop (≥1024px): [full layout description]
- Tablet (≥640px): [what changes — hidden columns, stacked cards, etc.]
- Mobile (<640px): [what changes — full stack, hamburger menu, etc.]

## Revision History
| Sprint | Task | Change |
|--------|------|--------|
| Sprint 1 | TASK-XXX | Initial spec — [feature] page |
<!-- Add rows when this spec is updated in later sprints -->
