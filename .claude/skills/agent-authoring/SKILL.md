---
name: agent-authoring
description: >
  Use when creating, editing, or reviewing agent files in
  .claude/agents/. Covers agent structure, required reading,
  quality checklists, refactoring guidelines.
invocation: manual
---

# Agent Authoring Guide

> Use when creating, editing, or reviewing agent files in `.claude/agents/`.

## Agent File Structure

Every agent `.md` file MUST follow this structure:

```markdown
---
name: agent-[name]
description: >
  [What this agent does — role, stack, responsibilities]
required_skills:
  - skill-name-1
  - skill-name-2
---

# Agent: [name]

## Role
[One sentence — what this agent is responsible for]

## Required Reading (BEFORE any code)
[Numbered list of files to read before starting any work]

## Assigned Areas
[List of file paths this agent owns]

## Reuse-First Rule — READ BEFORE YOU WRITE
[Shared code that MUST be checked before creating new code]

## Quality Checklist — MUST check before commit
### Before writing code
### While writing code
### Before commit
### Runtime verification

## Anti-patterns — NEVER do
[Table or list of forbidden patterns with alternatives]

## Branch Strategy
[Standard Mode and Hero Mode behavior]

## Current State
[Live status: working on, branch, blocked by]

## Session Log
[Date-based log of work done]

## My TODOs
[Tasks from SPRINT.md]

## Notes
[Persistent notes between sessions]
```

## Agent Design Principles

### 1. Agents are Specialists, Not Generalists

Each agent owns ONE stack/domain:

| Agent | Domain | NEVER touches |
|-------|--------|--------------|
| agent-api | NestJS, Prisma, shared types | Frontend features |
| agent-frontend | React, Tailwind, Shadcn | API modules |
| agent-jobs | Rust, Tokio, Redis queue | TypeScript code |
| agent-product-design | UI mockups, specs | Production code |

If a task crosses domains → split into separate tasks for separate agents.

### 2. Required Reading = Skill Dependencies

The "Required Reading" section is the agent's skill dependency list.
Order matters — read in sequence:

```markdown
## Required Reading (BEFORE any code)
1. `.claude/rules/anti-hallucination.md`     ← Always first
2. `.claude/skills/[stack]/SKILL.md`          ← Stack-specific skill
3. `docs/[relevant-guide].md`                 ← Project docs
4. Design mockup (if user-oriented epic)      ← Conditional
5. GitNexus (if available)                    ← Optional tool
```

Rules:
- Anti-hallucination is ALWAYS #1 for all agents
- Stack skill is ALWAYS #2 (typescript, rust, frontend-ui, etc.)
- Project docs come after skills
- Conditional items clearly marked with "if" prefix

### 3. Quality Checklist = Acceptance Gate

The quality checklist is what the agent checks before calling a task "done".
Structure it in phases:

```
Before writing code    → What to read, what to check exists
While writing code     → Conventions to follow
Before commit          → Static checks (lint, typecheck, tests)
Runtime verification   → Dynamic checks (server starts, no crash)
```

Every phase should be checkboxes `- [ ]` so the agent can tick them off.

### 4. Anti-patterns = Guardrails

The anti-patterns section prevents the most common AI mistakes for this stack.
Format as a table:

```markdown
| Anti-pattern | Why it's bad | Do this instead |
|-------------|-------------|-----------------|
| `any` type | Defeats type system | Use `unknown` + Zod |
| `.unwrap()` | Panics in production | Use `?` + `AppError` |
```

Keep to 5-10 items. More than that → extract to skill gotchas.md.

### 5. Current State = Status Board

This section is LIVE — agents update it as they work:

```markdown
## Current State
- **Working on**: TASK-021 — User registration API
- **Branch**: feat/TASK-021-user-registration
- **Mode**: Standard
- **Last completed**: TASK-020 — Database schema
- **Blocked by**: No
```

In team mode, other devs read this to know what's in flight.

## Refactoring Agents — When to Extract to Skills

**Red flags** that an agent file needs refactoring:

| Signal | Threshold | Action |
|--------|-----------|--------|
| File > 150 lines | Total lines | Extract methodology to skill |
| Code examples > 30 lines | Per example | Move to skill references/ |
| Same content in 2+ agents | Duplicate lines | Extract shared skill |
| Stack-specific > 50 lines | Language/framework rules | Dedicated stack skill |
| Methodology > 40 lines | Process/workflow | Dedicated workflow skill |

**After refactoring**, the agent file should be ~80-120 lines:
- Role + Required Reading: ~10 lines
- Assigned Areas + Reuse-First: ~20 lines
- Quality Checklist: ~30 lines (high-level, details in skills)
- Anti-patterns: ~10 lines
- Branch Strategy + State + Log: ~30 lines

## Agent Communication Patterns

### Solo Mode
Agent talks to user directly. Status updates via "Current State" section.

### Team Mode
Agents communicate via their `.md` files as async status boards:

```
agent-api.md    → "Working on: TASK-021, Blocked by: No"
agent-frontend  → reads agent-api status → knows when types are ready
```

Rules:
- Update "Working on" BEFORE starting a task
- Update "Blocked by" when waiting on another agent/dev
- Update "Last completed" AFTER task is done
- NEVER modify another agent's file

## Checklist for New Agents

- [ ] File created: `.claude/agents/agent-[name].md`
- [ ] Has frontmatter (name, description, required_skills)
- [ ] Role is one sentence
- [ ] Required Reading lists anti-hallucination first, then stack skills
- [ ] Assigned Areas clearly defined (no overlap with other agents)
- [ ] Quality Checklist has 4 phases (before/while/commit/runtime)
- [ ] Anti-patterns table with 5-10 items
- [ ] Branch Strategy covers both Standard and Hero Mode
- [ ] Current State section with placeholders
- [ ] Referenced in CLAUDE.md ownership boundaries table
- [ ] Added to plan-sprint agent assignment guide
