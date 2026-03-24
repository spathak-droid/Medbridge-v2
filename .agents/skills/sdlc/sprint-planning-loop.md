---
name: sprint-planning-loop
description: Sprint Planning Loop. Takes PRD phases as input. Runs a multi-agent pipeline: SM creates tickets → Developer estimates → BA clarifies vague ACs → QA reviews testability → Tech Lead reviews architectural scope → DevOps flags deployment complexity → PM prioritizes and approves → SM finalizes. Incorporates retrospective learnings from previous sprint. Output is a locked, battle-ready sprint backlog.
---

# Sprint Planning Loop

**Trigger:** PRD approved (presearch converged) OR previous sprint closed
**Owner:** Scrum Master
**Input:**
- PRD phase for this sprint
- Team velocity (story points)
- Carry-over tickets from previous sprint
- `retrospective_actions` from previous sprint (if any)
- `tech_lead_pattern_log` from previous sprint (if any)
- `quality_metrics` from previous sprint (if any)

**Output:** Locked sprint backlog — ticket list with IDs, estimates, assignments, dependencies, and testability/architecture pre-approvals

---

## Who Runs This Loop

| Agent | Role in Sprint Planning | Does NOT Do |
|-------|------------------------|-------------|
| Scrum Master | Orchestrates, creates tickets, finalizes backlog | Estimate, prioritize, make tech decisions |
| Developer | Estimates, flags vague or risky tickets | Create tickets, prioritize |
| BA | Clarifies ambiguous ACs on flagged tickets | Estimate, create tickets |
| QA | Reviews ACs for testability, flags gaps | Estimate, create tickets, fix ACs |
| Tech Lead | Reviews high-complexity tickets for architectural scope | Prioritize, estimate, write ACs |
| DevOps | Flags tickets with non-trivial deployment ops | Estimate, create tickets, write ACs |
| PM | Prioritizes, cuts scope, approves backlog | Estimate, create tickets |

**Participation is conditional:** QA, Tech Lead, and DevOps are called only when relevant tickets exist. They respond once and step aside — they do not own the loop.

---

## Step 0 — Retrospective Input Ingestion

**Owner: Scrum Master**

Before creating tickets, SM ingests learnings from the previous sprint:

```json
{
  "agent": "scrum-master",
  "action": "RETRO_INGESTION",
  "sprint": 2,
  "retrospective_actions_applied": [
    {
      "action": "Add auth pattern reminder to all backend tickets",
      "source": "tech-lead pattern log Sprint 1 — auth missing from DELETE endpoints",
      "applied_as": "ticket_note added to all backend tickets with DELETE endpoints"
    }
  ],
  "pattern_log_notes": ["<pattern: repeated review failures to be noted in ticket templates>"],
  "quality_baseline": {
    "prev_sprint_avg_review_cycles": 1.4,
    "prev_sprint_escaped_defects": 0,
    "target_this_sprint": "avg review cycles < 1.2"
  }
}
```

If no previous sprint: skip this step. Mark `"first_sprint": true`.

---

## Step 1 — Scrum Master: Ticket Draft

**Owner: Scrum Master**

SM reads the PRD phase and creates draft tickets.

Rules:
- One ticket per acceptance criterion group (not per AC line)
- No ticket > 8 story points (split if larger — SM proposes split, Developer confirms)
- Dependencies between tickets must be explicit
- Label every ticket: `backend | frontend | migration | auth | api | ui`
- Pre-assign to `developer`
- Add `retrospective_notes` to tickets of types that had recurring issues in previous sprints

SM output:
```json
{
  "agent": "scrum-master",
  "action": "TICKET_DRAFT",
  "sprint": 2,
  "prd_phase": "Phase 2",
  "draft_tickets": [ "<ticket objects per artifacts/ticket.md schema>" ],
  "total_draft_sp": 0,
  "team_velocity": 20,
  "capacity_status": "WITHIN | OVER | UNDER",
  "retrospective_notes_applied": ["<which pattern reminders were added to which ticket types>"]
}
```

---

## Step 2 — Developer: Estimation

**Owner: Developer**

Developer estimates every draft ticket. Developer does NOT change ACs or priorities.

Rules:
- Story points: 1/2/3/5/8 only (no halves)
- Flag `needs_split` if estimate > 8
- Flag `too_vague` if description is insufficient to estimate
- Flag `technical_unknown` if a key technical approach is unclear — include specific question
- Flag `high_risk` if this ticket touches infra, auth, or data migration
- Add `technical_notes` for non-obvious implementation approaches
- Include awareness of retrospective pattern reminders (confirm "I saw the auth reminder")

Developer output:
```json
{
  "agent": "developer",
  "action": "ESTIMATION",
  "sprint": 2,
  "estimates": [
    {
      "ticket_id": "PROJ-XXX",
      "estimate_sp": 3,
      "complexity": "LOW | MEDIUM | HIGH",
      "technical_notes": "",
      "needs_split": false,
      "too_vague": false,
      "vague_reason": "",
      "technical_unknown": false,
      "technical_question": "",
      "high_risk": false,
      "risk_reason": "",
      "retrospective_reminder_acknowledged": true
    }
  ],
  "total_estimated_sp": 0,
  "split_recommended": ["PROJ-XXX"],
  "clarification_needed": ["PROJ-XXX"],
  "architect_input_needed": ["PROJ-XXX"]
}
```

---

## Step 3 — BA: AC Clarification (conditional)

**Owner: BA** — only runs if Developer flagged `too_vague` tickets.

BA only responds to flagged tickets. Does not review the full backlog.

BA output:
```json
{
  "agent": "ba",
  "action": "AC_CLARIFICATION",
  "sprint": 2,
  "clarifications": [
    {
      "ticket_id": "PROJ-XXX",
      "original_ac": "<what was unclear>",
      "updated_acceptance_criteria": {
        "happy_path": "Given [context], when [action], then [outcome]",
        "failure_path": "Given [invalid input], when [action], then [error response]"
      },
      "notes": "<what changed and why>"
    }
  ]
}
```

---

## Step 4 — QA: Testability Review (conditional)

**Owner: QA** — runs on all tickets (brief review) or deep review on high-complexity/flagged tickets.

QA checks whether ACs can be turned into test cases. QA does NOT write test cases here — that happens in the QA Loop.

QA specifically checks:
- Does each AC have a clear pass/fail condition?
- Does each AC include a failure path?
- Are there missing edge cases that will obviously need testing (empty state, permissions, boundaries)?
- Are there ACs that are ambiguous about who the actor is (which user role)?

QA output:
```json
{
  "agent": "qa",
  "action": "TESTABILITY_REVIEW",
  "sprint": 2,
  "reviews": [
    {
      "ticket_id": "PROJ-XXX",
      "verdict": "TESTABLE | NEEDS_CLARIFICATION | UNTESTABLE",
      "gaps": [
        {
          "ac_ref": "<which AC>",
          "gap": "<what's missing>",
          "recommended_addition": "<suggested AC addition>",
          "route_to": "ba"
        }
      ],
      "missing_edge_cases_flagged": ["<edge case that will need a test but AC doesn't cover>"]
    }
  ],
  "tickets_needing_ba_update": ["PROJ-XXX"],
  "overall_testability": "GREEN | YELLOW | RED"
}
```

If QA finds `UNTESTABLE` tickets → route back to BA for mandatory update before sprint starts.

---

## Step 5 — Tech Lead: Architectural Scope Review (conditional)

**Owner: Tech Lead** — runs on tickets flagged `high_risk`, `technical_unknown`, or estimate ≥ 5sp.

Tech Lead checks whether the ticket's scope is architecturally sound before development starts. This is a pre-flight check, not a code review.

Tech Lead checks:
- Does the ticket imply an architectural pattern that doesn't exist yet?
- Does the ticket scope assume the wrong layer (e.g., business logic in a route handler)?
- Is there a naming/structure convention the Developer needs to know before starting?
- Does any technical unknown from Developer's estimation have a clear answer?

Tech Lead output:
```json
{
  "agent": "tech-lead",
  "action": "ARCHITECTURAL_SCOPE_REVIEW",
  "sprint": 2,
  "reviews": [
    {
      "ticket_id": "PROJ-XXX",
      "verdict": "CLEAR | NEEDS_GUIDANCE | NEEDS_SPLIT",
      "guidance": "<specific pattern or approach Developer should use>",
      "answer_to_technical_unknown": "<answer to Developer's question if one was flagged>",
      "split_recommendation": null,
      "pattern_reminder": "<if this ticket type has a known recurring issue from pattern log>"
    }
  ],
  "tickets_needing_redesign": ["PROJ-XXX"],
  "architect_consultation_needed": ["PROJ-XXX"]
}
```

If Tech Lead says `NEEDS_SPLIT`: SM splits the ticket before proceeding.
If Tech Lead needs Architect input: SM facilitates a one-turn Architect consultation before proceeding.

---

## Step 6 — DevOps: Deployment Complexity Assessment (conditional)

**Owner: DevOps** — runs on any ticket labeled `migration`, `auth`, or `api` with infra implications.

DevOps does not estimate story points. DevOps flags operational complexity.

DevOps output:
```json
{
  "agent": "devops",
  "action": "DEPLOYMENT_COMPLEXITY_REVIEW",
  "sprint": 2,
  "reviews": [
    {
      "ticket_id": "PROJ-XXX",
      "has_migration": true,
      "migration_risk": "LOW | MEDIUM | HIGH",
      "migration_notes": "<is it reversible? destructive? long-running?>",
      "new_env_vars": ["VAR_NAME"],
      "deployment_window_required": false,
      "pm_sign_off_required": false,
      "estimated_deploy_time_minutes": 5,
      "ops_concern": "<anything DevOps needs to flag before this ticket starts>"
    }
  ],
  "tickets_requiring_pm_signoff": ["PROJ-XXX"],
  "tickets_requiring_deploy_window": ["PROJ-XXX"]
}
```

---

## Step 7 — PM: Prioritization and Capacity Decision

**Owner: PM**

PM receives the fully annotated backlog: estimates + BA clarifications + QA testability verdicts + Tech Lead scope review + DevOps ops flags.

Rules:
- If WITHIN capacity: approve backlog as-is (or pull STRETCH tickets)
- If OVER capacity: cut lowest-priority tickets with rationale
- P0_CRITICAL tickets are never cut
- Tickets flagged `NEEDS_SPLIT` by Tech Lead must be split before approval
- Tickets flagged `UNTESTABLE` by QA must be updated by BA before approval
- PM must acknowledge DevOps `pm_sign_off_required` tickets explicitly

PM output:
```json
{
  "agent": "pm",
  "action": "SPRINT_APPROVAL",
  "sprint": 2,
  "decision": "APPROVED | REVISED",
  "cuts": [
    { "ticket_id": "PROJ-XXX", "reason": "<why cut>", "moved_to": "Sprint 3" }
  ],
  "additions": [
    { "ticket_id": "PROJ-XXX", "reason": "<why added from stretch>" }
  ],
  "devops_signoffs": [
    { "ticket_id": "PROJ-XXX", "signoff": "APPROVED | DEFERRED", "condition": "<any condition>" }
  ],
  "final_sp": 18,
  "sprint_goal": "<one sentence: what does success look like at end of this sprint>"
}
```

---

## Step 8 — Scrum Master: Finalize Sprint Backlog

**Owner: Scrum Master**

SM incorporates all decisions and produces the final sprint backlog.

SM output:
```json
{
  "agent": "scrum-master",
  "action": "SPRINT_BACKLOG_FINAL",
  "sprint": 2,
  "sprint_goal": "<from PM>",
  "sprint_start": "Day 11",
  "sprint_end": "Day 20",
  "backlog": [ "<final ticket list — ordered by priority + dependency>" ],
  "total_sp": 18,
  "dependency_order": [
    "PROJ-00X must complete before PROJ-00Y",
    "PROJ-00A and PROJ-00B can run in parallel"
  ],
  "ready_to_start": ["PROJ-XXX", "PROJ-YYY"],
  "blocked_until": [
    { "ticket": "PROJ-XXX", "blocked_by": "PROJ-YYY" }
  ],
  "quality_targets": {
    "target_avg_review_cycles": 1.2,
    "target_avg_qa_cycles": 1.0
  }
}
```

---

## Loop Exit Condition

Sprint planning is complete when ALL of the following are true:
- [ ] All tickets have estimates from Developer
- [ ] No tickets are flagged as `too_vague` or `UNTESTABLE`
- [ ] All `technical_unknown` flags have answers from Tech Lead or Architect
- [ ] All `high_risk` tickets have DevOps complexity review
- [ ] Total SP ≤ team velocity
- [ ] PM has approved the backlog (including sign-offs)
- [ ] All dependencies documented
- [ ] SM has published the final backlog with `ready_to_start` set

→ Hand off to **Dev Loop** for each ticket in `ready_to_start`
