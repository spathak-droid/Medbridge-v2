---
name: review-result
description: Canonical markdown review artifact written by Tech Lead for each PR review cycle.
---

# Review Artifact

The review artifact is written to `reviews/<ticket>-review.md`.

## Required Header

The first line must be exactly one of:

```text
VERDICT: APPROVED
VERDICT: CHANGES_REQUESTED
```

## Required Structure

```md
VERDICT: APPROVED | CHANGES_REQUESTED
# Review for <TICKET-ID>

## Intake Check
- scope: PASS | FAIL — <note>
- pr_structure: PASS | FAIL — <note>
- deployment_notes: PASS | FAIL — <note>

## Checklist
- conventions: PASS | FAIL — <note>
- architecture: PASS | FAIL — <note>
- security: PASS | FAIL — <note>
- tests: PASS | FAIL — <note>
- code_quality: PASS | FAIL — <note>
- performance: PASS | FAIL | N/A — <note>

## Summary
<short overall assessment>

## Blocking Findings
[BLOCKING]
File: <exact path>
Line: <exact number or n/a>
Issue: <one sentence>
Why it matters: <one sentence>
Fix: <specific action>
Example: <existing file or pattern reference>

## Non-Blocking Findings
[NON-BLOCKING]
File: <exact path>
Line: <exact number or n/a>
Suggestion: <one sentence>
Why: <one sentence>

## Pattern Notes
- <recurring pattern or `none`>
```

## Rules

1. Use `## Blocking Findings` even when there are no blockers; write `none`.
2. Use `## Non-Blocking Findings` even when empty; write `none`.
3. Any convention, security, or missing-test failure must produce `VERDICT: CHANGES_REQUESTED`.
4. Do not write JSON.
