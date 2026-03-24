---
name: pr-review
description: Canonical markdown PR artifact written by Developer and consumed by Tech Lead, QA, and DevOps.
---

# Pull Request Artifact

The PR artifact is a markdown handoff file written by Developer at `prs/<ticket>-pr.md`.

It is not a JSON record and it is not edited by downstream agents. Tech Lead, QA, and DevOps each write their own separate artifacts.

## Required Header

The first line must be exactly:

```text
VERDICT: PR_READY
```

## Required Structure

```md
VERDICT: PR_READY
# PR for <TICKET-ID>

## Summary
- ticket: <TICKET-ID>
- title: <imperative change summary>
- branch: <branch name or n/a>
- base: <base branch>
- author: developer

## Scope
### What Changed
<1-3 sentences>

### Why
<business or ticket reason>

### How
<implementation approach and key decisions>

### Not Changed
<explicit scope boundaries>

## Files Changed
- `path/to/file` — ADDED | MODIFIED | DELETED — <one-line summary>

## Validation
- lint: PASS | FAIL | NOT_RUN — `<command>`
- typecheck: PASS | FAIL | NOT_RUN — `<command>`
- tests: PASS | FAIL | NOT_RUN — `<command>`
- manual_checks: <brief note or none>

## Self-Review Checklist
- [x] Happy path verified
- [x] Primary failure path verified
- [x] Edge cases from the ticket reviewed
- [x] No debug code left behind
- [x] No secrets committed
- [x] Tests added or existing coverage confirmed

## Migration / Data Notes
<migration summary, reversibility, data risk, or `none`>

## Deployment Notes
<env vars, flags, rollout notes, or `none`>

## Risks / Follow-ups
- <known limitation or follow-up item>
```

## Rules

1. One ticket per PR artifact.
2. Every changed file must be listed.
3. Validation results must reflect commands actually run.
4. If a section is not needed, write `none`; do not omit the section.
5. Do not paste raw terminal logs. Summarize the outcome and list the command.
