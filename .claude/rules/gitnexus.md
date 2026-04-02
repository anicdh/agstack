# GitNexus Workflow (MANDATORY)

## ⛔ Anti-Hallucination
See `.claude/rules/anti-hallucination.md` - ALL outputs require evidence.

---

## ALWAYS use GitNexus CLI (npx)

**NEVER** use grep, Grep tool, or find to search for code.

> **Reason for switching from MCP to npx:** MCP server is unstable. CLI runs directly, more reliable.

## Commands Reference

```bash
# Find execution flows
npx gitnexus query "search term" [--limit N] [--content]

# 360° view of symbol
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

## Mandatory procedure when modifying code:

### 1. SEARCH FOR CODE

```bash
# ❌ DO NOT use
grep "functionName"
Grep tool
find . -name "*.rs"

# ✅ USE
npx gitnexus query "functionName"
npx gitnexus context functionName
```

### 2. BEFORE MODIFYING ANY SYMBOL

```bash
# MANDATORY run impact analysis
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

### 3. IMPLEMENT CODE CHANGES

Only after running impact analysis and user confirms.

### 4. BEFORE COMMIT

```bash
# Check git changes
git diff --stat

# Run impact for each modified file/symbol
npx gitnexus impact changedSymbol --direction upstream
```

> **Note:** `detect_changes` only exists in MCP. Workaround: use `git diff` + `impact` manually.

## Tool replacement table

| Instead of... | Use npx gitnexus... |
|------------|----------------------|
| `grep "functionName"` | `npx gitnexus query "functionName"` |
| `Grep tool` | `npx gitnexus query` or `npx gitnexus context` |
| `find . -name "*.rs"` | `npx gitnexus query "*.rs"` |
| Find callers | `npx gitnexus context symbolName` |
| Find dependencies | `npx gitnexus impact symbol --direction downstream` |
| Find dependents | `npx gitnexus impact symbol --direction upstream` |

## Index Management

```bash
# When index is stale (after commit)
npx gitnexus analyze

# Check status
npx gitnexus status

# Force re-index
npx gitnexus analyze --force
```

## If violation occurs

1. User has the right to request revert changes
2. Claude must run the correct procedure from the beginning
