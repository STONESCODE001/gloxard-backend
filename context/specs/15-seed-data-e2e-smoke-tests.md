# Specification: Unit 15 — Seed Data & End-to-End System Smoke Tests

> **Spec Identifier**: `15-seed-data-e2e-smoke-tests`  
> **Target Spec File**: `context/specs/15-seed-data-e2e-smoke-tests.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 2, 3, 4, and 5)  

---

## 1. Goal

Deliver an automated database seeding utility (`src/seed.js`) that populates Gloxad Academy with comprehensive, realistic demo data (admins, verified instructors, categories, published sample courses with modules and gradable quizzes, enrollments, and messages) and an automated end-to-end system smoke test suite (`scripts/test-e2e-smoke.js`). Verify 100% compliance across all 5 core architectural invariants—uniform error schema, presigned S3 media offloading, content protection, Paystack payment verification idempotency, and primary key `_id` consistency—and confirm full operational readiness across all user flows.

---

## 2. Design

### 2.1 Visual & Structural Decisions

Following `context/code-standards.md` and `context/architecture.md`, Unit 15 establishes system-wide quality assurance and automated data seeding.

#### Terminal Console & Logging Design
Both `src/seed.js` and `scripts/test-e2e-smoke.js` utilize structured ANSI terminal formatting to deliver clear visual status reports:
* **Headers & Banners**: Bright cyan bold section dividers (`[SEEDING DATABASE]`, `[RUNNING E2E SMOKE TESTS]`).
* **Success Markers**: `[PASS]` or `[SEED SUCCESS]` in bright green (`\x1b[32m`).
* **Failure Markers**: `[FAIL]` or `[ERROR]` in bright red (`\x1b[31m`).
* **Invariant Badges**: Yellow indicators (`[INVARIANT 1..5]`) matching the 5 architectural invariants.
* **Summary Table**: Tabular CLI output summarizing total suites, total assertions, passed count, failed count, and total execution duration in milliseconds.

#### Database Seeding Architecture (`src/seed.js`)
* **Deterministic Collection Teardown**: Completely purges existing documents across all Mongoose models (`User`, `Otp`, `Category`, `Course`, `Enrollment`, `Transaction`, `Question`, `Note`, `Progress`, `Conversation`, `Message`, `Notification`) before inserting new seed documents to prevent duplicate key errors (`E11000`).
* **Entity Relationships & References**:
  * **System Admin**: `admin@gloxad.com` (Role: `admin`, `isVerified: true`).
  * **Instructors**: 
    * `jane.tutor@gloxad.com` (Role: `instructor`, `approvalStatus: "approved"`, `isVerified: true`).
    * `john.tutor@gloxad.com` (Role: `instructor`, `approvalStatus: "approved"`, `isVerified: true`).
    * `pending.tutor@gloxad.com` (Role: `instructor`, `approvalStatus: "pending"`, `isVerified: false`).
  * **Students**:
    * `alice.student@gloxad.com` (Role: `student`, `isVerified: true`).
    * `bob.student@gloxad.com` (Role: `student`, `isVerified: true`).
  * **Categories**:
    * Web Development (Subcategories: Frontend, Backend; Topics: React, Node.js, Express).
    * Data Science (Subcategories: Machine Learning, Python; Topics: Pandas, PyTorch).
    * Design & UX (Subcategories: Figma, UI Design; Topics: Wireframing, Prototyping).
  * **Courses**:
    * "Fullstack JavaScript Mastery" (Published, Paid: $49.99, Instructor: Jane, 2 Modules, 4 Lessons with S3 presigned video URLs, 1 Quiz with 2 Questions).
    * "Python Data Science Bootcamp" (Published, Free: $0, Instructor: John, 1 Module, 2 Lessons, 1 Quiz).
    * "Figma UI/UX Design Essentials" (Draft, Paid: $29.99, Instructor: Jane).
  * **Enrollments & Progress**:
    * Alice enrolled in "Fullstack JavaScript Mastery" (Progress: 50%, 2 lessons completed).
    * Bob enrolled in "Python Data Science Bootcamp" (Progress: 100%, Certificate issued).
  * **Community & Messaging**:
    * Group course chat for "Fullstack JavaScript Mastery" with sample messages between Jane and Alice.
    * In-app notification records for welcome events and course submission notices.

#### E2E System Smoke Test Suite Architecture (`scripts/test-e2e-smoke.js`)
* **HTTP Target Server**: Operates against `http://localhost:3001` (or dynamic `PORT` specified in environment). If server is not active, test runner detects port unavailability, logs an error message, and provides actionable guidance.
* **Test Isolation**: Executes real HTTP REST requests and Socket.io client connections without mocking controller functions, guaranteeing end-to-end integration validation.

---

## 3. Implementation

### 3.1 Database Seeding Utility (`src/seed.js`)

1. **Database Connection & Safety Guard**:
   - Imports `dotenv/config`, Mongoose connection helper from `src/config/db.js`, and standard models.
   - Verifies environment connection to prevent accidental execution against production databases (`NODE_ENV === 'production'` safety check).
2. **Collection Purge Sequence**:
   - Executes `await Model.deleteMany({})` sequentially across `User`, `Otp`, `Category`, `Course`, `Enrollment`, `Transaction`, `Question`, `Note`, `Progress`, `Conversation`, `Message`, `Notification`.
3. **Password Pre-Hashing**:
   - Pre-hashes standard test password (`Password123!`) using `bcrypt.hash(password, 10)` to optimize seed script execution time.
4. **Data Generation & Insertion**:
   - **Admins & Users**: Inserts Admin, Instructors, and Students with complete profile metadata (`firstName`, `lastName`, `avatarUrl`, `bio`, `socials`).
   - **Taxonomy**: Creates categories and retrieves generated `_id`s for course references.
   - **Courses & Modules**: Inserts published sample courses with nested modules, video URLs (pointing to valid mock S3 paths `https://gloxad-bucket.s3.amazonaws.com/courses/...`), and quizzes containing `correctOptionIndex`.
   - **Enrollments & Transactions**: Creates active enrollments linked to users and courses, along with matching Paystack `Transaction` records (`reference: "SEED_REF_1001"`).
   - **Conversations & Messages**: Establishes 1:1 and group conversations in `Conversation` model and populates `Message` records.
5. **CLI Output & Cleanup**:
   - Prints table of inserted entities: `Users: 5`, `Categories: 3`, `Courses: 3`, `Enrollments: 2`, `Transactions: 2`, `Messages: 4`.
   - Disconnects Mongoose via `await mongoose.connection.close()` and exits with code `0`.

---

### 3.2 End-to-End System Smoke Test Suite (`scripts/test-e2e-smoke.js`)

The smoke test suite is divided into two primary assertion categories:

#### Part 1: Architectural Invariants Verification
1. **Invariant 1: Uniform Error Schema Validation**
   - Triggers `400 Bad Request` (`POST /api/auth/signup` with missing fields).
   - Triggers `401 Unauthorized` (`GET /api/auth/me` with invalid token).
   - Triggers `403 Forbidden` (`POST /api/tutor/courses` using student JWT).
   - Triggers `404 Not Found` (`GET /api/courses/non-existent-course-id-999`).
   - Asserts every response body strictly matches `{ "error": expect.any(String) }` with zero extra root keys like `message`, `stack`, or HTML markup.
2. **Invariant 2: Presigned S3 Media Offloading Validation**
   - Calls `POST /api/upload/presigned-url` with `{ "filename": "test-video.mp4", "fileType": "video/mp4", "folder": "courses" }`.
   - Asserts response contains `uploadUrl` (AWS S3 presigned PUT URL) and `fileUrl`.
   - Asserts Express server does not expose multipart upload endpoints or file buffer streaming middleware.
3. **Invariant 3: Content Protection Integrity Validation**
   - Fetches published paid course via `GET /api/courses/:id` without `Authorization` header.
   - Asserts `videoUrl` and `correctOptionIndex` are `undefined` / stripped from lesson and quiz objects.
   - Fetches same course using enrolled student Bearer JWT.
   - Asserts `videoUrl` and `correctOptionIndex` are fully populated and visible.
4. **Invariant 4: Paystack Server-Side Verification & Idempotency Validation**
   - Calls `POST /api/enrollments/checkout` with invalid Paystack reference (`"INVALID_REF_X"`).
   - Asserts backend returns HTTP `400` with uniform error `{ "error": "Paystack transaction verification failed: ..." }`.
   - Calls `POST /api/enrollments/checkout` with valid mock reference.
   - Sends duplicate checkout request with identical reference.
   - Asserts second request succeeds idempotently (`200 OK`) and returns existing `Enrollment` without duplicate database creation.
5. **Invariant 5: Primary Key `_id` Naming Consistency Validation**
   - Inspects response payloads across `/api/auth/me`, `/api/courses`, `/api/categories`, `/api/enrollments/my-courses`, and `/api/messages/conversations`.
   - Asserts every entity object contains string key `_id` and does not use `id` or raw `_id: { $oid: ... }`.

#### Part 2: End-to-End User Flow Execution
1. **Flow 1: User Auth & Verification Flow**:
   - Register new student -> Signin -> Fetch profile (`GET /api/auth/me`) -> Update profile -> Verify JWT claims.
2. **Flow 2: Tutor Showcase & Admin Moderation Flow**:
   - Register new instructor (`approvalStatus: "pending"`) -> Showcase expertise -> Admin lists pending tutors (`GET /api/admin/users?role=instructor`) -> Admin approves tutor -> Verify tutor status updated to `"approved"`.
3. **Flow 3: 5-Step Course Authoring & Review Pipeline**:
   - Approved instructor initializes Step 1 draft -> Updates Step 2 & 3 modules/quizzes -> Submits course for review -> Admin lists pending courses -> Admin approves course -> Verify course `status: "published"`.
4. **Flow 4: Public Course Discovery & Search**:
   - Search public courses by keyword -> Filter by category -> Verify pagination metadata (`page`, `limit`, `total`, `totalPages`).
5. **Flow 5: Free & Paid Enrollments**:
   - Enroll student in free course (`POST /api/enrollments/enroll/:id`) -> Verify enrollment record and automatic group chat room joining.
6. **Flow 6: Learning Engine & Quiz Evaluation**:
   - Mark lesson progress (`POST /api/learning/:courseId/progress`) -> Submit quiz answers (`POST /api/learning/:courseId/quiz/:moduleId/submit`) -> Verify quiz score calculation -> Fetch completion certificate (`GET /api/learning/:courseId/certificate`).
7. **Flow 7: Real-Time Messaging & Notifications**:
   - Post message (`POST /api/messages/:conversationId`) -> Connect Socket.io client -> Verify real-time event emission (`new_message`) -> Fetch notifications (`GET /api/notifications`).

---

### 3.3 Package.json Script Integration

Update `package.json` to define standardized scripts for seeding and testing:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",
  "build": "node scripts/build.js",
  "seed": "node src/seed.js",
  "test:smoke": "node scripts/test-e2e-smoke.js",
  "test": "npm run test:smoke"
}
```

---

### 3.4 API Documentation Synchronization (`src/views/docs.html`)

Update `src/views/docs.html` to document:
* **Seed Credentials Card**: Displays default test user accounts (`admin@gloxad.com`, `jane.tutor@gloxad.com`, `alice.student@gloxad.com` with password `Password123!`).
* **Quality Assurance Section**: Explains how to execute automated E2E smoke tests via `npm run test:smoke`.

---

## 4. Dependencies

* **Packages To Install**: None.
* **Architecture Rules**: Uses Node.js native modules (`assert`, `child_process`, `http`), existing dependencies (`axios`, `mongoose`, `bcryptjs`, `jsonwebtoken`), and `socket.io-client` (already installed in `devDependencies`).

---

## 5. Verification Checklist

- [ ] **File Locations**: `src/seed.js` and `scripts/test-e2e-smoke.js` exist and are executable.
- [ ] **Clean Seeding Execution**: Running `npm run seed` purges the database, seeds admin, instructors, students, categories, published courses, enrollments, and messages cleanly without duplicate key errors, and exits with code 0.
- [ ] **Invariant 1 Verification**: Automated test confirms all error responses match `{ "error": "<msg>" }`.
- [ ] **Invariant 2 Verification**: Automated test confirms S3 presigned URL generation operates cleanly without raw server buffering.
- [ ] **Invariant 3 Verification**: Automated test confirms `videoUrl` and `correctOptionIndex` are hidden from non-enrolled users and visible to enrolled users.
- [ ] **Invariant 4 Verification**: Automated test confirms Paystack payment references are verified server-side and processed idempotently.
- [ ] **Invariant 5 Verification**: Automated test confirms `_id` naming consistency across all entity models.
- [ ] **E2E Flow 1 (Auth & OTP)**: Test suite confirms complete signup, signin, OTP, and profile lifecycle.
- [ ] **E2E Flow 2 (Tutor Approval)**: Test suite confirms instructor onboarding and admin approval workflow.
- [ ] **E2E Flow 3 (Course Authoring)**: Test suite confirms 5-step wizard creation, submission, and admin publishing.
- [ ] **E2E Flow 4 (Catalog Search)**: Test suite confirms public search, category filtering, and pagination.
- [ ] **E2E Flow 5 (Enrollments)**: Test suite confirms free enrollment and paid Paystack checkout.
- [ ] **E2E Flow 6 (Learning Engine)**: Test suite confirms lesson progress updates, server-side quiz grading, and certificate retrieval.
- [ ] **E2E Flow 7 (Messaging & Socket)**: Test suite confirms REST message creation and real-time Socket.io event emissions.
- [ ] **CLI Summary Table**: Test suite prints clean CLI report table with 100% passed assertions.
- [ ] **Documentation Sync**: `src/views/docs.html` updated with seed account details and smoke test instructions.
