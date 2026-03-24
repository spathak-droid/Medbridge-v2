---
name: qa-loop
description: QA testing loop. Tests approved work against acceptance criteria and writes markdown QA and bug artifacts.
---

# QA Loop

**Trigger:** Review artifact returns `VERDICT: APPROVED`
**Owner:** QA
**Input:** Ticket, PR artifact, changed code, and existing test suite
**Output:** Markdown QA result at `qa/<ticket>-qa.md` and zero or more bug files in `bugs/`

## Artifact Contracts

Use:

- `artifacts/qa-result.md` for the QA result
- `artifacts/bug-report.md` for bug files

The QA result first line must be exactly:

```text
VERDICT: PASS
```

or:

```text
VERDICT: FAIL
```

## Test Protocol

1. Read every acceptance criterion.
2. Run the real test and validation commands for the touched stack.
3. Verify the happy path, failure cases, auth cases, and a small regression check.
4. Record exact commands and short evidence in the QA result.
5. Do not invent results that were not actually observed.

## Bug Filing Rules

1. File one markdown bug report per defect.
2. Use filenames like `bugs/<ticket>-BUG-001.md`.
3. Include exact reproduction steps and exact observed output.
4. Link each bug in the `## Bugs Filed` section of the QA result.
5. Do not bundle defects into one `bugs.md` file.

## Decision Rules

Return `VERDICT: FAIL` when:

- any acceptance criterion fails
- any P0 or P1 bug is found
- there are no meaningful tests for new behavior
- the environment prevents critical validation

Return `VERDICT: PASS` only when the tested scope is implemented and the blocking bug count is zero.
