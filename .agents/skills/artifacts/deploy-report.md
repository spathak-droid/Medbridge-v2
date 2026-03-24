---
name: deploy-report
description: Canonical markdown deploy artifact written by DevOps for each deployment attempt.
---

# Deploy Report Artifact

The deploy artifact is written to `deploys/<ticket>-deploy.md`.

## Required Header

The first line must be exactly one of:

```text
VERDICT: DEPLOYED
VERDICT: ROLLBACK
```

## Required Structure

```md
VERDICT: DEPLOYED | ROLLBACK
# Deploy Report for <TICKET-ID>

## Summary
- result: DEPLOYED | ROLLBACK
- deploy_strategy: <strategy>
- deployed_by: devops

## Pre-Deploy Checks
- lint: PASS | FAIL — <note>
- typecheck: PASS | FAIL — <note>
- tests: PASS | FAIL — <note>
- migrations_reviewed: PASS | FAIL | N/A — <note>
- rollback_plan_confirmed: PASS | FAIL — <note>

## Commands Run
- `<command>` — PASS | FAIL — <short evidence>

## Staging Result
<health checks, smoke results, or `none`>

## Production Result
<promotion outcome, rollback trigger, or `none`>

## Monitoring Window
<error rate, latency, alerts, or `none`>

## Notes
<follow-ups, env changes, or `none`>
```

## Rollback Incident File

If the verdict is `ROLLBACK`, also write `deploys/<ticket>-rollback.md` with:

```md
# Rollback Incident for <TICKET-ID>

## Failure Summary
<what failed>

## Rollback Steps Taken
- <step>

## Root Cause
<best current understanding>

## Developer Follow-Up
- <what must be fixed before retry>
```

## Rules

1. Do not write JSON.
2. The deploy artifact records facts from the actual deployment attempt, not plans.
3. If rollback happens, the rollback incident file is mandatory.
