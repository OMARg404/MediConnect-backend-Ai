# MediConnect — Intelligent Healthcare Ecosystem

> Graduation Project — Faculty of Computers and Data Science, Alexandria University (2025/2026)
> Supervised by Prof. Dr. Mohamed Elfiky

MediConnect is a unified, AI-powered healthcare platform that connects patients, doctors, admins, and healthcare facilities across Egypt. It centralizes hospital discovery, appointment management, and AI-driven medical guidance into a single ecosystem, moving beyond traditional booking platforms (like Vezeeta) into an intelligent decision-support system.

> **Disclaimer:** MediConnect is a decision-support platform and does not replace professional medical diagnosis or clinical judgment. All medical decisions must be made by qualified healthcare professionals.

---

## Table of contents

- [System overview](#system-overview)
- [Tech stack](#tech-stack)
- [Backend architecture](#backend-architecture)
- [Database design (ERD)](#database-design-erd)
- [Security & access control](#security--access-control)
- [AI architecture](#ai-architecture)
- [AI processing pipeline](#ai-processing-pipeline)
- [Data scraping & hospital data pipeline](#data-scraping--hospital-data-pipeline)
- [Performance & scalability](#performance--scalability)
- [Monitoring, logging & backups](#monitoring-logging--backups)
- [Future roadmap](#future-roadmap)

---

## System overview

The platform serves four primary actors:

| Actor | Role |
|---|---|
| **Patient** | Searches hospitals/doctors, books appointments, uploads medical documents, chats with the AI assistant |
| **Doctor** | Manages schedule, views patient records, treats assigned appointments |
| **Facility (Hospital/Center)** | Manages its profile, doctors, capacity (ICU/beds), and operational data |
| **Admin** | Manages facilities, oversees system-wide reports and audits |

Core system flows (from the Context & Level-1 diagrams):
- Patients and doctors send credentials/queries → system returns service responses, treatment info, and assigned appointments.
- Facilities report status, audit data, and operational metrics.
- Admins issue administrative actions and receive system reports.
- All actors can interact with the **AI chatbot** channel.

---

## Tech stack

MediConnect uses a **decoupled, microservices-oriented architecture** — the AI engine is a separate service from the core backend, so heavy AI computation never blocks normal API traffic.

| Layer | Technology | Why |
|---|---|---|
| **Backend API** | Node.js + Express.js | High-performance, real-time request handling, scalable |
| **Database** | MongoDB (NoSQL) | Flexible schema for unstructured/semi-structured medical records, no complex joins |
| **Auth & Security** | JWT, Bcrypt, RBAC | Stateless sessions, password hashing, role-based permissions |
| **AI Engine** | Python (FastAPI/Flask), standalone server | Isolates heavy AI compute from backend performance |
| **Base LLM** | Google Gemini Flash 2.0 | Fast multimodal inference, strong Arabic/Egyptian-dialect NLP |
| **Web frontend** | React.js (SPA) | Component-based, reactive UX for patients/doctors/admins/facilities |
| **Mobile app** | Flutter (Dart) | Single codebase, native-like performance on Android & iOS |
| **Integration** | REST APIs, Postman, Supervisor | Unified communication layer, 24/7 process uptime |
| **Payments** | Paymob | Payment session creation + webhook-driven status updates |
| **Caching/Queues** | Redis / Memcached (planned scaling layer) | Distributed caching, reduces DB load |

---

## Backend architecture

### High-level flow

```
Mobile App (Flutter) ──┐
                        ├──► Node.js + Express REST API ──► MongoDB
Web App (React) ───────┘              │
                                       ├──► AI Microservice (FastAPI/Flask + Gemini)
                                       └──► Paymob Payment Gateway (webhook callback)
```

The backend is the **single source of truth** — it owns authentication, bookings, entity data, and payment state. The AI service is consulted asynchronously and never writes directly to the core business data; it returns assessments and recommendations that the backend persists.

### Core backend responsibilities

1. **Authentication & Authorization** — JWT issuing/verification, Bcrypt password hashing, RBAC middleware gating every route by role (Patient / Doctor / Admin / Facility).
2. **Entity management** — CRUD + search/filter over hospitals, doctors, medical centers (by specialty, location, rating, real-time ICU/bed availability).
3. **Appointment engine** — booking, modification, cancellation, instant confirmation, automated reminders.
4. **Document handling** — accepts uploaded medical documents (images/PDFs), forwards them to the OCR/NLP pipeline, stores extracted structured data.
5. **Reviews & sentiment** — patients post reviews; sentiment classification is applied (via AI service) to support quality scoring.
6. **Notifications** — SMS/email triggers for reminders, status changes, and system alerts.
7. **Payments** — Paymob session creation, webhook listener that updates booking/payment status post-transaction.
8. **Data ingestion** — consumes the outputs of the web-scraping pipeline (hospital/doctor datasets) to keep entity data fresh.

### Sample API surface (from documented endpoints)

| Endpoint | Method | Purpose |
|---|---|---|
| `/ai/sessions` | GET | Retrieve all AI diagnosis sessions for the authenticated user |
| `/ai/diagnosis/start` | POST | Start a new AI diagnosis session (question + lat/lng for location-aware matching) |
| `/ai/diagnosis/continue` | POST | Continue an active session by session ID + patient answer |
| `/bookings` | POST | Create a new appointment (entityId, date, time) → returns booking confirmation |
| `/entities/nearby` | GET | Get nearby healthcare entities (lat, lng, subType, page) ranked by proximity |
| `/payments/paymob/session` | POST | Create a Paymob payment session for a booking, returns secure iframe URL |

All protected endpoints require a **Bearer JWT token**; the Paymob flow is completed via webhook callback that asynchronously updates the booking's payment status — the backend never blocks an HTTP response waiting on the payment gateway.

📬 **Postman collection (Paymob API):** [MediConnect — Paymob API](https://www.postman.com/interstellar-escape-498060/mediconnect/collection/tyusm54/mediconnect-paymob-api)

---

## Database design (ERD)

MongoDB is used as a **document store**, but the logical relationships mirror this structure:

- **Patient** — personal details (name, contact, demographics, national ID, medical history)
- **Doctor** — professional info, linked to a **Facility** via `FacilityID`
- **Facility** — organizational details (hospital/center), linked to an **Admin** via `AdminID`
- **Admin** — manages one or more facilities (1:M)
- **Appointment** — junction entity connecting Patient, Doctor, and Facility via foreign keys (`NationalID`, `DoctorID`, `FacilityID`)

Relationships:
- Patient **books** Appointments (1:M)
- Doctor **has** Appointments (1:M)
- Facility **hosts** Appointments (1:M)
- Facility **has** Doctors (1:M)
- Admin **manages** Facilities (1:M)

Each entity document (see Appendix B sample) is a **self-contained record** holding: unique ID, type/subtype, name, addresses, governorate, area, contact numbers, operating hours, booking status, schedule, bookings array, reviews, ratings, and featured flag — this denormalized design avoids relational joins and speeds up location-based, filtered search.

---

## Security & access control

- **JWT** for stateless session management.
- **Bcrypt** for password hashing — passwords are never stored or readable as plaintext.
- **RBAC (Role-Based Access Control)** — every route is gated by role (Patient / Doctor / Admin / Facility), tested across both web and mobile clients.
- **Security auditing** — authentication/authorization audits, abnormal access detection, API misuse / rate-limit violation tracking, sensitive-data access logging.
- **Encrypted backups** — at rest and in transit, stored in isolated, access-controlled environments separate from production.

---

## AI architecture

### Why a hybrid LLM + retrieval approach

A general-purpose LLM alone is prone to hallucination in medical contexts. MediConnect instead uses a **Hybrid LLM + Vector Retrieval (RAG) architecture**: the LLM provides language understanding and reasoning, while domain-specific **Vector Databases (VDBs)** ground every answer in real medical knowledge (clinical guidelines, textbooks, case studies).

This lets the system:
- Understand multimodal input (text symptoms + medical images)
- Retrieve clinically relevant, evidence-based information
- Generate medically-aligned reasoning grounded in real sources
- Flag potential diagnoses and urgent/high-risk cases
- Match patients to suitable doctors by medical, geographic, and operational criteria

### Base model

The foundation model is a multimodal LLM (**Gemini-class**, specifically **Gemini Flash 2.0**), chosen for:
- Native multimodal support (text + images)
- High reasoning accuracy
- Fast inference for real-time clinical assistance
- Cost-efficient scaling
- Strong RAG compatibility

Critically, **the base LLM never talks to the user directly.** Every request passes through a custom **Medical AI Pipeline** that handles preprocessing, retrieval, safety filtering, and output validation — keeping the model inside strict medical and ethical boundaries.

### Orchestration: Main Platform Intelligence Model (MPIM)

MPIM is the central orchestration layer. It:
1. Classifies incoming cases by medical specialty
2. Preprocesses text/image input
3. Routes the case to the correct specialized diagnostic model
4. Applies multi-layered safety/risk filters
5. Initiates doctor-matching and recommendation logic

This separation of **orchestration** from **diagnosis** keeps the system modular and extensible — new specialties can be added without touching the routing logic.

### Specialized diagnostic models

Each specialty has its **own model + dedicated VDB**, reducing cross-domain interference and hallucination:

| Specialty | Capabilities | VDB contents |
|---|---|---|
| **Orthopedics** | Fracture detection/classification, joint pain analysis, bone density, arthritis typing | Fracture classifications, X-ray interpretation guides, musculoskeletal datasets, emergency workflows |
| **Cardiology** | Chest pain classification, BP trend analysis, ECG interpretation, cardiac risk scoring | ECG embeddings, atherosclerosis research, cardiovascular risk networks |
| **Neurology** | Headache classification, stroke-risk estimation, seizure pattern recognition, facial asymmetry detection | Neuro exam protocols, symptom datasets, imaging descriptions |
| **Gastroenterology & Oncology** | Abdominal pain classification, liver/stomach disease analysis, GI bleeding risk, early cancer indicators | Tumor symptom datasets, diagnostic pathways, lab value rules |
| **Dermatology & Fitness/Nutrition** | Skin lesion/rash analysis, acne/eczema classification, nutritional deficiency detection, body composition | Dermatology image metadata, nutrition research, fitness guidelines |

### Vector database (VDB) structure

Each VDB stores:
- Digitized and converted medical textbooks
- WHO and international clinical guidelines
- Structured, annotated case studies
- Specialty-specific medical datasets
- Doctor profiles and specialty embeddings (for matching)

Retrieving from curated sources — rather than relying purely on the LLM's internal memory — is the core hallucination-reduction strategy.

---

## AI processing pipeline

The end-to-end flow for a single AI diagnosis session:

1. **Input ingestion** — symptoms, medical history, and uploaded images are normalized.
2. **Base model understanding** — the LLM performs symptom classification, medical entity extraction, severity estimation, and image feature extraction.
3. **Specialty routing** — MPIM routes the case to the matching specialized model.
4. **Retrieval augmentation (RAG)** — the diagnostic model pulls relevant clinical guidelines, similar historical cases, symptom clusters, and research evidence from its VDB.
5. **Diagnostic reasoning** — the system produces differential diagnoses, confidence levels, recommended tests, urgency classification, and non-clinical lifestyle suggestions.
6. **Doctor matching** — candidates are ranked by specialty/subspecialty fit, ratings, experience, geographic proximity, and availability.
7. **Final output** — a summarized assessment, possible diagnoses, risk level, next steps, and bookable doctor recommendations are returned to the patient.

### Safety & reliability layer

Because this touches sensitive health decisions, every session passes through:
- Multi-layered safety/content filters
- Hallucination suppression mechanisms
- Emergency symptom / red-flag detection
- Risk-level classification and escalation
- Cross-validation across multiple trusted knowledge sources

---

## Data scraping & hospital data pipeline

MediConnect's entity database (**17,500+ healthcare entities across 27 governorates, 41 subtypes**) was built through a custom pipeline:

1. **Web scraping** — Python (`requests` + `BeautifulSoup`) scrapes trusted healthcare directories with custom rate-limiting/retry logic to avoid IP blocks. Extracts: name, address, services overview, contact info, images, JSON-LD metadata, coordinates (when available).
2. **Cleaning & preprocessing** — removes incomplete/duplicate records, normalizes text encoding, sorts alphabetically, regex-extracts lat/lng, filters non-Egyptian locations.
3. **Geocoding** — `Geopy` + Nominatim converts addresses lacking coordinates into precise lat/lng, with fallback logic for ambiguous results and a mandatory 1-second delay between requests (rate-limit compliance).
4. **Deep image extraction** — parses custom HTML attributes (e.g. `<div data-image="URL">`) to aggregate every available image into a structured `Photos` array per entity.
5. **Export & integration** — outputs standardized datasets (`updated_hospital_data.csv`, `translated_hospital_data.csv`, `medical_centers.csv`, `complete_hospital_data.csv`) consumed by map visualization, search/filtering, AI doctor-matching, and backend APIs.

This pipeline is what powers the **Business Intelligence analysis** (Appendix D) showing healthcare service concentration in Cairo/Giza/Alexandria versus underserved governorates like Matrouh, North Sinai, and Red Sea — informing both Ministry-level and private investment recommendations.

---

## Performance & scalability

| Layer | Techniques |
|---|---|
| **Backend** | MongoDB indexing on hot fields (location, specialty, dates, roles); aggregation pipelines for analytics; connection pooling; async background workers for AI/OCR/sentiment tasks |
| **Frontend** | Lazy loading + code splitting; centralized state management; cached/batched API calls |
| **Mobile** | Offline caching of hospital lists/preferences; background sync; optimized map rendering (clustering, controlled refresh) |
| **Infrastructure** | Horizontal scaling (replicated backend instances); load balancing; distributed caching (Redis/Memcached) |

---

## Monitoring, logging & backups

- **API performance monitoring** — response time, throughput, 4xx/5xx error rates, endpoint availability, with automatic threshold alerts.
- **Health checks** — backend, DB connectivity, AI microservice responsiveness, external integrations (geolocation, notifications).
- **Structured logging** — app logs, error/exception logs, AI/OCR inference logs, security events — timestamped, severity-tagged, centralized.
- **Infrastructure metrics** — CPU, memory, disk I/O, network traffic, uptime — visualized on analytics dashboards.
- **Backups** — scheduled snapshots, multi-region replication, encrypted storage, automated recovery + validation drills, defined retention policies.

---

## Future roadmap

- **Telemedicine** — video consultations
- **E-prescriptions** — pharmacy delivery integration
- **Real-time ICU/bed dashboards** — live capacity for patients and admins
- **Wearable/IoT integration** — continuous vital-sign monitoring with anomaly detection
- **Emergency Assistant Mode** — rapid critical-symptom triage with nearest-facility routing
- **Predictive modeling** — chronic condition progression (diabetes, hypertension, cardiovascular)
- **Egypt-specific fine-tuning** — localized clinical datasets for better diagnostic relevance
- **Community feature** — separate doctor and patient spaces for knowledge sharing and peer support

---

## References

Key sources informing this architecture: Ministry of Health and Population (MOHP) Egypt guidelines, WHO Global Strategy on Digital Health 2020–2025, *Deep Learning* (Goodfellow et al.), *Speech and Language Processing* (Jurafsky & Martin), IEEE AI Ethics standards, OpenAPI Specification v3.0, Flutter documentation, AWS microservices best practices.

---

*This README is derived from the MediConnect graduation project documentation (System Design, Implementation, and AI chapters) and reflects the architecture as implemented in Senior Project 1 & 2.*
