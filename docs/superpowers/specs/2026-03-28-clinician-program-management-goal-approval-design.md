# Clinician Program Management & Goal Approval

## Problem

The current implementation lets the AI coach assign exercise programs and set goals autonomously during onboarding. Per the project requirements, exercise programs are **prescribed by clinicians** — the coach should only reference already-assigned exercises and help patients set goals. Goals should require clinician approval before the patient transitions to ACTIVE. Additionally, patients currently self-register without any clinician involvement — the clinician should create the patient record (with program) first, and patients can only sign up if a record already exists for their email.

## Corrected Patient Flow

```
1. Clinician creates patient from dashboard (name, email, exercise program)
   → Patient record created in DB with program_type set, phase = PENDING
2. Patient signs up at /patient/signup with the SAME email
   → Matched to existing record. If no record exists → error: "Your clinician hasn't set up your account yet"
3. Patient logs in → consent screen
4. Coach references ALREADY-ASSIGNED exercises, helps patient set a goal
5. Patient confirms goal → goal sent to clinician for approval
6. Patient sees "Waiting for clinician review..." (stays in ONBOARDING)
7. Clinician approves goal → patient transitions to ACTIVE
   OR clinician rejects → patient can chat with coach to set a new goal
```

## Changes Required

### 1. Clinician Creates Patient (New)

**Backend: New endpoint in `app/api/patients.py`**

**`POST /api/patients/create`** (clinician-only)
- Request body: `{ name: string, email: string, program_type: string }`
- Validates `program_type` against available programs
- Validates email is not already taken
- Creates `Patient` record with:
  - `name` = provided name
  - `email` = provided email
  - `program_type` = provided program
  - `phase` = PENDING
  - `logged_in` = False
  - `consent_given` = False
  - `external_id` = NULL (set when patient signs up via Firebase)
- Returns created patient

**Frontend: Add "Add Patient" to clinician dashboard**

**File:** `frontend/src/pages/ClinicianDashboard.tsx`
- Add "Add Patient" button in the header area
- Opens a modal/form with:
  - Name (text input, required)
  - Email (email input, required)
  - Exercise Program (dropdown of 5 programs, required)
- On submit → calls `POST /api/patients/create`
- Patient appears in roster as PENDING

### 2. Patient Signup: Email Matching Gate

**Backend: Update `POST /api/patients/me` in `app/api/patients.py`**
- Current behavior: creates a new Patient if none found by `firebase_uid`
- New behavior:
  1. First try to find by `firebase_uid` (returning user) → return as-is
  2. If not found by UID, try to find by `email` (new signup matching clinician-created record)
     - If found → link the record: set `external_id = firebase_uid`, `logged_in = True`
     - If NOT found → return 403 error: "Your clinician hasn't set up your account yet. Please contact your care team."
  3. No longer creates new Patient records — only links to existing ones

**Frontend: Update `PatientSignup.tsx`**
- Catch the 403 error from the backend
- Display: "Your clinician hasn't set up your account yet. Please contact your care team."
- Patient cannot proceed until clinician creates their record

### 3. Remove `assign_program` from Coach Tools

**File:** `app/tools/coach_tools.py`
- Remove `assign_program` tool from `make_coach_tools()` return list entirely
- The coach should never assign programs in any phase

**File:** `app/services/coach_service.py`
- Update tool filtering: remove `assign_program` from all phases (not just active/re-engaging)
- `set_goal` remains available during ONBOARDING only (already implemented)

**File:** `app/graphs/onboarding.py`
- Update `ONBOARDING_SYSTEM_PROMPT`:
  - Remove all assign_program instructions
  - Step 1: Welcome patient warmly
  - Step 2: Use `get_program_summary` to reference their assigned exercises
  - Step 3: Help them set a specific, achievable exercise goal
  - Step 4: Use `set_goal` tool when they agree
  - Add instruction: if no program is assigned yet, tell patient their clinician hasn't set up their program and to check back later or message their care team
- Remove all references to `assign_program` from the prompt

**File:** `app/graphs/active.py`
- Remove `assign_program` references from system prompt (already partially done)

### 4. Goal Model: Add Clinician Approval Fields

**File:** `app/models/goal.py`
- Add fields:
  - `clinician_approved: bool = False` — whether clinician has approved
  - `clinician_rejected: bool = False` — whether clinician has rejected
  - `rejection_reason: str | None = None` — why it was rejected
  - `reviewed_at: datetime | None = None` — when clinician reviewed it

**Migration:** New alembic migration to add these columns to the `goals` table.

### 5. Goal Approval API Endpoints

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

### 6. Phase Machine Guard Update

**File:** `app/services/phase_machine.py`
- Update ONBOARDING → ACTIVE guard: require BOTH `goal.confirmed == True` AND `goal.clinician_approved == True`

### 7. Clinician Program Management UI

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

### 8. Clinician Goal Approval UI

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

### 9. Patient Waiting State UI

**File:** `frontend/src/pages/ChatPage.tsx`

After patient confirms a goal (clicks "Confirm Goal"):
- If `clinician_approved = false`: show a banner at the top of chat:
  > "Your goal has been submitted for review by your care team. You'll be notified once it's approved."
- Patient can still chat with the coach while waiting
- GoalCard shows "Submitted for review" instead of "Goal confirmed!"

**File:** `frontend/src/components/cards/GoalCard.tsx`
- Add new state: confirmed but not yet approved → show "Waiting for clinician review" with a clock icon
- If rejected: show rejection reason and prompt to set a new goal

### 10. Goal Rejection Flow in Coach

**File:** `app/graphs/onboarding.py`
- Add to system prompt: if the patient's previous goal was rejected by the clinician, acknowledge the feedback, share the rejection reason, and help them set a revised goal

### 11. Frontend API & Types Updates

**File:** `frontend/src/lib/types.ts`
- Update `Goal` interface:
  ```typescript
  clinician_approved: boolean
  clinician_rejected: boolean
  rejection_reason: string | null
  reviewed_at: string | null
  ```

**File:** `frontend/src/lib/api.ts`
- Add `createPatient(name: string, email: string, programType: string): Promise<Patient>`
- Add `approveGoal(goalId: number): Promise<Goal>`
- Add `rejectGoal(goalId: number, reason: string): Promise<Goal>`
- Add `assignProgram(patientId: number, programType: string): Promise<void>`
- Add `removeProgram(patientId: number): Promise<void>`
- Add `getAvailablePrograms(): Promise<Program[]>`

### 12. Backend Response Model Update

**File:** `app/api/goals.py`
- Update `GoalResponse` to include new fields: `clinician_approved`, `clinician_rejected`, `rejection_reason`, `reviewed_at`

## Out of Scope

- Custom exercise creation (only the 5 predefined programs)
- Email/push notifications when goal is approved/rejected (future enhancement)
- Bulk goal approval
- Clinician account management (clinicians self-register as before)

## Testing

- Backend: test patient creation endpoint, email matching gate, approve/reject endpoints, phase transition guards, tool filtering
- Frontend: test signup error for unregistered emails, GoalCard states, program assignment UI, approval buttons, add patient modal
- Integration: full flow from clinician creates patient → patient signs up → onboarding → goal → clinician approval → ACTIVE
