# GitNexus Workflow (Conditional)

## Anti-Hallucination
See `.claude/rules/anti-hallucination.md` - ALL outputs require evidence.

---

## GitNexus Availability Check

At the start of each session, check if GitNexus is initialized:

```bash
npx gitnexus status 2>/dev/null
```

- **If index exists** → use GitNexus commands for code search and impact analysis
- **If error or "No index found"** → use grep, Grep tool, find normally (skip all GitNexus rules below)

> GitNexus is optional. It provides smarter code navigation and blast radius analysis,
> but the project works fine without it. See `.claude/skills/gitnexus/SKILL.md` for setup.

---

## When GitNexus IS Available

### ⛔ MANDATORY: Use GitNexus — DO NOT use grep/Grep tool

When the index is available, you MUST use GitNexus for ALL code search.
GitNexus understands relationships between symbols, not just text matches.

**This is NOT optional. Using grep/Grep tool when GitNexus index exists is a VIOLATION.**

```bash
# ✅ CORRECT — always use these
npx gitnexus query "functionName"
npx gitnexus context functionName

# ❌ WRONG — DO NOT use when GitNexus is available
grep "functionName"      # VIOLATION
Grep tool                # VIOLATION
```

**Only allowed fallback:** If `npx gitnexus query` returns zero results AND you believe
the term exists, THEN you may use grep as a last resort. State why GitNexus missed it.

> **Reason for CLI over MCP:** MCP server is unstable. CLI via npx runs directly, more reliable.

### Commands Reference

```bash
# Find execution flows
npx gitnexus query "search term" [--limit N] [--content]

# 360 view of symbol
npx gitnexus context symbolName [--content] [--file path/to/file.rs]

# Blast radius analysis
npx gitnexus impact targetSymbol [--direction upstream|downstream] [--depth N]

# Raw Cypher query
npx gitnexus cypher "MATCH (f:Function) RETURN f.name LIMIT 10"

# Management
npx gitnexus analyze    # Build/refresh index
npx gitnexus status     # Check freshness
npx gitnexus clean      # Delete index
```

### Before Modifying Any Symbol

```bash
# Run impact analysis
npx gitnexus impact symbolName --direction upstream

# Output will show:
# - Risk level: LOW/MEDIUM/HIGH/CRITICAL
# - d=1: WILL BREAK (direct callers)
# - d=2: LIKELY AFFECTED
# - d=3: MAY NEED TESTING
```

**Rules:**
- Report blast radius to user
- STOP if risk = HIGH or CRITICAL
- Only proceed when user confirms

### Before Commit

```bash
# Check git changes
git diff --stat

# Run impact for each modified file/symbol
npx gitnexus impact changedSymbol --direction upstream
```

### Tool Replacement Table (MANDATORY when GitNexus is available)

| ❌ DO NOT use | ✅ MUST use instead |
|------------|----------------------|
| `grep "functionName"` | `npx gitnexus query "functionName"` |
| `Grep tool` | `npx gitnexus query` or `npx gitnexus context` |
| `find . -name "*.rs"` | `npx gitnexus query "*.rs"` |
| Find callers | `npx gitnexus context symbolName` |
| Find dependencies | `npx gitnexus impact symbol --direction downstream` |
| Find dependents | `npx gitnexus impact symbol --direction upstream` |

### Index Management

```bash
# When index is stale (after commit)
npx gitnexus analyze

# Check status
npx gitnexus status

# Force re-index
npx gitnexus analyze --force
```

---

## When GitNexus is NOT Available

Use standard tools normally:
- `grep`, `Grep tool`, `find` — all allowed
- No blast radius analysis — rely on manual code review and tests
- Consider initializing GitNexus when codebase grows beyond ~50 files:
  ```bash
  npx gitnexus analyze
  ```

## If Violation Occurs

1. User has the right to request revert changes
2. Claude must run the correct procedure from the beginning
