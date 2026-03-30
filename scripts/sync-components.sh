#!/usr/bin/env bash
#
# sync-components — Auto-detect installed Shadcn components and update COMPONENTS.md
#
# Usage: npm run sync:components
#   or:  bash scripts/sync-components.sh
#
# Scans frontend/src/components/ui/ for .tsx files, compares against
# COMPONENTS.md, and adds missing entries with pre-filled metadata.

set -euo pipefail

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
# Maps filename → "DisplayName|Use when|Key props"
# This covers all standard Shadcn/ui components.

declare -A COMPONENT_META=(
  ["accordion"]="Accordion|Expandable/collapsible content sections|type=\"single\|multiple\", collapsible"
  ["alert"]="Alert|Status messages, banners, callouts|variant=\"default\|destructive\""
  ["alert-dialog"]="AlertDialog|Confirmation dialogs requiring user action (delete, discard)|action, cancel, title, description"
  ["aspect-ratio"]="AspectRatio|Maintaining consistent width/height ratios for media|ratio={16/9}"
  ["avatar"]="Avatar|User profile images with fallback|src, alt, fallback"
  ["badge"]="Badge|Labels, tags, status indicators|variant=\"default\|secondary\|destructive\|outline\""
  ["breadcrumb"]="Breadcrumb|Navigation hierarchy showing current location|separator, items"
  ["button"]="Button|All click actions — primary, secondary, destructive, ghost, link|variant, size, disabled, asChild"
  ["calendar"]="Calendar|Date selection grid (used inside DatePicker)|mode=\"single\|range\", selected, onSelect"
  ["card"]="Card|Content containers with header/body/footer|CardHeader, CardTitle, CardContent, CardFooter"
  ["carousel"]="Carousel|Scrollable content slideshow|orientation, opts"
  ["chart"]="Chart|Data visualization wrapper for Recharts|config, ChartTooltip, ChartLegend"
  ["checkbox"]="Checkbox|Boolean selection (standalone or in forms)|checked, onCheckedChange, disabled"
  ["collapsible"]="Collapsible|Show/hide content sections|open, onOpenChange"
  ["command"]="Command|Command palette, searchable list, combobox base|CommandInput, CommandList, CommandItem"
  ["context-menu"]="ContextMenu|Right-click menus|trigger, items, sub-menus"
  ["dialog"]="Dialog|Modal dialogs for forms, confirmations, content|open, onOpenChange, DialogTrigger, DialogContent"
  ["drawer"]="Drawer|Bottom sheet / mobile-friendly dialog|open, onOpenChange, direction"
  ["dropdown-menu"]="DropdownMenu|Action menus triggered by button click|trigger, items, sub-menus, checkboxItem"
  ["form"]="Form|React Hook Form wrapper with Zod validation|FormField, FormItem, FormLabel, FormMessage"
  ["hover-card"]="HoverCard|Rich content on hover (user profiles, previews)|trigger, content, openDelay"
  ["input"]="Input|Single-line text input|type, placeholder, disabled, className"
  ["input-otp"]="InputOTP|One-time password / verification code input|maxLength, pattern"
  ["label"]="Label|Accessible form field labels|htmlFor"
  ["menubar"]="Menubar|Horizontal menu bar (app-style navigation)|trigger, content, items"
  ["navigation-menu"]="NavigationMenu|Site navigation with dropdowns|trigger, content, link"
  ["pagination"]="Pagination|Page navigation controls|PaginationPrevious, PaginationNext, PaginationItem"
  ["popover"]="Popover|Floating content triggered by click|trigger, content, side, align"
  ["progress"]="Progress|Determinate progress indicator|value, max"
  ["radio-group"]="RadioGroup|Single selection from multiple options|value, onValueChange, RadioGroupItem"
  ["resizable"]="Resizable|Resizable panel layouts|ResizablePanel, ResizablePanelGroup, ResizableHandle"
  ["scroll-area"]="ScrollArea|Custom scrollable area with styled scrollbar|className, orientation"
  ["select"]="Select|Dropdown selection (single value)|value, onValueChange, SelectTrigger, SelectContent, SelectItem"
  ["separator"]="Separator|Visual divider line|orientation=\"horizontal\|vertical\""
  ["sheet"]="Sheet|Side panel overlay (settings, filters, mobile nav)|side=\"top\|right\|bottom\|left\", open, onOpenChange"
  ["sidebar"]="Sidebar|Application sidebar navigation|SidebarProvider, SidebarTrigger, SidebarContent"
  ["skeleton"]="Skeleton|Loading placeholder animation|className (set width/height)"
  ["slider"]="Slider|Range value selection|value, onValueChange, min, max, step"
  ["sonner"]="Sonner|Toast notifications (recommended over Toast)|toast(), toast.success(), toast.error()"
  ["switch"]="Switch|On/off toggle control|checked, onCheckedChange, disabled"
  ["table"]="Table|Data tables with header, body, rows|TableHeader, TableBody, TableRow, TableCell"
  ["tabs"]="Tabs|Tabbed content panels|value, onValueChange, TabsList, TabsTrigger, TabsContent"
  ["textarea"]="Textarea|Multi-line text input|placeholder, rows, disabled"
  ["toast"]="Toast|Toast notification system (alternative to Sonner)|toast({ title, description, variant })"
  ["toggle"]="Toggle|Pressable on/off button|pressed, onPressedChange, variant"
  ["toggle-group"]="ToggleGroup|Group of toggle buttons (single or multi select)|type=\"single\|multiple\", value, onValueChange"
  ["tooltip"]="Tooltip|Hover hint text|content, side, delayDuration"
)

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
  [[ "$filename" == "index" ]] && continue
  [[ "$filename" == "utils" ]] && continue

  # Check if already documented
  # Convert filename to PascalCase for search
  pascal_name=$(echo "$filename" | sed -r 's/(^|-)(\w)/\U\2/g')

  if grep -q "### $pascal_name" "$CATALOG" 2>/dev/null; then
    existing_count=$((existing_count + 1))
    continue
  fi

  # Look up metadata
  if [[ -v "COMPONENT_META[$filename]" ]]; then
    IFS='|' read -r display_name use_when key_props <<< "${COMPONENT_META[$filename]}"
  else
    display_name="$pascal_name"
    use_when="TODO: describe when to use this component"
    key_props="TODO: list key props"
    unknown_count=$((unknown_count + 1))
  fi

  # Generate entry
  entry="
### $display_name
- **Import**: \`import { $display_name } from \"@/components/ui/$filename\"\`
- **Use when**: $use_when
- **Key props**: \`$key_props\`
"

  # Insert before the Component Decision Map section
  # Find the line "## Component Decision Map" and insert before it
  if grep -q "^## Component Decision Map" "$CATALOG"; then
    sed -i "/^## Component Decision Map/i\\$entry" "$CATALOG"
  else
    # Fallback: append before end
    echo "$entry" >> "$CATALOG"
  fi

  echo "  Added: $display_name ($filename.tsx)"
  new_count=$((new_count + 1))
done

# Remove the placeholder text if we added components
if [ "$new_count" -gt 0 ]; then
  sed -i '/^\*No components installed yet/d' "$CATALOG"
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
