---
name: ticket
description: Standard ticket/story format used across all SDLC loops. Created by Scrum Master during sprint planning, estimated by Developer, refined by BA. Every ticket in the system uses this schema.
---

# Ticket / Story Format

Every unit of work in the SDLC is a ticket. Tickets are the only way work flows through the system. No ticket = no work. Every ticket has a single owner at any given time.

---

## Ticket Types

| Type | When Used | Created By |
|------|-----------|------------|
| `STORY` | User-facing feature from PRD requirement | Scrum Master (from PRD) |
| `TASK` | Technical sub-task of a story (no direct user value) | Developer (when breaking down a story) |
| `BUG` | Defect found by QA or production | QA (from QA loop) |
| `SPIKE` | Research / investigation with time-box | Scrum Master (when uncertainty is high) |

---

## Ticket Schema

```json
{
  "id": "PROJ-XXX",
  "type": "STORY | TASK | BUG | SPIKE",
  "title": "<imperative verb + object: 'Add payment method list endpoint'>",
  "sprint": N,
  "status": "BACKLOG | IN_DEV | IN_REVIEW | IN_QA | DONE | BLOCKED | CANCELLED",
  "priority": "P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW",

  "description": {
    "as_a": "<user persona>",
    "i_want": "<goal>",
    "so_that": "<outcome>"
  },

  "acceptance_criteria": [
    "<testable condition 1 — starts with 'Given/When/Then' or 'User can'>",
    "<testable condition 2>"
  ],

  "technical_notes": "<implementation hints from Architect/Developer — optional>",

  "estimate_sp": N,
  "estimate_hours": N,
  "complexity": "LOW | MEDIUM | HIGH",

  "assignee": "developer | tech-lead | qa | devops",
  "reporter": "scrum-master | qa | developer",

  "dependencies": ["PROJ-XXX", "PROJ-YYY"],
  "blocks": ["PROJ-ZZZ"],

  "parent_story": "PROJ-XXX",
  "sub_tasks": ["PROJ-XXX"],

  "labels": ["backend", "frontend", "migration", "auth", "api", "ui"],

  "linked_prd_requirement": "R-XX",

  "history": [
    {
      "date": "Day N",
      "from_status": "BACKLOG",
      "to_status": "IN_DEV",
      "by": "developer",
      "note": ""
    }
  ],

  "pr_ref": "PR-XXX",
  "bug_refs": ["BUG-XXX"]
}
```

---

## Lifecycle Rules

```
BACKLOG
  → IN_DEV: Developer picks up ticket
  → CANCELLED: PM removes from sprint

IN_DEV
  → IN_REVIEW: Developer opens PR (PR must exist to move here)
  → BLOCKED: Developer hits a blocker (must describe blocker in history)
  → BACKLOG: Developer de-scopes (with PM approval)

IN_REVIEW
  → IN_QA: Tech Lead returns APPROVED
  → IN_DEV: Tech Lead returns CHANGES_REQUESTED
  → BLOCKED: Review is blocked (dependency not merged)

IN_QA
  → DONE: QA returns PASS
  → IN_DEV: QA returns FAIL (bug report filed, ticket sent back)
  → BLOCKED: QA environment is broken / dependency not deployed

BLOCKED
  → previous status: Blocker removed
  → CANCELLED: PM decides to drop

DONE
  → (terminal — cannot regress. New bugs create BUG tickets.)
```

---

## Acceptance Criteria Writing Rules

Every acceptance criterion must be:
- **Testable** — QA can write a test case for it
- **Specific** — No vague language ("works correctly", "is fast")
- **Scoped** — Describes one observable behavior

Format options:
```
Given [context], when [action], then [outcome]
User can [action] from [location]
System returns [response] when [condition]
[Field] is required / optional / hidden
```

Bad ❌: "Payment method form works correctly"
Good ✅: "Given a user with payment_methods:manage permission, when they submit the form with valid fields, then a new PaymentMethod is created and appears in the list"

---

## Story Point Scale

| Points | Complexity | Rough Hours | Example |
|--------|-----------|-------------|---------|
| 1 | Trivial | 1-2h | Add a field to an existing model |
| 2 | Small | 2-4h | New API endpoint, standard CRUD |
| 3 | Medium | 4-8h | New feature with backend + frontend |
| 5 | Large | 1-2d | Complex feature with multiple layers |
| 8 | Very Large | 2-4d | Consider splitting |
| 13 | Too Big | — | Must split before sprint planning |

Rule: No ticket > 8 points enters a sprint without being split first.
Spike tickets: always 1-3 points, time-boxed.

---

## Example: Story Ticket

```json
{
  "id": "PROJ-001",
  "type": "STORY",
  "title": "Add PaymentMethod list view with sorting and filtering",
  "sprint": 1,
  "status": "IN_DEV",
  "priority": "P1_HIGH",
  "description": {
    "as_a": "merchant",
    "i_want": "to see all my payment methods in a sortable, filterable list",
    "so_that": "I can quickly find and manage specific payment methods"
  },
  "acceptance_criteria": [
    "Given a logged-in merchant with payment_methods:manage, when they navigate to /payment-methods, then they see a list of all their payment methods",
    "User can sort the list by: label (A-Z, Z-A), type, created_at",
    "User can filter by: type (credit_card, ach, wire)",
    "Given no payment methods exist, user sees an empty state with a 'Add Payment Method' CTA",
    "List shows: label, type, is_default badge, last 4 digits of vault_ref (masked)"
  ],
  "technical_notes": "Use the existing table component from ResponseForm pattern. Auth via get_current_user dependency.",
  "estimate_sp": 5,
  "estimate_hours": 8,
  "complexity": "MEDIUM",
  "assignee": "developer",
  "reporter": "scrum-master",
  "dependencies": [],
  "blocks": ["PROJ-002", "PROJ-003"],
  "labels": ["frontend", "backend", "api"],
  "linked_prd_requirement": "R-01"
}
```

---

## Example: Bug Ticket

```json
{
  "id": "BUG-001",
  "type": "BUG",
  "title": "DELETE /payment-methods/:id returns 200 for non-existent ID",
  "sprint": 1,
  "status": "IN_DEV",
  "priority": "P1_HIGH",
  "description": {
    "as_a": "QA engineer",
    "i_want": "DELETE to return 404 for non-existent resource",
    "so_that": "callers know the operation had no effect"
  },
  "acceptance_criteria": [
    "Given a DELETE request to /payment-methods/nonexistent-id, system returns HTTP 404 with error body",
    "Given a DELETE request to /payment-methods/:id the caller does not own, system returns HTTP 403"
  ],
  "estimate_sp": 1,
  "assignee": "developer",
  "reporter": "qa",
  "parent_story": "PROJ-001",
  "labels": ["bug", "backend", "api"],
  "linked_prd_requirement": "R-01"
}
```
