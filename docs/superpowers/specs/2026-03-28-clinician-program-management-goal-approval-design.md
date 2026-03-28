# Clinician Program Management & Goal Approval

## Problem

The current implementation lets the AI coach assign exercise programs and set goals autonomously during onboarding. Per the project requirements, exercise programs are **prescribed by clinicians** — the coach should only reference already-assigned exercises and help patients set goals. Goals should require clinician approval before the patient transitions to ACTIVE.

## Corrected Patient Flow

```
1. Clinician adds patient → assigns exercise program from dashboard
2. Patient logs in → consent screen
3. Patient starts chatting with coach
4. Coach references ALREADY-ASSIGNED exercises, helps patient set a goal
5. Patient confirms goal → goal sent to clinician for approval
6. Patient sees "Waiting for clinician review..." (stays in ONBOARDING)
7. Clinician approves goal → patient transitions to ACTIVE
   OR clinician rejects → patient can chat with coach to set a new goal
```

## Changes Required

### 1. Remove `assign_program` from Coach Tools

**File:** `app/tools/coach_tools.py`
- Remove `assign_program` tool from `make_coach_tools()` return list entirely
- The coach should never assign programs in any phase

**File:** `app/services/coach_service.py`
- Update tool filtering: remove `assign_program` from all phases (not just active/re-engaging)
- `set_goal` remains available during ONBOARDING only (already implemented)

**File:** `app/graphs/onboarding.py`
- Update `ONBOARDING_SYSTEM_PROMPT`:
  - Remove step 2 (assign_program instructions)
  - Step 1: Welcome patient warmly
  - Step 2: Use `get_program_summary` to reference their assigned exercises
  - Step 3: Help them set a specific, achievable exercise goal
  - Step 4: Use `set_goal` tool when they agree
  - Add instruction: if no program is assigned yet, tell patient their clinician hasn't set up their program and to check back later or message their care team
- Remove all references to `assign_program` from the prompt

**File:** `app/graphs/active.py`
- Remove `assign_program` references from system prompt (already partially done)

### 2. Goal Model: Add Clinician Approval Fields

**File:** `app/models/goal.py`
- Add fields:
  - `clinician_approved: bool = False` — whether clinician has approved
  - `clinician_rejected: bool = False` — whether clinician has rejected
  - `rejection_reason: str | None = None` — why it was rejected
  - `reviewed_at: datetime | None = None` — when clinician reviewed it

**Migration:** New alembic migration to add these columns to the `goals` table.

### 3. Goal Approval API Endpoints

**File:** `app/api/goals.py`

**`POST /api/goals/{goal_id}/approve`** (clinician-only)
- Sets `goal.clinician_approved = True`, `goal.reviewed_at = now`
- Checks if goal is also `confirmed = True` (patient confirmed)
- If both confirmed AND approved → transition patient ONBOARDING → ACTIVE
- Schedules Day 2, 5, 7 follow-ups (move from confirm endpoint)
- Returns updated goal

**`POST /api/goals/{goal_id}/reject`** (clinician-only)
- Request body: `{ reason: string }`
- Sets `goal.clinician_rejected = True`, `goal.rejection_reason = reason`, `goal.reviewed_at = now`
- Sets `goal.confirmed = False` (reset patient confirmation so they can re-do)
- Returns updated goal
- Patient stays in ONBOARDING, can chat with coach to set a new goal

**Update `POST /api/goals/{goal_id}/confirm`** (existing)
- Remove the phase transition logic from here
- Only set `goal.confirmed = True`
- Check if `clinician_approved` is already True → if so, transition to ACTIVE
- Otherwise, goal stays in "waiting for clinician" state
- Remove `schedule_followups()` call from here (moved to approve)

### 4. Phase Machine Guard Update

**File:** `app/services/phase_machine.py`
- Update ONBOARDING → ACTIVE guard: require BOTH `goal.confirmed == True` AND `goal.clinician_approved == True`

### 5. Clinician Program Management UI

**File:** `frontend/src/pages/PatientDetailPage.tsx`

Add to the right sidebar "Current Program" section:
- If no program assigned: show "No program assigned" with an "Assign Program" button
- If program assigned: show program name with "Change Program" and "Remove Program" buttons
- "Assign Program" / "Change Program" opens a dropdown/modal with the 5 available programs:
  - Post-Surgical Knee Rehabilitation
  - Shoulder Rehabilitation
  - Lower Back Rehabilitation
  - Fall Prevention & Balance
  - General Mobility & Flexibility
- Each option shows program name and exercise count
- Selection calls existing `POST /api/patients/{id}/program` endpoint
- "Remove Program" calls existing `DELETE /api/patients/{id}/program` endpoint

### 6. Clinician Goal Approval UI

**File:** `frontend/src/pages/PatientDetailPage.tsx`

Update the "Patient Goals" section in the right sidebar:
- For goals with `confirmed = true` but `clinician_approved = false` and `clinician_rejected = false`:
  - Show amber "Pending Review" badge
  - Show "Approve" button (green) and "Reject" button (red)
  - Reject opens a small text input for reason
- For goals with `clinician_approved = true`:
  - Show green "Approved" badge with checkmark
- For goals with `clinician_rejected = true`:
  - Show red "Rejected" badge with the reason

### 7. Patient Waiting State UI

**File:** `frontend/src/pages/ChatPage.tsx`

After patient confirms a goal (clicks "Confirm Goal"):
- If `clinician_approved = false`: show a banner at the top of chat:
  > "Your goal has been submitted for review by your care team. You'll be notified once it's approved."
- Patient can still chat with the coach while waiting
- GoalCard shows "Submitted for review" instead of "Goal confirmed!"

**File:** `frontend/src/components/cards/GoalCard.tsx`
- Add new state: confirmed but not yet approved → show "Waiting for clinician review" with a clock icon
- If rejected: show rejection reason and prompt to set a new goal

### 8. Goal Rejection Flow in Coach

**File:** `app/graphs/onboarding.py`
- Add to system prompt: if the patient's previous goal was rejected by the clinician, acknowledge the feedback, share the rejection reason, and help them set a revised goal

### 9. Frontend API & Types Updates

**File:** `frontend/src/lib/types.ts`
- Update `Goal` interface:
  ```typescript
  clinician_approved: boolean
  clinician_rejected: boolean
  rejection_reason: string | null
  reviewed_at: string | null
  ```

**File:** `frontend/src/lib/api.ts`
- Add `approveGoal(goalId: number): Promise<Goal>`
- Add `rejectGoal(goalId: number, reason: string): Promise<Goal>`
- Add `assignProgram(patientId: number, programType: string): Promise<void>`
- Add `removeProgram(patientId: number): Promise<void>`
- Add `getAvailablePrograms(): Promise<Program[]>`

### 10. Backend Response Model Update

**File:** `app/api/goals.py`
- Update `GoalResponse` to include new fields: `clinician_approved`, `clinician_rejected`, `rejection_reason`, `reviewed_at`

## Out of Scope

- Custom exercise creation (only the 5 predefined programs)
- Clinician creating patients from the dashboard (patients self-register)
- Email/push notifications when goal is approved/rejected (future enhancement)
- Bulk goal approval

## Testing

- Backend: test approve/reject endpoints, phase transition guards, tool filtering
- Frontend: test GoalCard states, program assignment UI, approval buttons
- Integration: full flow from program assignment → onboarding → goal → approval → ACTIVE
