---
name: skill-authoring
description: >
  Use when creating, editing, or reviewing skills in .claude/skills/.
  Covers skill structure, frontmatter, progressive disclosure,
  gotchas format, and anti-patterns.
invocation: manual
---

# Skill Authoring Guide

> Use when creating, editing, or reviewing skills in `.claude/skills/`.

## Skill Structure

A skill is a **folder**, not just a markdown file:

```
.claude/skills/[skill-name]/
├── SKILL.md          # Main instructions (< 300 lines)
├── gotchas.md        # Common mistakes (optional, recommended)
└── references/       # Deep-dive docs loaded on-demand (optional)
    ├── pattern-a.md
    └── pattern-b.md
```

## SKILL.md Template

Every SKILL.md MUST follow this structure:

```markdown
---
name: skill-name
description: >
  [TRIGGER CONDITIONS — when should this skill activate?
  Be specific: file types, keywords, scenarios.
  Example: "Use when writing or modifying any .rs file"]
invocation: auto | manual
---

# [Skill Title]

> [One-line summary of what this skill does]

## When to Use
[Specific trigger conditions — what user says/does that activates this]

## Quick Reference
[Most-used commands, patterns, or decisions — the 20% that covers 80% of use cases]

## Workflow / Checklist
[Step-by-step or checklist for the main task]

## Gotchas
[Top 3-5 mistakes, or link to gotchas.md if extensive]
→ See gotchas.md for full list

## References
[Links to reference files for deep-dives]
→ See references/[topic].md for [description]
```

## Frontmatter Rules

The frontmatter is critical — it's how the system knows when to load the skill:

```yaml
---
name: rust-dev                    # kebab-case, unique
description: >
  ALWAYS read this BEFORE writing or modifying any Rust code (.rs files).
  Covers error handling, async patterns, type safety, and documentation
  requirements for this project.
invocation: auto                  # auto = load when pattern matches
                                  # manual = only when user asks
---
```

**Description must answer:** "When should Claude read this skill?"
- ✅ "Use when writing or modifying any `.rs` file" — clear trigger
- ❌ "Rust development best practices" — too vague, no trigger

## Progressive Disclosure — Save Tokens

**Layer 1: Frontmatter** (~50 tokens) — always loaded, tells system when to activate
**Layer 2: SKILL.md body** (< 300 lines) — loaded when skill activated
**Layer 3: references/** (0 tokens until needed) — loaded on-demand by Claude

Rules:
- SKILL.md body < 300 lines — if longer, extract to references/
- Keep the most-used 20% in SKILL.md, put the rest in references/
- Claude reads references/ only when it needs deep-dive info

### What Goes Where

| Content | Location | Why |
|---------|----------|-----|
| Trigger conditions | Frontmatter `description` | Always visible to system |
| Core checklist, quick reference | SKILL.md body | Loaded on activation |
| Code examples (> 30 lines) | references/ | On-demand |
| Edge cases, advanced patterns | references/ | On-demand |
| Gotchas (> 5 items) | gotchas.md | On-demand |
| Templates, scripts | templates/, scripts/ | On-demand |

## Gotchas File

Create `gotchas.md` with this format:

```markdown
# [Skill Name] Gotchas

## [Mistake Name]

**Symptom:** What goes wrong
**Cause:** Why it happens
**Fix:** How to avoid it

\`\`\`
// ❌ WRONG
bad example

// ✅ CORRECT
good example
\`\`\`
```

Start with 3-5 gotchas. Add more as real failures are discovered during sprints.

## Skill Categories

When creating a new skill, identify which category it belongs to:

| Category | Purpose | Examples |
|----------|---------|---------|
| **Dev Standards** | How to write code for this stack | rust, typescript, postgres, frontend-ui |
| **Workflow** | Multi-step processes | plan-sprint, setup, upgrade, product-owner-review |
| **Code Quality** | Review and enforce standards | review, qa, cso |
| **Tool Integration** | How to use external tools | gitnexus, browse |
| **Scaffolding** | Generate boilerplate | scaffold (if added) |

## Writing Tips

1. **Don't state the obvious** — Claude already knows TypeScript. Focus on PROJECT-SPECIFIC conventions
2. **Show ❌/✅ examples** — concrete wrong/right pairs are 10x more effective than abstract rules
3. **Don't railroad Claude** — provide guidance, not exact code to copy. Claude adapts better with principles
4. **Include "Before Commit Checklist"** — concrete checklist at the end, easy to verify
5. **Link to real code** — reference Dummies module or existing code as examples

## Anti-patterns

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| 500+ line SKILL.md | Wastes tokens, Claude loses focus | Extract to references/ |
| No frontmatter | System doesn't know when to load | Add name + description + invocation |
| Description as summary | "Best practices for X" doesn't trigger | State trigger conditions explicitly |
| Duplicate across skills | Same content in 3 skills | Extract shared skill, reference from others |
| Project-specific paths hardcoded | Breaks when folder structure changes | Use relative paths or auto-detect |
| No gotchas | Same mistakes repeated every sprint | Add gotchas.md from day one |

## Checklist for New Skills

- [ ] Folder created: `.claude/skills/[name]/`
- [ ] SKILL.md has frontmatter (name, description, invocation)
- [ ] Description states trigger conditions, not just summary
- [ ] Body < 300 lines, rest in references/
- [ ] Has ❌/✅ examples for main patterns
- [ ] Has "Before Commit Checklist" or "Workflow" section
- [ ] gotchas.md created (even if just 2-3 items)
- [ ] Added to upgrade skill file list
- [ ] Referenced in relevant agent's "Required Reading"
