#!/usr/bin/env bash
#
# sync-components — Auto-detect installed Shadcn components and update COMPONENTS.md
#
# Usage: npm run sync:components
#   or:  bash scripts/sync-components.sh
#
# Scans frontend/src/components/ui/ for .tsx files, compares against
# COMPONENTS.md, and adds missing entries with pre-filled metadata.
#
# Compatible with macOS default bash (3.2+) — no bash 4 features used.

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
UI_DIR="$PROJECT_ROOT/frontend/src/components/ui"
CATALOG="$UI_DIR/COMPONENTS.md"

if [ ! -d "$UI_DIR" ]; then
  echo "ERROR: $UI_DIR not found. Run from project root."
  exit 1
fi

if [ ! -f "$CATALOG" ]; then
  echo "ERROR: COMPONENTS.md not found at $CATALOG"
  exit 1
fi

# ─── Known Shadcn component metadata ────────────────────────────
# Returns "DisplayName|Use when|Key props" for a given filename.
# Compatible with bash 3.2 (no associative arrays).

get_component_meta() {
  case "$1" in
    accordion)      echo 'Accordion|Expandable/collapsible content sections|type="single|multiple", collapsible' ;;
    alert)          echo 'Alert|Status messages, banners, callouts|variant="default|destructive"' ;;
    alert-dialog)   echo 'AlertDialog|Confirmation dialogs requiring user action (delete, discard)|action, cancel, title, description' ;;
    aspect-ratio)   echo 'AspectRatio|Maintaining consistent width/height ratios for media|ratio={16/9}' ;;
    avatar)         echo 'Avatar|User profile images with fallback|src, alt, fallback' ;;
    badge)          echo 'Badge|Labels, tags, status indicators|variant="default|secondary|destructive|outline"' ;;
    breadcrumb)     echo 'Breadcrumb|Navigation hierarchy showing current location|separator, items' ;;
    button)         echo 'Button|All click actions — primary, secondary, destructive, ghost, link|variant, size, disabled, asChild' ;;
    calendar)       echo 'Calendar|Date selection grid (used inside DatePicker)|mode="single|range", selected, onSelect' ;;
    card)           echo 'Card|Content containers with header/body/footer|CardHeader, CardTitle, CardContent, CardFooter' ;;
    carousel)       echo 'Carousel|Scrollable content slideshow|orientation, opts' ;;
    chart)          echo 'Chart|Data visualization wrapper for Recharts|config, ChartTooltip, ChartLegend' ;;
    checkbox)       echo 'Checkbox|Boolean selection (standalone or in forms)|checked, onCheckedChange, disabled' ;;
    collapsible)    echo 'Collapsible|Show/hide content sections|open, onOpenChange' ;;
    command)        echo 'Command|Command palette, searchable list, combobox base|CommandInput, CommandList, CommandItem' ;;
    context-menu)   echo 'ContextMenu|Right-click menus|trigger, items, sub-menus' ;;
    dialog)         echo 'Dialog|Modal dialogs for forms, confirmations, content|open, onOpenChange, DialogTrigger, DialogContent' ;;
    drawer)         echo 'Drawer|Bottom sheet / mobile-friendly dialog|open, onOpenChange, direction' ;;
    dropdown-menu)  echo 'DropdownMenu|Action menus triggered by button click|trigger, items, sub-menus, checkboxItem' ;;
    form)           echo 'Form|React Hook Form wrapper with Zod validation|FormField, FormItem, FormLabel, FormMessage' ;;
    hover-card)     echo 'HoverCard|Rich content on hover (user profiles, previews)|trigger, content, openDelay' ;;
    input)          echo 'Input|Single-line text input|type, placeholder, disabled, className' ;;
    input-otp)      echo 'InputOTP|One-time password / verification code input|maxLength, pattern' ;;
    label)          echo 'Label|Accessible form field labels|htmlFor' ;;
    menubar)        echo 'Menubar|Horizontal menu bar (app-style navigation)|trigger, content, items' ;;
    navigation-menu) echo 'NavigationMenu|Site navigation with dropdowns|trigger, content, link' ;;
    pagination)     echo 'Pagination|Page navigation controls|PaginationPrevious, PaginationNext, PaginationItem' ;;
    popover)        echo 'Popover|Floating content triggered by click|trigger, content, side, align' ;;
    progress)       echo 'Progress|Determinate progress indicator|value, max' ;;
    radio-group)    echo 'RadioGroup|Single selection from multiple options|value, onValueChange, RadioGroupItem' ;;
    resizable)      echo 'Resizable|Resizable panel layouts|ResizablePanel, ResizablePanelGroup, ResizableHandle' ;;
    scroll-area)    echo 'ScrollArea|Custom scrollable area with styled scrollbar|className, orientation' ;;
    select)         echo 'Select|Dropdown selection (single value)|value, onValueChange, SelectTrigger, SelectContent, SelectItem' ;;
    separator)      echo 'Separator|Visual divider line|orientation="horizontal|vertical"' ;;
    sheet)          echo 'Sheet|Side panel overlay (settings, filters, mobile nav)|side="top|right|bottom|left", open, onOpenChange' ;;
    sidebar)        echo 'Sidebar|Application sidebar navigation|SidebarProvider, SidebarTrigger, SidebarContent' ;;
    skeleton)       echo 'Skeleton|Loading placeholder animation|className (set width/height)' ;;
    slider)         echo 'Slider|Range value selection|value, onValueChange, min, max, step' ;;
    sonner)         echo 'Sonner|Toast notifications (recommended over Toast)|toast(), toast.success(), toast.error()' ;;
    switch)         echo 'Switch|On/off toggle control|checked, onCheckedChange, disabled' ;;
    table)          echo 'Table|Data tables with header, body, rows|TableHeader, TableBody, TableRow, TableCell' ;;
    tabs)           echo 'Tabs|Tabbed content panels|value, onValueChange, TabsList, TabsTrigger, TabsContent' ;;
    textarea)       echo 'Textarea|Multi-line text input|placeholder, rows, disabled' ;;
    toast)          echo 'Toast|Toast notification system (alternative to Sonner)|toast({ title, description, variant })' ;;
    toggle)         echo 'Toggle|Pressable on/off button|pressed, onPressedChange, variant' ;;
    toggle-group)   echo 'ToggleGroup|Group of toggle buttons (single or multi select)|type="single|multiple", value, onValueChange' ;;
    tooltip)        echo 'Tooltip|Hover hint text|content, side, delayDuration' ;;
    *)              echo '' ;;
  esac
}

# ─── Convert kebab-case to PascalCase (macOS compatible) ────────

to_pascal_case() {
  echo "$1" | awk -F'-' '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1' OFS=''
}

# ─── Scan installed components ───────────────────────────────────

echo "=== sync-components — Scanning installed Shadcn components ==="
echo ""

new_count=0
existing_count=0
unknown_count=0

for file in "$UI_DIR"/*.tsx; do
  [ -f "$file" ] || continue

  filename="$(basename "$file" .tsx)"

  # Skip non-component files
  case "$filename" in
    index|utils) continue ;;
  esac

  # Check if already documented
  pascal_name=$(to_pascal_case "$filename")

  if grep -q "### $pascal_name" "$CATALOG" 2>/dev/null; then
    existing_count=$((existing_count + 1))
    continue
  fi

  # Look up metadata
  meta=$(get_component_meta "$filename")

  if [ -n "$meta" ]; then
    IFS='|' read -r display_name use_when key_props <<< "$meta"
  else
    display_name="$pascal_name"
    use_when="TODO: describe when to use this component"
    key_props="TODO: list key props"
    unknown_count=$((unknown_count + 1))
  fi

  # Generate entry
  entry="### $display_name
- **Import**: \`import { $display_name } from \"@/components/ui/$filename\"\`
- **Use when**: $use_when
- **Key props**: \`$key_props\`
"

  # Insert before the Component Decision Map section
  # Uses awk instead of sed to avoid macOS sed multiline escaping issues
  if grep -q "^## Component Decision Map" "$CATALOG"; then
    awk -v entry="$entry" '/^## Component Decision Map/ { print entry; print ""; } { print }' "$CATALOG" > "$CATALOG.tmp"
    mv "$CATALOG.tmp" "$CATALOG"
  else
    # Fallback: append to end
    printf "\n%s\n" "$entry" >> "$CATALOG"
  fi

  echo "  Added: $display_name ($filename.tsx)"
  new_count=$((new_count + 1))
done

# Remove the placeholder text if we added components
if [ "$new_count" -gt 0 ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' '/^\*No components installed yet/d' "$CATALOG"
  else
    sed -i '/^\*No components installed yet/d' "$CATALOG"
  fi
fi

echo ""
echo "=== Summary ==="
echo "  New entries added: $new_count"
echo "  Already documented: $existing_count"
if [ "$unknown_count" -gt 0 ]; then
  echo "  Unknown components (needs manual description): $unknown_count"
fi
echo ""

if [ "$new_count" -gt 0 ]; then
  echo "COMPONENTS.md has been updated."
  echo "Review the new entries and add examples if needed."
else
  echo "COMPONENTS.md is up to date — no changes needed."
fi
