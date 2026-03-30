#!/usr/bin/env bash
#
# scaffold:clean — Remove all Dummies reference code from the boilerplate.
#
# Usage: npm run scaffold:clean
#   or:  bash scripts/scaffold-clean.sh
#
# This script removes:
# 1. Dummies shared types
# 2. Dummies API module (service, controller, DTOs, tests)
# 3. Dummies frontend feature (types, queries, components, tests)
# 4. Dummies query keys from query-keys.ts
# 5. Dummies references from ARCHITECTURE.md
# 6. Dummies reference table from CLAUDE.md
#
# After running, the boilerplate is clean and ready for your real features.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== scaffold:clean — Removing Dummies reference code ==="
echo ""

# ─── 1. Remove Dummies source files ─────────────────────────────

remove_if_exists() {
  if [ -e "$1" ]; then
    rm -rf "$1"
    echo "  Removed: $1"
  fi
}

echo "Removing shared types..."
remove_if_exists "$PROJECT_ROOT/shared/types/dummy.ts"

echo "Removing API module..."
remove_if_exists "$PROJECT_ROOT/api/src/modules/dummies"

echo "Removing frontend feature..."
remove_if_exists "$PROJECT_ROOT/frontend/src/features/dummies"

# ─── 2. Clean up query-keys.ts ──────────────────────────────────

QUERY_KEYS="$PROJECT_ROOT/frontend/src/lib/query-keys.ts"
if [ -f "$QUERY_KEYS" ]; then
  echo "Cleaning query-keys.ts..."
  # Remove the dummies block (from comment to closing brace + comma)
  sed -i '/─── Reference feature (Dummies)/,/^  },$/d' "$QUERY_KEYS"
  echo "  Cleaned: $QUERY_KEYS"
fi

# ─── 3. Clean up ARCHITECTURE.md ────────────────────────────────

ARCH_FILE="$PROJECT_ROOT/ARCHITECTURE.md"
if [ -f "$ARCH_FILE" ]; then
  echo "Cleaning ARCHITECTURE.md..."
  sed -i '/dummies.*REFERENCE.*scaffold:clean/d' "$ARCH_FILE"
  echo "  Cleaned: $ARCH_FILE"
fi

# ─── 4. Clean up CLAUDE.md ──────────────────────────────────────

CLAUDE_FILE="$PROJECT_ROOT/CLAUDE.md"
if [ -f "$CLAUDE_FILE" ]; then
  echo "Cleaning CLAUDE.md..."
  # Remove the Reference Feature section
  sed -i '/^## Reference Feature (Dummies)$/,/^## Multi-Agent Rules$/{ /^## Multi-Agent Rules$/!d; }' "$CLAUDE_FILE"
  echo "  Cleaned: $CLAUDE_FILE"
fi

# ─── Done ────────────────────────────────────────────────────────

echo ""
echo "=== Done! Dummies reference code has been removed. ==="
echo ""
echo "Next steps:"
echo "  1. Create your first real feature module"
echo "  2. Add query keys to frontend/src/lib/query-keys.ts"
echo "  3. Add database tables to ARCHITECTURE.md"
echo "  4. Update CLAUDE.md with your feature's reference table"
echo ""
echo "Tip: Follow the same patterns that Dummies used."
echo "     Check git history if you need to reference the removed code."
