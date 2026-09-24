# Progress Tracker - Gloxad Academy Backend API

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)

## Units Progress

- [x] **Audit & Scaffolding**: Initial repository analysis and gap assessment
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

## Codebase Audit Log (`01-auth-email-otp.md`)

### What Was Already Done
1. **Initial Runtime & DB Setup**:
   - `package.json` initialized with ES Modules (`type: module`), basic scripts (`start`, `dev`), and dependencies (`bcrypt`, `dotenv`, `express@5.2.1`, `mongoose@9.10.2`, `nodemon`).
   - `src/config/db.js`: MongoDB connection established with Mongoose.
   - `src/index.js`: Basic Express listener and DB connect invocation.
2. **Initial User Model (`src/models/User.model.js`)**:
   - Fields: `name`, `firstName`, `lastName`, `username`, `email`, `passwordHash`, `avatar`, `bio`, `role`, `certifications`, `isVerified`, `isActive`, `socialLinks`, `notificationPreferences`, `lastLoginAt`.
   - Pre-save hooks for name computation and password hashing.
3. **Draft Auth Controller & Routes**:
   - Rudimentary `registerUser`, `loginUser`, and `logoutUser` in `src/controllers/auth.controller.js` and routes in `src/routes/auth.routes.js`.
   - Mounted at `/api/v1/users` in `src/app.js`.

### Identified Gaps & Violations to Fix
1. **Rule 1 Violation (`{ "error": "..." }`)**: Current controllers return `{ message: "..." }`. Must strictly follow `{ "error": "<msg>" }`.
2. **Rule 5 Violation (`_id` invariant)**: Current controllers project `id: user._id`. Must strictly retain `_id`.
3. **Missing Dependencies**: Need `jsonwebtoken`, `bcryptjs`, `nodemailer`, `express-rate-limit`, `cors`, `helmet`.
4. **Environment Config**: `src/config/env.js` is empty. Needs validation of `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_ORIGIN`, and SMTP credentials.
5. **Model Inconsistencies**:
   - `User.model.js`: Needs `password` (instead of `passwordHash`), `approvalStatus` (`pending`, `approved`, `rejected`), `avatarUrl`, `socials`, and password stripping on `toJSON`.
   - `Otp.model.js`: Missing completely. Needs schema with TTL auto-expiration for 4-digit and 5-digit OTPs.
6. **Missing Middlewares & Utilities**:
   - `src/utils/hash.js`, `src/utils/jwt.js`, `src/utils/email.js` (with dev logger fallback).
   - `src/middlewares/auth.middleware.js`, `role.middleware.js`, `rateLimiter.middleware.js`, `error.middleware.js`.
7. **Missing Endpoints (6 of 9)**:
   - Needs: `signup`, `signin`, `getMe`, `signout`, `verifyEmail`, `forgotPassword`, `verifyOtp`, `resetPassword`, `updatePassword`.
8. **App Wiring & Docs**:
   - Mount routes at `/api/auth`.
   - Global 404 handler and error middleware.
   - Serve `src/views/docs.html` at `GET /` matching `context/ui-context.md`.

### Next Steps Sequence
1. Install dependencies: `npm install jsonwebtoken bcryptjs nodemailer express-rate-limit cors helmet`. [DONE]
2. Build environment configuration `src/config/env.js` and `.env.example`. [DONE]
3. Align `src/models/User.model.js` and create `src/models/Otp.model.js`. [DONE]
4. Implement utilities: `src/utils/hash.js`, `src/utils/jwt.js`, `src/utils/email.js`. [DONE]
5. Implement middlewares: `src/middlewares/error.middleware.js`, `src/middlewares/auth.middleware.js`, `src/middlewares/role.middleware.js`, `src/middlewares/rateLimiter.middleware.js`. [DONE]
6. Implement all 9 controller functions in `src/controllers/auth.controller.js` and wire in `src/routes/auth.routes.js`. [DONE]
7. Update `src/app.js` and `src/index.js`. [DONE]
8. Create `src/views/docs.html` adhering to `context/ui-context.md`. [DONE]
9. Test and verify against the checklist using curl. [DONE - 100% Passed]

### Milestone 1 Verification Results
- [x] **GET /**: Returns HTML API documentation portal conforming to `ui-context.md`.
- [x] **GET /api/unknown-endpoint**: Returns `404 {"error": "Route not found"}`.
- [x] **POST /api/auth/signup (validation)**: Returns `400 {"error": "First name, email, and password are required"}`.
- [x] **POST /api/auth/signup (student)**: Returns `201 Created` with `user` object retaining `_id` and stripping `password`.
- [x] **POST /api/auth/signup (duplicate)**: Returns `409 Conflict {"error": "User with this email or username already exists"}`.
- [x] **POST /api/auth/signup (instructor)**: Sets `approvalStatus: "pending"`, generates 4-digit verification OTP, dispatches email.
- [x] **POST /api/auth/verify-email (invalid)**: Returns `400 {"error": "Invalid or expired OTP code"}`.
- [x] **POST /api/auth/verify-email (valid)**: Returns `200 {"message": "Email verified successfully"}` and marks `isVerified: true`.
- [x] **POST /api/auth/signin (invalid)**: Returns `401 {"error": "Invalid email or password"}`.
- [x] **POST /api/auth/signin (valid)**: Returns `200` with JWT Bearer token and sanitized user profile.
- [x] **GET /api/auth/me (unauthenticated)**: Returns `401 {"error": "Authentication token missing or malformed"}`.
- [x] **GET /api/auth/me (authenticated)**: Returns `200` with populated user document (`_id` preserved).
- [x] **POST /api/auth/forget-passwd**: Returns `200 {"message": "Password reset OTP dispatched to email"}` with anti-enumeration protection.
- [x] **POST /api/auth/verify-otp**: Returns `200 {"valid": true, "message": "OTP is valid"}` without consuming code.
- [x] **POST /api/auth/reset-passwd**: Consumes OTP and resets password.
- [x] **POST /api/auth/update-password**: Verifies current password and updates to new password.
- [x] **POST /api/auth/signout**: Returns `200 {"message": "Successfully signed out"}`.

### Next Step
- **Target Unit**: Unit 04: User Profile Management & AWS S3 Presigned Media Offloading.
- **Specification**: Profile updates (`PUT /api/auth/update-profile`) and AWS S3 direct pre-signed URL generator (`POST /api/upload/presigned-url`).


