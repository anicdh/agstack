# Frontend UI Skill — Tailwind + Shadcn/ui

> **MANDATORY:** agent-frontend MUST read this file before writing or modifying any `.tsx` file with UI.

## Before Writing Any UI Code

1. Check `frontend/src/components/ui/` — what Shadcn components are installed?
2. Check `frontend/src/components/shared/` — project wrappers around Shadcn
3. Check `docs/ux-guide.md` — UX principles and mandatory patterns
4. If user-oriented epic: check mockup at `frontend/src/mockups/[epic-name]/`

## Tailwind Conventions

### Mobile-First Responsive

```tsx
// ✅ CORRECT — mobile-first, add breakpoints for larger screens
<div className="p-4 sm:p-6 lg:p-8">
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item) => <Card key={item.id} />)}
  </div>
</div>

// ❌ WRONG — desktop-first, overriding for mobile
<div className="p-8 md:p-6 sm:p-4">
```

### Breakpoint Reference

| Prefix | Min width | Typical device |
|--------|-----------|---------------|
| (none) | 0px | Mobile |
| `sm:` | 640px | Large phone / small tablet |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Laptop |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

### Spacing System — Be Consistent

```tsx
// Page-level padding
<main className="p-4 sm:p-6 lg:p-8">

// Section spacing
<div className="space-y-6">       {/* Between major sections */}
  <div className="space-y-4">     {/* Between subsections */}
    <div className="space-y-2">   {/* Between related elements */}

// Card content
<Card>
  <CardHeader className="pb-3">   {/* Tighter header padding */}
  <CardContent className="pt-0">  {/* No double padding with header */}
</Card>

// Gap between inline elements
<div className="flex items-center gap-2">    {/* Buttons, tags, icons */}
<div className="flex items-center gap-4">    {/* Cards, sections */}
```

Rules:
- `gap-2` (8px) — between buttons, tags, inline elements
- `gap-4` (16px) — between cards, form fields
- `gap-6` (24px) — between subsections
- `gap-8` (32px) — between major sections
- NEVER use arbitrary values like `gap-[13px]` — stick to the scale

### Typography

```tsx
// Page title
<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>

// Section title
<h2 className="text-lg font-semibold">Recent Orders</h2>

// Subtitle / description
<p className="text-sm text-muted-foreground">Manage your orders and track shipments.</p>

// Table cell text
<TableCell className="font-medium">{name}</TableCell>
<TableCell className="text-muted-foreground">{date}</TableCell>
```

Rules:
- `text-muted-foreground` for secondary text — NEVER hardcode `text-gray-500`
- `tracking-tight` on page titles for better visual density
- `font-medium` for emphasis, `font-semibold` for headings, `font-bold` for page titles
- Max `text-3xl` for page titles — never `text-5xl` or larger in app UI

### Colors — Use Semantic Tokens

```tsx
// ✅ CORRECT — semantic color tokens (theme-aware)
<div className="bg-background text-foreground">
<div className="bg-muted text-muted-foreground">
<div className="bg-card text-card-foreground">
<div className="border-border">
<div className="bg-destructive text-destructive-foreground">
<div className="bg-primary text-primary-foreground">

// ❌ WRONG — hardcoded colors (breaks dark mode)
<div className="bg-white text-black">
<div className="bg-gray-100 text-gray-600">
<div className="bg-red-500 text-white">
```

Rules:
- ALWAYS use semantic tokens: `background`, `foreground`, `muted`, `card`, `primary`, `destructive`, `border`
- NEVER hardcode color values like `bg-white`, `text-black`, `bg-gray-*`
- Exception: `text-red-500` is OK for inline form error messages (Shadcn convention)
- Status colors: use Badge variants, not raw colors

### Dark Mode Ready

```tsx
// ✅ CORRECT — already works with dark mode via semantic tokens
<Card className="bg-card text-card-foreground">

// ✅ CORRECT — explicit dark mode override when needed
<div className="bg-muted dark:bg-muted/50">

// ❌ WRONG — light-only colors
<div className="bg-white shadow-md">      {/* Invisible in dark mode */}
<div className="text-gray-900">           {/* Low contrast in dark mode */}
```

## Shadcn/ui Component Decision Map

### DO NOT write raw HTML — use Shadcn

| Need | Shadcn Component | NEVER use |
|------|-----------------|-----------|
| Button/action | `<Button>` | `<button>` |
| Text input | `<Input>` | `<input>` |
| Select dropdown | `<Select>` | `<select>` |
| Checkbox | `<Checkbox>` | `<input type="checkbox">` |
| Toggle | `<Switch>` | Custom toggle |
| Modal | `<Dialog>` | `<dialog>`, custom modal |
| Confirm dialog | `<AlertDialog>` | `window.confirm()` |
| Side panel | `<Sheet>` | Custom sidebar |
| Toast/notification | `toast()` from Sonner | `window.alert()`, custom notification |
| Tooltip | `<Tooltip>` | `title` attribute |
| Dropdown menu | `<DropdownMenu>` | Custom dropdown |
| Data table | `<Table>` + components | `<table>` with raw HTML |
| Tabs | `<Tabs>` | Custom tab implementation |
| Accordion | `<Accordion>` | Custom collapsible |
| Badge/tag | `<Badge>` | `<span>` with hardcoded colors |
| Loading spinner | `<Loader2>` from lucide | Custom spinner SVG |
| Separator | `<Separator>` | `<hr>` |
| Card container | `<Card>` | `<div>` with shadow |

### Button Variants — When to Use Each

```tsx
// Primary action (1 per view)
<Button>Create Order</Button>

// Secondary actions
<Button variant="outline">Cancel</Button>
<Button variant="secondary">Save Draft</Button>

// Destructive (delete, remove, revoke)
<Button variant="destructive">Delete</Button>

// Ghost (table row actions, icon-only buttons)
<Button variant="ghost" size="icon">
  <Pencil className="h-4 w-4" />
</Button>

// Link-style
<Button variant="link">View details</Button>
```

### Form Pattern

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm<CreateItemDto>({
  resolver: zodResolver(CreateItemSchema),
  defaultValues: { name: "", status: "ACTIVE" },
});

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter name..." {...field} />
            </FormControl>
            <FormMessage />  {/* Auto shows Zod errors */}
          </FormItem>
        )}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create
        </Button>
      </div>
    </form>
  </Form>
);
```

### Status Badge Pattern

```tsx
const statusVariants: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "secondary",
  SHIPPING: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

<Badge variant={statusVariants[order.status]}>
  {order.status}
</Badge>
```

## Layout Patterns

### Page Layout

```tsx
// Standard list page
export function OrdersPage() {
  return (
    <div className="space-y-6">
      {/* Header — title + primary action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage customer orders.</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" /> New Order</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search orders..." className="max-w-sm" />
        <Select><SelectTrigger className="w-[140px]">...</SelectTrigger></Select>
      </div>

      {/* Table with responsive wrapper */}
      <div className="overflow-x-auto rounded-md border">
        <Table>...</Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Showing 1-20 of 156</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm">Next</Button>
        </div>
      </div>
    </div>
  );
}
```

### Empty State

```tsx
function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

// Usage
<EmptyState
  icon={PackageOpen}
  title="No orders yet"
  description="Start by creating your first order."
  action={<Button><Plus className="h-4 w-4 mr-2" /> Create Order</Button>}
/>
```

### Loading Skeleton

```tsx
function OrderListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-md border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Icons — lucide-react Only

```tsx
import { Plus, Pencil, Trash2, ChevronDown, Search, Loader2, X } from "lucide-react";

// Standard sizes
<Icon className="h-4 w-4" />    {/* Inside buttons, table cells */}
<Icon className="h-5 w-5" />    {/* Standalone, navigation */}
<Icon className="h-6 w-6" />    {/* Empty state, feature icons */}
<Icon className="h-12 w-12" />  {/* Hero/empty state illustration */}
```

Rules:
- ONLY `lucide-react` — no emoji, no other icon libraries
- Always explicit `h-*` and `w-*` classes — never rely on default sizing
- `mr-2` when icon is before text in a button
- `text-muted-foreground` for decorative icons

## Animation — Minimal

```tsx
// ✅ ALLOWED — subtle transitions
<div className="transition-colors hover:bg-muted">          {/* Hover states */}
<div className="transition-opacity duration-150">            {/* Fade in/out */}
<Loader2 className="h-4 w-4 animate-spin" />                {/* Loading spinner */}

// ❌ NOT ALLOWED — distracting animations
<div className="animate-bounce">                             {/* Too flashy */}
<div className="animate-pulse">                              {/* Only for skeletons */}
<div className="transition-all duration-1000">               {/* Too slow */}
```

Rules:
- `animate-spin` — ONLY for `Loader2` spinner
- `animate-pulse` — ONLY for `Skeleton` loading placeholders
- `transition-colors` — for hover/focus states on interactive elements
- NEVER auto-animate on page load — animate only on user interaction
- NEVER use CSS `@keyframes` or custom animations — Tailwind built-ins only

## Common Gotchas

### z-index Stacking

```tsx
// Shadcn handles z-index internally for overlays. DO NOT manually set z-index
// unless you have a specific layering issue.

// ❌ WRONG
<div className="z-50">
<div className="z-[9999]">

// ✅ CORRECT — let Shadcn manage overlay stacking
<Dialog>    {/* z-50 by default */}
<Sheet>     {/* z-50 by default */}
<Toast>     {/* z-[100] by default */}
```

### Overflow and Scroll

```tsx
// Table — horizontal scroll on mobile
<div className="overflow-x-auto rounded-md border">
  <Table>...</Table>
</div>

// Long content area — vertical scroll with fixed height
<div className="h-[400px] overflow-y-auto">
  <div className="space-y-2">{items.map(...)}</div>
</div>

// Text overflow — truncate
<p className="truncate max-w-[200px]">{longText}</p>

// ❌ WRONG — overflow hidden clips content silently
<div className="overflow-hidden">  {/* Content disappears! */}
```

### Focus and Accessibility

```tsx
// Shadcn handles focus rings. Additional a11y rules:

// Interactive elements need aria-label when text is not visible
<Button variant="ghost" size="icon" aria-label="Edit order">
  <Pencil className="h-4 w-4" />
</Button>

// Loading states need aria-busy
<div aria-busy={isLoading}>
  {isLoading ? <Skeleton /> : <Content />}
</div>

// Destructive dialog needs clear messaging
<AlertDialogTitle>Are you sure?</AlertDialogTitle>
<AlertDialogDescription>
  This will permanently delete the order. This action cannot be undone.
</AlertDialogDescription>
```

## Before Commit Checklist

1. No raw HTML elements where Shadcn exists (no `<button>`, `<input>`, `<select>`, `<dialog>`)
2. No hardcoded colors (no `bg-white`, `text-black`, `bg-gray-*`) — use semantic tokens
3. No arbitrary values (no `w-[347px]`, `gap-[13px]`) — use Tailwind scale
4. Mobile-first responsive (`sm:`, `md:`, `lg:` breakpoints)
5. Every table wrapped in `overflow-x-auto`
6. Every list/table has empty state
7. Every async button has loading spinner + disabled
8. Every icon-only button has `aria-label`
9. Spacing follows system: `gap-2` → `gap-4` → `gap-6` → `gap-8`
10. No `z-index` overrides unless absolutely necessary
