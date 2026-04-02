# GitNexus — Codebase Intelligence (Optional)

> **Optional skill.** Enable by running `npx gitnexus analyze` in project root.
> If not initialized, agents fall back to normal grep/find.

## What is GitNexus?

GitNexus builds a knowledge graph of your codebase — functions, classes, modules,
and their relationships. Instead of grepping blind, you can ask "what calls this
function?", "what breaks if I change this?", "show me the auth flow".

## When to Use

- Codebase has grown beyond ~50 files and grep is getting noisy
- You need to understand blast radius before refactoring
- You're onboarding to unfamiliar code
- You need to trace execution flows across modules

## Setup

```bash
# First time — build the index
npx gitnexus analyze

# Check if index exists and is fresh
npx gitnexus status

# Force re-index after major changes
npx gitnexus analyze --force
```

This creates a `.gitnexus/` directory (add to `.gitignore`).

## Commands Reference

```bash
# Find execution flows related to a concept
npx gitnexus query "search term" [--limit N] [--content]

# 360° view of a symbol (callers, callees, processes)
npx gitnexus context symbolName [--content] [--file path/to/file]

# Blast radius — what breaks if you change this?
npx gitnexus impact targetSymbol [--direction upstream|downstream] [--depth N]

# Raw graph query
npx gitnexus cypher "MATCH (f:Function) RETURN f.name LIMIT 10"

# Delete index
npx gitnexus clean
```

## Mandatory Workflow: Before Modifying Any Symbol

```
1. npx gitnexus impact symbolName --direction upstream
   → Shows risk level: LOW / MEDIUM / HIGH / CRITICAL
   → d=1: WILL BREAK (direct callers)
   → d=2: LIKELY AFFECTED
   → d=3: MAY NEED TESTING

2. If risk = HIGH or CRITICAL → STOP, report to user, get confirmation
3. If risk = LOW or MEDIUM → proceed with changes
4. After changes → re-run impact to verify nothing unexpected broke
```

## Agent Integration

When GitNexus is available, agents SHOULD use it instead of grep for:

| Instead of... | Use... |
|--------------|--------|
| `grep "functionName"` | `npx gitnexus query "functionName"` |
| Finding callers manually | `npx gitnexus context symbolName` |
| Guessing blast radius | `npx gitnexus impact symbol --direction upstream` |
| Tracing a flow by reading code | `npx gitnexus query "auth flow"` |

## Checking If Available

Agents should check at session start:
```bash
npx gitnexus status 2>/dev/null
```

- If output shows index info → use GitNexus commands
- If error or "No index found" → fall back to grep/find (normal behavior)

## Index Freshness

Re-index after:
- Merging a PR with significant code changes
- Adding new modules or features
- Refactoring that moves/renames files

```bash
npx gitnexus analyze  # Incremental update
```
