# Implementation Plan - Gloxad Academy Backend API

This document details the architectural setup, project structure, conventions, database models, and step-by-step roadmap for building the **Gloxad Academy Backend API** according to the provided specification document.

---

## Technical Overview & Conventions

### Stack Selection
- **Runtime & Framework**: Node.js + Express.js (ES Modules / `"type": "module"`)
- **Database**: MongoDB + Mongoose ODM
- **Real-Time Communication**: Socket.io
- **Authentication**: JWT (JSON Web Tokens in `Authorization: Bearer <token>` header) + `bcryptjs`
- **File Uploads**: AWS S3 pre-signed URLs (`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`)
- **Payments**: Paystack REST API verification + webhook HMAC-SHA512 verification
- **Security & Infrastructure**: `cors` (credentials enabled), `helmet`, `express-rate-limit`, `zod` or `joi` for request validation

### Standardized Response & Error Format
- **Base REST Path**: `/api` (e.g. `http://localhost:3001/api`)
- **Socket Path**: `http://localhost:3001`
- **ID Field**: `_id` string across all endpoints and responses
- **Error Response Format**:
  ```json
  { "error": "Human-readable error message" }
  ```
- **HTTP Status Codes**:
  - `200` / `201`: Success
  - `400`: Validation or Bad Request
  - `401`: Unauthorized / Unauthenticated / Expired token
  - `403`: Forbidden (Wrong role or lack of ownership)
  - `404`: Resource Not Found
  - `409`: Conflict (e.g. Duplicate Email, Duplicate Enrollment)
  - `422`: Unprocessable Entity / Semantic Error
  - `429`: Rate Limited

---

## Project Structure

```
gloxard/
├── package.json
├── IMPLEMENTATION_PLAN.md
├── .env.example
├── .gitignore
├── src/
│   ├── app.js               # Express application initialization & middleware
│   ├── server.js            # HTTP server & Socket.io entry point
│   ├── config/
│   │   ├── db.js            # Mongoose database connection
│   │   └── env.js           # Environment variable validation & exports
│   ├── constants/
│   │   └── index.js         # Roles, status enums, default limits
│   ├── middlewares/
│   │   ├── auth.middleware.js       # JWT authentication & req.user extraction
│   │   ├── role.middleware.js       # Role guards (student, instructor, admin)
│   │   ├── error.middleware.js      # Global JSON error handler returning { error }
│   │   ├── validate.middleware.js   # Request body/query validator
│   │   └── rateLimiter.middleware.js # Rate limiting configurations
│   ├── models/
│   │   ├── User.model.js
│   │   ├── Otp.model.js
│   │   ├── Category.model.js
│   │   ├── Course.model.js
│   │   ├── Enrollment.model.js
│   │   ├── Transaction.model.js
│   │   ├── Review.model.js
│   │   ├── Appeal.model.js
│   │   ├── Conversation.model.js
│   │   ├── Message.model.js
│   │   ├── Notification.model.js
│   │   └── QuestionNoteMisc.model.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── upload.controller.js
│   │   ├── category.controller.js
│   │   ├── course.controller.js
│   │   ├── enrollment.controller.js
│   │   ├── learning.controller.js
│   │   ├── tutor.controller.js
│   │   ├── admin.controller.js
│   │   ├── message.controller.js
│   │   ├── notification.controller.js
│   │   └── webhook.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── upload.routes.js
│   │   ├── category.routes.js
│   │   ├── course.routes.js
│   │   ├── enrollment.routes.js
│   │   ├── learning.routes.js
│   │   ├── tutor.routes.js
│   │   ├── admin.routes.js
│   │   ├── message.routes.js
│   │   ├── notification.routes.js
│   │   └── webhook.routes.js
│   ├── socket/
│   │   └── socket.handler.js  # Socket.io connection, rooms, typing & events
│   └── utils/
│       ├── jwt.js           # Token generation & verification
│       ├── hash.js          # Password hashing helpers
│       ├── email.js         # Email/OTP dispatch service
│       ├── paystack.js      # Paystack API integration
│       └── s3.js            # S3 presigned URL generator
```

---

## Suggested Step-by-Step Build Order

### Milestone 1: Project Setup & Foundation
- Setup `package.json` (ES Modules, dependencies).
- Configure environment variables (`MONGODB_URI`, `JWT_SECRET`, `PORT`, `FRONTEND_ORIGIN`, etc.).
- Establish MongoDB connection via Mongoose.
- Set up Express app with `cors` (with credentials), `helmet`, `express.json()`.
- Implement global error handling middleware producing `{ "error": "message" }`.

### Milestone 2: Authentication & OTP System
- **Models**: `User`, `Otp`.
- **Endpoints**:
  - `POST /api/auth/signup` (Student / Instructor creation, email verification trigger).
  - `POST /api/auth/signin` (Returns JWT + public user object).
  - `GET /api/auth/me` (Validates Bearer token, returns full profile).
  - `POST /api/auth/signout` (Clears auth context).
  - `POST /api/auth/verify-email` (Validates 4-digit OTP, sets `isVerified: true`).
  - `POST /api/auth/forget-passwd` (Generates 5-digit OTP).
  - `POST /api/auth/verify-otp` (Validates OTP without consuming).
  - `POST /api/auth/reset-passwd` (Resets password and consumes OTP).
  - `POST /api/auth/update-password` (Authenticated password change).

### Milestone 3: Profile & Presigned S3 File Uploads
- **Endpoints**:
  - `PUT /api/auth/update-profile` (Updates bio, socials, avatarUrl, notification preferences).
  - `POST /api/upload/presigned-url` (Generates AWS S3 PUT presigned URLs for avatars, course content, credentials).

### Milestone 4: Categories & Public Courses
- **Models**: `Category`, `Course`.
- **Endpoints**:
  - `GET /api/categories` & `POST/DELETE /api/admin/categories`.
  - `GET /api/courses` (Search, filters: free/paid/trimester, sort, pagination).
  - `GET /api/courses/:slugOrId` (Full course metadata with preview protection for un-enrolled users).

### Milestone 5: Tutor Onboarding & Course Authoring (5-step wizard)
- **Endpoints**:
  - `POST /api/tutor/showcase-expertise` (Upload credentials, submit bio).
  - `GET /api/tutor/dashboard-stats` & `GET /api/tutor/earnings`.
  - `POST /api/tutor/courses` (Create draft course).
  - `PUT /api/tutor/courses/:id` (Incremental step update).
  - `GET /api/tutor/courses` & `GET /api/tutor/courses/:id`.
  - `POST /api/tutor/courses/:id/submit` (Submit for admin review).
  - `POST /api/tutor/courses/:id/appeal` (Appeal course rejection).

### Milestone 6: Admin Moderation & Management
- **Endpoints**:
  - `GET /api/admin/dashboard-stats`, `GET /api/admin/recent-registrations`, `GET /api/admin/recent-transactions`.
  - `GET /api/admin/users`, `GET/DELETE /api/admin/users/:id`.
  - `PUT /api/admin/tutors/:id/approval` (Approve/Reject tutor).
  - `GET /api/admin/courses/pending`, `GET /api/admin/courses/all`, `PUT /api/admin/courses/:id/status`.
  - `GET /api/admin/appeals`, `PUT /api/admin/appeals/:id/status`.
  - `GET /api/admin/finance`, `POST /api/admin/broadcast`.

### Milestone 7: Enrollments, Payments (Paystack) & Webhook
- **Models**: `Enrollment`, `Transaction`.
- **Endpoints**:
  - `POST /api/enrollments/enroll/:courseId` (Free course enrollment).
  - `POST /api/enrollments/checkout` (Server-side Paystack verification & paid enrollment creation).
  - `POST /api/webhooks/paystack` (Idempotent signature-verified webhook handling).
  - `GET /api/enrollments/my-courses` (User's enrolled courses with computed progress).

### Milestone 8: Learning Experience
- **Endpoints**:
  - `GET/POST /api/learning/:courseId/questions` (Q&A thread).
  - `GET/POST /api/learning/:courseId/notes` (Private notes).
  - `GET /api/learning/:courseId/announcements`.
  - `POST /api/learning/:courseId/quiz/:moduleId/submit` (Server-side quiz grading).
  - `POST /api/learning/:courseId/progress` (Lesson completion & video position tracking).
  - `GET /api/learning/:courseId/certificate`.

### Milestone 9: Messaging (REST + Socket.io) & Notifications
- **Models**: `Conversation`, `Message`, `Notification`.
- **Socket.io Events**: `join_user`, `join_conversation`, `leave_conversation`, `typing`, `stop_typing`, `new_message`, `new_notification`.
- **Endpoints**:
  - `GET /api/messages/conversations`, `GET /api/messages/:conversationId`, `POST /api/messages/:conversationId`.
  - `POST /api/messages/conversations/new`.
  - `GET /api/notifications` & `POST /api/notifications/mark-read`.

---

## Verification Plan

### Automated Tests
- Environment validation tests.
- Authentication integration tests (signup, OTP verification, signin, token guard).
- Role access control tests (Student cannot access `/api/admin/*` or `/api/tutor/*`).
- Paystack webhook signature verification tests.

### Manual Verification
- Testing server startup with `npm run dev` / `node src/server.js`.
- Testing API endpoints via HTTP client/Postman or curl.
- Verifying MongoDB schema indexes and connection status.
