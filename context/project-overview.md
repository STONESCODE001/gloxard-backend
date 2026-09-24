# Project Overview - Gloxad Academy Backend API

## Overview
Gloxad Academy is a high-performance RESTful backend API and real-time Socket.io service designed to power an e-learning platform. Built using Node.js, Express.js (ES Modules), MongoDB with Mongoose ODM, AWS S3 for direct file uploads, Paystack for payment verification, and Socket.io for messaging, the API serves three distinct roles: Students, Instructors, and Admins. It handles authentication with JWT and email OTP verification, course catalog search and discovery, a 5-step course authoring pipeline, server-side quiz grading, progress and certificate tracking, and real-time notifications. The backend also serves an HTML API documentation web page detailing every endpoint for frontend developers.

## Measurable Goals
1. **Endpoint Coverage**: Implement and expose all 35+ REST endpoints and 8 Socket.io real-time events defined in the backend API specification under the `/api` base path.
2. **Access Control Verification**: Achieve 100% role-based access control (RBAC) enforcement across `student`, `instructor`, and `admin` routes, returning HTTP 401 for unauthenticated calls and HTTP 403 for unauthorized calls.
3. **5-Step Authoring Incremental Wizard**: Support complete course creation and editing across 5 separate wizard step payloads (`Basic Info`, `Advanced Info`, `Curriculum & Lessons`, `Publish Messages`, `Final Review`).
4. **Server-Side Payment Idempotency**: Verify 100% of Paystack payment transactions server-side with zero tolerance for browser-side price tampering or duplicate reference processing.
5. **Direct Media Storage Offloading**: Issue short-lived (maximum 15-minute expiration) AWS S3 PUT presigned URLs for 100% of media upload requests, keeping raw video and document byte streaming completely off the Express API server.
6. **Frontend Documentation Accessibility**: Expose an interactive HTML documentation page at `http://localhost:3001/` displaying all API endpoints, HTTP methods, required request headers, payload shapes, and status codes (`200`, `400`, `401`, `403`, `404`, `409`, `422`, `429`).

## Step-by-Step Core User Flow (No Gaps)

1. **Registration**: An unauthenticated user sends `POST /api/auth/signup` with `email`, `password`, `firstName`, `lastName`, and `role` (`student` or `instructor`).
2. **Email Verification**: Instructors receive a 4-digit email OTP and call `POST /api/auth/verify-email` with `{ "email": "...", "otp": "1234" }` to set `user.isVerified = true`.
3. **Authentication**: User calls `POST /api/auth/signin` with email and password. The backend verifies credentials via `bcrypt` and returns a JWT Bearer token and public user object.
4. **Tutor Onboarding Application**: An instructor calls `POST /api/tutor/showcase-expertise` with credentials/bio. The account status becomes `approvalStatus: "pending"`.
5. **Admin Tutor Approval**: An admin calls `GET /api/admin/users?role=instructor` to review pending tutors and updates the status via `PUT /api/admin/tutors/:id/approval` with `{ "status": "approved" }`.
6. **Draft Course Initialization**: The approved instructor calls `POST /api/tutor/courses` with basic course info (Step 1). The server creates a course record with `status: "draft"` and returns `course._id`.
7. **Direct Media Upload URL Generation**: The instructor calls `POST /api/upload/presigned-url` with `{ "filename": "lesson.mp4", "fileType": "video/mp4", "folder": "courses" }` and receives an S3 `uploadUrl` and permanent `fileUrl`. The browser uploads video bytes directly to S3.
8. **Incremental Course Authoring**: The instructor calls `PUT /api/tutor/courses/:id` with step data (Step 2 description/skills, Step 3 modules/lessons/quizzes, Step 4 welcome/congrats messages).
9. **Course Review Submission**: The instructor calls `POST /api/tutor/courses/:id/submit`. The server validates course completeness and sets `status: "pending"`.
10. **Admin Course Moderation**: An admin reviews pending courses via `GET /api/admin/courses/pending` and approves the course via `PUT /api/admin/courses/:id/status` with `{ "status": "published" }`.
11. **Public Course Discovery**: A student searches published courses via `GET /api/courses?search=python&courseType=paid` and views single course details via `GET /api/courses/:slugOrId`. The backend strips lesson `videoUrl` and quiz `correctOptionIndex` for non-enrolled callers.
12. **Paid Course Checkout**: The student completes Paystack payment popup in the browser and calls `POST /api/enrollments/checkout` with `{ "courseId": "...", "reference": "T12345" }`. The server verifies the reference with Paystack API, creates a `Transaction` record, creates an `Enrollment` record, and adds the student to the course group chat.
13. **Learning Experience & Progress**: The enrolled student fetches enrolled courses via `GET /api/enrollments/my-courses`, streams lesson videos, posts Q&A via `POST /api/learning/:courseId/questions`, and saves private notes via `POST /api/learning/:courseId/notes`.
14. **Server-Side Quiz Submission**: The student submits quiz answers via `POST /api/learning/:courseId/quiz/:moduleId/submit` with `{ "answers": [1, 0, 2] }`. The server grades the quiz and returns `{ "passed": true, "score": 80 }`.
15. **Course Completion & Certificate**: The student updates lesson progress via `POST /api/learning/:courseId/progress`. When 100% complete, `completedAt` is recorded and `GET /api/learning/:courseId/certificate` returns certificate details.
16. **Real-Time Communication**: Students and tutors send messages via `POST /api/messages/:conversationId`, emitting `new_message` events over Socket.io to clients in room `conv:<id>`, and view notifications via `GET /api/notifications`.

## Features by Category

### 1. Authentication & Security
- `POST /api/auth/signup`: User creation with `bcrypt` password hashing.
- `POST /api/auth/signin`: Credential validation and JWT Bearer token generation.
- `GET /api/auth/me`: Authenticated user state retrieval.
- `POST /api/auth/signout`: Session teardown / token invalidation.
- `POST /api/auth/verify-email`: 4-digit OTP email verification for tutors.
- `POST /api/auth/forget-passwd`: 5-digit OTP generation for password reset.
- `POST /api/auth/verify-otp`: Password reset OTP verification without consumption.
- `POST /api/auth/reset-passwd`: Password update and OTP consumption.
- `POST /api/auth/update-password`: Authenticated password change.

### 2. User & Media Management
- `PUT /api/auth/update-profile`: Update bio, socials, avatar URL, and notification preferences.
- `POST /api/upload/presigned-url`: Generate short-lived AWS S3 PUT presigned URLs for avatars, course thumbnails, lesson videos, and PDFs.

### 3. Course Catalog & Discovery
- `GET /api/categories`: List all course categories with subcategories and topics.
- `POST /api/admin/categories` & `DELETE /api/admin/categories/:id`: Category CRUD for admins.
- `GET /api/courses`: Public course search, filter (free/paid/trimester), sort, and pagination.
- `GET /api/courses/:slugOrId`: Full course details with role-based content protection (video URL & quiz answers hidden from non-enrolled users).

### 4. Tutor Authoring & Moderation
- `POST /api/tutor/showcase-expertise`: Submit credentials and bio for admin verification.
- `GET /api/tutor/dashboard-stats` & `GET /api/tutor/earnings`: Instructor analytics and revenue metrics.
- `POST /api/tutor/courses`: Create initial draft course (Step 1).
- `PUT /api/tutor/courses/:id`: Update course draft per wizard step (Steps 2–4).
- `GET /api/tutor/courses` & `GET /api/tutor/courses/:id`: Instructor course catalog and single course preview.
- `POST /api/tutor/courses/:id/submit`: Submit draft course for admin review.
- `POST /api/tutor/courses/:id/appeal`: Appeal a rejected course.

### 5. Admin Moderation & Operations
- `GET /api/admin/dashboard-stats`, `GET /api/admin/recent-registrations`, `GET /api/admin/recent-transactions`: Platform metrics.
- `GET /api/admin/users` & `DELETE /api/admin/users/:id`: User management and soft deletion.
- `PUT /api/admin/tutors/:id/approval`: Approve or reject tutor onboarding applications.
- `GET /api/admin/courses/pending`, `GET /api/admin/courses/all`, `PUT /api/admin/courses/:id/status`: Course moderation.
- `GET /api/admin/appeals` & `PUT /api/admin/appeals/:id/status`: Appeal resolution.
- `GET /api/admin/finance`: Platform revenue and monthly breakdown.
- `POST /api/admin/broadcast`: Role-based system broadcast notifications.

### 6. Enrollments & Paystack Integration
- `POST /api/enrollments/enroll/:courseId`: Instant free course enrollment.
- `POST /api/enrollments/checkout`: Server-side Paystack transaction verification and paid enrollment creation.
- `POST /api/webhooks/paystack`: Signature-verified (HMAC-SHA512) idempotent webhook processing.
- `GET /api/enrollments/my-courses`: List signed-in user's enrolled courses with progress percentages.

### 7. Learning Experience & Certificate
- `GET/POST /api/learning/:courseId/questions`: Course Q&A thread management.
- `GET/POST /api/learning/:courseId/notes`: Private student notes per lesson/timestamp.
- `GET /api/learning/:courseId/announcements`: Course announcements view.
- `POST /api/learning/:courseId/quiz/:moduleId/submit`: Server-side quiz evaluation and score recording.
- `POST /api/learning/:courseId/progress`: Mark lesson completed and update video player position.
- `GET /api/learning/:courseId/certificate`: Retrieve completion certificate details.

### 8. Real-Time Messaging & Notifications
- `GET /api/messages/conversations`: List user's 1:1 and group conversations.
- `GET /api/messages/:conversationId` & `POST /api/messages/:conversationId`: Fetch and send conversation messages.
- `POST /api/messages/conversations/new`: Start or retrieve 1:1 conversation.
- `GET /api/notifications` & `POST /api/notifications/mark-read`: In-app notification center.
- **Socket.io Events**: `join_user`, `join_conversation`, `leave_conversation`, `typing`, `stop_typing`, `new_message`, `new_notification`.

### 9. Developer Experience
- `GET /`: Serves an HTML page detailing all API endpoints, HTTP methods, headers, body payload shapes, and status codes for frontend developers.

## Explicit Out-of-Scope List

1. **Frontend User Interface Application**: Building React/Next.js UI components or pages for end-users (the repository solely contains the backend API server and the HTML API docs page).
2. **Server-Side Video Processing**: Transcoding, encoding, or processing video file streams in Express server memory (video files are uploaded directly from client browsers to AWS S3).
3. **Automated Bank Payout Execution**: Automated bank transfers/payouts from platform accounts to instructor personal bank accounts (platform tracks instructor revenue shares in MongoDB; external bank transfers are manual/out of band).
4. **Third-Party OAuth Backend Integration**: Executing live Google or Apple OAuth redirects (buttons exist on frontend, backend social endpoints `/auth/google` and `/auth/apple` return standard structured placeholders).
5. **Native Mobile App Backends**: Specialized iOS/Android native push notification services (APNs/FCM) or mobile SDK native bindings.
6. **Legacy Upvote/Downvote Endpoints**: Executing `/vote/up` or `/vote/down` (deprecated in favor of 1-5 star course reviews).

## Verifiable Success Criteria

1. **Error Standard Enforcement**: A call to an invalid endpoint or with invalid payload returns HTTP 400/404 with JSON structure `{ "error": "<string_message>" }`.
2. **User Authentication Lifecycle**: A user can register via `POST /api/auth/signup`, authenticate via `POST /api/auth/signin`, and receive a valid JWT token that unlocks `GET /api/auth/me`.
3. **Role Security Guard Verification**: A user with role `student` calling `POST /api/tutor/courses` receives HTTP 403 `Forbidden`.
4. **Course Authoring Execution**: An approved instructor can create a draft course via `POST /api/tutor/courses`, update wizard fields via `PUT /api/tutor/courses/:id`, and submit for review via `POST /api/tutor/courses/:id/submit`, resulting in `course.status === "pending"`.
5. **Content Protection Integrity**: An un-enrolled user calling `GET /api/courses/:slugOrId` receives course details where `videoUrl` and `correctOptionIndex` fields are stripped from all lesson/quiz objects.
6. **Payment Checkout Idempotency**: Submitting a valid Paystack payment reference to `POST /api/enrollments/checkout` returns an `Enrollment` object and `Transaction` object (`status: "success"`). Submitting the same reference a second time returns the existing `Enrollment` without duplicate database creation.
7. **Server Quiz Grading**: Calling `POST /api/learning/:courseId/quiz/:moduleId/submit` with correct answers returns `{ "success": true, "passed": true, "score": 100 }`.
8. **Real-Time Socket Messaging**: Calling `POST /api/messages/:conversationId` causes connected Socket.io clients joined in room `conv:<id>` to immediately receive a `new_message` payload.
9. **Documentation Page Availability**: Sending `GET http://localhost:3001/` returns an HTTP 200 HTML page containing an interactive reference table of all API endpoints, parameters, request bodies, and status codes.
