---
name: upgrade
description: >
  Use when pulling latest agStack boilerplate updates into an
  existing project. Merges convention files without overwriting
  project-specific code.
invocation: manual
---

# /upgrade — Pull agStack boilerplate updates into existing project

> Fetches the latest agStack boilerplate files and merges them into the current project
> without overwriting project-specific code (features, modules, configs with real data).

## When to use

Run `/upgrade` when:
- agStack has released updates to boilerplate files (CLAUDE.md, agent files, DoD, skills, etc.)
- You want to pull in new conventions, fixes, or skills from agStack

## Instructions

### Step 1: Clone latest agStack to temp directory

```bash
git clone --depth 1 https://github.com/gstack-studio/agStack.git /tmp/agstack-upgrade
```

If clone fails (private repo, no access), tell the user:
> "Can't access agStack repo. Download the latest release and place it at /tmp/agstack-upgrade, then run /upgrade again."

### Step 2: Identify files to upgrade

**ALWAYS upgrade (boilerplate files):**
These files contain conventions, rules, and templates — safe to overwrite:

```
CLAUDE.md
.npmrc
biome.json
lefthook.yml
.claude/agents/_template.md
.claude/agents/agent-api.md
.claude/agents/agent-frontend.md
.claude/agents/agent-jobs.md
.claude/agents/CLAIMS.md (create if missing — team mode file claims)
.claude/agents/TEAM-RULES.md (create if missing — team mode workflow rules)
agile/DEFINITION-OF-DONE.md
agile/VELOCITY.md (merge — keep existing sprint data, update template sections)
agile/BACKLOG.md (merge — keep existing epics/tasks, update estimation guide header)
agile/templates/*
```

**ALWAYS upgrade (rules):**
```
.claude/rules/anti-hallucination.md
```

**ALWAYS upgrade (skills):**
```
.claude/skills/setup/SKILL.md
.claude/skills/plan-sprint/SKILL.md
.claude/skills/upgrade/SKILL.md
.claude/skills/product-owner-review/SKILL.md
.claude/skills/gitnexus/SKILL.md (optional — code navigation)
.claude/skills/rust/SKILL.md
.claude/skills/typescript/SKILL.md
.claude/skills/postgres/SKILL.md
.claude/skills/frontend-ui/SKILL.md
```

**NEVER overwrite (project-specific):**
```
package.json (project has real deps — only check for ^ or ~ and fix)
api/prisma/schema.prisma (project has real models)
.env / .env.example (project has real values)
docker-compose.yml (project may have custom services)
frontend/src/features/* (project code)
api/src/modules/* (project code)
jobs/src/jobs/* (project code)
shared/types/* (project types)
agile/sprints/* (project sprint history)
agile/VELOCITY.md velocity chart rows (project data)
docs/* (project docs)
```

### Step 3: Merge strategy

For each file in the "ALWAYS upgrade" list:

1. **If file exists in project:**
   - Read both versions (project + agStack)
   - If they are identical → skip
   - If different → replace with agStack version, BUT:
     - For CLAUDE.md: preserve the `## Project Structure`, `## Environment Variables`, `## Key Decisions`, and `## Dev Setup` sections (project-specific content). Replace everything else.
     - For VELOCITY.md: keep the velocity chart data rows and agent velocity data. Replace the template/header sections.
     - For BACKLOG.md: keep all epics and tasks. Replace the estimation guide header.
     - For agent files: keep `## Current State`, `## Session Log`, `## My TODOs`, `## Notes` sections. Replace everything else.

2. **If file doesn't exist in project:**
   - Copy from agStack

3. **New skills from agStack:**
   - If agStack has new skill folders not in project → copy them in
   - If existing skill updated → replace SKILL.md

### Step 4: Fix dependency versions

Scan all `package.json` files for `^` or `~` prefix:

```bash
grep -rn '"\^' package.json frontend/package.json api/package.json 2>/dev/null
grep -rn '"~' package.json frontend/package.json api/package.json 2>/dev/null
```

If found, strip the prefix:
```bash
sed -i 's/"\^/"/g' <file>
sed -i 's/"~/"/g' <file>
```

Verify `.npmrc` exists with `save-exact=true`. Create if missing.

### Step 5: Verify and report

After merging, run:
```bash
npx @biomejs/biome check . 2>&1 | head -20
cd api && npx tsc --noEmit 2>&1 | head -20
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Report to user:
```
Upgrade complete:
- Updated: [list of files changed]
- Skipped (identical): [list]
- New: [list of new files added]
- Fixed: [N] dependency versions stripped of ^ or ~
- Lint: [pass/fail]
- TypeCheck: [pass/fail]

Review the changes and commit when ready.
```

### Step 6: Cleanup

```bash
rm -rf /tmp/agstack-upgrade
```

## Rules

1. **NEVER overwrite project-specific code** — features, modules, migrations, sprint data
2. **ALWAYS preserve project sections** in merged files (CLAUDE.md, VELOCITY.md, agent files)
3. **ALWAYS fix `^` and `~`** in package.json — this is a security requirement
4. **Show diff summary** before applying changes if more than 5 files affected
5. Communicate in the user's preferred language
