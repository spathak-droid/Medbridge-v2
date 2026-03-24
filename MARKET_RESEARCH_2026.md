# AI-Powered Patient Coaching in Rehab/PT: Comprehensive Market Research (March 2026)

> Web research conducted March 24, 2026. All findings sourced from peer-reviewed publications, FDA guidance documents, industry reports, and company disclosures.

---

## 1. STATE OF AI IN REHAB: Current Solutions for Patient Engagement in PT

### The Landscape in 2026

AI integration in physical therapy has reached an inflection point. As of early 2026, the FDA has authorized over 1,250 AI-enabled medical devices (up from 950 in August 2024), and 80.9% of PT professionals believe AI will be integrated into physical therapy practice. The market is segmented into several categories:

### Category A: AI Motion Tracking & Exercise Guidance

| Company | Technology | Key Metrics | Model |
|---------|-----------|-------------|-------|
| **Exer Health** | Camera-based motion tracking, 24-point body tracking, FDA Class II device | Bills $125/mo/patient via RTM, 86% private insurance success | B2B to PT clinics |
| **SWORD Health** | Wearable sensors + AI software, real-time movement feedback | 3.2:1 ROI, 67% members pain-free, $3,177 savings/member/year | B2B2C (employers) |
| **Kaia Health** (acquired by SWORD for $285M, Jan 2026) | Vision-based AI motion capture, clinically validated | 22% medical claims cost savings, 50% decrease in MSK pain | Hybrid human+AI |
| **Hinge Health** | Sensor-based guided therapy, IPO May 2025 | $574M+ revenue, newfound profitability | B2B2C (employers/payers) |
| **MedBridge Motion Capture** | Acquired Rehab Boost (Oct 2024), body part detection + rep counting | Not FDA-cleared, integrated into One Care platform | B2B to PT orgs |
| **Physitrack** | AI-enhanced exercise prescription, video-guided exercises | 80K+ providers, 17K+ exercises, 3M+ patient app downloads | B2B SaaS |

### Category B: AI-Powered Administrative & Workflow Tools

- **Ambient AI Scribes** (APTA published practice advisory Sept 2025): AI documentation tools that listen to patient encounters and auto-generate clinical notes
- **AI scheduling & billing**: Automating 80% of workflows, reducing denials by 75%, securing approvals one week before appointments
- **Preparing for CMS's 2026 mandate** for technology-enabled care reporting

### Category C: AI Patient Engagement & Coaching (THE GAP)

This is the least developed category and where the largest opportunity exists. Most existing platforms are passive (track/report) rather than active (coach/motivate). The tools that exist are:

- **MedBridge Patient Copilot** (announced June 2024): Reactive AI chatbot that answers patient questions when asked. Does NOT proactively reach out, motivate, or coach.
- **MedBridge Guided Pathways**: Pre-built multi-week care programs with push reminders and gamification. Not conversational; not personalized AI coaching.
- **Generic chatbot platforms** (Emitrr, Curogram, etc.): Automated appointment reminders and basic check-ins. Not clinical. Not personalized to exercise programs.

**Key Insight**: No major rehab platform currently offers a proactive, conversational AI accountability coach that reaches out to patients between visits with personalized, motivational outreach tied to their specific exercise program and goals.

### Recent Clinical Evidence (2025-2026)

- University of Michigan (Dec 2025): ML models using wearable sensor data can predict how PTs would rate patients' balance training performance, enabling AI-guided home exercise feedback
- Quasi-experimental study (2025): AI-supervised telerehabilitation resulted in significantly fewer face-to-face sessions (6 vs 9 median) for cervical whiplash patients
- Independent PHTI analysis: Virtual MSK solutions improve health outcomes comparably to in-person PT with net decrease in spending

---

## 2. CONVERSATIONAL AI IN HEALTHCARE: Who's Doing AI Chatbots/Coaches

### Tier 1: Purpose-Built Healthcare AI Agents

| Company | Focus | Approach | Funding/Scale |
|---------|-------|----------|---------------|
| **Hippocratic AI** | Patient-facing healthcare agents | Constellation architecture of 22 LLMs (Polaris 3.0, 4.2T parameters). 40+ agent roles including chronic care management, wellness coaching, post-discharge follow-up. Safety: built-in guardrails with human supervisor escalation. Validated by 6,234 licensed clinicians across 307,038 calls | $3.5B valuation, $126M Series C |
| **Lark Health** | Chronic disease management | AI-powered text-based coaching for diabetes, hypertension, weight management. Real-time feedback on food, activity, sleep, stress. Hybrid: live nurses available for escalation | Established, payer contracts |
| **Tala Health** | Full patient journey AI agents | AI agents for clinicians across the entire patient journey | $100M funding (Sofreh Capital) |
| **Popai Health** | Patient conversation-to-action | AI turns patient conversations into actionable care steps | $11M (Team8, NEA) |

### Tier 2: Mental Health AI Coaching

| Company | Focus | Status |
|---------|-------|--------|
| **Woebot Health** | CBT-based mental health chatbot | SHUT DOWN June 30, 2025. CEO cited cost of FDA compliance + need to adopt LLMs that FDA hasn't figured out how to regulate. 1.5M+ users. Measurable improvements in depression/anxiety within 2 weeks |
| **Wysa** | AI-guided mental wellness | Active, evidence-based CBT/DBT techniques |
| **Youper** | Emotional health AI | Active, mood tracking + AI coaching |

### Tier 3: Symptom Triage & General Health AI

| Company | Focus |
|---------|-------|
| **Buoy Health** | AI symptom assessment, care navigation |
| **Ada Health** | AI-powered symptom checker |
| **Infermedica** | AI triage and pre-visit intake |
| **Fabric Health** | Clinical concierge chat AI |

### Key Takeaway

Hippocratic AI is the most significant player to watch. Their multi-LLM safety constellation approach (primary model supervised by specialist support models) represents the emerging gold standard for patient-facing healthcare AI. However, they focus on phone-based agents for broad healthcare tasks -- not rehab-specific coaching.

**No one is doing what a MedBridge AI accountability coach would do**: proactive, personalized, text-based motivational coaching specifically tied to a patient's PT exercise program, delivered between visits, with deterministic safety guardrails.

---

## 3. LLMs/GenAI IN PHYSICAL THERAPY: Companies, Capabilities, and Regulation

### Current LLM Applications in PT

Research published in 2025-2026 shows LLMs can:
- Create personalized patient education materials (answering health questions accurately >90% of the time)
- Provide health coaching comparable to human coaches (RAG-enabled LLM demonstrated comparable performance in tested domains)
- Generate accessible exercise descriptions and modifications
- Interpret complex medical information for patients
- Support shared decision-making between patients and clinicians

### Published Research on LLM Coaching

A 2024 study published in ScienceDirect ("Advancing health coaching: A comparative study of large language model and health coaches") found:
- RAG-enabled LLMs demonstrated **comparable performance to health coaches** in the domains tested
- LLMs offer advantages in accessibility, scalability, and customization through zero-shot learning
- Human coaching still excels at relational depth, sustained engagement, and nuanced behavioral modification

### The Regulatory Landscape for LLMs in Healthcare

**FDA Stance (as of January 2026)**:
- No clear regulatory pathway specifically for LLM-based patient coaching tools
- Generic LLM chatbots for therapy: FDA has NOT figured out how to regulate these (Woebot CEO's exact words when shutting down)
- FDA's Digital Health Advisory Committee is actively weighing guardrails for generative AI in mental health devices
- Key risks flagged: **hallucination**, **sycophancy** (model tells patient what they want to hear vs. what's accurate), and **bias**

**What IS Clear**:
- General wellness software that motivates adherence to clinician-prescribed exercises: **EXEMPT** from FDA device regulation (January 2026 guidance)
- CDS software that supports (not drives) HCP decisions: **EXEMPT** if it uses validated data and lets clinicians independently review
- Fully autonomous therapy/diagnostic systems: **REGULATED** as medical devices

**HIPAA for LLMs**:
- Standard ChatGPT: NOT HIPAA-compliant, no BAA available for consumer product
- ChatGPT for Healthcare (launched Jan 2026): Enterprise-grade, supports HIPAA compliance, BAA available, PHI not used for training
- Claude (Anthropic) via Hathr.ai: HIPAA-compliant wrapper available
- Key requirements: BAA, encryption at rest/in transit, audit logging, access controls, no PHI in model training data

### Enterprise LLM Healthcare Solutions

| Solution | HIPAA Status | Key Features |
|----------|-------------|--------------|
| OpenAI ChatGPT for Healthcare (Jan 2026) | Supports HIPAA compliance, BAA available | Clinical accuracy optimization, guideline-aligned responses, transparent citations |
| Anthropic Claude (via compliant wrappers) | BAA available through partners | Strong safety training, constitutional AI approach |
| BastionGPT | HIPAA-compliant | Medical-specific GPT wrapper |
| Hippocratic AI Polaris 3.0 | Purpose-built for healthcare | 22 specialist LLMs, constellation safety architecture |

---

## 4. CLINICAL SAFETY CONCERNS: Risks of AI Coaching in Healthcare

### Documented Risks

#### AI Hallucination
- Studies estimate hallucination rates in clinical AI range from **8% to 20%**, depending on model complexity and training data
- GPT-4 Turbo suggested **contraindicated or less effective medications in 12% of cases** (Neuropsychopharmacology, 2024)
- AI systems can generate plausible-sounding but completely fabricated clinical information

#### Crisis Response Failures
- Stanford research: AI bots sometimes **normalized or enabled dangerous behavior**, including listing nearby bridges in response to suicide inquiries
- ChatGPT evaluation: **frequently underestimates suicide risk**, especially in severe cases
- Of 25 mental health chatbots reviewed, only **2 included suicide hotline referrals** during crisis situations

#### Sycophancy
- FDA Advisory Committee flagged risk of AI models telling patients what they want to hear rather than what is accurate
- In rehab context: AI might validate a patient's decision to skip exercises rather than appropriately encouraging adherence

#### Privacy & Data Risks
- Handling of health data "varies wildly" across AI platforms
- Many chatbots are NOT HIPAA-compliant
- Risk of PHI being used to train models without patient consent
- Prompt injection attacks could expose patient data

#### Bias & Discrimination
- LLMs show "increased stigmatizing language for conditions like schizophrenia and alcohol dependence"
- Potential for disparate outcomes across demographic groups
- Training data biases can lead to culturally inappropriate coaching

#### Liability
- Physicians remain liable for clinical judgment; hospitals face exposure for inadequate AI governance
- Standard of care is evolving to potentially include AI use (and non-use)
- Documentation should reflect how AI informed clinical reasoning
- No established legal precedent for AI coaching malpractice in PT specifically

### FDA Guidance on Safety (2025-2026)

| Guidance | Date | Key Requirements |
|----------|------|-----------------|
| General Wellness Products (updated) | Jan 6, 2026 | Wellness software exempt if non-diagnostic, non-therapeutic |
| CDS Software (updated) | Jan 6, 2026 | Exempt if supports (not drives) HCP decisions |
| PCCP for AI Devices | Aug 2025 | Formal mechanism for iterative AI improvement |
| Cybersecurity Premarket | 2025 | "Secure by design" requirement |
| GenAI Mental Health DHAC | Nov 2025 | Advisory committee weighing guardrails |

### Recommended Safety Architecture (Industry Best Practices)

1. **Dual-layer safety classification**: Keyword/pattern matching (fast, deterministic) + LLM-based classification (nuanced)
2. **Human-in-the-loop escalation**: Automatic clinician alerts for flagged content
3. **Scope restriction**: AI coach NEVER modifies prescriptions, diagnoses, or provides clinical advice
4. **Crisis protocols**: Hard-coded suicide/crisis hotline redirects that bypass LLM generation entirely
5. **Consent verification**: Per-interaction consent checks, not just one-time signup
6. **Audit logging**: Complete record of all AI-patient interactions for clinical review
7. **Transparency disclaimers**: California AB 3030 requires AI-generated communications to include disclaimer + human contact info

---

## 5. SUCCESS STORIES: Published Evidence for AI Coaching Improving Rehab Adherence

### Clinical Trial Evidence

#### Kaia Health (Now SWORD)
- Algorithmic exercise programs led to **as much improvement as outpatient PT over 12 weeks** (measured by pain and function scales)
- **22% medical claims cost savings** in employer-sponsored programs
- **50% decrease in MSK pain** reported across user population

#### SWORD Health
- Independently validated **3.2:1 ROI** ($3,177 savings/member/year)
- **67% of members report becoming pain-free**

#### Propeller Health (Digital Therapeutics)
- Sensor + AI app for inhaler adherence: **reduced rescue inhaler use by ~50%** in some patients, cut exacerbations

#### JMIR Rapid Review (2025): AI-Based Digital Rehabilitation Adherence
Six mechanisms identified across peer-reviewed studies:
1. **Motivation & Engagement** (4 studies): Exercise tracking, gamification, awards, motivational content
2. **Enhanced Communication** (4 studies): AI identifies optimal communication styles per patient
3. **Personalization** (3 studies): Assessing cognitive frameworks and attitudes to customize interventions
4. **Usability** (2 studies): Smartphone-only (no extra hardware) improves accessibility
5. **Automated Reminders** (2 studies): Daily notifications, alerts, and prompts
6. **Objective Measurement** (1 study): Tracking actual exercise frequency/duration vs. self-report

#### Systematic Review: Human vs AI vs Hybrid Coaching (Frontiers in Digital Health, 2025)

| Modality | Completion Rate | Key Advantage | Key Weakness |
|----------|----------------|---------------|--------------|
| **Human coaching** | 80-100% | Highest engagement quality, sustained motivation, 92.5% satisfaction | Cost-prohibitive at scale |
| **AI coaching** | 90-93% (typical), 9.8-45.4% (outliers) | Scalability, accessibility, consistent physical activity improvements | Can feel "patronizing," engagement may not sustain post-intervention |
| **Hybrid** | 55-56.5% retention | Combines AI scale with human depth | Needs refinement, usability complaints |

**Critical Finding**: AI coaching excels at scalability and accessibility but struggles with sustained engagement and relational depth. The recommendation is "human-in-the-loop" validation of AI recommendations.

#### AI Text-Based Health Coaching (PMC, 2025)
- Medication adherence increased from **72.1% to 92.3%** over 12 weeks
- Blood pressure monitoring adherence rose from **65.7% to 89.6%**
- Higher chatbot engagement correlated with **lower anxiety, improved wellbeing, increased physical activity, and higher goal attainment**

#### Chatbot for Total Knee Replacement (BMC Musculoskeletal Disorders, 2023)
- Randomized controlled trial examining virtual assistant (chatbot) impact on adherence to home rehabilitation after TKR
- Adherence assessed at 3 months post-surgery
- Study design validates the concept of chatbot-driven PT adherence interventions

### Industry Metrics
- Clinics using AI/digital adherence methods: **up to 40% compliance improvement**
- App-based programs with remote support: **10.3 additional exercise days/month**
- Text message reminders alone: **10.8 percentage points** increase in medication adherence
- One AI-enabled PT provider reports **91% patient adherence rates** (vs. industry average of 35%)

---

## 6. WHAT MEDBRIDGE IS MISSING: The AI Accountability Coach Gap

### MedBridge's Current AI Capabilities (as of March 2026)

| Feature | Status | Limitation |
|---------|--------|-----------|
| Motion Capture (Rehab Boost) | Launched | Not FDA-cleared (Exer is Class II). Assesses movement, doesn't coach |
| Patient Copilot | Launched (June 2024) | **REACTIVE ONLY** - answers questions when asked, doesn't proactively engage |
| Guided Pathways | Launched | Pre-built pathways with push reminders. Not conversational. Not personalized AI |
| One Care Platform | Launched (Sep 2025) | Unified dashboard. Still fundamentally a tracking/reporting tool |
| HEP Builder | Mature | 8,000+ videos but no active engagement layer between visits |
| Medbridge GO App | Mature | 4.8-4.9 star ratings, gamification (streaks/trophies), but patients still drop off |

### MedBridge's Own Adherence Data Reveals the Problem

- **43%** of patients log in within 2 hours of getting HEP
- **58%** engage within 2 days
- **86%** satisfaction with Pathways
- **70%** report pain reduction within 30 days
- **BUT**: They publish NO hard long-term adherence-rate data
- Industry average: only **35%** of patients fully adhere to HEPs
- The gap between initial engagement (58%) and sustained adherence (35%) is **the dropout cliff**

### The 10 Specific Gaps an AI Accountability Coach Fills

| # | Gap in MedBridge | What an AI Coach Does |
|---|-----------------|----------------------|
| 1 | **No proactive AI outreach** - messaging is manual, clinician-initiated, enterprise-only | Automated check-ins at Day 2, 5, 7 referencing patient's own goals |
| 2 | **No conversational coaching** - Patient Copilot answers questions, doesn't motivate | Multi-turn conversations: welcome, goal-set, celebrate, nudge |
| 3 | **No behavioral nudging engine** - reminders are generic push notifications | Tone-adjusted messages (celebration vs nudge vs check-in) based on adherence |
| 4 | **No predictive dropout intervention** - tracks disengagement but doesn't act | Exponential backoff system + clinician alert after 3 unanswered messages |
| 5 | **No "between visits" active layer** - passive wait for patient to return | Scheduled follow-ups referencing specific goals and progress |
| 6 | **No safety pipeline for AI messaging** - no clinical boundary enforcement | Dual-layer safety classifier (crisis patterns + clinical patterns + fallback) |
| 7 | **No deterministic patient lifecycle** - no formal phase state machine | PENDING -> ONBOARDING -> ACTIVE -> RE_ENGAGING -> DORMANT with guards |
| 8 | **No warm re-engagement** - dormant patients stay dormant forever | RE_ENGAGING subgraph with welcome-back, goal review, fresh start option |
| 9 | **Messaging is enterprise-only** - basic plans have no patient communication | AI coach works across all tiers as standalone engagement layer |
| 10 | **No consent-first architecture** - consent check at signup only | Consent gate verified on EVERY interaction |

### What Competitors Are Doing That MedBridge Is NOT

- **Kaia Health/SWORD**: Hybrid human + AI proactive coaching, clinically validated outcomes
- **Hinge Health**: Full digital MSK platform with coaching layer, $574M revenue, profitable, IPO'd
- **Hippocratic AI**: 40+ healthcare agent roles including wellness coaching, chronic care management
- **Exer Health**: FDA Class II device with RTM billing at $125/month/patient

### The Strategic Urgency

1. **CMS ACCESS Model launches July 2026**: Explicit payment pathways for technology-enabled MSK care with Outcome-Aligned Payments tied to PROMs. MedBridge customers need engagement data to earn these payments.
2. **SWORD acquired Kaia for $285M** (Jan 2026): The consolidation of motion tracking + proactive coaching into one platform is the competitive model MedBridge faces.
3. **Hinge Health IPO** (May 2025): Validates the market for AI-enabled PT at massive scale.
4. **85% of generative AI healthcare spend flows to startups**, not incumbents. MedBridge risks being disrupted if it doesn't add active AI coaching.

---

## 7. RECENT TRENDS 2025-2026: The Latest in AI-Powered Patient Engagement

### Funding & Market Dynamics

- **Healthcare AI venture funding** in H1 2025: $6.4B, with 62% going to AI-enabled startups
- 2025 AI healthcare funding already **24.4% higher** than all of 2024 ($8.6B)
- AI adoption in healthcare is **2.2x faster** than the broader economy
- AI in patient engagement market: **$9B (2025) -> $61.7B (2035)**, 21% CAGR
- AI in physical therapy: **$179M (2025) -> $1.7B (2035)**, 25% CAGR
- Prediction: **30-40% of routine patient interactions** will be AI-handled by 2026

### Key 2025-2026 Milestones

| Date | Event | Significance |
|------|-------|-------------|
| May 2025 | Hinge Health IPO | Validates digital MSK market at scale |
| June 2025 | Woebot Health shuts down | FDA regulatory uncertainty kills a pioneer; LLMs move faster than regulators |
| Aug 2025 | FDA PCCP guidance for AI devices | Formal mechanism for iterative AI improvement |
| Sep 2025 | MedBridge One Care launch | Unified platform, but still no active coaching layer |
| Nov 2025 | FDA DHAC on GenAI in mental health | Advisory committee weighing LLM guardrails |
| Dec 2025 | U-Michigan AI balance training | ML models predict PT ratings from wearable data |
| Jan 2026 | FDA updates general wellness + CDS guidance | Reduces oversight for low-risk digital health tools. Wellness coaching clearly exempt |
| Jan 2026 | OpenAI ChatGPT for Healthcare launch | Enterprise HIPAA-compliant LLM for clinical use |
| Jan 2026 | SWORD acquires Kaia Health ($285M) | Motion tracking + proactive coaching consolidation |
| Feb 2026 | APTA Combined Sections Meeting | Multiple sessions on AI and rehabilitation |
| Jul 2026 | CMS ACCESS Model launches | New payment model for tech-enabled MSK care |

### Emerging Architecture Patterns

1. **Multi-LLM safety constellations** (Hippocratic AI): Primary model supervised by specialist models to reduce hallucination. 4.2 trillion parameters across 22 LLMs.
2. **Deterministic state machines + LLM generation**: Application code controls state transitions; LLM only generates conversational content within guardrails. This is the safest pattern for patient-facing AI.
3. **Human-in-the-loop hybrid models**: AI handles routine coaching at scale, escalates to human clinicians for complex/concerning situations.
4. **RAG-enabled clinical coaching**: LLMs augmented with retrieval from evidence-based clinical guidelines to reduce hallucination.
5. **Consent-first architecture**: Every interaction verifies consent, not just initial signup. Required by emerging state laws (CA AB 3030).

### The Emerging Consensus on AI Coaching Architecture

Based on all research reviewed, the ideal AI rehabilitation coaching system in 2026 should have:

1. **Proactive outreach** (not reactive-only) - the #1 gap in current platforms
2. **Personalized to the patient's specific exercise program and goals** - generic reminders don't work
3. **Deterministic safety guardrails** - LLM generates content, but application code controls all state transitions and clinical boundaries
4. **Dual-layer safety pipeline** - pattern matching (fast/deterministic) + LLM classification (nuanced)
5. **Crisis escalation protocols** - hard-coded, bypass LLM entirely
6. **Clinician-in-the-loop** - automatic alerts when patient shows concerning patterns
7. **Behavioral science-informed messaging** - motivational interviewing techniques, not generic prompts
8. **Audit trail** - complete logging for HIPAA compliance and clinical review
9. **Scope restriction** - NEVER modify prescriptions, diagnose, or provide clinical advice
10. **Consent verification** - per-interaction, not one-time

---

## SOURCES

### AI in Physical Therapy & Rehabilitation
- [2025 Advancements in Physical Therapy: AI, VR & Robotic Rehabilitation](https://www.sprypt.com/blog/advancements-in-physical-therapy)
- [9 Game-Changing Technologies Revolutionizing Physical Therapy in 2025](https://www.sprypt.com/blog/physical-therapy-digital-innovation-guide)
- [AI Supports Home-Based Balance Training - Michigan Engineering](https://news.engin.umich.edu/2025/12/ai-supports-home-based-balance-training/)
- [APTA Practice Advisory on AI-Enabled Ambient Scribe Technology](https://www.apta.org/article/2025/09/19/apta-practice-advisory-on-ai-enabled-ambient-scribe-technology-now-available)
- [How AI Is Transforming Physical Therapy Practice - USAHS](https://www.usa.edu/blog/artificial-intelligence-in-physical-therapy-cool-applications-fascinating-implications/)
- [Adoption of AI in Rehabilitation: Perceptions Among Healthcare Providers - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11855079/)
- [Enabling AI and Robotic Coaches for Physical Rehabilitation Therapy - Springer](https://link.springer.com/article/10.1007/s12369-022-00883-0)

### Conversational AI & Healthcare Chatbots
- [Conversational AI for Healthcare - Sermo](https://www.sermo.com/resources/conversational-ai-for-healthcare/)
- [Beyond the Waiting Room: AI-Powered Patient Engagement - Curogram](https://curogram.com/blog/conversational-ai-for-patient-follow-up-and-engagement)
- [Advancing Patient Engagement with Conversational AI - Wolters Kluwer](https://www.wolterskluwer.com/en/expert-insights/advancing-patient-engagement-with-conversational-artificial-intelligence)
- [The Future of Patient Engagement - Infermedica](https://infermedica.com/blog/articles/the-future-of-patient-engagement-how-ai-is-transforming-healthcare-interactions)
- [Lark Health - Chronic Disease Management](https://intuitionlabs.ai/software/patient-engagement-digital-health/chronic-disease-management/lark-health)
- [Woebot Health](https://woebothealth.com/)
- [Woebot, a Mental-Health Chatbot, Tries Out Generative AI - IEEE Spectrum](https://spectrum.ieee.org/woebot)

### LLMs in Healthcare
- [Advancing Health Coaching: LLM vs Health Coaches - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S093336572400246X)
- [Improving Patient Engagement: Role for LLMs - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12235655/)
- [Large Language Models in Patient Education: Scoping Review - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11554522/)
- [Large Language Models in Healthcare - ArXiv](https://arxiv.org/abs/2503.04748)
- [Impact and Challenges of LLMs in Healthcare - Arcadia](https://arcadia.io/resources/large-language-models-in-healthcare)

### FDA Regulation & Digital Health
- [FDA Digital Health Guidance: 2026 Requirements Overview](https://intuitionlabs.ai/articles/fda-digital-health-technology-guidance-requirements)
- [FDA Issues Updated Guidance Loosening Regulatory Approach - Latham & Watkins](https://www.lw.com/en/insights/fda-issues-updated-guidance-loosening-regulatory-approach-to-certain-digital-health-tools)
- [Key Updates in FDA's 2026 General Wellness and CDS Guidance - Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/1/key-updates-in-fdas-2026-general-wellness-and-clinical-decision-support-software-guidance)
- [FDA Limits Oversight of AI Health Software and Wearables](https://telehealth.org/news/fda-clarifies-oversight-of-ai-health-software-and-wearables-limiting-regulation-of-low-risk-devices/)
- [FDA's DHAC Weighs Guardrails for GenAI in Mental Health - Hogan Lovells](https://www.hoganlovells.com/en/publications/fdas-digital-health-advisory-committee-weighs-guardrails-for-generative-ai-in-mental-health-devices)
- [The 2026 AI Reset: New Era for Healthcare Policy - blueBriX](https://bluebrix.health/articles/ai-reset-a-new-era-for-healthcare-policy)
- [Woebot Therapy Chatbot Shuts Down - STAT News](https://www.statnews.com/2025/07/02/woebot-therapy-chatbot-shuts-down-founder-says-ai-moving-faster-than-regulators/)
- [FDA Digital Advisers Confront Risks of Therapy Chatbots - STAT News](https://www.statnews.com/2025/11/05/fda-digital-advisers-therapy-chatbots-regulating-generative-ai/)

### Clinical Safety & HIPAA
- [AI Chatbots and HIPAA Compliance Challenges - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10937180/)
- [Is ChatGPT HIPAA Compliant? Updated for 2026 - HIPAA Journal](https://www.hipaajournal.com/is-chatgpt-hipaa-compliant/)
- [OpenAI for Healthcare](https://openai.com/index/openai-for-healthcare/)
- [AI Therapists Are Dangerous: The Evidence - Blueprint AI](https://www.blueprint.ai/blog/ai-therapists-are-harmful-heres-the-proof)
- [Who's Liable When AI Gets It Wrong? - Medical Economics](https://www.medicaleconomics.com/view/the-new-malpractice-frontier-who-s-liable-when-ai-gets-it-wrong-)
- [Understanding Liability Risk from Healthcare AI Tools - NEJM](https://www.nejm.org/doi/full/10.1056/NEJMhle2308901)
- [How Physicians Might Get in Trouble Using AI - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12309835/)

### Adherence & Outcomes Research
- [How AI-Based Digital Rehabilitation Improves End-User Adherence - JMIR/PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12352703/)
- [Systematic Review: Human, AI, and Hybrid Health Coaching - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12058678/)
- [Enhancing Home Rehabilitation Through AI-Driven Virtual Assistants - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12591998/)
- [Digital Therapeutics: Virtual Coaching Powered by AI - Frontiers](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2021.750428/full)
- [Chatbot for Home Physiotherapy Adherence After TKR - BMC](https://bmcmusculoskeletdisord.biomedcentral.com/articles/10.1186/s12891-023-06607-3)
- [Survey: 75% of Patients Skip PT Homework](https://bioengineer.org/survey-reveals-75-of-patients-skip-physical-therapy-homework-hindering-recovery-progress/)
- [Adherence to Home Exercise Programs - Physiopedia](https://www.physio-pedia.com/Adherence_to_Home_Exercise_Programs)
- [How Clinics Improve Home Exercise Adherence - Exer AI](https://www.exer.ai/posts/improve-home-exercise-adherence-in-physical-therapy)

### MedBridge
- [MedBridge Unveils AI-Assisted One Care Platform](https://www.medbridge.com/blog/medbridge-unveils-ai-assisted-one-care-platform-to-deliver-smarter-more-connected-care)
- [The Future of AI at MedBridge: Q&A with Head of AI](https://www.medbridge.com/blog/the-future-of-ai-at-medbridge-a-q-a-with-medbridges-head-of-ai-paul-jaure)
- [MedBridge Acquires Rehab Boost, Launches Motion Capture](https://www.medbridge.com/blog/medbridge-acquires-rehab-boost-launches-medbridge-motion-capture-as-part-of-medbridge-ai)
- [Digital Patient Engagement Tools - MedBridge](https://www.medbridge.com/blog/what-is-digital-patient-engagement)
- [AI for Physical Therapy: Enhancing Patient Care - MedBridge](https://www.medbridge.com/blog/the-future-of-ai-automation-and-physical-therapy)

### Competitive Landscape
- [SWORD Health Acquires Kaia Health for $285M - MobiHealthNews](https://www.mobihealthnews.com/news/sword-health-acquires-kaia-health-285m)
- [What's Next for Virtual PT: MSK Startups - Axios](https://www.axios.com/pro/health-tech-deals/2024/06/11/virtual-digital-physical-therapy-pt-msk-market-sword-hinge-research)
- [Virtual MSK Solutions Improve Outcomes, Lower Costs - PHTI](https://phti.org/announcement/new-analysis-virtual-msk-solutions-improve-health-outcomes-and-lower-costs/)
- [Exer AI - Clinical AI for MSK](https://www.exer.ai/)
- [Physitrack - Remote Patient Engagement](https://www.physitrack.com/)

### Funding & Market Trends
- [Healthcare AI Rakes in Nearly $4B in VC Funding 2025 - FierceHealthcare](https://www.fiercehealthcare.com/health-tech/healthcare-ai-rakes-nearly-4b-vc-funding-buoying-digital-health-market-2025)
- [Hippocratic AI $126M Series C - FierceHealthcare](https://www.fiercehealthcare.com/ai-and-machine-learning/hippocratic-ai-lands-126m-series-c-expand-patient-facing-ai-agents-fuel-ma)
- [AI Healthcare Funding Rises 2025 - Crunchbase](https://news.crunchbase.com/health-wellness-biotech/ai-healthcare-funding-rises-2025/)
- [AI in Healthcare Investment Trends 2026 - Qubit Capital](https://qubit.capital/blog/ai-healthcare-investment-trends)
- [AI-Powered Companies Dominate 2025 Digital Health Funding](https://wewillcure.com/insights/ai-and-machine-learning/investment/ai-powered-companies-dominate-2025-digital-health-funding)
- [Hippocratic AI - Safest Generative AI Healthcare Agent](https://hippocraticai.com/)
- [Hippocratic AI Polaris 3.0 - BusinessWire](https://www.businesswire.com/news/home/20250319172281/en/Hippocratic-AI-Releases-Polaris-3.0-A-4.2-Trillion-Parameter-Suite-of-22-LLMs-Enhancing-Patient-Safety-and-Experience-By-Leveraging-Real-World-Experiences)
