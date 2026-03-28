# Clinician Program Management & Goal Approval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clinicians create patients with assigned programs; patients sign up via email match; goals require clinician approval before ACTIVE phase.

**Architecture:** Patient model gets nullable `external_id` (set on signup) and required `email`. Goal model gets approval fields. `assign_program` tool removed from coach. New create-patient and goal approve/reject endpoints. Frontend adds "Add Patient" modal on clinician dashboard and goal approval UI on patient detail page. Patient signup gates on email match.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-28-clinician-program-management-goal-approval-design.md`

---

### Task 1: Database Migration — Patient model `external_id` nullable + Goal approval fields

**Files:**
- Modify: `app/models/patient.py`
- Modify: `app/models/goal.py`
- Create: `alembic/versions/e5f6a7b8c9d0_clinician_goal_approval.py`

- [ ] **Step 1: Update Patient model — make `external_id` nullable**

In `app/models/patient.py`, change line 15:

```python
# Before:
external_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)

# After:
external_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
```

- [ ] **Step 2: Update Goal model — add approval fields**

In `app/models/goal.py`, add after line 17 (`confirmed` field):

```python
    clinician_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    clinician_rejected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rejection_reason: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
```

- [ ] **Step 3: Generate alembic migration**

Run:
```bash
cd /Users/san/Desktop/Gauntlet/Medbridge-v2
source .venv/bin/activate
alembic revision --autogenerate -m "clinician goal approval and nullable external_id"
```

Review the generated migration to ensure it:
- Makes `patients.external_id` nullable
- Adds `goals.clinician_approved` (bool, default false)
- Adds `goals.clinician_rejected` (bool, default false)
- Adds `goals.rejection_reason` (string, nullable)
- Adds `goals.reviewed_at` (datetime, nullable)

- [ ] **Step 4: Run migration**

```bash
alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
git add app/models/patient.py app/models/goal.py alembic/versions/
git commit -m "feat: add goal approval fields and make external_id nullable"
```

---

### Task 2: Backend — Clinician creates patient endpoint

**Files:**
- Modify: `app/api/patients.py`
- Create: `tests/test_create_patient.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_create_patient.py`:

```python
"""Tests for clinician create-patient endpoint."""
import pytest
from httpx import AsyncClient

from app.models.patient import Patient
from app.models.enums import PatientPhase
from app.data.programs import PROGRAMS


@pytest.fixture
def create_body():
    return {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "program_type": "knee_rehab_post_surgical",
    }


class TestCreatePatient:
    """POST /api/patients/create"""

    @pytest.mark.asyncio
    async def test_creates_patient_with_program(self, client: AsyncClient, create_body, session):
        resp = await client.post("/api/patients/create", json=create_body)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Jane Smith"
        assert data["phase"] == "PENDING"
        assert data["consent_given"] is False

    @pytest.mark.asyncio
    async def test_rejects_invalid_program_type(self, client: AsyncClient):
        resp = await client.post("/api/patients/create", json={
            "name": "Jane", "email": "jane@example.com", "program_type": "invalid_program",
        })
        assert resp.status_code == 400
        assert "program" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_rejects_duplicate_email(self, client: AsyncClient, create_body, session):
        await client.post("/api/patients/create", json=create_body)
        resp = await client.post("/api/patients/create", json=create_body)
        assert resp.status_code == 409
        assert "email" in resp.json()["detail"].lower()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_create_patient.py -v
```
Expected: FAIL — endpoint does not exist yet.

- [ ] **Step 3: Implement the endpoint**

In `app/api/patients.py`, add the following after the imports section. First add the request/response models:

```python
from app.data.programs import PROGRAMS


class CreatePatientRequest(BaseModel):
    name: str
    email: str
    program_type: str


class CreatePatientResponse(BaseModel):
    id: int
    name: str
    email: str
    program_type: str
    phase: str
    consent_given: bool
```

Then add the endpoint:

```python
@router.post("/create", response_model=CreatePatientResponse)
async def create_patient(
    body: CreatePatientRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> CreatePatientResponse:
    """Clinician creates a patient record with an assigned exercise program.

    The patient can later sign up with the same email to link their account.
    """
    if body.program_type not in PROGRAMS:
        available = ", ".join(PROGRAMS.keys())
        raise HTTPException(status_code=400, detail=f"Invalid program type. Available: {available}")

    # Check for duplicate email
    existing = await session.execute(
        select(Patient).where(Patient.email == body.email)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A patient with this email already exists")

    patient = Patient(
        name=body.name,
        email=body.email,
        program_type=body.program_type,
        logged_in=False,
        consent_given=False,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    return CreatePatientResponse(
        id=patient.id,
        name=patient.name,
        email=patient.email or "",
        program_type=patient.program_type or "",
        phase=patient.phase.value,
        consent_given=patient.consent_given,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_create_patient.py -v
```
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/patients.py tests/test_create_patient.py
git commit -m "feat: add clinician create-patient endpoint"
```

---

### Task 3: Backend — Patient signup email matching gate

**Files:**
- Modify: `app/api/patients.py` (the `find_or_create_patient` function, lines 338-394)
- Modify: `frontend/src/pages/auth/PatientSignup.tsx`
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Update `find_or_create_patient` endpoint**

Replace the function body in `app/api/patients.py` (lines 338-394). The new logic:
1. Try to find by `firebase_uid` (returning user) → return as-is
2. If not found, try to find by `email` (new signup matching clinician-created record)
3. If found by email → link the record (set `external_id = firebase_uid`)
4. If not found at all → return 403

```python
@router.post("/me", response_model=PatientListItem)
async def find_or_create_patient(
    body: FindOrCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(set_audit_user),
) -> PatientListItem:
    """Find patient by Firebase UID, or match by email for first-time signup.

    Patients can only sign up if a clinician has pre-created their record.
    """
    clean_name = body.name

    # 1. Try to find by Firebase UID (returning user)
    result = await session.execute(
        select(Patient).where(Patient.external_id == body.firebase_uid)
    )
    patient = result.scalar_one_or_none()

    if patient is None:
        # 2. Try to match by email (first-time signup linking to clinician-created record)
        email = user.email  # from Firebase auth token
        if email:
            email_result = await session.execute(
                select(Patient).where(Patient.email == email)
            )
            patient = email_result.scalar_one_or_none()

        if patient is None:
            raise HTTPException(
                status_code=403,
                detail="Your clinician hasn't set up your account yet. Please contact your care team.",
            )

        # Link the clinician-created record to this Firebase UID
        patient.external_id = body.firebase_uid

    # Update name if provided and different
    if clean_name and patient.name != clean_name:
        patient.name = clean_name

    # Mark as logged in
    if not patient.logged_in:
        patient.logged_in = True

    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    # Adherence
    adh = get_adherence_for_patient(patient.external_id or "", patient.program_type)
    adh_pct = adh["adherence_percentage"] if adh and isinstance(adh, dict) else None

    # Latest confirmed goal
    goal_result = await session.execute(
        select(Goal)
        .where(Goal.patient_id == patient.id, Goal.confirmed == True)  # noqa: E712
        .order_by(Goal.created_at.desc())
    )
    goal = goal_result.scalars().first()

    return PatientListItem(
        id=patient.id,
        name=display_name(patient.name),
        external_id=patient.external_id or "",
        phase=patient.phase.value,
        consent_given=patient.consent_given,
        adherence_pct=adh_pct,
        goal_summary=goal.raw_text if goal else None,
    )
```

- [ ] **Step 2: Check that `AuthenticatedUser` has the `email` field**

Read `app/middleware/auth.py` to see if the `AuthenticatedUser` class has an `email` field from the JWT token. If not, add it:

```python
# In AuthenticatedUser class, ensure email is available:
email: str | None = None
```

And in the token decode logic, extract email from the JWT payload:

```python
email = payload.get("email")
```

- [ ] **Step 3: Update PatientSignup.tsx to handle the 403 error**

In `frontend/src/pages/auth/PatientSignup.tsx`, update the catch block in `handleSubmit` (around line 30):

```typescript
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed'
      // Check if this is a "clinician hasn't set up account" error
      if (msg.includes("clinician hasn't set up")) {
        setError("Your clinician hasn't set up your account yet. Please contact your care team.")
      } else {
        setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
      }
    } finally {
```

- [ ] **Step 4: Verify the error propagates from AuthContext**

In `frontend/src/contexts/AuthContext.tsx`, the `signUp` function (line 189) calls `registerRole` and then the frontend calls `/api/patients/me`. Check where `/api/patients/me` is called and ensure the 403 error propagates to the signup page. The error from `apiFetch` should throw and be caught by the signup form's try/catch.

- [ ] **Step 5: Commit**

```bash
git add app/api/patients.py app/middleware/auth.py frontend/src/pages/auth/PatientSignup.tsx frontend/src/contexts/AuthContext.tsx
git commit -m "feat: gate patient signup on clinician-created email record"
```

---

### Task 4: Backend — Remove `assign_program` from coach tools

**Files:**
- Modify: `app/tools/coach_tools.py`
- Modify: `app/services/coach_service.py`
- Modify: `app/graphs/onboarding.py`

- [ ] **Step 1: Remove `assign_program` tool from `make_coach_tools`**

In `app/tools/coach_tools.py`, delete the entire `assign_program` function (lines 218-252) and update the return statement (line 254):

```python
# Before:
    return [set_goal, set_reminder, assign_program, get_program_summary, get_adherence_summary, alert_clinician]

# After:
    return [set_goal, set_reminder, get_program_summary, get_adherence_summary, alert_clinician]
```

- [ ] **Step 2: Update tool filtering in `coach_service.py`**

In `app/services/coach_service.py`, update both tool filtering blocks (lines 138-145 and 271-277). Since `assign_program` no longer exists, simplify:

```python
# Lines 138-145 (run_coach_turn):
    # Build tools bound to this session and patient, filtered by phase
    all_tools = make_coach_tools(session, patient_id)
    if patient.phase == PatientPhase.ONBOARDING:
        # Onboarding can use set_goal
        tools = all_tools
    else:
        # Active/re-engaging: no goal setting
        tools = [t for t in all_tools if t.name != "set_goal"]

# Lines 271-277 (run_coach_turn_stream):
    # Build tools bound to this session and patient, filtered by phase
    all_tools = make_coach_tools(session, patient_id)
    if patient.phase == PatientPhase.ONBOARDING:
        tools = all_tools
    else:
        tools = [t for t in all_tools if t.name != "set_goal"]
```

- [ ] **Step 3: Update onboarding system prompt**

In `app/graphs/onboarding.py`, replace `ONBOARDING_SYSTEM_PROMPT` (lines 26-63):

```python
ONBOARDING_SYSTEM_PROMPT = (
    "You are a supportive rehabilitation coach onboarding a new patient.\n\n"
    "Your job is to guide the patient through these steps:\n"
    "1. Welcome the patient warmly\n"
    "2. Use the get_program_summary tool to look up their assigned exercise program, "
    "then describe the exercises they'll be doing in an encouraging way\n"
    "3. Help them set a specific, achievable exercise goal based on their program\n"
    "4. When they agree to a goal, use the set_goal tool to save it WITH ALL "
    "detail fields filled in:\n"
    "   - goal_text: The specific goal (e.g. 'Complete knee rehab exercises 5 days a week "
    "for 20 minutes')\n"
    "   - instructions: Numbered step-by-step instructions on how to achieve this goal safely. "
    "Include warm-up, technique tips, and progression advice (at least 4-5 steps).\n"
    "   - precautions: Safety warnings and when to seek medical attention. Include specific "
    "warning signs like sharp pain, swelling, dizziness, numbness. Always end with "
    "'Contact your care team immediately if symptoms persist.'\n"
    "   - video_url: A relevant YouTube video URL for the exercise type. Use real, well-known "
    "physical therapy YouTube channels like Bob & Brad, AskDoctorJo, or PhysioTutors. "
    "Provide the full URL.\n"
    "   - video_title: A descriptive title for the video.\n\n"
    "IMPORTANT: The patient's exercise program has already been assigned by their clinician. "
    "Do NOT try to change or reassign their program. If no program is found, tell the patient "
    "their clinician hasn't set up their exercise program yet and to check back later or "
    "message their care team.\n\n"
    "Guidelines:\n"
    "- Be warm, encouraging, and conversational\n"
    "- Keep responses concise (2-3 sentences)\n"
    "- If the patient gives an unrealistic goal (e.g., 'run a marathon tomorrow'), "
    "gently guide them toward something achievable\n"
    "- If the patient refuses to commit to a goal, acknowledge that and offer to "
    "revisit later — don't push\n"
    "- If the patient asks clinical questions (about symptoms, medication, diagnosis), "
    "redirect them to their care team\n"
    "- Never provide clinical advice, diagnoses, or medication recommendations\n"
    "- Focus on exercise adherence and motivation, not clinical outcomes"
) + MI_OARS_GUIDELINES + ONBOARDING_MI_TIPS
```

- [ ] **Step 4: Run backend tests to check nothing broke**

```bash
pytest tests/test_coach_tools.py tests/test_active_graph.py tests/test_onboarding_graph.py -v
```

Fix any tests that reference `assign_program`.

- [ ] **Step 5: Commit**

```bash
git add app/tools/coach_tools.py app/services/coach_service.py app/graphs/onboarding.py
git commit -m "feat: remove assign_program from coach, update onboarding prompt"
```

---

### Task 5: Backend — Goal approval and rejection endpoints

**Files:**
- Modify: `app/api/goals.py`
- Create: `tests/test_goal_approval.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_goal_approval.py`:

```python
"""Tests for goal approval and rejection endpoints."""
import pytest
from sqlalchemy import select
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.enums import PatientPhase


@pytest.fixture
async def patient_with_goal(session):
    """Create a patient in ONBOARDING with a confirmed but unapproved goal."""
    patient = Patient(
        external_id="test-uid-approval",
        name="Test Patient",
        email="test@example.com",
        phase=PatientPhase.ONBOARDING,
        consent_given=True,
        logged_in=True,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    goal = Goal(
        patient_id=patient.id,
        raw_text="Walk 20 minutes 3 times a week",
        confirmed=True,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    return patient, goal


class TestApproveGoal:
    """POST /api/goals/{goal_id}/approve"""

    @pytest.mark.asyncio
    async def test_approves_goal_and_transitions_to_active(self, client, patient_with_goal, session):
        patient, goal = patient_with_goal
        resp = await client.post(f"/api/goals/{goal.id}/approve")
        assert resp.status_code == 200
        data = resp.json()
        assert data["clinician_approved"] is True
        assert data["reviewed_at"] is not None

        # Patient should now be ACTIVE
        result = await session.execute(select(Patient).where(Patient.id == patient.id))
        p = result.scalar_one()
        assert p.phase == PatientPhase.ACTIVE

    @pytest.mark.asyncio
    async def test_approve_without_patient_confirm_does_not_transition(self, client, session):
        patient = Patient(
            external_id="test-uid-no-confirm",
            name="No Confirm",
            email="noconfirm@example.com",
            phase=PatientPhase.ONBOARDING,
            consent_given=True,
            logged_in=True,
        )
        session.add(patient)
        await session.commit()
        await session.refresh(patient)
        goal = Goal(patient_id=patient.id, raw_text="Test goal", confirmed=False)
        session.add(goal)
        await session.commit()
        await session.refresh(goal)

        resp = await client.post(f"/api/goals/{goal.id}/approve")
        assert resp.status_code == 200
        data = resp.json()
        assert data["clinician_approved"] is True

        # Patient should still be ONBOARDING (not confirmed by patient yet)
        result = await session.execute(select(Patient).where(Patient.id == patient.id))
        p = result.scalar_one()
        assert p.phase == PatientPhase.ONBOARDING


class TestRejectGoal:
    """POST /api/goals/{goal_id}/reject"""

    @pytest.mark.asyncio
    async def test_rejects_goal_with_reason(self, client, patient_with_goal):
        _, goal = patient_with_goal
        resp = await client.post(f"/api/goals/{goal.id}/reject", json={"reason": "Too ambitious"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["clinician_rejected"] is True
        assert data["rejection_reason"] == "Too ambitious"
        assert data["confirmed"] is False  # Reset so patient can redo

    @pytest.mark.asyncio
    async def test_reject_returns_404_for_missing_goal(self, client):
        resp = await client.post("/api/goals/99999/reject", json={"reason": "test"})
        assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_goal_approval.py -v
```
Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 3: Update `GoalResponse` model and add endpoints**

In `app/api/goals.py`, update the `GoalResponse` model:

```python
class GoalResponse(BaseModel):
    id: int
    patient_id: int
    raw_text: str
    structured_goal: dict | None = None
    confirmed: bool
    clinician_approved: bool = False
    clinician_rejected: bool = False
    rejection_reason: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
```

Add a rejection request model:

```python
class RejectGoalRequest(BaseModel):
    reason: str
```

Add the approve endpoint:

```python
@router.post("/{goal_id}/approve", response_model=GoalResponse)
async def approve_goal(
    goal_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Clinician approves a patient's goal.

    If the goal is also confirmed by the patient, transitions to ACTIVE
    and schedules follow-up check-ins.
    """
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.clinician_approved = True
    goal.reviewed_at = datetime.now(timezone.utc)
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    # If both patient confirmed AND clinician approved → transition to ACTIVE
    if goal.confirmed:
        patient_result = await session.execute(
            select(Patient).where(Patient.id == goal.patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient and patient.phase == PatientPhase.ONBOARDING:
            try:
                machine = PhaseStateMachine(session)
                await machine.transition(patient.id, PatientPhase.ACTIVE)
            except Exception:
                logger.warning("Phase transition ONBOARDING→ACTIVE failed for patient %s", patient.id)

            # Schedule follow-ups
            try:
                await schedule_followups(
                    session, patient.id, onboarding_completed_at=datetime.now(timezone.utc),
                )
            except Exception:
                logger.exception("Failed to schedule follow-ups for patient %s", patient.id)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        clinician_approved=goal.clinician_approved,
        clinician_rejected=goal.clinician_rejected,
        rejection_reason=goal.rejection_reason,
        reviewed_at=goal.reviewed_at,
        created_at=goal.created_at,
    )
```

Add the reject endpoint:

```python
@router.post("/{goal_id}/reject", response_model=GoalResponse)
async def reject_goal(
    goal_id: int,
    body: RejectGoalRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Clinician rejects a patient's goal with a reason.

    Resets the patient confirmation so they can set a new goal.
    """
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.clinician_rejected = True
    goal.rejection_reason = body.reason
    goal.reviewed_at = datetime.now(timezone.utc)
    goal.confirmed = False  # Reset so patient can set a new goal
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        clinician_approved=goal.clinician_approved,
        clinician_rejected=goal.clinician_rejected,
        rejection_reason=goal.rejection_reason,
        reviewed_at=goal.reviewed_at,
        created_at=goal.created_at,
    )
```

- [ ] **Step 4: Update the existing `confirm_goal` endpoint**

Replace the `confirm_goal` function body. Remove the phase transition and follow-up scheduling from here — those now happen in `approve_goal`:

```python
@router.post("/{goal_id}/confirm", response_model=GoalResponse)
async def confirm_goal(
    goal_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Patient confirms their goal.

    If the clinician has already approved it, transitions to ACTIVE.
    Otherwise, the goal waits for clinician approval.
    """
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Consent gate
    patient_result = await session.execute(
        select(Patient).where(Patient.id == goal.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if patient:
        if not patient.logged_in:
            raise HTTPException(status_code=403, detail="Patient must be logged in")
        if not patient.consent_given:
            raise HTTPException(status_code=403, detail="Patient consent required for coaching")

    goal.confirmed = True
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    # If clinician already approved → transition to ACTIVE
    if goal.clinician_approved and patient and patient.phase == PatientPhase.ONBOARDING:
        try:
            machine = PhaseStateMachine(session)
            await machine.transition(patient.id, PatientPhase.ACTIVE)
        except Exception:
            logger.warning("Phase transition ONBOARDING→ACTIVE failed for patient %s", patient.id)

        try:
            await schedule_followups(
                session, patient.id, onboarding_completed_at=datetime.now(timezone.utc),
            )
        except Exception:
            logger.exception("Failed to schedule follow-ups for patient %s", patient.id)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        clinician_approved=goal.clinician_approved,
        clinician_rejected=goal.clinician_rejected,
        rejection_reason=goal.rejection_reason,
        reviewed_at=goal.reviewed_at,
        created_at=goal.created_at,
    )
```

- [ ] **Step 5: Update the goals list endpoint to return new fields**

Find where goals are returned in `app/api/patients.py` (the `GET /api/patients/{id}/goals` endpoint) and ensure the response includes the new fields. Update the response model there too.

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_goal_approval.py -v
```
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/goals.py tests/test_goal_approval.py app/api/patients.py
git commit -m "feat: add goal approve/reject endpoints, update confirm flow"
```

---

### Task 6: Backend — Update phase machine guard

**Files:**
- Modify: `app/services/phase_machine.py`

- [ ] **Step 1: Update the ONBOARDING → ACTIVE guard**

In `app/services/phase_machine.py`, update the guard check (lines 107-119):

```python
        elif from_phase == PatientPhase.ONBOARDING and target_phase == PatientPhase.ACTIVE:
            result = await self._session.execute(
                select(Goal).where(
                    Goal.patient_id == patient.id,
                    Goal.confirmed == True,  # noqa: E712
                    Goal.clinician_approved == True,  # noqa: E712
                )
            )
            approved_goal = result.scalar_one_or_none()
            if approved_goal is None:
                raise TransitionError(
                    patient.id,
                    f"Patient {patient.id} has no confirmed and clinician-approved goal",
                    from_phase=from_phase,
                    to_phase=target_phase,
                )
```

- [ ] **Step 2: Run phase machine tests**

```bash
pytest tests/test_phase_machine.py -v
```

Update any tests that expect ONBOARDING→ACTIVE to work with only a confirmed goal — they now need `clinician_approved=True` as well.

- [ ] **Step 3: Commit**

```bash
git add app/services/phase_machine.py tests/test_phase_machine.py
git commit -m "feat: require clinician approval in ONBOARDING→ACTIVE guard"
```

---

### Task 7: Frontend — Update types and API functions

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Update Goal interface in types.ts**

In `frontend/src/lib/types.ts`, update the `Goal` interface:

```typescript
export interface Goal {
  id: number
  patient_id: number
  raw_text: string
  structured_goal?: GoalDetails | null
  confirmed: boolean
  clinician_approved: boolean
  clinician_rejected: boolean
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
}
```

- [ ] **Step 2: Add API functions in api.ts**

In `frontend/src/lib/api.ts`, add after the `confirmGoal` function:

```typescript
export function approveGoal(goalId: number): Promise<Goal> {
  return apiFetch<Goal>(`/api/goals/${goalId}/approve`, {
    method: 'POST',
  })
}

export function rejectGoal(goalId: number, reason: string): Promise<Goal> {
  return apiFetch<Goal>(`/api/goals/${goalId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function createPatient(name: string, email: string, programType: string): Promise<{ id: number; name: string; email: string; program_type: string; phase: string; consent_given: boolean }> {
  return apiFetch(`/api/patients/create`, {
    method: 'POST',
    body: JSON.stringify({ name, email, program_type: programType }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add goal approval types and API functions"
```

---

### Task 8: Frontend — Add Patient modal on Clinician Dashboard

**Files:**
- Modify: `frontend/src/pages/ClinicianDashboard.tsx`

- [ ] **Step 1: Add state and modal for creating a patient**

In `ClinicianDashboard.tsx`, add state variables after the existing state declarations (around line 19):

```typescript
const [showAddPatient, setShowAddPatient] = useState(false)
const [newPatientName, setNewPatientName] = useState('')
const [newPatientEmail, setNewPatientEmail] = useState('')
const [newPatientProgram, setNewPatientProgram] = useState('')
const [addingPatient, setAddingPatient] = useState(false)
const [addPatientError, setAddPatientError] = useState('')
```

Add the import at the top:
```typescript
import { createPatient, getAlerts, getAnalyticsV2, getPatients, getRiskScores, acknowledgeAlert, getAvailablePrograms } from '../lib/api'
```

Add available programs state and fetch:
```typescript
const [availablePrograms, setAvailablePrograms] = useState<{ program_type: string; program_name: string; exercise_count: number }[]>([])

// In the useEffect/fetchDashboard, add:
getAvailablePrograms().then(setAvailablePrograms).catch(() => {})
```

- [ ] **Step 2: Add the "Add Patient" button next to the heading**

Replace the heading (line 101):

```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-xl font-bold text-neutral-800">My Patients</h2>
  <button
    onClick={() => setShowAddPatient(true)}
    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    Add Patient
  </button>
</div>
```

- [ ] **Step 3: Add the modal component**

Add the modal JSX right after the heading div, before the summary stats row:

```tsx
{showAddPatient && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <h3 className="text-lg font-bold text-neutral-800 mb-4">Add New Patient</h3>
      {addPatientError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {addPatientError}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
          <input
            type="text"
            value={newPatientName}
            onChange={(e) => setNewPatientName(e.target.value)}
            className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Patient name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
          <input
            type="email"
            value={newPatientEmail}
            onChange={(e) => setNewPatientEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="patient@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Exercise Program</label>
          <select
            value={newPatientProgram}
            onChange={(e) => setNewPatientProgram(e.target.value)}
            className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">Select a program...</option>
            {availablePrograms.map((p) => (
              <option key={p.program_type} value={p.program_type}>
                {p.program_name} ({p.exercise_count} exercises)
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            setShowAddPatient(false)
            setAddPatientError('')
            setNewPatientName('')
            setNewPatientEmail('')
            setNewPatientProgram('')
          }}
          className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl text-sm font-medium hover:bg-neutral-50 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          disabled={addingPatient || !newPatientName || !newPatientEmail || !newPatientProgram}
          onClick={async () => {
            setAddingPatient(true)
            setAddPatientError('')
            try {
              await createPatient(newPatientName, newPatientEmail, newPatientProgram)
              setShowAddPatient(false)
              setNewPatientName('')
              setNewPatientEmail('')
              setNewPatientProgram('')
              fetchDashboard()
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to create patient'
              setAddPatientError(msg)
            } finally {
              setAddingPatient(false)
            }
          }}
          className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 cursor-pointer"
        >
          {addingPatient ? 'Creating...' : 'Create Patient'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ClinicianDashboard.tsx
git commit -m "feat: add 'Add Patient' modal on clinician dashboard"
```

---

### Task 9: Frontend — Goal approval UI on PatientDetailPage

**Files:**
- Modify: `frontend/src/pages/PatientDetailPage.tsx`

- [ ] **Step 1: Add imports and state for goal approval**

Add to imports:
```typescript
import { approveGoal, rejectGoal } from '../lib/api'
```

Add state near other state declarations:
```typescript
const [rejectingGoalId, setRejectingGoalId] = useState<number | null>(null)
const [rejectReason, setRejectReason] = useState('')
const [goalActionLoading, setGoalActionLoading] = useState(false)
```

- [ ] **Step 2: Replace the Patient Goals section**

Replace the existing "Patient Goals" section (lines 379-402) with:

```tsx
{goals.length > 0 && (
  <div className="card p-5">
    <h3 className="text-sm font-bold text-neutral-800 mb-3">Patient Goals</h3>
    <div className="space-y-3">
      {goals.map(g => (
        <div key={g.id} className="border border-neutral-100 rounded-xl p-3">
          <div className="flex items-start gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              g.clinician_approved ? 'bg-green-100 text-green-600'
                : g.clinician_rejected ? 'bg-red-100 text-red-600'
                : g.confirmed ? 'bg-amber-100 text-amber-600'
                : 'bg-neutral-100 text-neutral-400'
            }`}>
              {g.clinician_approved ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : g.clinician_rejected ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-neutral-600">{g.raw_text}</p>
              {g.clinician_approved && (
                <span className="text-[10px] font-medium text-green-600 mt-1 inline-block">Approved</span>
              )}
              {g.clinician_rejected && (
                <div className="mt-1">
                  <span className="text-[10px] font-medium text-red-600">Rejected</span>
                  {g.rejection_reason && (
                    <p className="text-[11px] text-red-500 mt-0.5">Reason: {g.rejection_reason}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pending review: show approve/reject buttons */}
          {g.confirmed && !g.clinician_approved && !g.clinician_rejected && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] font-medium text-amber-600">Pending your review</span>
              </div>
              {rejectingGoalId === g.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={goalActionLoading || !rejectReason.trim()}
                      onClick={async () => {
                        setGoalActionLoading(true)
                        try {
                          await rejectGoal(g.id, rejectReason)
                          setRejectingGoalId(null)
                          setRejectReason('')
                          fetchGoals()
                        } catch {}
                        setGoalActionLoading(false)
                      }}
                      className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setRejectingGoalId(null); setRejectReason('') }}
                      className="py-1.5 px-3 text-neutral-500 text-xs font-medium hover:bg-neutral-50 rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    disabled={goalActionLoading}
                    onClick={async () => {
                      setGoalActionLoading(true)
                      try {
                        await approveGoal(g.id)
                        fetchGoals()
                        fetchPatient()
                      } catch {}
                      setGoalActionLoading(false)
                    }}
                    className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    disabled={goalActionLoading}
                    onClick={() => setRejectingGoalId(g.id)}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Ensure `fetchGoals` and `fetchPatient` functions exist**

Check if there are already functions to refetch goals and patient data on this page. If goals are fetched in a `useEffect`, extract the fetch into a named function (e.g., `fetchGoals`) that can be called after approval/rejection. Same for patient data.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PatientDetailPage.tsx
git commit -m "feat: add goal approve/reject UI on patient detail page"
```

---

### Task 10: Frontend — Patient waiting state in GoalCard and ChatPage

**Files:**
- Modify: `frontend/src/components/cards/GoalCard.tsx`
- Modify: `frontend/src/pages/ChatPage.tsx`

- [ ] **Step 1: Update GoalCard to show approval states**

In `frontend/src/components/cards/GoalCard.tsx`, add new props:

```typescript
interface GoalCardProps {
  goalText: string
  confirmed: boolean
  clinicianApproved?: boolean
  clinicianRejected?: boolean
  rejectionReason?: string | null
  structuredGoal?: GoalDetails | null
  onConfirm: () => void
  onEdit: () => void
}
```

Update the component to show different states:
- `confirmed && !clinicianApproved && !clinicianRejected` → "Submitted for review. Your care team will review your goal shortly."
- `clinicianApproved` → "Goal approved! You're all set."
- `clinicianRejected` → "Your care team suggested changes: {rejectionReason}. Let's set a new goal." with the Edit button visible.

- [ ] **Step 2: Update ChatPage to pass new props to GoalCard**

In `frontend/src/pages/ChatPage.tsx`, update the GoalCard usage (around line 376):

```tsx
<GoalCard
  goalText={msg.metadata.goal_text}
  confirmed={confirmedGoalIds.has(msg.metadata.goal_id)}
  clinicianApproved={goalsMap.get(msg.metadata.goal_id)?.clinician_approved}
  clinicianRejected={goalsMap.get(msg.metadata.goal_id)?.clinician_rejected}
  rejectionReason={goalsMap.get(msg.metadata.goal_id)?.rejection_reason}
  structuredGoal={goalsMap.get(msg.metadata.goal_id)?.structured_goal}
  onConfirm={() =>
    handleConfirmGoal(msg.metadata!.goal_id!, msg.metadata!.goal_text!)
  }
  onEdit={() =>
    handleEditGoal(msg.metadata!.goal_text!)
  }
/>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/GoalCard.tsx frontend/src/pages/ChatPage.tsx
git commit -m "feat: show goal approval status in patient chat UI"
```

---

### Task 11: Frontend — Clinician program management on PatientDetailPage

**Files:**
- Modify: `frontend/src/pages/PatientDetailPage.tsx`

- [ ] **Step 1: Add program management to the Current Program section**

Update the "Current Program" card (around lines 352-377) to include assign/change/remove buttons. Add state:

```typescript
const [showProgramSelect, setShowProgramSelect] = useState(false)
const [programLoading, setProgramLoading] = useState(false)
```

Add to imports:
```typescript
import { assignProgram, clearProgram, getAvailablePrograms } from '../lib/api'
```

Replace the Current Program card with a version that shows:
- If no program: "No program assigned" + "Assign Program" button → opens dropdown of 5 programs
- If program assigned: program name + "Change" and "Remove" buttons
- "Change" opens the same dropdown, "Remove" calls `clearProgram`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/PatientDetailPage.tsx
git commit -m "feat: add clinician program assign/change/remove UI"
```

---

### Task 12: Run full test suite and fix breakages

**Files:** Various test files

- [ ] **Step 1: Run backend tests**

```bash
cd /Users/san/Desktop/Gauntlet/Medbridge-v2
source .venv/bin/activate
pytest tests/ -v --tb=short 2>&1 | tail -40
```

Fix any tests that broke due to:
- `assign_program` tool removal
- `external_id` being nullable
- Goal model having new fields
- Phase machine requiring `clinician_approved`

- [ ] **Step 2: Run frontend tests**

```bash
cd frontend
npx vitest run
```

Fix any tests that broke due to Goal type changes.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: update tests for clinician program/goal approval changes"
```
