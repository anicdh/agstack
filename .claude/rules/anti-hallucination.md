# Anti-Hallucination Rules (MANDATORY for ALL agents)

> Every claim MUST have verifiable evidence. No evidence = don't say it.

## Rule 1: Evidence-Based Output

Every claim about code behavior, test results, or system state MUST be backed by
actual tool/command output from THIS session.

```
❌ "All tests pass" (without running tests)
❌ "The server starts correctly" (without starting it)
❌ "No errors in the build" (without running build)
❌ "This function handles edge cases" (without testing them)

✅ Run `npm test` → show output → then state "All 12 tests pass"
✅ Run `npm run dev` → show startup log → then state "Server starts on port 3000"
✅ Run `cargo clippy` → show output → then state "Zero warnings"
```

## Rule 2: Tool/Command Failure

When a tool or command fails, you MUST:
1. **STOP** — do not proceed as if it succeeded
2. **Report the error** with the actual output
3. **Diagnose** the root cause
4. **NEVER fabricate** success output

```
❌ Tool fails → ignore → "I've verified everything works"
✅ Tool fails → "cargo check failed with: error[E0433]: ..." → fix → re-run → show success
```

## Rule 3: File References

Before referencing any file or path, verify it exists:

```
❌ "See the implementation in src/utils/helper.ts" (never checked if file exists)
✅ Read file first or run ls → confirm exists → then reference it
```

## Rule 4: Runtime Claims

Claims about runtime behavior (server starts, API responds, UI renders) require
ACTUAL runtime verification:

```
❌ "The NestJS module initializes correctly" (only ran typecheck)
✅ Started server → waited 10s → no crash → checked logs → "Server initialized, all modules loaded"
```

## Rule 5: Dependency Claims

Claims about whether a dependency exists, works, or is compatible require verification:

```
❌ "This package supports our Node version" (assumed from memory)
✅ Checked package.json engines field or ran npm ls → confirmed compatibility
```

## Self-Check Before Any Status Report

Before reporting task status (especially "done" or "implemented"):

- [ ] Did I actually RUN the verification commands? (not just plan to)
- [ ] Can I point to the actual output that proves my claim?
- [ ] If something failed, did I report it honestly instead of glossing over?
- [ ] Are all file paths I reference verified to exist?
- [ ] Did I test the actual behavior, not just assume from reading code?

## Escalation

If you cannot verify a claim because a tool is unavailable or environment is broken:
1. State clearly: "I cannot verify this because [reason]"
2. Do NOT assume success
3. Flag it for human verification
