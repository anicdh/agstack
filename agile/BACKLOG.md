# Product Backlog

> Epic → Task (no Story). Acceptance criteria are within the Task.
> Epic = WHY (from /office-hours). Task = WHAT + HOW + DONE-WHEN.
> Run `/plan-sprint` after `/plan-eng-review` to populate this file.

## Estimation guide
- Story points on Task (not on Epic)
- Fibonacci: 1, 2, 3, 5, 8
- 1-2: a few hours | 3: half day to 1 day | 5: 2-3 days | 8: 3-5 days (consider breaking down)
- Sprint = 1 week. Target 25-30 pts/sprint. Tasks at 8 pts are a warning sign — break down if possible.

---

## EPIC-01: [Epic Name] [type: user-oriented | technical]

> **Why:** [Problem to solve — from /office-hours]
> **Type:** user-oriented | technical
> **Design required:** yes | no
> **Design status:** ⬜ Not started | 🎨 In progress | ✅ Approved
>
> **Scope:** [What is included in this epic]
> **Out of scope:** [What is NOT being done]
> **Source:** /office-hours session [date]

### TASK-001: [Task Name] [X pts] ⬜
- **Dev:** [dev-name — Team Mode only, assigned during /plan-sprint]
- **Agent:** [agent name]
- **Branch:** feat/[branch-name]
- **Accept when (AI implementation):**
  - [ ] [Acceptance criterion 1]
  - [ ] [Acceptance criterion 2]
  - [ ] Passes lint, typecheck, runtime verification
- **Accept when (Human refinement):**
  - [ ] UX reviewed in browser — no visual bugs or interaction issues
  - [ ] Edge cases verified — empty, error, loading states work
- **Tech:** [Technical approach]
- **Depends on:** [Task IDs if any]

### TASK-002: [Task Name] [X pts] ⬜
- **Dev:** [dev-name — Team Mode only, assigned during /plan-sprint]
- **Agent:** [agent name]
- **Branch:** feat/[branch-name]
- **Accept when (AI implementation):**
  - [ ] [Acceptance criterion 1]
  - [ ] [Acceptance criterion 2]
  - [ ] Passes lint, typecheck, runtime verification
- **Accept when (Human refinement):**
  - [ ] UX reviewed in browser — no visual bugs or interaction issues
  - [ ] Edge cases verified — empty, error, loading states work
- **Tech:** [Technical approach]

---

## EPIC-02: [Epic Name] [type: user-oriented | technical]

> **Why:** [...]
> **Type:** user-oriented | technical
> **Design required:** yes | no
> **Design status:** ⬜ Not started | 🎨 In progress | ✅ Approved
>
> **Scope:** [...]
> **Source:** /office-hours session [date]

### TASK-010: ...

---

## Legend

**Epic types:**
- `user-oriented` — has UI, needs design approval before sprint (product-design agent)
- `technical` — no UI, goes straight to /plan-sprint

**Epic design status:**
- ⬜ Not started | 🎨 In progress | ✅ Approved

**Task status:**
- ⬜ Backlog | 🔵 In current sprint | 🟢 Implemented (AI done) | 🔧 Refining (human polishing) | ✅ Done (both signed off)
- Only ✅ Done tasks count toward sprint velocity

**Structure:**
- Points on Task, NOT on Epic
- Epic has: WHY + TYPE + SCOPE + Design status — from /product-owner-review
- Task has: agent, branch, accept-when (AI + Human), tech, design reference
