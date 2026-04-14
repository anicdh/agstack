---
name: plan-sprint
description: >
  Use when starting a new sprint or planning the next sprint after
  the current one completes. Converts eng review output into epics,
  tasks, and sprint backlog. Run after /plan-eng-review.
invocation: manual
---

# /plan-sprint — Sprint Planning from Eng Review Output

> Converts the output of `/plan-eng-review` into actionable Epics, Tasks, and a Sprint backlog.
> This is the bridge between "we know what to build" and "we're building it."

## When to use

**First sprint:** Run `/plan-sprint` immediately after `/plan-eng-review` is complete.
**Subsequent sprints:** Run `/plan-sprint` when the current sprint is done.

This skill handles both cases automatically — it detects whether this is the first sprint or a continuation.

**Prerequisite for first sprint:**
- `docs/PRD.md` (from `/office-hours`)
- Engineering review output (from `/plan-eng-review`)

**Prerequisite for subsequent sprints:**
- Sprint Review done (user feedback collected on this week's release)
- Previous sprint tasks marked ✅ or identified as carry-over
- `/retro` run IF previous sprint had issues (see Conditional Retro below)

If prerequisites are missing, tell the user what to run first.

## Instructions

You are converting a reviewed product and engineering plan into a structured sprint backlog.
The agile framework uses **Epic → Task (no User Story)** — see ADR-005.

### Step 1: Read Inputs & Detect Sprint Mode

Read these files:

1. `docs/PRD.md` — features, user problems, goals
2. `CLAUDE.md` — coding conventions, reuse map, tech stack
3. `agile/BACKLOG.md` — current epics and task statuses
4. `agile/DEFINITION-OF-DONE.md` — what "done" means
5. `agile/VELOCITY.md` — past velocity data
6. `agile/sprints/current.md` — which sprint is active
7. If `Team Mode = team` in CLAUDE.md → also read `.claude/agents/TEAM-RULES.md`

**Detect mode:**
- If BACKLOG.md has only templates (no real epics) → **First Sprint Mode** (read eng review output)
- If BACKLOG.md has real epics with tasks → **Next Sprint Mode** (read previous sprint RETRO.md + carry-over tasks)

**Team Mode — ask for sprint participants:**

If `Team Mode = team` in CLAUDE.md, ask:
> "Who is participating in this sprint? (comma-separated names, e.g., `an, minh`)"

Use these names as dev identifiers throughout the sprint (SPRINT.md, BACKLOG.md, CLAIMS.md, spawn prompts).
Calculate sprint capacity: `[N devs] × 25-30 pts = [total] pts`.

Solo mode: skip this — capacity stays 25-30 pts, no dev column needed.

### Step 2: Create Epics in BACKLOG.md

> **Next Sprint Mode**: Skip this step if epics already exist. Instead, review existing epics —
> add new ones only if `/office-hours` has been run again with new features.
> Update task statuses: mark completed tasks ✅, identify carry-over tasks.

**First Sprint Mode:** For each major feature or capability identified in the PRD + eng review:

1. Create an Epic with a clear **Why** (from PRD user problems/goals)
2. Set **Scope** and **Out of scope** boundaries
3. Reference the source (`/office-hours session [date]`)

**Epic rules:**
- Epic = a user-facing capability or product goal, NOT a technical task
- Epic names should be understandable by a non-technical person
- Typical MVP has 3-6 epics — if you have more than 8, you're scoping too much
- Number epics sequentially: EPIC-01, EPIC-02, ...

### Step 3: Break Epics into Tasks

For each Epic, create Tasks that are independently deliverable:

**Task structure** (follow the format in BACKLOG.md template):
```
### TASK-XXX: [Task Name] [X pts] ⬜
- **Agent:** [agent-frontend | agent-api | agent-jobs]
- **Branch:** feat/[branch-name]
- **Accept when (AI implementation):**
  - [ ] [Specific, testable criterion]
  - [ ] [Another criterion]
  - [ ] Passes lint, typecheck, runtime verification
- **Accept when (Human refinement):**
  - [ ] UX reviewed — no visual bugs, spacing, or interaction issues
  - [ ] Edge cases handled — empty, error, loading states work correctly
  - [ ] Tested in browser — actual user flow works end-to-end
- **Tech:** [Technical approach — which files, patterns, shared code to use]
- **Depends on:** [TASK-XXX if any, or "none"]
```

**Task lifecycle:**
```
⬜ Todo → 🔵 In Progress → 🟢 Implemented → 🔧 Refining → ✅ Done
              (AI working)    (AI done,        (Human        (Both
                               lint/type/      compares vs    signed off)
                               runtime pass)   design mock)
```

- AI marks task `🟢 Implemented` when code passes all automated checks
- Human compares implementation against design mockup (for user-oriented epics)
- Human fixes remaining issues → marks `🔧 Refining`
- Human confirms everything matches design + works end-to-end → marks `✅ Done`
- Only `✅ Done` tasks count toward sprint velocity

**Design-first workflow (user-oriented epics):**
```
product-design agent creates mockup → design approved → tasks enter sprint →
AI implements following mockup → human compares vs mockup → ✅
```

**Task rules:**
- Each task is assigned to ONE primary agent (even if it touches multiple layers)
- Tasks that cross layers (e.g., "Register form + API") should be split into separate FE and API tasks
- Story points use Fibonacci: 1, 2, 3, 5, 8
  - 1-2: a few hours | 3: half day to 1 day | 5: 2-3 days | 8: 3-5 days (warning sign)
- Tasks at 8 pts are allowed but are a warning — ask "can this be split into two smaller tasks?"
- Sprint = 1 week. Target 25-30 pts total per sprint.
- "Accept when" criteria must be specific and testable, not vague
- "Tech" section should reference shared code from the Reuse Map in CLAUDE.md
- Number tasks sequentially across all epics: TASK-001, TASK-002, ...

**Agent assignment guide:**
| Work type | Agent |
|-----------|-------|
| React components, pages, hooks, UI | agent-frontend |
| NestJS modules, API endpoints, Prisma | agent-api |
| Rust jobs, queue processing | agent-jobs |
| Shared types, Zod schemas | agent-api (primary), mirrored by agent-jobs |

**Multi-dev task assignment (Team Mode only):**

When `Team Mode = team` and there are multiple devs, assign tasks to devs during this step:

1. **Group by dependency** — if TASK-B depends on TASK-A, same dev gets both
2. **Group by domain** — tasks touching the same Prisma model or feature module → same dev
3. **Balance points** — roughly equal pts per dev (±3 pts variance OK)
4. **Shared types** — if multiple devs need new shared types, assign ALL shared type tasks to one dev (they merge first, others rebase)

Add `Dev` column to each task in BACKLOG.md:
```
### TASK-XXX: [Task Name] [X pts] ⬜
- **Dev:** [dev-name]
- **Agent:** [agent-frontend | agent-api | agent-jobs]
...
```

Present assignment summary to ALL devs for agreement before starting.

### Step 4: Plan the Sprint

After all Epics and Tasks are in BACKLOG.md:

1. **Define a Sprint Goal** — one sentence describing the user-facing outcome this sprint delivers.
   - Good: "Users can sign up and log in with email/password"
   - Bad: "Build auth module" (too technical, not user-facing)
   - The Sprint Goal is the commitment — use it to decide if a task belongs in this sprint or not
2. **Determine sprint number** — check `agile/sprints/` for existing sprints
3. **Create sprint directory**: `agile/sprints/sprint-XX/`
4. **Select tasks for the sprint** based on:
   - Dependencies (tasks with no dependencies first)
   - Priority (from PRD — which features are most critical for MVP)
   - Capacity (25-30 pts per dev per sprint — team mode: multiply by number of participants)
   - If past velocity exists in VELOCITY.md, use it as guide
   - Every selected task must contribute to the Sprint Goal
5. **Populate SPRINT.md** using the template from `agile/templates/sprint.md`
   - Each task should include `blocked_by:` (task IDs this task depends on, use — for no dependencies) and `touches:` (directories/files this task will modify, helps detect conflicts in parallel waves)
6. **Mark selected tasks** as 🔵 in BACKLOG.md
7. **Update `agile/sprints/current.md`** to point to the new sprint
8. **Update `agile/VELOCITY.md`** — fill in previous sprint's actual velocity (Next Sprint Mode only)

**Sprint 1 special rules:**
- If this is Sprint 1, include foundational tasks (database schema, app shell) before feature tasks
- Sprint 1 velocity is unpredictable — commit conservatively (25-30 pts per dev for a 1-week sprint)
- Always include at least one end-to-end task (FE → API → DB) to validate the full stack early

**Conditional Retro — check before planning next sprint:**
Before proceeding, check the previous sprint for these signals:
- Carry-over > 0 tasks (sprint didn't complete all committed work)
- Any task was rejected at `/review` or `/qa`
- Actual velocity dropped compared to previous sprint
- User reported issues or friction during the sprint

If ANY signal is present → tell the user: "Previous sprint had [signal]. Recommend running `/retro` first."
If NO signals → skip retro, proceed directly to planning.
If RETRO.md exists from a previous run → read and apply its lessons regardless.

**Next Sprint rules:**
- If RETRO.md exists, read it for lessons learned — apply them to planning
- Use actual velocity from VELOCITY.md to set realistic commitment (not wishful thinking)
- Carry-over tasks keep their original IDs and points — do NOT renumber
- If a carry-over task was partially done, note what remains in the Tech section
- New tasks from new epics or scope changes get new sequential IDs
- Ask user: "Any scope changes or new priorities since last sprint?"

### Step 5: Verify design prerequisites

For each user-oriented epic with tasks in this sprint:

1. Check `agile/BACKLOG.md` — is the epic's Design status ✅ Approved?
   - If ✅ → proceed, reference the design in task Tech section:
     ```
     - **Design:** docs/ui-specs/[epic-name].md + mockup at frontend/src/mockups/[epic-name]/
     ```
   - If NOT ✅ → **STOP**. Tell the user:
     > "EPIC-XX is user-oriented but design is not approved yet. Run product-design agent first."

2. For technical epics → no design needed, proceed directly

3. Reference the UI spec's acceptance criteria in each task's "Accept when (AI implementation)" section — copy the specific criteria from `docs/ui-specs/[epic-name].md`

**Why this matters:**
- Agent-frontend has interactive mockups + concrete specs to follow → fewer UX mistakes
- Human refinement at sprint end compares implementation against design → objective review
- Future sprints reuse and extend the same spec → consistency across iterations

### Step 5.5: Wave Calculation (Standard Mode only)

After task breakdown, if any tasks have `blocked_by:` values (not just —):

1. **Check for circular dependencies:** if any task chain forms a cycle (A → B → A), STOP and warn:
   "Circular dependency detected: TASK-X → TASK-Y → TASK-X. Fix blocked_by: fields before proceeding."
2. **Topologically sort tasks into execution waves:**
   - Wave 0: tasks with no dependencies (blocked_by = —)
   - Wave 1: tasks whose dependencies are all in Wave 0
   - Wave 2: tasks whose dependencies are all in Wave 0 or Wave 1 (v1: max 2 waves recommended)
3. **Check for conflicts within each wave:**
   - Compare `touches:` fields of all tasks in the same wave
   - If paths overlap, warn user: "TASK-X and TASK-Y both touch [path]. Consider serializing them or accept merge-time conflict risk."
   - If `touches:` is omitted, fall back to agent-level ownership boundaries from CLAUDE.md (coarser, may over-warn)
4. **Display the wave plan:**
   ```
   Wave 0 (sequential): TASK-001
   Wave 1 (parallel via worktrees): TASK-002, TASK-003, TASK-004
   ```

If no tasks have `blocked_by:` values, skip wave calculation — all tasks run sequentially as before (backward compatible).

### Step 6: Present and Confirm

Present the sprint plan to the user in a clear summary:

```
Sprint [XX] Plan:
- Sprint Goal: [1 sentence — user-facing outcome, not technical]
- [N] epics → [N] tasks → [N] pts committed
- Key deliverables: [list 2-3 outcomes that serve the Sprint Goal]

Top priority tasks:
1. TASK-XXX: [name] ([N] pts) — [dev] / [agent]
2. TASK-XXX: [name] ([N] pts) — [dev] / [agent]
3. ...
```

**Team Mode — also include per-dev breakdown:**
```
Dev assignments:
  [dev-1]: TASK-XXX, TASK-XXX, TASK-XXX ([N] pts)
           Agents: agent-api → agent-frontend (sequential)
           Merge order: TASK-XXX (shared types) → TASK-XXX → TASK-XXX
  [dev-2]: TASK-XXX, TASK-XXX ([N] pts)
           Agents: agent-api → agent-frontend (sequential)
           Merge order: TASK-XXX → TASK-XXX (after dev-1 merges shared types)
```

Ask the user:
> "Does this sprint plan look right? Want to adjust scope, priorities, or point estimates before we start?"

**Next Sprint Mode** — also include:
```
Velocity: last sprint [X] pts done out of [Y] committed
Carry-over: [N] tasks ([M] pts)
New tasks: [N] tasks ([M] pts)
```

After user confirms, ask them to choose a development mode:

> "How do you want to work this sprint?"
> - **Standard Mode** (recommended) — 1 task = 1 branch, sequential, review each PR. Methodical and clean.
> - **Hero Mode** — 1 sprint branch, multiple agents working simultaneously. Fast and furious.

### Step 6a: Standard Mode (Recommended)

One branch per task, sequential, review each PR. All PRs target the sprint branch — main stays clean.

**Branch strategy:**
```
Solo:  main ← feat/TASK-XXX (PRs go directly to main)
Team:  main ← sprint/sprint-XX ← feat/TASK-XXX (PRs go to sprint branch, sprint merges to main after QA)
```

**Solo workflow — without waves (no `blocked_by:` declared):**
1. Run agent-api tasks first (shared types + API endpoints)
2. Each task gets its own branch: `git checkout -b feat/TASK-001-[name]`
3. After each task: `/review` → PR to main → merge
4. Then run agent-frontend tasks — API is already merged
5. Run agent-jobs tasks if any
6. Sprint end: `/qa` + `/design-review` on main

**Solo workflow — with waves (`blocked_by:` declared):**
1. Run Wave 0 tasks sequentially (same as without-waves flow above)
2. **CRITICAL: Wait for Wave 0 PRs to be merged into the target branch BEFORE spawning Wave 1.**
   Worktrees are created from the current HEAD — if Wave 0 code is not merged yet, Wave 1 agents will not see it and may recreate files that already exist, causing merge conflicts.
3. After Wave 0 is merged, spawn Wave 1 tasks in parallel using worktrees:
   - Each task gets its own worktree via Agent tool with `isolation: "worktree"`
   - All wave-1 agents run simultaneously, each on its own branch
   - Each agent creates a PR when done
4. User reviews and merges Wave 1 PRs
5. If Wave 2 exists, repeat (merge Wave 1 first, then spawn Wave 2)
6. Sprint end: `/qa` + `/design-review` on main

**Team workflow — without waves:**
1. Create sprint branch: `git checkout -b sprint/sprint-XX` from main
2. Each dev runs agent-api tasks first → feature branch → PR to sprint branch → merge
3. After each PR merge: notify team, other devs rebase from sprint branch
4. Then each dev runs agent-frontend tasks → feature branch → PR to sprint branch
5. Sprint end: `/qa` + `/design-review` on sprint branch
6. QA passes → manual PR from `sprint/sprint-XX` → `main` (all devs approve)

**Team workflow — with waves:**
1. Create sprint branch: `git checkout -b sprint/sprint-XX` from main
2. Run Wave 0 tasks sequentially (same as without-waves team flow)
3. **CRITICAL: Wait for Wave 0 PRs to be merged into sprint branch BEFORE spawning Wave 1.**
   Worktrees are created from the current HEAD — if Wave 0 code is not merged yet, Wave 1 agents will not see it.
4. After Wave 0 is merged, spawn Wave 1 tasks in parallel using worktrees:
   - Each task gets its own worktree via Agent tool with `isolation: "worktree"`
   - All wave-1 agents run simultaneously, each on its own branch
   - Each agent creates a PR to sprint/sprint-XX
5. User reviews and merges Wave 1 PRs to sprint branch
6. Sprint end: `/qa` + `/design-review` on sprint branch
7. QA passes → manual PR from `sprint/sprint-XX` → `main`

> **⛔ NEVER use `git stash` to switch between tasks or branches.** Each task runs in its own worktree or branch. If a task is incomplete, commit WIP on the current branch and push it. Stash-then-checkout = lost work.
> `git stash && <command> && git stash pop` in a single command chain is OK (e.g., stash to run tests). The rule bans stash-and-forget, not stash-and-pop-immediately.

**Spawn prompt (sequential, solo):**
```
You are agent-api. Read CLAUDE.md, then .claude/agents/agent-api.md,
then agile/sprints/current.md. Your tasks this sprint: TASK-001, TASK-002.
For each task: create branch feat/TASK-XXX-[name], complete the task,
commit, then report back for review before starting the next task.
NEVER use git stash to switch tasks. If incomplete, commit WIP and push.
Follow the quality checklist in your agent file.
BEFORE marking any task done: read its "Accept when" criteria, verify EACH
criterion (run tests, lint, runtime check), and report results explicitly.
Do not add features, abstractions, or code not required by the task.
```

**Spawn prompt (sequential, team):**
```
You are agent-api working for [dev-name]. Read CLAUDE.md, then
.claude/agents/agent-api.md, then .claude/agents/TEAM-RULES.md,
then agile/sprints/current.md.
Sprint branch: sprint/sprint-XX. Your tasks: TASK-XXX, TASK-XXX.
Before editing shared files, check .claude/agents/CLAIMS.md.
Before starting a task, git pull --rebase origin sprint/sprint-XX.
For each task: create branch feat/TASK-XXX-[name] from sprint branch,
complete the task, commit, then report back for review.
PRs target sprint/sprint-XX (NOT main).
NEVER use git stash to switch tasks. If incomplete, commit WIP and push.
Follow the quality checklist in your agent file.
BEFORE marking any task done: read its "Accept when" criteria, verify EACH
criterion (run tests, lint, runtime check), and report results explicitly.
Do not add features, abstractions, or code not required by the task.
```

**Spawn prompt (wave 1+ parallel, solo):**
```
You are [agent-type]. Read CLAUDE.md, then .claude/agents/[agent-name].md,
then agile/sprints/current.md. Your task: TASK-XXX.
You are running in a worktree — your working directory is isolated.
Complete the task, commit, create a PR to main, then report back.
NEVER use git stash to switch tasks. If you can't finish, commit WIP and push.
Follow the quality checklist in your agent file.
BEFORE marking done: verify EACH "Accept when" criterion with actual commands.
Do not add features, abstractions, or code not required by the task.
```

**Spawn prompt (wave 1+ parallel, team):**
```
You are [agent-type] working for [dev-name]. Read CLAUDE.md, then
.claude/agents/[agent-name].md, then .claude/agents/TEAM-RULES.md,
then agile/sprints/current.md. Your task: TASK-XXX.
Sprint branch: sprint/sprint-XX. You are running in a worktree — isolated.
Complete the task, commit, create a PR to sprint/sprint-XX, then report back.
NEVER use git stash to switch tasks. If you can't finish, commit WIP and push.
Follow the quality checklist in your agent file.
BEFORE marking done: verify EACH "Accept when" criterion with actual commands.
Do not add features, abstractions, or code not required by the task.
```

**If a wave-1 agent fails:**
- The worktree branch persists with its commits. No work is lost.
- Other wave-1 agents are unaffected (each has its own isolated worktree).
- User can resume by spawning a new agent targeting the same branch, or abandon it.
- Successful agents in the same wave merge their PRs independently.

**Worktree cleanup at sprint end:**
Run `git worktree list` to audit. Remove orphans with `git worktree remove <path>`.

**Why this is the default:**
- Each PR is small and easy to review
- Frontend always has real, merged API to consume — no mocks needed
- Team mode: main never receives unverified code — QA runs on sprint branch first
- If something breaks, you know exactly which task caused it
- Waves enable parallelism for independent tasks without merge chaos

### Step 6b: Hero Mode

One sprint branch, multiple agents grinding simultaneously. Spawn agents, let them cook, review at the end.

**Branch:** `sprint/sprint-XX` (single branch, all agents)

**When Hero Mode makes sense:**
- You want maximum speed and are comfortable reviewing a bigger diff at the end
- Most tasks are independent or you trust the ownership boundaries
- Sprint has enough tasks to justify parallel work

**When Hero Mode is a bad idea:**
- Sprint is small (< 5 tasks) — overhead isn't worth it
- Most frontend tasks directly depend on API endpoints in the same sprint

**Workflow:**
1. Create branch: `git checkout -b sprint/sprint-XX`
2. Spawn agent-api FIRST — it owns shared types and database schema
3. Spawn agent-frontend SECOND — it picks up independent tasks or tasks where API is already done
4. Spawn agent-jobs if sprint has job-related tasks
5. All agents commit on the SAME branch, working on different files
6. Agents pick up tasks as they finish — if an agent is done early, it can grab independent tasks from another agent's list (respecting ownership boundaries)
7. End of sprint: `/review` + `/qa` the entire branch → 1 PR to main

**Spawn prompt (parallel):**
```
You are agent-frontend. Read CLAUDE.md, then .claude/agents/agent-frontend.md,
then agile/sprints/current.md. Your tasks this sprint: TASK-003, TASK-005.
Work on branch sprint/sprint-XX. Follow the quality checklist in your agent file.
After completing each task, update your agent file and commit immediately.
If shared types from agent-api are not committed yet, use a temporary local
interface and replace it when the types appear on the branch.
When you finish your tasks, check if there are independent tasks you can pick up.
BEFORE marking any task done: verify EACH "Accept when" criterion with actual commands.
Do not add features, abstractions, or code not required by the task.
```

**Conflict prevention (Hero Mode):**

Ownership boundaries — agents MUST stay in their lanes:
| Resource | Owner | Others |
|----------|-------|--------|
| `/shared/types/*` | agent-api | READ only — never modify |
| `/api/prisma/schema.prisma` | agent-api | READ only — never modify |
| `/frontend/src/components/ui/*` | Shadcn-managed | Wrap in `/components/shared/` |
| `/frontend/src/features/*` | agent-frontend | agent-api never touches |
| `/api/src/modules/*` | agent-api | agent-frontend never touches |
| `.claude/agents/[name].md` | that agent only | Never modify another agent's file |

Shared type workflow:
1. agent-api creates/modifies types in `/shared/types/` and commits early
2. agent-frontend pulls and consumes — if not ready yet, uses temporary local interface
3. agent-jobs mirrors types manually in `jobs/src/types/`

If git conflict occurs: the agent that encounters it resolves it, preferring the OTHER agent's changes in shared files.

## Rules

1. **DO NOT invent features** — only create Epics/Tasks from what's in the PRD and eng review
2. **DO NOT skip the dependency check** — tasks with dependencies must list them
3. **DO NOT create tasks larger than 8 points** — break them down
4. **DO NOT assign a task to multiple agents** — pick the primary owner, note collaborators in Tech section
5. **DO NOT overcommit Sprint 1** — conservative is better than heroic
6. **ALWAYS reference shared code** in the Tech section — check the Reuse Map in CLAUDE.md
7. **ALWAYS create the sprint directory and files** — don't just list tasks in chat
8. Communicate in the user's preferred language
