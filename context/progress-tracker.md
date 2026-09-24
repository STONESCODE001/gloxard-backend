# Progress Tracker - Gloxad Academy Backend API

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Current Active Milestone Spec: [`01-auth-email-otp.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/01-auth-email-otp.md)

---

## Current Phase
- **Phase 1**: Identity, Security & Core Foundation

## Current Goal
- Milestone 1 (Units 01, 02, 03) **COMPLETED & VERIFIED**. Ready to commence Unit 04 (User Profile Management & AWS S3 Presigned Media Offloading).

---

## Units Progress Summary

- [x] **Audit & Scaffolding**: Initial repository analysis, rule violation fixes, and dependency installation.
- [x] **Milestone 1 (01-auth-email-otp)**: User Authentication, Email & OTP System [COMPLETED]
  - [x] **Unit 01**: Core Foundation & Centralized Error Infrastructure
  - [x] **Unit 02**: Authentication Core & JWT Access Guards
  - [x] **Unit 03**: Email OTP Verification & Password Recovery System
- [ ] **Unit 04**: User Profile Management & AWS S3 Presigned Media Offloading
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

## Completed in Milestone 1 (`01-auth-email-otp.md`)

1. **Dependencies**:
   - `jsonwebtoken`, `bcryptjs`, `nodemailer`, `express-rate-limit`, `cors`, `helmet`.
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
6. **Documentation Portal**:
   - [`src/views/docs.html`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/views/docs.html): Conforms strictly to [`context/ui-context.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/ui-context.md) and served directly at `GET /`.

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

---

## Next Up
- **Unit 04**: User Profile Management & AWS S3 Presigned Media Offloading.
  - Scope:
    1. AWS SDK S3 client and presigned URL helper (`src/utils/s3.js`).
    2. `PUT /api/auth/update-profile`: Update bio, socials, and notification preferences.
    3. `POST /api/upload/presigned-url`: Generates S3 PUT presigned URLs for client-side uploads (enforcing Rule 2: Zero Raw File Buffering on API server).
    4. Sync new endpoints to `src/views/docs.html`.

---

## Architecture Decisions & Invariants Enforced
- **Rule 1: Uniform Error Schema**: All 4xx and 5xx responses strictly return `{ "error": "<message>" }`.
- **Rule 5: Strict Identifier Standard**: Primary keys strictly retain `_id` and are never projected to `id`.
- **Stateless Auth**: JWT Bearer authorization in `Authorization: Bearer <token>` with 7-day expiration.
- **Unified Deployment**: `src/views/docs.html` is served directly by the Express app at `GET /`, guaranteeing that deploying the backend automatically deploys the updated documentation with zero manual steps.
- **Build Verification Invariant**: `npm run build` (`node scripts/build.js`) executes strict syntax validation (`node --check`) across all project files before every commit/deployment.
- **Entrypoint Compatibility**: Created root `index.js` re-exporting `src/index.js` so hosting environments (e.g. Render defaults) executing `node index.js` boot without `MODULE_NOT_FOUND`.