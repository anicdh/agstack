# UI Component Catalog

> **RULE: Before writing ANY interactive UI element, CHECK this file first.**
> If a Shadcn component exists for your need, USE IT. DO NOT write raw HTML.

## How to Add a New Shadcn Component

```bash
# 1. Install the component
npx shadcn@latest add <component-name>

# 2. Auto-sync this file (detects new .tsx files and adds entries)
bash scripts/sync-components.sh
```

The sync script has built-in metadata for all standard Shadcn components — it auto-fills import path, use case, and key props. Review and add code examples if needed.

## Installed Components

<!-- When you install a new Shadcn component, add an entry below using this format:

### ComponentName
- **Import**: `import { ComponentName } from "@/components/ui/component-name"`
- **Use when**: [describe when to use this component]
- **DO NOT use when**: [describe when NOT to use / what to use instead]
- **Key props**: `prop1`, `prop2`, `variant="default|destructive|outline"`
- **Example**:
```tsx
<ComponentName variant="default" size="sm">
  Label
</ComponentName>
```
-->

*No components installed yet. Run `npx shadcn@latest add <name>` to install.*

---

## Component Decision Map

> Use this table to find the RIGHT component for your UI need.
> If "Shadcn component" column says "—", you may write custom HTML.

| UI Need | Shadcn Component | DO NOT write |
|---------|-----------------|--------------|
| Click action | `Button` | `<button className="...">` |
| Text input | `Input` | `<input type="text">` |
| Multi-line text | `Textarea` | `<textarea>` |
| On/off toggle | `Switch` | `<input type="checkbox">` for toggles |
| Checkbox | `Checkbox` | `<input type="checkbox">` |
| Radio options | `RadioGroup` | `<input type="radio">` |
| Dropdown select | `Select` | `<select>` |
| Combobox / autocomplete | `Combobox` (Command-based) | Custom dropdown with useState |
| Modal / dialog | `Dialog` | `<dialog>` or custom modal div |
| Side panel | `Sheet` | Fixed position div |
| Popover | `Popover` | Absolute positioned div |
| Tooltip | `Tooltip` | `title` attribute or custom hover div |
| Toast / notification | `Sonner` or `Toast` | Custom notification div |
| Data table | `Table` + `DataTable` pattern | `<table>` with manual styling |
| Form with validation | `Form` (react-hook-form wrapper) | Manual form + onSubmit |
| Date picker | `DatePicker` (Calendar + Popover) | `<input type="date">` |
| Tabs | `Tabs` | Custom tab div with useState |
| Accordion | `Accordion` | Custom toggle div |
| Navigation menu | `NavigationMenu` | Custom nav with links |
| Breadcrumb | `Breadcrumb` | Custom breadcrumb spans |
| Pagination | `Pagination` | Custom prev/next buttons |
| Badge / tag | `Badge` | `<span className="rounded-full...">` |
| Alert / banner | `Alert` | Custom colored div |
| Card container | `Card` | `<div className="border rounded...">` |
| Dropdown menu | `DropdownMenu` | Custom absolute div |
| Context menu | `ContextMenu` | Custom right-click handler |
| Command palette | `Command` | Custom search modal |
| Separator line | `Separator` | `<hr>` or border div |
| Avatar | `Avatar` | `<img className="rounded-full">` |
| Skeleton loader | `Skeleton` | `<div className="animate-pulse">` |
| Progress bar | `Progress` | `<div>` with width percentage |
| Slider | `Slider` | `<input type="range">` |
| Scroll area | `ScrollArea` | `overflow-auto` div |
| Label | `Label` | `<label>` |
| Aspect ratio | `AspectRatio` | Padding-based ratio hack |
| Collapsible | `Collapsible` | Custom toggle with useState |
| Hover card | `HoverCard` | Custom hover div |
| Alert dialog | `AlertDialog` | `window.confirm()` |
| Toggle button | `Toggle` | Button with active state |
| Toggle group | `ToggleGroup` | Multiple buttons with state |
| Static text | — | `<p>`, `<span>`, `<h1>`-`<h6>` OK |
| Layout divs | — | `<div>` with Tailwind OK |
| Links | — | `<a>` or React Router `<Link>` OK |
| Images | — | `<img>` OK |
| Icons | `lucide-react` | DO NOT use emoji or unicode symbols |

## Wrapper Components

> Shared wrapper components live in `@/components/shared/`.
> These wrap Shadcn components with project-specific defaults.
> DO NOT modify files in `@/components/ui/` — those are Shadcn-managed.

| Need | Wrapper at | Wraps |
|------|-----------|-------|
| *Add your wrappers here* | `@/components/shared/<name>.tsx` | `@/components/ui/<shadcn>` |

<!-- Example:
| Confirm dialog | `@/components/shared/confirm-dialog.tsx` | `AlertDialog` |
| Data table | `@/components/shared/data-table.tsx` | `Table` + sorting/filtering |
| Page header | `@/components/shared/page-header.tsx` | Breadcrumb + title layout |
-->

## Rules for Claude Agents

1. **SEARCH THIS FILE FIRST** before writing any UI element
2. **If a Shadcn component exists** → install it (`npx shadcn@latest add`) and use it
3. **If a wrapper exists** in `@/components/shared/` → use the wrapper
4. **If neither exists** and the pattern will be reused → create a wrapper in `@/components/shared/`
5. **NEVER modify `@/components/ui/`** — these files are managed by Shadcn CLI
6. **After installing a new component** → update this file with the entry
