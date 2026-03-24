---
name: review-loop
description: Tech Lead review loop. Reviews a single PR artifact and changed code, then writes a markdown review artifact.
---

# Review Loop

**Trigger:** Developer writes `prs/<ticket>-pr.md`
**Owner:** Tech Lead
**Input:** PR artifact, ticket, conventions, changed code, and presearch decisions
**Output:** Markdown review artifact at `reviews/<ticket>-review.md`

## Artifact Contract

Use `artifacts/review-result.md` as the source of truth.

The first line must be exactly one of:

```text
VERDICT: APPROVED
VERDICT: CHANGES_REQUESTED
```

## Review Protocol

1. Validate PR intake:
   - one ticket only
   - scope boundaries present
   - files changed listed
   - validation commands/results listed
   - deployment notes present or `none`
2. Read the actual changed files in the target repo.
3. Check conventions, architecture, security, tests, and code quality.
4. Record at least one meaningful comment.
5. Write the review artifact in markdown, not JSON.

## Blocking Rules

The review must be `CHANGES_REQUESTED` when any of the following is true:

- a convention is violated
- auth is missing on a protected mutation
- tests for new behavior are missing
- validation clearly failed
- the PR artifact is incomplete

## Finding Format

Blocking finding:

```text
[BLOCKING]
File: <exact path>
Line: <exact number or n/a>
Issue: <what is wrong>
Why it matters: <impact>
Fix: <what to change>
Example: <existing pattern or file reference>
```

Non-blocking finding:

```text
[NON-BLOCKING]
File: <exact path>
Line: <exact number or n/a>
Suggestion: <improvement>
Why: <benefit>
```

## Pattern Notes

If you notice a recurring issue, log it in `## Pattern Notes`.
Route recommendations to the factory skill docs or conventions, not `CLAUDE.md`.
