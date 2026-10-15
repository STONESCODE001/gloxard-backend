# Unit 17 Specification: Infrastructure Unblock & Partner Applications (Phase 1)

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Architectural Standards: [`architecture.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/architecture.md)  
> Alignment Handoff: [`BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md)

---

## 1. Goal

Unblock platform infrastructure and production readiness (health check decoupling, S3 folder expansion with private signed GET URLs, S3 multipart uploads for video, and nested field validation error envelopes) and implement the complete Institution Partner Application lifecycle and Gloxad Staff Reviewer Portal with full audit tracking, single-use 7-day activation token issuance, and partner KPI analytics.

---

## 2. Design

### 2.1 Data Models & Schemas

#### 1. `InstitutionApplication.model.js` (`InstitutionApplication`)
* **Collection Name**: `institutionapplications`
* **Fields**:
  * `referenceId`: `{ type: String, unique: true, required: true, index: true }` (Format: `GLX-YYYY-XXXX`, e.g., `GLX-2026-9012`).
  * `institutionName`: `{ type: String, required: true, trim: true }`.
  * `type`: `{ type: String, required: true, enum: ["Private University", "Vocational School", "Charter School", "Medical Institute", "Public College", "International School", "Technical College", "Business School", "Law School", "Online University", "Tertiary Institution", "Other"] }`.
  * `website`: `{ type: String, trim: true, default: "" }`.
  * `address`:
    * `line1`: `{ type: String, trim: true, default: "" }`.
    * `city`: `{ type: String, trim: true, default: "" }`.
    * `country`: `{ type: String, trim: true, default: "NG" }`.
  * `representative`:
    * `name`: `{ type: String, required: true, trim: true }`.
    * `role`: `{ type: String, required: true, trim: true }`.
    * `email`: `{ type: String, required: true, lowercase: true, trim: true, index: true }`.
    * `phone`: `{ type: String, required: true, trim: true }`.
  * `expectedStudents`: `{ type: String, default: "" }` (Range string, e.g. "2,500 - 5,000").
  * `expectedStudentsCount`: `{ type: Number, default: 0 }`.
  * `requestedFeatures`: `{ type: String, default: "" }`.
  * `message`: `{ type: String, default: "" }`.
  * `documents`: `[{ name: String, key: String, size: Number, verifiedAt: Date }]`.
  * `status`: `{ type: String, enum: ["pending", "under_review", "approved", "rejected"], default: "pending", index: true }`.
  * `plan`: `{ type: String, enum: ["Premium", "Enterprise"], default: "Premium" }`.
  * `internalNotes`: `{ type: String, default: "" }`.
  * `accessCode`: `{ type: String, default: "" }` (Access code for public tracking security).
  * `submittedAt`: `{ type: Date, default: Date.now, index: true }`.
  * `reviewedBy`: `{ type: Schema.Types.ObjectId, ref: "User", default: null }`.
  * `updatedBy`: `{ type: String, default: "" }`.
* **Hooks & Indexes**:
  * Compound index: `{ "representative.email": 1, status: 1 }` (enforce rejection of duplicate `pending` applications for the same representative email).
  * Auto-generation pre-validation hook for `referenceId` if not provided: `GLX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`.

#### 2. `ReviewEvent.model.js` (`ReviewEvent`)
* **Collection Name**: `reviewevents`
* **Purpose**: Immutable audit log of every staff reviewer decision, note, and communication.
* **Fields**:
  * `applicationId`: `{ type: Schema.Types.ObjectId, ref: "InstitutionApplication", required: true, index: true }`.
  * `actorId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true }`.
  * `actorName`: `{ type: String, required: true }`.
  * `action`: `{ type: String, required: true, enum: ["status_change", "plan_change", "note", "approve", "reject", "request_info", "invite_sent"] }`.
  * `from`: `{ type: Schema.Types.Mixed, default: null }`.
  * `to`: `{ type: Schema.Types.Mixed, default: null }`.
  * `note`: `{ type: String, default: "" }`.
  * `createdAt`: `{ type: Date, default: Date.now, index: true }`.

#### 3. `Institution.model.js` (`Institution`)
* **Collection Name**: `institutions`
* **Purpose**: Core tenant workspace record initialized upon application approval in `pending_activation` status.
* **Fields**:
  * `name`: `{ type: String, required: true, trim: true }`.
  * `slug`: `{ type: String, required: true, unique: true, lowercase: true, trim: true }`.
  * `logoUrl`: `{ type: String, default: "" }`.
  * `branding`:
    * `displayName`: `{ type: String, default: "" }`.
    * `color`: `{ type: String, default: "#4F46E5" }`.
    * `tagline`: `{ type: String, default: "" }`.
  * `plan`: `{ type: String, enum: ["Premium", "Enterprise"], default: "Premium" }`.
  * `billing`: `{ type: String, enum: ["monthly", "annual"], default: "monthly" }`.
  * `status`: `{ type: String, enum: ["pending_activation", "onboarding", "active", "suspended"], default: "pending_activation", index: true }`.
  * `adminUserId`: `{ type: Schema.Types.ObjectId, ref: "User", default: null }`.
  * `representativeEmail`: `{ type: String, required: true, lowercase: true, trim: true }`.
  * `applicationId`: `{ type: Schema.Types.ObjectId, ref: "InstitutionApplication", unique: true, index: true }`.
  * `activationToken`: `{ type: String, index: true }` (Cryptographic hash of 32-byte hex token).
  * `activationExpiresAt`: `{ type: Date, required: true }` (7 days from approval).
  * `activationUsed`: `{ type: Boolean, default: false }`.
  * `onboarding`:
    * `currentStep`: `{ type: Number, default: 1 }`.
    * `completedSteps`: `{ type: [Number], default: [] }`.
  * `seatLimit`: `{ type: Number, default: 500 }`.
  * `createdAt`, `updatedAt` (timestamps).

---

### 2.2 Endpoint Architecture & RBAC Safeguards

| Endpoint | HTTP Method | Guard / Role | Description |
| :--- | :--- | :--- | :--- |
| **Infrastructure & Uploads** | | | |
| `/api/health/liveness` | `GET` | Public | Process uptime check: `{ status: "ok", uptime: ... }`. |
| `/api/health/readiness` | `GET` | Public | Connectivity probe for MongoDB & S3 bucket access. |
| `/api/upload/presigned-url` | `POST` | `authGuard` (or public for applications) | Extended prefixes (`logos`, `signatures`, `documents`, `submissions`, `certificates`). Private prefixes return `key` only. |
| `/api/upload/signed-url` | `GET` | `authGuard` | Generates short-lived signed GET URL (5-min TTL) for private S3 assets. |
| `/api/upload/multipart/initiate` | `POST` | `authGuard` | Initiates S3 multipart upload for large video files (>100MB). |
| `/api/upload/multipart/presign-part` | `POST` | `authGuard` | Generates presigned URL for specific part upload. |
| `/api/upload/multipart/complete` | `POST` | `authGuard` | Finalizes S3 multipart upload and returns object URL. |
| `/api/upload/multipart/abort` | `POST` | `authGuard` | Aborts incomplete multipart upload. |
| **Partner Applications (Public)** | | | |
| `/api/institutions/applications` | `POST` | Public (Rate Limited) | Submit new partnership request, prevent duplicate pending apps, dispatch confirmation email. |
| `/api/institutions/applications/:referenceId` | `GET` | Public | Status track route returning `{ referenceId, status, submittedAt, estimatedReviewHours: 48 }`. |
| `/api/institutions/plans` | `GET` | Public | Plans catalogue ($249/mo Premium, $599/mo Enterprise, 20% annual discount). |
| **Gloxad Reviewer Portal (Admin)** | | | |
| `/api/admin/institution-applications` | `GET` | `authGuard`, `admin` | Searchable, filterable, paginated applications table. |
| `/api/admin/institution-applications/:id` | `GET` | `authGuard`, `admin` | Detailed review drawer data: institution, representative, documents, review audit history. |
| `/api/admin/institution-applications/:id` | `PUT` | `authGuard`, `admin` | Update status, plan, and internal notes. Logs `ReviewEvent`. |
| `/api/admin/institution-applications/:id/approve` | `POST` | `authGuard`, `admin` | Idempotent approval: creates `Institution` (pending_activation), issues 7-day activation token, sends email. |
| `/api/admin/institution-applications/:id/reject` | `POST` | `authGuard`, `admin` | Sets status `rejected`, logs event, emails applicant with reason. |
| `/api/admin/institution-applications/:id/request-info` | `POST` | `authGuard`, `admin` | Sets status `under_review`, logs event, emails inquiry to representative. |
| `/api/admin/institution-applications/:id/resend-invite` | `POST` | `authGuard`, `admin` | Resends activation email for approved applications (409 if not approved). |
| `/api/admin/institution-applications/:id/documents/:docId/download` | `GET` | `authGuard`, `admin` | Returns 5-minute signed GET URL for application document and logs download. |
| `/api/admin/partners/overview` | `GET` | `authGuard`, `admin` | Reviewer dashboard KPIs: total institutions, active students, revenue, growth, 30/90-day time series. |
| `/api/admin/partners/summary` | `GET` | `authGuard`, `admin` | Active institutions (% change), pending approvals count, approval success rates. |
| `/api/admin/partners/geo` | `GET` | `authGuard`, `admin` | Application count breakdown by country/coordinates for dashboard map. |
| `/api/admin/partners/growth` | `GET` | `authGuard`, `admin` | Monthly partner onboarding trend (last 7 months). |

---

### 2.3 Error Schema & Validation Envelope

All validation errors produced by the API must return HTTP `400` with nested field mapping and a machine-readable code:
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "fields": {
    "representative.email": "A valid institutional email is required",
    "institutionName": "Institution name must be at least 3 characters"
  }
}
```
Specific conflict and business logic errors will provide stable error codes:
* `409` `{ "error": "A pending application with this email already exists", "code": "DUPLICATE_APPLICATION" }`
* `409` `{ "error": "Application is already approved", "code": "ALREADY_APPROVED" }`
* `404` `{ "error": "Application not found", "code": "APPLICATION_NOT_FOUND" }`
* `400` `{ "error": "Invalid or expired activation token", "code": "TOKEN_EXPIRED" }`

---

## 3. Implementation

### 3.1 Model & Schema Files
1. **Create `src/models/InstitutionApplication.model.js`**:
   - Define schema with validation, indexes, and reference ID generator.
2. **Create `src/models/ReviewEvent.model.js`**:
   - Define audit event schema recording staff reviewer actions.
3. **Create `src/models/Institution.model.js`**:
   - Define institution tenant schema with activation fields and onboarding state.

### 3.2 Infrastructure & Upload Utilities
1. **Health Routes Split (`src/app.js`)**:
   - Decouple `/api/health` into `/api/health/liveness` and `/api/health/readiness`.
   - Readiness checks `mongoose.connection.readyState === 1` and S3 bucket head check.
2. **S3 Presigned & Signed GET (`src/utils/s3.js`)**:
   - Add prefixes: `logos`, `signatures`, `documents`, `submissions`, `certificates`.
   - Private prefix enforcement: uploads to private prefixes return `{ key }` and no public `fileUrl`.
   - Implement `generateSignedGetUrl(key, expiresIn = 300)` using `GetObjectCommand` and `@aws-sdk/s3-request-presigner`.
   - Implement S3 multipart helpers: `createMultipartUpload`, `getPresignedPartUrl`, `completeMultipartUpload`, `abortMultipartUpload`.
3. **Upload Controller & Routes (`src/controllers/upload.controller.js` & `src/routes/upload.routes.js`)**:
   - Expose `GET /api/upload/signed-url` with query parameter `key`.
   - Expose multipart endpoints under `/api/upload/multipart/*`.
4. **Enhanced Error Middleware (`src/middlewares/error.middleware.js`)**:
   - Support `{ error, code, fields }` payload structure while preserving backward compatibility for existing simple `{ error }` callers.

### 3.3 Partner Applications & Reviewer Logic
1. **Create `src/controllers/institution.controller.js`**:
   - `submitApplication`: Validates fields, checks for duplicate pending email, saves documents, emits confirmation email with reference ID, returns `201 { application: { _id, referenceId, status, submittedAt } }`.
   - `trackApplication`: Resolves status by `referenceId`, returns safe public metadata `{ referenceId, status, submittedAt, estimatedReviewHours: 48 }`.
   - `getPlans`: Returns hardcoded canonical plan pricing ($249/mo, $599/mo, limits, 20% annual discount).
2. **Create `src/controllers/reviewer.controller.js`**:
   - `listApplications`: Search by institution name, rep name/email, filter by status and type, sort by `submittedAt: desc`, with pagination.
   - `getApplicationDetail`: Full review drawer payload including rep details, expected students, notes, documents with signed preview URLs, and `ReviewEvent` history.
   - `updateApplication`: Updates status/plan/notes, creates `ReviewEvent`.
   - `approveApplication`: Validates current status is not already `approved`. Generates 32-byte activation token (hashed in DB), creates `Institution` in `pending_activation`, sets application to `approved`, creates `ReviewEvent`, dispatches activation email.
   - `rejectApplication`: Sets status `rejected`, logs reason in `ReviewEvent`, dispatches rejection email.
   - `requestInfoApplication`: Sets status `under_review`, logs in `ReviewEvent`, emails question to representative.
   - `resendInvite`: Regenerates/resends activation link if application is `approved` and activation not yet used.
   - `downloadDocument`: Emits short-lived signed GET URL for document key, logs download audit event.
   - Partner Analytics Controllers:
     - `getPartnersOverview`: Aggregates total institutions, active students, estimated revenue, application volume trends.
     - `getPartnersSummary`: Active institutions count, pending approval counts, approval success percentages.
     - `getPartnersGeo`: Aggregates applications by country ISO/name for map pins.
     - `getPartnersGrowth`: Monthly partner onboarding progression over the past 7 months.
3. **Email Templates Expansion (`src/utils/email.js`)**:
   - Add transactional email triggers:
     - `sendPartnerApplicationConfirmationEmail({ to, name, referenceId, trackingUrl })`
     - `sendPartnerActivationEmail({ to, name, institutionName, activationUrl, expiresAt })`
     - `sendPartnerRejectionEmail({ to, name, institutionName, reason })`
     - `sendPartnerRequestInfoEmail({ to, name, institutionName, message })`

### 3.4 Routing & App Mounts
1. **Create `src/routes/institution.routes.js`**:
   - Mount public application and tracking endpoints.
2. **Mount Reviewer Routes in `src/routes/admin.routes.js`**:
   - Mount reviewer portal endpoints protected by `authGuard` and `roleGuard("admin")`.
3. **Mount in `src/app.js`**:
   - `app.use("/api/institutions", institutionRoutes);`
   - Reviewer routes integrated into `/api/admin`.

### 3.5 Documentation & Testing
1. **Interactive API Documentation Portal (`src/views/docs.html`)**:
   - Add new navigation Section: "Institution Partner & Reviewer Portal".
   - Document all 15 Phase 1 endpoints with interactive "Try It Out" drawers and payload templates.
2. **Seed Engine (`src/seed.js`)**:
   - Seed sample partner applications (`pending`, `under_review`, `approved`, `rejected`) and pre-seeded `Institution` records.
3. **Automated Smoke Tests (`scripts/test-e2e-smoke.js`)**:
   - Add `FLOW 9: Partner Application, Staff Reviewer Decision, and Activation Flow` verifying end-to-end functionality.

---

## 4. Dependencies

No new external npm packages required. All required features utilize existing installed packages:
* `@aws-sdk/client-s3` & `@aws-sdk/s3-request-presigner` (S3 PUT/GET & multipart)
* `crypto` (Built-in Node.js module for token generation & hashing)
* `mongoose` (ODM for models and indexes)
* `express` & `express-rate-limit` (Routing & rate limiting)
* `nodemailer` (Email dispatch)

---

## 5. Verification Checklist

- [ ] `GET /api/health/liveness` returns `200 { "status": "ok", "uptime": ... }`.
- [ ] `GET /api/health/readiness` returns `200 { "status": "ready", "database": "connected", "storage": "connected" }`.
- [ ] `POST /api/upload/presigned-url` accepts `logos`, `signatures`, `documents`, `submissions`, `certificates` and enforces private folder key isolation.
- [ ] `GET /api/upload/signed-url?key=...` returns working 5-minute signed GET URL for authenticated users.
- [ ] `POST /api/institutions/applications` generates valid reference ID (`GLX-YYYY-XXXX`), stores application, and dispatches confirmation email.
- [ ] `POST /api/institutions/applications` rejects duplicate pending submission with identical representative email with `409` and code `DUPLICATE_APPLICATION`.
- [ ] `GET /api/institutions/applications/:referenceId` returns safe status tracking payload without sensitive representative data.
- [ ] `GET /api/institutions/plans` returns canonical pricing schema matching frontend requirements.
- [ ] `GET /api/admin/institution-applications` returns paginated list with search and status filtering for admin users.
- [ ] `GET /api/admin/institution-applications/:id` returns full review drawer context with documents and audit history.
- [ ] `PUT /api/admin/institution-applications/:id` updates status/notes and creates a `ReviewEvent` audit record.
- [ ] `POST /api/admin/institution-applications/:id/approve` creates `Institution` in `pending_activation`, sets 7-day expiry token, dispatches email, and prevents duplicate approvals (`409`).
- [ ] `POST /api/admin/institution-applications/:id/reject` sets status to `rejected` and sends email with reason.
- [ ] `POST /api/admin/institution-applications/:id/request-info` sets status to `under_review` and emails question.
- [ ] `POST /api/admin/institution-applications/:id/resend-invite` resends activation email for approved applications only.
- [ ] `GET /api/admin/partners/overview`, `/summary`, `/geo`, and `/growth` return computed metrics and timeseries data.
- [ ] Syntax and build check `npm run build` passes with zero errors.
- [ ] Smoke tests `npm run test:smoke` pass with 100% assertions.
- [ ] `GET /` renders interactive API documentation for all new Phase 1 endpoints.
