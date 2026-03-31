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

**Detect mode:**
- If BACKLOG.md has only templates (no real epics) → **First Sprint Mode** (read eng review output)
- If BACKLOG.md has real epics with tasks → **Next Sprint Mode** (read previous sprint RETRO.md + carry-over tasks)

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
- **Accept when:**
  - [ ] [Specific, testable criterion]
  - [ ] [Another criterion]
- **Tech:** [Technical approach — which files, patterns, shared code to use]
- **Depends on:** [TASK-XXX if any, or "none"]
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
   - Capacity (first sprint: aim for 25-30 points for a 1-week sprint)
   - If past velocity exists in VELOCITY.md, use it as guide
   - Every selected task must contribute to the Sprint Goal
5. **Populate SPRINT.md** using the template from `agile/templates/sprint.md`
6. **Mark selected tasks** as 🔵 in BACKLOG.md
7. **Update `agile/sprints/current.md`** to point to the new sprint
8. **Update `agile/VELOCITY.md`** — fill in previous sprint's actual velocity (Next Sprint Mode only)

**Sprint 1 special rules:**
- If this is Sprint 1, include foundational tasks (database schema, app shell) before feature tasks
- Sprint 1 velocity is unpredictable — commit conservatively (25-30 pts for a 1-week sprint)
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

### Step 5: Present and Confirm

Present the sprint plan to the user in a clear summary:

```
Sprint [XX] Plan:
- Sprint Goal: [1 sentence — user-facing outcome, not technical]
- [N] epics → [N] tasks → [N] pts committed
- Key deliverables: [list 2-3 outcomes that serve the Sprint Goal]

Top priority tasks:
1. TASK-XXX: [name] ([N] pts) — [agent]
2. TASK-XXX: [name] ([N] pts) — [agent]
3. ...
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

One branch per task, sequential, review each PR before moving on. For those who like things clean and controlled.

**Branch:** `feat/TASK-XXX-[description]` per task

**Workflow:**
1. Run agent-api tasks first (shared types + API endpoints)
2. Each task gets its own branch: `git checkout -b feat/TASK-001-[name]`
3. After each task: `/review` + `/qa` → PR to main → merge
4. Then run agent-frontend tasks — API is already merged, no guessing
5. Run agent-jobs tasks if any
6. Every PR is reviewed and tested before the next task starts

**Spawn prompt (sequential):**
```
You are agent-api. Read CLAUDE.md, then .claude/agents/agent-api.md,
then agile/sprints/current.md. Your tasks this sprint: TASK-001, TASK-002.
For each task: create branch feat/TASK-XXX-[name], complete the task,
commit, then report back for review before starting the next task.
Follow the quality checklist in your agent file.
```

After agent-api finishes all tasks and PRs are merged, spawn agent-frontend.

**Why this is the default:**
- Each PR is small and easy to review
- Frontend always has real, merged API to consume — no mocks needed
- Clean git history — each feature is one branch, one PR
- If something breaks, you know exactly which task caused it

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
