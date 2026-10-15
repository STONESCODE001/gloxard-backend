# GLOXAD PLATFORM — BACKEND RESPONSE & FRONTEND ALIGNMENT SPECIFICATION

**To:** Samuel Olusanya (Frontend Lead, Gloxad Academy)  
**From:** Backend Engineering Team  
**Date:** October 2026  
**Subject:** Response to Backend Requirements Document (v7 Oct 2026) & Implementation Clarifications  
**Status:** Review & Alignment Phase  

---

## 1. Executive Summary & Phase 0 Commitment

Thank you for the comprehensive requirements breakdown and audit. We have reviewed the document in its entirety. We acknowledge all blockers and inconsistencies identified in **Part A** and are prioritizing **Phase 0 (Unblock)** immediately.

### Phase 0 Action Plan (Immediate Turnaround: 48–72 Hours)
1. **S3 Media Storage (A1)**:
   - Restoring the production bucket with updated CORS rules matching `https://www.gloxadacademy.com` and `http://localhost:3000`.
   - Re-seeding category icons, course thumbnails, and sample assets.
   - Extending the presigned URL generator to support new folders: `logos/`, `signatures/`, `documents/`, `submissions/`, and `certificates/`.
2. **Production API CORS (A2)**:
   - Whitelisting `https://www.gloxadacademy.com`, `https://gloxadacademy.com`, and the staging frontend origin in the CORS middleware.
3. **Category Image Persistence (A3)**:
   - Updating `POST /api/admin/categories` and `PUT /api/admin/categories/:id` to accept, validate, and persist `imageUrl`.
4. **Token Refresh Grace Window (A4)**:
   - Updating `POST /api/auth/refresh` to permit recently expired tokens (with a 5-minute grace window) and return `{ token, user }`.
5. **Testing Environment & Documentation (A5 & D7)**:
   - Deploying a dedicated staging instance with pre-seeded test accounts (`student`, `instructor`, `admin`, `institution_admin`).
   - Publishing an OpenAPI 3.0 specification (`/api/openapi.json`) and a companion Postman collection.
6. **Platform Health Metric (A7 & D8)**:
   - Decoupling `/api/health` into `/api/health/liveness` (process status) and `/api/health/readiness` (MongoDB and S3 connectivity).

---

## 2. Backend Answers to Appendix D Questions

Here are the official architectural positions and responses to the questions raised in **Appendix D**:

### 1. Which flow in B0 do we adopt, and who owns the partner request form copy?
- **Adopted Flow**: We adopt the **"Review First"** workflow:
  1. Representative submits a lightweight Partnership Request form (Reference ID generated: e.g., `GLX-2026-9012`). Status: `pending`.
  2. Gloxad staff review, request info, reject, or approve via the Reviewer Portal.
  3. Approval generates an `Institution` record in `pending_activation` and emails a single-use, 7-day activation link.
  4. Representative sets a secure password (min 12 characters) via the activation link, then completes the 6-step Onboarding Wizard.
  5. Subscription payment activates the workspace and grants access to `/institution/dashboard`.
- **Form Ownership**: Frontend owns the UI copy and layout; Backend will provide the exact validation schema and error messaging contract.

### 2. What are the bucket name, region, and CDN domain?
- **Bucket Details**:
  - **Bucket Name**: `gloxad-media-production`
  - **Region**: `us-east-1` (or `eu-west-1` based on AWS config)
  - **CDN Domain**: CloudFront distribution will front public media (`avatars/`, `categories/`, `courses/`, `logos/`, `signatures/`).
- **Private Content**: `certifications/`, `documents/`, `submissions/`, and `certificates/` will strictly return `key` (no public URL). Access is served exclusively via short-lived signed GET URLs (`GET /api/upload/signed-url?key=...`).

### 3. Which payment provider and currency for institution subscriptions?
- **Provider**: **Paystack** (leveraging existing integration) for NGN and USD transactions.
- **Billing Model**: Recurring subscriptions driven by Paystack Plans & Authorizations, with an invoice fallback for bank transfers.
- **Bank Transfer Confirmation**:
  - The UI presents dedicated virtual bank accounts generated via Paystack Dedicated Virtual Accounts (DVA), allowing automated webhook reconciliation.
  - Manual bank transfer receipts can be submitted to a staff queue for manual override.

### 4. Which video provider for live classes?
- **Adopted Provider**: **LiveKit Cloud** (or self-hosted LiveKit).
  - Offers open-source React SDKs (`@livekit/components-react`).
  - Low-latency WebRTC performance in Nigeria/West Africa.
  - Generates token-gated rooms via backend API (`POST /api/lms/live-sessions/:id/join`).
  - Cloud Egress handles automated session recordings.

### 5. Are cohorts modeled on top of existing Course collections, or a new structure?
- **Dedicated Structure**: Cohorts will be an independent collection (`Cohort`) referencing `Course` and `Trimester`.
- **Rationale**: Keeps self-paced courses completely isolated from cohort-based trimester runs, preventing breaking changes to existing enrollments and certificates.

### 6. Can existing `/learning/*` routes be reused, or should LMS get dedicated routes?
- **Dedicated LMS Namespace**: The Trimester LMS will live under **`/api/lms/*`**.
- **Rationale**: Self-paced learning and cohort-based learning have fundamentally different progress rules, submission models, and cohort isolation policies. Shared utilities will run under the hood, but the API contracts will be clean and isolated.

### 7. Turnaround for Phase 0 and staging credentials?
- **Delivery Timeline**: Staging environment, seed credentials, and the OpenAPI 3.0 file will be delivered within **3 business days** following alignment sign-off.

### 8. Canonical field names and deprecation schedule (A6)?
- **Canonical Choices**:
  - `isEmailVerified` (deprecating `isVerified`)
  - `bio` (deprecating `biography`)
  - `socialLinks` (deprecating `socials`)
  - `avatarUrl` (deprecating `avatar`)
  - Course Category: Returns normalized object `{ _id, name, slug }` across all endpoints.
- **Deprecation Grace Period**: Both fields will be returned for **30 days** on staging and production before legacy aliases are dropped.

---

## 3. Critical Clarification Questions for Frontend (Samuel)

Before we lock the schemas and start implementing the new endpoints, please confirm the following:

### Domain 1: Onboarding Wizard & Partner Application (Part B)
1. **Existing UI State**:
   - Is the 6-step onboarding wizard in `Gloxadapp` currently rendered on a public route, or is it already behind an activation route like `/institution/activate`?
   - Does the frontend already have the initial lightweight partnership application form designed, or do we need to draft the fields together?
2. **Step-by-Step Persistence**:
   - Does your wizard send a `PUT /api/institutions/me/branding`, `PUT /api/institutions/me/departments`, etc., incrementally on each step's "Next" click, or does it hold state in local storage and submit all 6 steps at once?

### Domain 2: Video Classroom Integration (Part C & LiveKit)
1. **Frontend WebRTC Component**:
   - Have you already installed `@livekit/components-react` in the Next.js app, or is the `/lms/live` page currently a static mockup?
   - If we supply `{ provider: "livekit", serverUrl: "wss://...", roomToken: "..." }`, can your component initialize the room directly?
2. **Chat & Polls Real-Time Contract**:
   - For live chat history: Do you expect chat history to be sent when joining the Socket.io room (`namespace: /live`), or will the UI call a REST endpoint (e.g., `GET /api/lms/live-sessions/:id/chat`) upon mounting?

### Domain 3: Payment UX & Card Handling (Part B4)
1. **Card Input Security**:
   - The design shows an inline card form (Card Number, Expiry, CVV). For security and PCI-DSS compliance, our servers **cannot receive raw card numbers**.
   - Can we use **Paystack Inline Modal (Popup)** or redirect to a Paystack Hosted Checkout URL?
2. **Currency Display**:
   - If an institution pays in USD ($249 / $599), does the frontend expect the Paystack checkout to display USD or convert to NGN equivalent at checkout?

### Domain 4: Multi-Cohort Navigation & Context (Part C0 & C3)
1. **Active Cohort Switching**:
   - When `GET /api/lms/me` returns multiple cohorts in `cohorts: [...]`, how does the UI allow students/instructors to switch cohorts? Is there a header dropdown?
   - Will the UI explicitly append `?cohortId=<id>` to all LMS calls (`/dashboard/student`, `/assignments`, `/live-sessions`), or should the backend persist an `activeCohortId` on the user profile?

### Domain 5: Quizzes, Deadlines & Submissions (Part C3 & C4)
1. **Quiz Timer Expiration**:
   - When the 15-minute countdown on the UI reaches `00:00`, does the UI automatically trigger `POST /api/lms/quiz-attempts/:id/submit`, or should the backend reject/auto-grade any submission received after `expiresAt`?
2. **Quiz Retakes**:
   - How many retakes does the UI allow for failed quizzes? (e.g., unlimited, 3 attempts, or cooldown period?)
3. **Late Assignment Policy**:
   - Does the UI permit submitting an assignment past `dueAt` (displaying a "Late" badge), or does the submit button become disabled?
   - Can students edit/resubmit their GitHub URL or ZIP file before it is graded by an instructor?

### Domain 6: Client-Side S3 Uploads (Part A1 & D3)
1. **PUT Request Headers**:
   - When uploading files directly to S3 via the presigned URL, does your frontend code set the exact `Content-Type` header passed back in the presigned response?
   - For instructor video uploads, are you uploading via a single standard PUT, or do you require S3 Multipart Upload for files exceeding 100MB?

### Domain 7: Validation Error Format (Part 1 Conventions)
1. **Form Error Mapping**:
   - We are adopting the `{ error: "...", fields: { "email": "...", "password": "..." } }` contract.
   - Are your form handlers configured to read nested paths (e.g. `representative.email` vs `email`)?

---

## 4. Next Steps & Proposed Sign-Off

1. **Alignment Meeting / Async Review**: Review the 7 domains above and confirm or amend the proposed answers.
2. **Phase 0 Execution**: Backend unblocks S3, CORS, Category Images, and Token Refresh within 48–72 hours.
3. **Phase 1 & 2 Buildout**: Backend kicks off the Institution Application, Reviewer Portal, and LMS Core endpoints based on the approved contracts.

---
*Document prepared for handoff and technical sign-off.*
