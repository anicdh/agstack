# Tech Stack Consult Gotchas

## Overwriting Existing stack.json

**Symptom:** Previous stack decision lost without warning.
**Cause:** Running `/tech-stack-consult` again after `/setup` already scaffolded.
**Fix:** Always check if `.agstack/stack.json` exists first. If it does, show the current config and ask the user to confirm before overwriting.

## Recommending Rust for Learning

**Symptom:** User gets a `nestjs-rust` profile they can't maintain — Rust worker rots.
**Cause:** Agent recommends Rust because jobs are heavy, ignoring that Q3 says team has no Rust experience.
**Fix:** The decision matrix prioritizes Q3 (team skills). If Q3 == "TypeScript" (no Rust), always recommend `nestjs-only` with BullMQ, regardless of Q1 workload. Note it in the ADR as a "revisit when team adds Rust."

## PaaS Single-Service + nestjs-rust Conflict

**Symptom:** User deploys to Railway/Render single-service and can't run the Rust worker.
**Cause:** `nestjs-rust` requires 2 separate processes (Node + Rust), but single-service PaaS only runs one.
**Fix:** When Q4 == "PaaS single-service" AND the matrix lands on `nestjs-rust`, surface the tradeoff explicitly. Don't silently proceed — the user needs to decide between splitting services or switching to `nestjs-only`.

## Changing Profile After /setup Already Scaffolded

**Symptom:** User re-runs `/tech-stack-consult`, picks a different profile, then runs `/setup` again — project ends up with leftover files from the old profile (e.g., `/jobs` Rust folder still exists after switching to `nestjs-only`).
**Cause:** `/setup` scaffolds additively — it doesn't delete directories from a previous profile.
**Fix:** If `.agstack/stack.json` already exists AND `/setup` has been run, warn the user that switching profiles requires manual cleanup. List what they need to remove (e.g., `/jobs`, Rust entries in `docker-compose.yml`, CI pipeline steps). Better yet, suggest starting from a clean branch.

## Skipping Questions to Speed Up

**Symptom:** Agent asks only 2-3 questions then picks a profile — misses critical constraints (e.g., PaaS single-service or heavy realtime needs).
**Cause:** Agent tries to "shortcut" the 5-question flow because early answers seem decisive.
**Fix:** Always ask all 5 questions. The questions are cheap (one AskUserQuestion each) and edge cases in Q4/Q5 can flip the recommendation or surface important tradeoffs. The skill explicitly caps at 5 — don't go below that either.
