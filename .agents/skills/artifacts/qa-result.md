---
name: qa-result
description: Canonical markdown QA artifact written by QA for each approved PR.
---

# QA Result Artifact

The QA artifact is written to `qa/<ticket>-qa.md`.

## Required Header

The first line must be exactly one of:

```text
VERDICT: PASS
VERDICT: FAIL
```

## Required Structure

```md
VERDICT: PASS | FAIL
# QA Result for <TICKET-ID>

## Summary
- result: PASS | FAIL
- test_cycle: <number>
- tester: qa

## Commands Run
- `<command>` — PASS | FAIL — <short evidence>

## Acceptance Criteria Coverage
- AC1 — PASS | FAIL — <evidence>
- AC2 — PASS | FAIL — <evidence>

## Negative And Regression Coverage
- negative_cases: <what was checked>
- auth_cases: <what was checked>
- regression_checks: <what was checked>

## Bugs Filed
- `bugs/<TICKET-ID>-BUG-001.md` — P1_HIGH — <title>
- `bugs/<TICKET-ID>-BUG-002.md` — P2_MEDIUM — <title>

## Decision Notes
<why this is PASS or FAIL>
```

## Rules

1. One QA artifact per test cycle.
2. File one bug markdown file per distinct defect.
3. If the result is PASS, `## Bugs Filed` must say `none`.
4. If the result is FAIL, every blocking defect must appear both in `## Bugs Filed` and as its own file in `bugs/`.
5. Do not write JSON.
