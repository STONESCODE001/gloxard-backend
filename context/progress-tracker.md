# Progress Tracker - Gloxad Academy Backend API

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Current Active Spec: [`04-user-profile-s3-upload.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/04-user-profile-s3-upload.md)

---

## Current Phase
- **Phase 1**: Identity, Security & Core Foundation

## Current Goal
- [x] Milestone 1 (Units 01, 02, 03, 04) **COMPLETED & VERIFIED**. Ready to commence Unit 05 (Course Taxonomy & Category Management).

---

## Units Progress Summary

- [x] **Audit & Scaffolding**: Initial repository analysis, rule violation fixes, and dependency installation.
- [x] **Milestone 1 (01-auth-email-otp)**: User Authentication, Email & OTP System [COMPLETED]
  - [x] **Unit 01**: Core Foundation & Centralized Error Infrastructure
  - [x] **Unit 02**: Authentication Core & JWT Access Guards
  - [x] **Unit 03**: Email OTP Verification & Password Recovery System
  - [x] **Phase 1 Alignment (Handoff P0/P1 Blockers)**:
    - [x] Student & Tutor OTP dispatch on signup (4-digit CSPRNG).
    - [x] Session token return on signup (`201 { token, user }`).
    - [x] Verify email updated user return (`200 { message, user }`).
    - [x] `POST /api/auth/resend-verification` implemented.
    - [x] `PUT /api/auth/update-profile` implemented.
    - [x] Server-side session revocation via `tokenVersion`.
    - [x] Isolated rate-limit buckets with `Retry-After`.
    - [x] Multi-provider email integration (Brevo REST API, SMTP Relay, Resend, and Dev Logger fallback).
- [x] **Unit 04**: User Profile Management & AWS S3 Presigned Media Offloading [COMPLETED & VERIFIED]
  - [x] **Phase 1 Alignment**:
    - [x] Upload Presigned URL Generation (S3 offloading) implemented.
    - [x] Direct Media Upload Verification (Client -> S3) verified.
    - [x] Full Profile Update with Collision Prevention & Nested Object Preservation implemented.
- [ ] **Unit 05**: Course Taxonomy & Category Management
- [ ] **Unit 06**: Course Catalog & Public Discovery (with Content Protection)
- [ ] **Unit 07**: Tutor Onboarding & Analytics
- [ ] **Unit 08**: 5-Step Course Authoring Wizard & Review Pipeline
- [ ] **Unit 09**: Admin Moderation, User Management & Platform Operations
- [ ] **Unit 10**: Course Enrollments & Paystack Payment Verification
- [ ] **Unit 11**: Idempotent Paystack Webhook Processing
- [ ] **Unit 12**: Learning Engine (Progress, Server-Side Quiz Grading, Q&A, Notes, Certificate)
- [ ] **Unit 13**: Real-Time Messaging & In-App Notifications (REST + Socket.io)
- [ ] **Unit 14**: Interactive API Documentation Web Page
- [ ] **Unit 15**: Seed Data & End-to-End System Smoke Tests

---

## Completed in Milestone 1

### Units 01 - 03 (`01-auth-email-otp.md`)
1. **Dependencies**: `jsonwebtoken`, `bcryptjs`, `nodemailer`, `express-rate-limit`, `cors`, `helmet`.
2. **Environment & Database Configuration**:
   - [`src/config/env.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/config/env.js): Validated `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_ORIGIN`, SMTP settings.
   - [`.env.example`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/.env.example): Fully documented configuration keys.
   - [`src/config/db.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/config/db.js): Robust Mongoose connection lifecycle handler.
3. **Data Models**:
   - [`src/models/User.model.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/models/User.model.js): Standardized password hashing hook, full `name` calculation, `approvalStatus` (`pending` for instructors, `approved` for students), `socials`, `avatarUrl`, and automatic `toJSON` stripping of `password` and `__v`.
   - [`src/models/Otp.model.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/models/Otp.model.js): Hashed OTP records with MongoDB TTL auto-deletion index (`expires: 0`) and `consumed` tracking.
4. **Middlewares & Utilities**:
   - [`src/utils/hash.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/utils/hash.js): Bcrypt salt hashing & comparison.
   - [`src/utils/jwt.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/utils/jwt.js): JWT token signing & verification (`7d` expiry).
   - [`src/utils/email.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/utils/email.js): Hybrid email dispatch (SMTP + dev logger fallback).
   - [`src/middlewares/auth.middleware.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/middlewares/auth.middleware.js): Bearer JWT extraction and `req.user` injection.
   - [`src/middlewares/role.middleware.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/middlewares/role.middleware.js): Role authorization guard.
   - [`src/middlewares/rateLimiter.middleware.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/middlewares/rateLimiter.middleware.js): IP rate limiting for auth & OTP routes.
   - [`src/middlewares/error.middleware.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/middlewares/error.middleware.js): Centralized error formatter adhering to Rule 1 (`{ "error": "<message>" }`).
5. **Controllers & Routes (`src/controllers/auth.controller.js` & `src/routes/auth.routes.js`)**:
   - `POST /api/auth/signup`: User registration (Student / Instructor with 4-digit OTP).
   - `POST /api/auth/signin`: Stateless authentication & JWT issuance.
   - `GET /api/auth/me`: Authenticated user profile context.
   - `POST /api/auth/signout`: Session termination acknowledgment.
   - `POST /api/auth/verify-email`: 4-digit OTP email verification.
   - `POST /api/auth/forget-passwd`: 5-digit recovery OTP request (anti-enumeration protected).
   - `POST /api/auth/verify-otp`: 5-digit OTP validation without consumption.
   - `POST /api/auth/reset-passwd`: Consumes OTP and sets new password.
   - `POST /api/auth/update-password`: Authenticated password change.

---

### Unit 04 (`04-user-profile-s3-upload.md`)
1. **Dependencies**:
   - Added AWS SDK v3: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
2. **Environment & Configuration**:
   - Extended [`src/config/env.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/config/env.js) and [`.env.example`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/.env.example) to support `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET`.
3. **Data Model Updates**:
   - Updated [`src/models/User.model.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/models/User.model.js) to support `github` link in `socialLinksSchema` and guarantee consistent JSON virtuals output.
4. **AWS S3 Utility & Dev Fallback**:
   - Created [`src/utils/s3.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/utils/s3.js): Validates target folder prefixes (`avatars`, `courses`, `certifications`, `resources`), constructs standardized keys (`<folder>/<timestamp>-<uuid>_<sanitized_filename>`), sets 15-minute expiration (`expiresIn: 900`), and automatically falls back to simulated dev presigned URLs when AWS credentials are absent.
5. **Upload Controller & Routes**:
   - Implemented `POST /api/upload/presigned-url` and `PUT /api/upload/mock-put/*path` in [`src/controllers/upload.controller.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/controllers/upload.controller.js) and [`src/routes/upload.routes.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/routes/upload.routes.js).
   - Mounted upload routes under `/api/upload` in [`src/app.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/app.js).
6. **User Profile Controller Refinements**:
   - Updated `PUT /api/auth/update-profile` in [`src/controllers/auth.controller.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/controllers/auth.controller.js):
     - Validates username uniqueness and returns exact error envelope `400 {"error": "Username is already taken"}`.
     - Performs non-destructive partial updates on nested objects (`socialLinks`, `notificationPreferences`).
7. **Interactive API Documentation Portal Sync**:
   - Updated [`src/views/docs.html`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/views/docs.html) to render documentation blocks, request payload schema tables, and interactive response cards for both `PUT /api/auth/update-profile` and `POST /api/upload/presigned-url`.

---

## Verification Results Checklist (100% Passed)

- [x] `GET /`: Returns HTML API documentation portal conforming to `ui-context.md`.
- [x] `GET /api/unknown-endpoint`: Returns `404 {"error": "Route not found"}`.
- [x] `POST /api/auth/signup (validation)`: Returns `400 {"error": "First name, email, and password are required"}`.
- [x] `POST /api/auth/signup (student)`: Returns `201 Created` with `user` object retaining `_id` and stripping `password`.
- [x] `POST /api/auth/signup (duplicate)`: Returns `409 Conflict {"error": "User with this email or username already exists"}`.
- [x] `POST /api/auth/signup (instructor)`: Sets `approvalStatus: "pending"`, generates 4-digit verification OTP, dispatches email.
- [x] `POST /api/auth/verify-email (invalid)`: Returns `400 {"error": "Invalid or expired OTP code"}`.
- [x] `POST /api/auth/verify-email (valid)`: Returns `200 {"message": "Email verified successfully"}` and marks `isVerified: true`.
- [x] `POST /api/auth/signin (invalid)`: Returns `401 {"error": "Invalid email or password"}`.
- [x] `POST /api/auth/signin (valid)`: Returns `200` with JWT Bearer token and sanitized user profile.
- [x] `GET /api/auth/me (unauthenticated)`: Returns `401 {"error": "Authentication token missing or malformed"}`.
- [x] `GET /api/auth/me (authenticated)`: Returns `200` with populated user document (`_id` preserved).
- [x] `POST /api/auth/forget-passwd`: Returns `200 {"message": "Password reset OTP dispatched to email"}` with anti-enumeration protection.
- [x] `POST /api/auth/verify-otp`: Returns `200 {"valid": true, "message": "OTP is valid"}` without consuming code.
- [x] `POST /api/auth/reset-passwd`: Consumes OTP and resets password.
- [x] `POST /api/auth/update-password`: Verifies current password and updates to new password.
- [x] `POST /api/auth/signout`: Returns `200 {"message": "Successfully signed out"}`.
- [x] `POST /api/upload/presigned-url (unauthenticated)`: Returns `401 {"error": "Authentication token missing or malformed"}`.
- [x] `POST /api/upload/presigned-url (missing body)`: Returns `400 {"error": "Filename and fileType are required"}`.
- [x] `POST /api/upload/presigned-url (valid request)`: Returns `200` containing `uploadUrl`, `fileUrl`, `key`, and `expiresIn: 900`.
- [x] `PUT /api/auth/update-profile (duplicate username)`: Returns `400 {"error": "Username is already taken"}`.
- [x] `PUT /api/auth/update-profile (successful update)`: Returns `200` with updated user profile retaining `_id`.
- [x] `GET / (API docs portal sync)`: Verified HTML portal contains sections for `update-profile` and `presigned-url`.

---

## Next Up
- **Unit 05**: Course Taxonomy & Category Management.
  - Scope:
    1. Category & Subcategory Mongoose models with slugification.
    2. Admin-only category management endpoints (`POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`).
    3. Public taxonomy discovery endpoint (`GET /api/categories`).
    4. Documentation portal sync in `src/views/docs.html`.

---

## Architecture Decisions & Invariants Enforced
- **Rule 1: Uniform Error Schema**: All 4xx and 5xx responses strictly return `{ "error": "<message>" }`.
- **Rule 2: Zero File Buffering**: Direct-to-cloud file upload offloading strictly via AWS S3 PUT presigned URLs without streaming raw bytes through the API server.
- **Rule 5: Strict Identifier Standard**: Primary keys strictly retain `_id` and are never projected to `id`.
- **Stateless Auth**: JWT Bearer authorization in `Authorization: Bearer <token>` with 7-day expiration.
- **Unified Deployment**: `src/views/docs.html` is served directly by the Express app at `GET /`, guaranteeing that deploying the backend automatically deploys the updated documentation with zero manual steps.
- **Build Verification Invariant**: `npm run build` (`node scripts/build.js`) executes strict syntax validation (`node --check`) across all project files before every commit/deployment.