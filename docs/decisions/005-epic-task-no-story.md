# ADR-005: Epic → Task (skip User Story)

## Status
Accepted

## Context
In traditional Agile, the workflow is Epic → User Story → Task.
User Story serves a communication purpose: forcing developers to think from the user's perspective
through the format "As a [user], I want [action] so that [benefit]".

When using gStack, 3 commands already cover the role of User Story:
- /office-hours: define user problems + goals (6 required questions)
- /plan-ceo-review: validate requirements from product perspective
- /plan-eng-review: estimate effort + technical risks

User Story becomes a redundant intermediate layer of information.

## Decision
Remove the User Story layer. Use Epic → Task directly.

Acceptance criteria (the only thing with real practical value in Story
that does not exist elsewhere) are embedded in each Task under the "Accept when" section.

## Consequences
- Less management overhead
- Agent reads Epic (WHY) + Task (WHAT + DONE-WHEN) = sufficient context
- Must ensure Epic section "Why" is clear enough to replace "As a user..." narrative
- If team expands with many non-technical people, may need to add Story layer back
