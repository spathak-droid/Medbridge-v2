---
name: bug-report
description: Canonical markdown bug report written by QA. One file per defect.
---

# Bug Report Artifact

QA writes one markdown file per defect at `bugs/<ticket>-BUG-00N.md`.

## Required Structure

````md
# <TICKET-ID>-BUG-001: <short defect title>

## Metadata
- ticket: <TICKET-ID>
- severity: P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW
- category: FUNCTIONAL | SECURITY | PERFORMANCE | UX | DATA_INTEGRITY | AUTH
- blocking: true | false
- service: backend | frontend | both
- endpoint: <endpoint or none>
- test_data: <required setup or none>

## Acceptance Criterion Violated
<paste the exact AC text or `none`>

## Steps To Reproduce
1. <exact step>
2. <exact step>
3. <exact step>

## Expected Behavior
<what should happen>

## Actual Behavior
<what actually happened, including exact status code, UI state, or error text>

## Evidence
```text
<request/response/log/error excerpt>
```

## Notes
- root_cause_hypothesis: <optional or `none`>
- status: OPEN
````

## Rules

1. One defect per file. No bundling.
2. Use exact observed behavior, not interpretation.
3. Copy exact error output into `## Evidence` when available.
4. P0 and P1 bugs are blocking.
