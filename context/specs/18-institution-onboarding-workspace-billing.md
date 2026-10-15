# Unit 18 Specification: Institution Onboarding, Workspace Management & Subscriptions (Phase 2)

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Architectural Standards: [`architecture.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/architecture.md)  
> Alignment Handoff: [`BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md)  
> Prior Spec: [`17-infrastructure-partner-applications.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/17-infrastructure-partner-applications.md)

---

## 1. Goal

Enable approved institutions to claim and activate their workspace via a 7-day single-use token, persist their 6-step onboarding wizard across sessions, manage multi-tenant departments and members (with manual addition and bulk CSV/JSON import up to seat limits), execute recurring Paystack subscription checkouts in USD/NGN, and access their institution analytics dashboard.

---

## 2. Design

### 2.1 Multi-Tenant Data Models & Schemas

#### 1. `Department.model.js` (`Department`)
* **Collection Name**: `departments`
* **Fields**:
  * `institutionId`: `{ type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true }`.
  * `name`: `{ type: String, required: true, trim: true }`.
  * `code`: `{ type: String, required: true, trim: true, uppercase: true }` (e.g. `CS-100`).
  * `faculty`: `{ type: String, trim: true, default: "" }`.
  * `headName`: `{ type: String, trim: true, default: "" }`.
  * `headUserId`: `{ type: Schema.Types.ObjectId, ref: "User", default: null }`.
  * `description`: `{ type: String, trim: true, default: "" }`.
  * `createdAt`, `updatedAt` (timestamps).
* **Indexes**:
  * Compound unique index: `{ institutionId: 1, code: 1 }` (department code must be unique within an institution).

#### 2. `InstitutionMember.model.js` (`InstitutionMember`)
* **Collection Name**: `institutionmembers`
* **Purpose**: Tracks roster of tutors and students associated with a tenant institution.
* **Fields**:
  * `institutionId`: `{ type: Schema.Types.ObjectId, ref: "Institution", required: true, index: true }`.
  * `role`: `{ type: String, required: true, enum: ["tutor", "student"], index: true }`.
  * `name`: `{ type: String, required: true, trim: true }`.
  * `email`: `{ type: String, required: true, lowercase: true, trim: true }`.
  * `departmentIds`: `[{ type: Schema.Types.ObjectId, ref: "Department" }]`.
  * `designation`: `{ type: String, trim: true, default: "" }` (tutors only, e.g. "Senior Lecturer").
  * `autoInvite`: `{ type: Boolean, default: false }`.
  * `inviteStatus`: `{ type: String, enum: ["not_invited", "pending", "accepted", "expired"], default: "not_invited", index: true }`.
  * `inviteToken`: `{ type: String, default: null }`.
  * `invitedAt`: `{ type: Date, default: null }`.
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", default: null, index: true }` (linked once registered).
  * `createdAt`, `updatedAt` (timestamps).
* **Indexes**:
  * Compound unique index: `{ institutionId: 1, email: 1 }` (email must be unique per institution).
  * Index: `{ institutionId: 1, role: 1 }`.

#### 3. `Subscription.model.js` (`Subscription`)
* **Collection Name**: `subscriptions`
* **Fields**:
  * `institutionId`: `{ type: Schema.Types.ObjectId, ref: "Institution", required: true, unique: true, index: true }`.
  * `plan`: `{ type: String, required: true, enum: ["Premium", "Enterprise"] }`.
  * `billing`: `{ type: String, required: true, enum: ["monthly", "annual"] }`.
  * `currency`: `{ type: String, required: true, enum: ["USD", "NGN"], default: "USD" }`.
  * `amountGross`: `{ type: Number, required: true }`.
  * `discount`: `{ type: Number, default: 0 }`.
  * `amountTotal`: `{ type: Number, required: true }`.
  * `taxAmount`: `{ type: Number, default: 0 }`.
  * `status`: `{ type: String, enum: ["active", "past_due", "canceled", "incomplete"], default: "incomplete", index: true }`.
  * `provider`: `{ type: String, default: "paystack" }`.
  * `providerReference`: `{ type: String, default: "", index: true }`.
  * `paystackSubscriptionCode`: `{ type: String, default: "" }`.
  * `paystackEmailToken`: `{ type: String, default: "" }`.
  * `periodStart`: `{ type: Date, default: Date.now }`.
  * `periodEnd`: `{ type: Date }`.
  * `invoices`: `[{ invoiceId: String, amount: Number, currency: String, paidAt: Date, status: String, receiptUrl: String }]`.
  * `createdAt`, `updatedAt` (timestamps).

#### 4. Model Updates on `User.model.js` & `Institution.model.js`
* **`User.model.js`**:
  * Add role: `"institution_admin"`.
  * Add field: `institutionId: { type: Schema.Types.ObjectId, ref: "Institution", default: null, index: true }`.
* **`Institution.model.js`**:
  * Ensure status lifecycle transitions: `pending_activation` -> `onboarding` -> `active` (or `suspended`).
  * Onboarding step tracking: `onboarding.currentStep` (1 to 6) and `onboarding.completedSteps` (array of step numbers).

---

### 2.2 Endpoint Architecture & RBAC Safeguards

All institution management routes live under `/api/institutions/me/*` and require:
1. `authGuard` (valid JWT).
2. `roleGuard("institution_admin")`.
3. Tenant isolation middleware (`institutionContext`): binds `req.institutionId = req.user.institutionId`.

| Endpoint | HTTP Method | Guard / Role | Description |
| :--- | :--- | :--- | :--- |
| **Activation (Public)** | | | |
| `/api/institutions/activate` | `POST` | Public | Validates 7-day token & min 12-char password. Creates/activates admin `User`, sets institution to `onboarding`, returns `{ token, user, institution }`. (400 if weak password, 410 if expired/used). |
| **Workspace & Onboarding Persistence** | | | |
| `/api/institutions/me` | `GET` | `institution_admin` | Resumes wizard state: returns institution data, `onboarding { currentStep, completedSteps }`, plan, and branding. |
| `/api/institutions/me/branding` | `PUT` | `institution_admin` | Step 1 & 6: Updates `displayName`, `color` (#hex), `tagline`, and `logoUrl` (must be verified S3 `logos/` key). Advances `currentStep`. |
| `/api/institutions/me/departments` | `GET` | `institution_admin` | Step 2: Lists all departments for the institution. |
| `/api/institutions/me/departments` | `POST` | `institution_admin` | Step 2: Creates new department. Enforces unique `code` and plan department limit (10 for Premium, unlimited for Enterprise). |
| `/api/institutions/me/departments/:id` | `PUT` | `institution_admin` | Step 2: Updates department metadata. |
| `/api/institutions/me/departments/:id` | `DELETE` | `institution_admin` | Step 2: Deletes department (safeguarded against assigned members). |
| `/api/institutions/me/members` | `GET` | `institution_admin` | Step 3 & 4: Paginated members listing with filters (`role=tutor\|student`, `departmentId`, `q`, `page`, `limit`). |
| `/api/institutions/me/members` | `POST` | `institution_admin` | Step 3 & 4: Adds individual member. Enforces seat limit (500 for Premium) and duplicate email check (`409`). If `autoInvite: true`, dispatches invite email immediately. |
| `/api/institutions/me/members/import` | `POST` | `institution_admin` | Step 3 & 4: Bulk CSV or JSON rows import (`name, email, department, designation`). Enforces seat limit, deduplicates by email, returns `{ imported, skipped: [{ row, reason }] }`. |
| `/api/institutions/me/members/:id/invite` | `POST` | `institution_admin` | Resends member invitation email. Rate limited to prevent spam (`429`). |
| `/api/institutions/me/members/:id` | `DELETE` | `institution_admin` | Detaches registered user or deletes draft member record. |
| **Subscription & Billing** | | | |
| `/api/institutions/me/subscription/checkout` | `POST` | `institution_admin` | Step 5: Initializes Paystack transaction. Returns `{ reference, access_code, checkoutUrl, amount, currency, discount, total }` for Paystack Inline popup. |
| `/api/institutions/me/subscription` | `GET` | `institution_admin` | Fetches active subscription details, renewal date, and invoice history. |
| **Institution Dashboard** | | | |
| `/api/institutions/me/dashboard` | `GET` | `institution_admin` | Aggregates workspace KPIs: total students, total tutors, active departments, growth %, weekly activity analytics. |

---

### 2.3 Pricing, Seat Limits & Calculations

The server strictly owns and enforces all billing calculations (never trusting client amounts):

* **Premium Growth**:
  * Monthly: **$249.00 / month** (Limits: up to 500 students, 10 departments).
  * Annual (20% discount): `12 * $249 * 0.80` = **$2,390.40 / year** (Save $597.60).
* **Enterprise Scalability**:
  * Monthly: **$599.00 / month** (Limits: unlimited students, unlimited departments).
  * Annual (20% discount): `12 * $599 * 0.80` = **$5,750.40 / year** (Save $1,437.60).
* **Seat Limit Safeguards**:
  * When adding members (single or bulk CSV): Count current students in `InstitutionMember`. If `currentCount + newCount > seatLimit`, reject with:
    `400 { "error": "Member limit of 500 reached for Premium plan. Upgrade to Enterprise to add more members.", "code": "SEAT_LIMIT_EXCEEDED" }`.
* **Department Limit Safeguards**:
  * When creating departments on Premium plan: If `currentCount >= 10`, reject with:
    `400 { "error": "Department limit of 10 reached for Premium plan. Upgrade to Enterprise for unlimited departments.", "code": "DEPARTMENT_LIMIT_EXCEEDED" }`.

---

## 3. Implementation

### 3.1 Model & Schema Files
1. **Create `src/models/Department.model.js`**:
   - Define department schema with compound unique index on `{ institutionId: 1, code: 1 }`.
2. **Create `src/models/InstitutionMember.model.js`**:
   - Define member schema with compound unique index on `{ institutionId: 1, email: 1 }` and `inviteStatus` lifecycle.
3. **Create `src/models/Subscription.model.js`**:
   - Define subscription schema recording Paystack transaction reference, plan, period, and invoice records.
4. **Update `src/models/User.model.js`**:
   - Include `"institution_admin"` in `ROLES`.
   - Add `institutionId` reference field.

### 3.2 Tenant Isolation & Activation Logic
1. **Tenant Middleware (`src/middlewares/institution.middleware.js`)**:
   - Extracts `req.user.institutionId`.
   - Validates that the institution exists and is not `suspended`.
   - Injects `req.institutionId` to guarantee 100% multi-tenant query isolation.
2. **Activation Controller (`src/controllers/activation.controller.js`)**:
   - Hashes incoming `token` and finds matching `Institution` where `activationUsed: false` and `activationExpiresAt > Date.now()`.
   - Validates password meets 12+ character security requirement.
   - Creates or updates `User` account:
     - `role: "institution_admin"`
     - `email: institution.representativeEmail`
     - `institutionId: institution._id`
     - `isEmailVerified: true`
   - Updates `Institution`:
     - `adminUserId: user._id`
     - `activationUsed: true`
     - `status: "onboarding"`
   - Issues 7-day JWT and returns `200 { token, user, institution }`.

### 3.3 Onboarding Wizard & Workspace Controllers
1. **Branding & Status Controller (`src/controllers/institutionAdmin.controller.js`)**:
   - `getInstitutionMe`: Returns current institution with populated `onboarding` step data.
   - `updateBranding`: Updates display name, color hex, tagline, and logoUrl. Updates `onboarding.completedSteps` and advances `onboarding.currentStep`.
2. **Department Controller (`src/controllers/department.controller.js`)**:
   - `getDepartments`: Lists all departments scoped to `req.institutionId`.
   - `createDepartment`: Enforces department limit (10 for Premium) and unique code.
   - `updateDepartment`: Updates name, faculty, head.
   - `deleteDepartment`: Checks if department is linked to any `InstitutionMember` before deletion.
3. **Member Management & CSV Import (`src/controllers/member.controller.js`)**:
   - `getMembers`: Filtered pagination by role, department, search string.
   - `addMember`: Checks plan seat limit, checks duplicate email in tenant (`409`), optionally sends invitation email.
   - `importMembers`: Stream/parse CSV or JSON rows. Parses headers (`name`, `email`, `department`, `designation` with aliases `Full Name` and `Professional Email`). Validates email syntax, dedupes, enforces seat limits, and reports `{ imported, skipped: [{ row, reason }] }`.
   - `resendInvite`: Rate-limits resend requests (`429`) and updates `invitedAt`.
   - `deleteMember`: Detaches user reference or removes draft member document.

### 3.4 Paystack Subscription Checkout & Webhook Reconciliation
1. **Paystack Subscription Integration (`src/utils/paystack.js`)**:
   - Add `initializeSubscriptionTransaction({ email, amount, currency, plan, billing, institutionId })`.
   - Generates Paystack transaction with `access_code` and `reference`.
2. **Subscription Controller (`src/controllers/subscription.controller.js`)**:
   - `createCheckout`: Validates requested plan and billing cycle. Computes canonical amount server-side. Invokes Paystack API. Returns `{ reference, access_code, checkoutUrl, amount, currency, discount, total }`.
   - `getSubscription`: Fetches active plan, renewal date, and billing invoices.
3. **Webhook Reconciliation (`src/controllers/webhook.controller.js`)**:
   - Extend existing HMAC-SHA512 Paystack webhook listener:
   - On `charge.success` for institution subscription:
     - Verify reference and amount.
     - Upsert `Subscription` document: `status: "active"`, `periodStart: Date.now()`, `periodEnd: periodEnd`.
     - Update `Institution`: `status: "active"`.
     - Append invoice to `subscription.invoices`.
     - Send payment receipt email to institution admin.

### 3.5 Dashboard Analytics
1. **Dashboard Controller (`src/controllers/institutionDashboard.controller.js`)**:
   - Aggregates live tenant data:
     - `totalStudents`: Count of student members.
     - `totalTeachers`: Count of tutor members.
     - `activeDepartments`: Count of active departments.
     - `seatUtilization`: Percentage of plan seats consumed.
     - `recentActivity`: Member additions and department changes.

### 3.6 Route Mounts & Documentation Sync
1. **Mount Routes in `src/app.js`**:
   - Mount `/api/institutions/activate` on `institutionRoutes`.
   - Mount `/api/institutions/me/*` on `institutionAdminRoutes` with `authGuard`, `roleGuard("institution_admin")`, and `institutionContext`.
2. **Interactive Docs Portal (`src/views/docs.html`)**:
   - Add Section "Institution Onboarding, Workspace & Subscriptions" covering all 12 Phase 2 endpoints with live Try It Out drawers.
3. **Seed Engine (`src/seed.js`)**:
   - Seed sample `Institution` records, pre-seeded departments, and member rosters.
4. **Smoke Suite (`scripts/test-e2e-smoke.js`)**:
   - Add `FLOW 10: Institution Activation, Wizard Step Persistence, Member Import & Subscription Checkout`.

---

## 4. Dependencies

No new external npm packages required. All functionality uses existing packages:
* `crypto` (Token hashing)
* `mongoose` (Tenant data models & unique compound indexes)
* `express` & `express-rate-limit` (Routing & rate limiting)
* `nodemailer` (Member invite & receipt emails)
* `paystack` API integration (via existing HTTPS fetch helpers in `src/utils/paystack.js`)

---

## 5. Verification Checklist

- [ ] `POST /api/institutions/activate` validates 12+ character password and rejects weak passwords with `400`.
- [ ] `POST /api/institutions/activate` consumes single-use 7-day token and returns `200 { token, user, institution }`.
- [ ] `POST /api/institutions/activate` rejects already used or expired token with `410 TOKEN_EXPIRED`.
- [ ] `GET /api/institutions/me` returns current step and completed steps for onboarding resume.
- [ ] `PUT /api/institutions/me/branding` updates branding, requires valid S3 `logos/` key, and advances onboarding step.
- [ ] `POST /api/institutions/me/departments` creates department with unique code per tenant (enforces 10 dept limit on Premium).
- [ ] `DELETE /api/institutions/me/departments/:id` blocks deletion if active members belong to the department.
- [ ] `POST /api/institutions/me/members` adds member and rejects duplicate email in same institution with `409`.
- [ ] `POST /api/institutions/me/members` enforces 500 student seat limit on Premium plan (`400 SEAT_LIMIT_EXCEEDED`).
- [ ] `POST /api/institutions/me/members/import` successfully parses CSV with aliases (`Full Name`, `Professional Email`) and returns accurate imported/skipped summary.
- [ ] `POST /api/institutions/me/members/:id/invite` rate limits rapid resend attempts (`429`).
- [ ] `POST /api/institutions/me/subscription/checkout` computes canonical amounts ($249/mo, $599/mo, 20% annual discount) and returns `{ reference, access_code }`.
- [ ] `POST /api/webhooks/paystack` transitions institution status to `active` upon signature-verified charge success.
- [ ] `GET /api/institutions/me/dashboard` returns real-time calculated metrics for students, tutors, and departments.
- [ ] Every query under `/api/institutions/me/*` strictly enforces multi-tenant isolation by `institutionId`.
- [ ] `npm run build` passes with 0 syntax errors.
- [ ] `npm run test:smoke` passes all assertions.
