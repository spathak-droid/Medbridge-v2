# HIPAA Compliance Status — MedBridge v2

Last updated: 2026-03-24

## Third-Party Services Handling PHI

| Service | What PHI is Sent | BAA Status | Action Required |
|---------|-----------------|------------|-----------------|
| **OpenRouter** (LLM) | Patient conversations, goals, health data sent for AI coaching responses | **NO BAA available** | Migrate to Azure OpenAI (BAA available) or self-host LLM before production |
| **Langfuse** (Observability) | **Scrubbed** — only token counts, message counts, and metadata sent (no content) | N/A (no PHI sent) | None — PHI scrubbing implemented |
| **Firebase Auth** | Email addresses, UIDs | **BAA available** — Google Cloud BAA covers Firebase | Sign Google Cloud BAA via console.cloud.google.com |
| **Railway** (PostgreSQL) | All patient data (names, messages, goals, adherence) | **BAA available** — contact Railway support | Request BAA from Railway before storing real patient data |
| **Resend** (Email) | Patient email addresses, reminder content | **BAA available** — contact Resend | Request BAA from Resend |

## Critical Pre-Production Checklist

### Must Complete Before Any Real Patient Data

- [ ] **Sign BAA with Railway** for PostgreSQL hosting
- [ ] **Sign Google Cloud BAA** for Firebase Authentication
- [ ] **Migrate LLM provider** from OpenRouter to BAA-covered provider (Azure OpenAI, AWS Bedrock, or self-hosted)
- [ ] **Sign BAA with Resend** for email notifications
- [ ] **Enable PostgreSQL SSL** — ensure `sslmode=require` in DATABASE_URL
- [ ] **Enable PostgreSQL encryption at rest** — Railway provides this by default
- [ ] **Set `APP_ENV=production`** — disables demo auth bypass
- [ ] **Rotate all API keys** that were previously in version control
- [ ] **Configure CORS** to only allow production frontend domain

### Implemented Safeguards

- [x] **Encryption in transit** — HSTS headers enforced, HTTPS required
- [x] **Database migrated to PostgreSQL** — Railway-hosted with connection encryption
- [x] **PHI scrubbed from application logs** — only message lengths and classification types logged
- [x] **PHI scrubbed from Langfuse traces** — only token counts and metadata sent
- [x] **Consent gate** — verified on every AI coaching interaction
- [x] **Audit logging** — structured JSON audit trail for PHI access
- [x] **Safety classifier** — blocks clinical content and crisis detection
- [x] **Auth bypass defaults to OFF** — APP_ENV defaults to production
- [x] **Role-based access control** — patients can only access their own data
- [x] **Input validation** — length limits on all user-submitted content
- [x] **Security headers** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options

### Remaining Gaps (Production Hardening)

- [ ] Redis-backed rate limiting (current: in-memory, not distributed)
- [ ] Automated data retention/deletion policy
- [ ] Audit log integrity protection (hash chain)
- [ ] Session timeout / automatic logoff
- [ ] Clinician-patient assignment scoping (currently clinicians see all patients)
- [ ] Penetration testing
- [ ] HIPAA training documentation for operators

## LLM Provider Migration Path

OpenRouter does **not** offer HIPAA BAAs. Before production:

1. **Azure OpenAI** — Microsoft signs BAAs. Replace `OPENROUTER_BASE_URL` with Azure endpoint in `llm_provider.py`. Minimal code change.
2. **AWS Bedrock** — Amazon signs BAAs. Requires SDK change from HTTP to boto3.
3. **Self-hosted** — Run open-source model (e.g., Llama) on HIPAA-compliant infrastructure. Most effort but full control.

Recommended: **Azure OpenAI** — drop-in compatible with OpenAI API format, BAA available.
