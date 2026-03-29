# CareArc — AI-Powered Physical Therapy Companion

CareArc is a full-stack web application that pairs physical therapy patients with an AI coaching assistant. It combines a conversational rehab coach (powered by LLMs via LangGraph) with a clinician dashboard for monitoring patient engagement, adherence, and outcomes — all built with HIPAA-compliant guardrails.

## What It Does

### For Patients
- **AI Coach Chat** — Conversational assistant that guides patients through their rehab program using motivational interviewing techniques
- **Personalized Exercise Programs** — 16 MedBridge-sourced programs (knee, hip, shoulder, back, ankle, post-surgical) with embedded YouTube video demos
- **Progress Tracking** — Daily exercise logging, streaks, adherence percentages, and video watch progress
- **Smart Reminders** — Configurable reminder schedules with email notifications
- **Direct Messaging** — Secure messaging channel to their clinician

### For Clinicians
- **Patient Roster** — Overview of all patients with real-time adherence and risk indicators
- **Analytics Dashboard** — Attention list, adherence heatmaps, program effectiveness metrics, and engagement signals
- **Patient Detail View** — Deep dive into individual patient progress, conversation history, video engagement, and clinical notes
- **Exercise Library** — Browse and manage the full exercise catalog
- **Risk Alerts** — Automated disengagement detection with configurable alert thresholds

### AI & Safety
- **LangGraph State Machine** — Multi-phase coaching flow (onboarding, active coaching, re-engagement) with tool-calling agents
- **Safety Pipeline** — Real-time message classification for crisis detection, medical red flags, and scope boundaries
- **Motivational Interviewing** — LLM prompts grounded in MI guidelines for empathetic, evidence-based coaching
- **Consent Gate** — HIPAA-compliant consent flow before any data collection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Vite |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy (async), Alembic |
| **AI/LLM** | LangGraph, LangChain, OpenRouter (Claude Haiku 4.5) |
| **Auth** | Firebase Authentication (patient & clinician roles) |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Observability** | Langfuse (LLM tracing), structured audit logging |
| **Email** | Resend API (reminders, digests) |
| **Rate Limiting** | Redis (prod) / in-memory (dev) |

## Project Structure

```
├── app/                    # Backend (FastAPI)
│   ├── api/                # REST endpoints (auth, coach, patients, analytics, alerts, messaging, goals, risk, health)
│   ├── graphs/             # LangGraph coaching flows (router, active, onboarding, re-engaging)
│   ├── middleware/          # Auth, audit logging, rate limiting, security headers
│   ├── models/             # SQLAlchemy ORM models (patient, goal, messages, exercise logs, video watch logs, etc.)
│   ├── services/           # Business logic (coach, safety pipeline, risk scoring, scheduler, email, nudge engine)
│   ├── tools/              # LangGraph tool definitions for the AI coach
│   └── data/               # Static data (exercise programs, adherence helpers)
├── frontend/               # Frontend (React + Vite)
│   └── src/
│       ├── components/     # Reusable UI (ChatInput, ExerciseCard, ConsentScreen, clinician widgets)
│       ├── contexts/       # React contexts (Auth)
│       ├── hooks/          # Custom hooks (usePatient)
│       ├── layouts/        # App shell, sidebar, patient header
│       ├── lib/            # API client, types, Firebase config
│       └── pages/          # Route pages (Chat, Program, Progress, Dashboard, Analytics, etc.)
├── alembic/                # Database migrations
├── tests/                  # Backend test suite (pytest)
├── pyproject.toml          # Python project config
└── Dockerfile              # Production container
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenRouter API key (or OpenAI key)
- A Firebase project (for authentication)

### 1. Clone the repo

```bash
git clone https://github.com/spathak-droid/Medbridge-v2.git
cd Medbridge-v2
```

### 2. Backend setup

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Configure environment
cp .env.example .env
# Edit .env with your API keys (at minimum: OPEN_ROUTER_API_KEY, Firebase config)

# Run database migrations
alembic upgrade head

# Start the backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Firebase setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** authentication
3. Download your service account key and save it as `firebase-service-account.json` in the project root
4. Add your Firebase client config values to `.env`

### 5. Create your first accounts

1. Open `http://localhost:5173` in your browser
2. Sign up as a **Clinician** first (this creates the clinician account)
3. Open a separate browser/incognito window and sign up as a **Patient**
4. The patient will go through consent, then can start chatting with the AI coach
5. The clinician can see the patient in their dashboard

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPEN_ROUTER_API_KEY` | Yes | OpenRouter API key for LLM access |
| `OPEN_ROUTER_MODEL` | No | Model to use (default: `anthropic/claude-haiku-4.5`) |
| `DATABASE_URL` | No | Database URL (default: SQLite `./medbridge.db`) |
| `FIREBASE_API_KEY` | Yes | Firebase client API key |
| `FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes | Path to Firebase service account JSON |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins |
| `REDIS_URL` | No | Redis URL for rate limiting (falls back to in-memory) |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `LANGFUSE_SECRET_KEY` | No | Langfuse secret key for LLM observability |
| `LANGFUSE_PUBLIC_KEY` | No | Langfuse public key |

## Running Tests

```bash
# Backend tests
pytest

# Frontend tests
cd frontend && npm test

# Type checking
cd frontend && npm run typecheck
```

## Production Deployment

### Docker

```bash
docker build -t carearc .
docker run -p 8000:8000 --env-file .env carearc
```

### Frontend build

```bash
cd frontend
npm run build
# Serve the dist/ folder with any static file server
npx serve -s dist -l 3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register patient or clinician |
| `POST` | `/api/coach/chat` | Send message to AI coach |
| `GET` | `/api/patients/{id}/program` | Get patient's exercise program |
| `POST` | `/api/patients/{id}/exercises/{eid}/log` | Log exercise completion |
| `GET` | `/api/analytics/v2` | Clinician analytics dashboard data |
| `GET` | `/api/patients/{id}/risk` | Patient risk assessment |
| `GET/POST` | `/api/messages/...` | Direct messaging (patient-clinician) |
| `GET` | `/api/alerts` | Disengagement alerts |
| `GET` | `/api/health` | Health check |

Full API documentation available at `/docs` when the server is running.

## License

Private — All rights reserved.
