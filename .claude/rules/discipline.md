# Coding Discipline (MANDATORY for ALL agents)

> Derived from common LLM coding pitfalls. These rules prevent scope creep,
> unnecessary complexity, and unrelated changes that slow down reviews and introduce bugs.

## Rule 1: No Speculative Features

DO NOT add anything the user did not ask for. Period.

```
❌ Task says "add login page" → you also add password reset, remember me, social login
❌ Task says "create user service" → you also add caching, rate limiting, audit logging
❌ Task says "fix the button" → you also refactor the component, extract a hook, add types
❌ "This might be useful later" → NEVER a valid reason to add code now
❌ "I'll make it configurable" → unless the task explicitly asks for configurability

✅ Task says "add login page" → you add ONLY the login page
✅ Task says "create user service" → you create ONLY the user service
✅ If you see something that SHOULD be improved → note it in a comment or create a backlog task, DO NOT fix it now
```

**The test:** For every line of code you write, ask: "Does the current task require this line?"
If no → delete it.

## Rule 2: Surgical Changes

Touch only what you must. Every changed line must trace directly to the current task.

```
❌ While fixing a bug in OrderService, also "clean up" imports in UserService
❌ While adding a feature, also rename variables in unrelated files for "consistency"
❌ While updating a component, also refactor its parent "because it was messy"
❌ Reformatting files that are not part of your task (let the linter handle it)

✅ Fix the bug in OrderService → only OrderService files change
✅ If you MUST touch an unrelated file (e.g., shared types), explain WHY in the commit
✅ "Clean up" and "refactor" are separate tasks — create a backlog item, don't sneak them in
```

**The test:** Run `git diff --stat` before commit. Every file in the diff must be directly
required by the current task. If a file is there "just because" → `git checkout -- <file>`.

## Rule 3: Explicit Over Implicit

When multiple approaches exist, DO NOT silently pick one. Surface the tradeoff.

```
❌ Silently choose Redis over in-memory cache without explaining why
❌ Pick REST over WebSocket without mentioning the alternative
❌ Use a library when native code would suffice (or vice versa) without saying so

✅ "I chose Redis cache here because [reason]. Alternative: in-memory with TTL. Want me to switch?"
✅ "This could be REST or WebSocket. REST is simpler for this use case. Agree?"
✅ When uncertain between 2 approaches → ask the user, don't guess
```

## Rule 4: Goal-Driven Verification

Before reporting a task as done, verify against acceptance criteria — not just "it compiles".

```
❌ "I've implemented the feature" (without running it)
❌ "Tests pass" (without actually running tests)
❌ Mark task 🟢 after writing code but before verifying it works

✅ Read the task's "Accept when" criteria
✅ Run the verification for each criterion (tests, lint, runtime check)
✅ Report: "Task done. Verified: [list each criterion and its result]"
✅ If a criterion can't be verified → say so explicitly, don't skip silently
```

**The loop:** Write code → verify against criteria → fix → verify again → only THEN report done.

## Self-Check Before Commit

- [ ] Every changed file is required by the current task?
- [ ] No speculative features, abstractions, or "nice to haves" added?
- [ ] No unrelated cleanup, renaming, or reformatting?
- [ ] Tradeoffs were surfaced (not silently decided)?
- [ ] Acceptance criteria verified (not assumed)?
