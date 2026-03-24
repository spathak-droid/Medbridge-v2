---
name: dev-loop
description: Development Loop. Developer implements a ticket, validates the work, and writes a markdown PR artifact for review.
---

# Development Loop

**Trigger:** Ticket moves to `IN_DEV`
**Owner:** Developer
**Input:** Ticket, conventions, presearch decisions, and any prior review / QA / rollback feedback
**Output:** Code changes in the target repo plus a markdown PR artifact at `prs/<ticket>-pr.md`

## Core Rules

1. Read the real codebase before changing anything.
2. Follow the target repo's conventions and exemplar files.
3. Implement only the ticket scope.
4. Run the real validation commands for the touched stack.
5. Write the PR artifact using `artifacts/pr-review.md`.
6. Do not write JSON status payloads.

## Required Workflow — TDD (Red → Green → Refactor)

1. Read the ticket, acceptance criteria, and any fix context.
2. Inspect existing code patterns and test patterns in the target repo.
3. **RED — Write failing tests FIRST:**
   - Write tests that cover every acceptance criterion from the ticket.
   - Match the repo's test framework, file naming, and assertion style.
   - Run the tests. They MUST fail (because the code doesn't exist yet).
   - If they pass, your tests aren't testing anything new — rewrite them.
4. **GREEN — Implement the minimum code to make tests pass:**
   - Write only the code needed to make your failing tests turn green.
   - Do not add features beyond what the tests require.
   - Run the tests after every significant change.
5. **REFACTOR — Clean up without changing behavior:**
   - Remove duplication.
   - Match existing code patterns and conventions.
   - Run lint, typecheck, and tests. All must pass.
6. Write `prs/<ticket>-pr.md` with:
   - `VERDICT: PR_READY`
   - actual files changed
   - actual commands run and results (include test output)
   - explicit scope boundaries

## Revision Rules

If the ticket returns from review, QA, or rollback:

1. Fix only the flagged issues.
2. Re-run validation.
3. Update the same PR artifact so it reflects the current state.
