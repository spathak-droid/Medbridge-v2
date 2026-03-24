---
name: deploy-loop
description: DevOps deployment loop. Uses validated artifacts and writes a markdown deploy report.
---

# Deploy Loop

**Trigger:** QA artifact returns `VERDICT: PASS`
**Owner:** DevOps
**Input:** Ticket, PR artifact, QA artifact, target repo state
**Output:** Markdown deploy report at `deploys/<ticket>-deploy.md`, plus rollback report if needed

## Artifact Contract

Use `artifacts/deploy-report.md` as the source of truth.

The first line of the deploy report must be exactly one of:

```text
VERDICT: DEPLOYED
VERDICT: ROLLBACK
```

If rollback happens, also write `deploys/<ticket>-rollback.md`.

## Deploy Protocol

1. Re-run the necessary validation commands before deploy.
2. Review migration and deployment notes from the PR artifact.
3. Record the exact commands run and actual outcomes.
4. Record staging and production outcomes separately.
5. If deployment degrades or fails, roll back immediately and write the rollback incident file.
6. Do not write JSON.

## Rollback Rules

Rollback is required when:

- a required validation step fails
- staging smoke checks fail
- production health degrades after rollout
- migrations fail or leave the app unhealthy
