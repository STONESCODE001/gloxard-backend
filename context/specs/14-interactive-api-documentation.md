# Specification: Unit 14 — Interactive API Documentation Web Page

> **Spec Identifier**: `14-interactive-api-documentation`  
> **Target Spec File**: `context/specs/14-interactive-api-documentation.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 2, 3, 4, and 5)  

---

## 1. Goal

Deliver an interactive, self-contained HTML/CSS API documentation portal served at `GET /` (`src/views/docs.html`) that provides frontend engineers and third-party integrators with a complete, zero-ambiguity reference for all 43 REST API endpoints and 8 Socket.io WebSocket events across Gloxad Academy. Enable rapid integration and testing through color-coded HTTP method badges, standardized request/response schemas, architectural invariant callouts, instant keyword search filtering, copy-to-clipboard code snippets, and an interactive client-side API sandbox with JWT token persistence.

---

## 2. Design

### 2.1 Visual & Structural Decisions

Following `context/code-standards.md` (Section 5) and the Sheybi Design System (`context/ui-context.md`), the documentation portal served at `GET /` (`src/views/docs.html`) provides a modern, responsive single-page reference interface.

#### Color Tokens & Visual Badges
* **Surface Background** (`--color-bg`): `#F7F8FC`
* **Card Surface** (`--color-surface`): `#FFFFFF`
* **Subtle Surface** (`--color-surface-subtle`): `#F2F4FA`
* **Code Editor Surface** (`--color-code-bg`): `#1B1B24`
* **Border Color** (`--color-border`): `#D9DDE8`
* **Text Primary** (`--color-text-primary`): `#111827`
* **Text Muted** (`--color-text-muted`): `#6B7280`
* **Primary Brand Accent** (`--color-primary`): `#4F46E5` (Indigo)
* **Primary Hover Accent** (`--color-primary-hover`): `#4338CA`
* **HTTP Method Badges**:
  * `GET`: Text `#16A34A`, Soft Background `#DCFCE7`, Border `#86EFAC`
  * `POST`: Text `#2563EB`, Soft Background `#DBEAFE`, Border `#93C5FD`
  * `PUT`: Text `#D97706`, Soft Background `#FEF3C7`, Border `#FDE68A`
  * `DELETE`: Text `#DC2626`, Soft Background `#FEE2E2`, Border `#FCA5A5`
* **WebSocket / Socket.io Event Badge**:
  * `SOCKET.IO`: Text `#7E22CE`, Soft Background `#F3E8FF`, Border `#D8B4FE`
* **Access Security Guard Badges**:
  * `Public`: Soft Green (`#DCFCE7` text `#15803D`)
  * `Bearer Auth`: Soft Indigo (`#EEF2FF` text `#4338CA`)
  * `Instructor Only`: Soft Amber (`#FEF3C7` text `#B45309`)
  * `Admin Only`: Soft Red (`#FEE2E2` text `#B91C1C`)
  * `Paystack Webhook`: Soft Purple (`#F3E8FF` text `#6B21A8`)

#### Typography
* **Primary Sans-Serif**: `Inter`, system-ui, -apple-system, sans-serif
* **Monospace Code Font**: `Fira Code`, `JetBrains Mono`, `Consolas`, monospace

#### Layout Hierarchy
1. **Top Header & Sticky Controls Bar**:
   - Product Title & Version Badge ("Gloxad Academy API Reference v1.0").
   - Live Search Input (`<input type="text" id="apiSearchInput" placeholder="Filter endpoints by keyword, route, or category...">`).
   - Server Base URL Indicator (`http://localhost:3001`).
   - Interactive Global JWT Token Input Field (`<input type="password" id="globalJwtToken" placeholder="Paste Bearer Token for Live Sandbox Testing...">`) with automatic `localStorage` persistence (`gloxad_doc_token`).
2. **Left Sidebar Navigation**:
   - Fixed/Sticky category menu listing 13 core domain categories + WebSockets.
   - Dynamic counter badges showing total endpoints per section (e.g. `Auth (9)`, `Courses (8)`, `Admin (13)`).
   - Scroll-spy highlighting active category section as user scrolls.
3. **Main Content Container**:
   - **Architectural Invariants Banner**: Highlights the 5 core rules (`{ "error": "<msg>" }` shape, Presigned S3 URLs, Content Protection, Paystack Verification, and `_id` primary key consistency).
   - **Category Section Headers**: Clear grouping by system boundary with domain description.
   - **Endpoint Cards**: Clean, card-based layout featuring:
     - Header: Method Badge + Endpoint Path + Security Guard Chip + Quick Copy Button.
     - Endpoint Description & Use Cases.
     - Request Headers Table (`Authorization`, `Content-Type`, `x-paystack-signature`).
     - Query Parameters & Request Body JSON Schemas (displaying data types, required flags, and constraints).
     - Response Status Codes Mappings (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`).
     - Syntax-highlighted Code Snippets (`<pre><code>`) with dark `#1B1B24` background showing exact JSON payload examples.
     - **Interactive "Try It Out" Live Sandbox Drawer**: Collapsible execution box pre-filled with example JSON payloads, allowing users to send live HTTP requests to `http://localhost:3001` and inspect real JSON responses directly inside the documentation UI.
4. **Real-Time WebSockets Section**:
   - Detailed event reference for all 8 Socket.io events.
   - Handshake authentication instructions (`auth: { token: "<jwt>" }`).
   - Room architecture diagram (`user:<userId>` and `conv:<conversationId>`).
   - Client emission payloads and Server broadcast payload schemas.

---

## 3. Implementation

### 3.1 View Delivery & Express Integration (`src/app.js` & `src/controllers/docs.controller.js`)

1. **Route Declaration**:
   - Map `GET /` directly to serve `src/views/docs.html`.
   - Ensure `GET /` bypasses CORS restrictions and authentication guards so frontend developers can access documentation publicly.
2. **File Handler Implementation**:
   - Use Node native `path.join()` with ES Module `import.meta.url` or `process.cwd()` to locate `src/views/docs.html`.
   - Use Express `res.sendFile()` with explicit header `Content-Type: text/html; charset=utf-8`.
3. **Error Fallback**:
   - If `src/views/docs.html` is missing during server startup, log a descriptive error and return HTTP 500 with standard error schema `{ "error": "Documentation template unavailable" }`.

---

### 3.2 Document Structure & Embedded Styling (`src/views/docs.html`)

1. **HTML5 Shell**:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <title>Gloxad Academy API Reference & Interactive Sandbox</title>
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap">
     <style>
       /* Embedded CSS Variables & Responsive Styles matching Sheybi Design System */
       :root {
         --bg-main: #F7F8FC;
         --surface-card: #FFFFFF;
         --surface-subtle: #F2F4FA;
         --code-bg: #1B1B24;
         --border-color: #D9DDE8;
         --text-primary: #111827;
         --text-muted: #6B7280;
         --primary-brand: #4F46E5;
         --primary-hover: #4338CA;
         --badge-get-bg: #DCFCE7; --badge-get-text: #16A34A; --badge-get-border: #86EFAC;
         --badge-post-bg: #DBEAFE; --badge-post-text: #2563EB; --badge-post-border: #93C5FD;
         --badge-put-bg: #FEF3C7; --badge-put-text: #D97706; --badge-put-border: #FDE68A;
         --badge-delete-bg: #FEE2E2; --badge-delete-text: #DC2626; --badge-delete-border: #FCA5A5;
         --badge-ws-bg: #F3E8FF; --badge-ws-text: #7E22CE; --badge-ws-border: #D8B4FE;
       }
       /* Layout CSS: Sidebar + Main Content + Sandbox Modals + Code Previews */
     </style>
   </head>
   ```

---

### 3.3 Comprehensive API Reference Catalog

The documentation portal in `src/views/docs.html` MUST explicitly document all 43 REST endpoints and 8 Socket.io events across the following 13 system boundary categories:

#### Category 1: System Health & Foundation (Unit 01)
1. **`GET /api/health`**
   - **Access**: Public
   - **Headers**: None
   - **Description**: Verifies API server status, runtime uptime, and MongoDB connectivity.
   - **Success Response (`200 OK`)**:
     ```json
     {
       "status": "ok",
       "uptime": 1245.82,
       "timestamp": "2026-10-01T22:00:00.000Z"
     }
     ```

#### Category 2: Authentication Core & Session Management (Unit 02)
2. **`POST /api/auth/signup`**
   - **Access**: Public
   - **Request Body**: `{ "email": "user@example.com", "password": "Password123!", "firstName": "John", "lastName": "Doe", "role": "student" | "instructor" }`
   - **Success Response (`201 Created`)**:
     ```json
     {
       "message": "Registration successful. Please verify your email.",
       "user": {
         "_id": "651a2b3c4d5e6f7a8b9c0d12",
         "email": "user@example.com",
         "firstName": "John",
         "lastName": "Doe",
         "role": "student",
         "isVerified": false,
         "approvalStatus": "approved"
       }
     }
     ```
   - **Errors**: `400 Bad Request`, `409 Conflict` (`{ "error": "User with this email already exists" }`).

3. **`POST /api/auth/signin`**
   - **Access**: Public
   - **Request Body**: `{ "email": "user@example.com", "password": "Password123!" }`
   - **Success Response (`200 OK`)**:
     ```json
     {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "user": {
         "_id": "651a2b3c4d5e6f7a8b9c0d12",
         "email": "user@example.com",
         "role": "student",
         "isVerified": true
       }
     }
     ```
   - **Errors**: `401 Unauthorized` (`{ "error": "Invalid email or password" }`).

4. **`GET /api/auth/me`**
   - **Access**: Bearer Auth Required
   - **Headers**: `Authorization: Bearer <token>`
   - **Success Response (`200 OK`)**: Returns current user profile document.
   - **Errors**: `401 Unauthorized` (`{ "error": "Authentication token missing or invalid" }`).

5. **`POST /api/auth/signout`**
   - **Access**: Bearer Auth Required
   - **Headers**: `Authorization: Bearer <token>`
   - **Success Response (`200 OK`)**: `{ "message": "Signed out successfully" }`.

6. **`POST /api/auth/update-password`**
   - **Access**: Bearer Auth Required
   - **Headers**: `Authorization: Bearer <token>`
   - **Request Body**: `{ "currentPassword": "OldPassword123!", "newPassword": "NewPassword123!" }`
   - **Success Response (`200 OK`)**: `{ "message": "Password updated successfully" }`.
   - **Errors**: `400 Bad Request` (`{ "error": "Incorrect current password" }`).

#### Category 3: Email OTP & Account Recovery (Unit 03)
7. **`POST /api/auth/verify-email`**
   - **Access**: Public
   - **Request Body**: `{ "email": "user@example.com", "otp": "4821" }`
   - **Success Response (`200 OK`)**: `{ "message": "Email verified successfully" }`.
   - **Errors**: `400 Bad Request` (`{ "error": "Invalid or expired OTP" }`).

8. **`POST /api/auth/forget-passwd`**
   - **Access**: Public (Rate limited: 5 req / 15 min)
   - **Request Body**: `{ "email": "user@example.com" }`
   - **Success Response (`200 OK`)**: `{ "message": "Password reset OTP sent to email" }`.

9. **`POST /api/auth/verify-otp`**
   - **Access**: Public
   - **Request Body**: `{ "email": "user@example.com", "otp": "95821" }`
   - **Success Response (`200 OK`)**: `{ "message": "OTP verified successfully" }`.

10. **`POST /api/auth/reset-passwd`**
    - **Access**: Public
    - **Request Body**: `{ "email": "user@example.com", "otp": "95821", "newPassword": "NewPassword123!" }`
    - **Success Response (`200 OK`)**: `{ "message": "Password reset successful" }`.

#### Category 4: User Profile Management & S3 Uploads (Unit 04)
11. **`PUT /api/auth/update-profile`**
    - **Access**: Bearer Auth Required
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: `{ "bio": "Senior Web Developer", "avatarUrl": "https://s3.amazonaws.com/gloxard/avatars/user.jpg", "socials": { "twitter": "@johndoe", "linkedin": "in/johndoe" }, "notificationPreferences": { "email": true, "push": true } }`
    - **Success Response (`200 OK`)**: Returns updated profile object.

12. **`POST /api/upload/presigned-url`**
    - **Access**: Bearer Auth Required
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: `{ "filename": "avatar.png", "fileType": "image/png", "folder": "avatars" | "thumbnails" | "trailers" | "videos" | "resources" | "certifications" }`
    - **Success Response (`200 OK`)**:
      ```json
      {
        "uploadUrl": "https://gloxard.s3.amazonaws.com/avatars/1696195200-avatar.png?AWSAccessKeyId=...",
        "fileUrl": "https://gloxard.s3.amazonaws.com/avatars/1696195200-avatar.png",
        "expiresInSeconds": 900
      }
      ```

#### Category 5: Course Taxonomy & Category Management (Unit 05)
13. **`GET /api/categories`**
    - **Access**: Public
    - **Success Response (`200 OK`)**: Returns hierarchy of categories, subcategories, and topics.

14. **`POST /api/admin/categories`**
    - **Access**: Admin Only (`role: admin`)
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: `{ "name": "Web Development", "slug": "web-development", "icon": "code-icon", "subcategories": [{ "name": "Frontend", "slug": "frontend", "topics": ["React", "Vue"] }] }`
    - **Success Response (`201 Created`)**: Returns created category document.

15. **`DELETE /api/admin/categories/:id`**
    - **Access**: Admin Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Success Response (`200 OK`)**: `{ "message": "Category deleted successfully" }`.

#### Category 6: Course Catalog & Public Discovery (Unit 06)
16. **`GET /api/courses`**
    - **Access**: Public
    - **Query Params**: `?search=python&category=web-dev&courseType=free|paid&sort=popular|newest|price&page=1&limit=10`
    - **Success Response (`200 OK`)**: Returns paginated published courses list (`status: "published"`).

17. **`GET /api/courses/:slugOrId`**
    - **Access**: Public (Content Protected)
    - **Description**: Returns detailed course outline. Strips `videoUrl` and quiz `correctOptionIndex` for unauthenticated or non-enrolled users.

#### Category 7: Tutor Onboarding & Dashboard (Unit 07)
18. **`POST /api/tutor/showcase-expertise`**
    - **Access**: Instructor Only (`role: instructor`)
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: `{ "expertiseBio": "10 years Python Experience", "experienceYears": 10, "certificationsUrl": "https://s3.amazonaws.com/..." }`
    - **Success Response (`200 OK`)**: `{ "message": "Application submitted for admin review", "approvalStatus": "pending" }`.

19. **`GET /api/tutor/dashboard-stats`**
    - **Access**: Instructor Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Success Response (`200 OK`)**: `{ "totalStudents": 1420, "activeCourses": 4, "averageRating": 4.8 }`.

20. **`GET /api/tutor/earnings`**
    - **Access**: Instructor Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Success Response (`200 OK`)**: `{ "availableBalance": 45000, "totalEarned": 180000, "monthlyBreakdown": [] }`.

#### Category 8: 5-Step Course Authoring Pipeline (Unit 08)
21. **`POST /api/tutor/courses`** (Step 1 - Initialize Draft)
    - **Access**: Approved Instructor Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: `{ "title": "Complete Modern Node.js", "subtitle": "Build scalable APIs", "category": "web-dev", "language": "English", "level": "Intermediate", "courseType": "paid", "price": 15000 }`
    - **Success Response (`201 Created`)**: Returns created draft course object (`status: "draft"`).

22. **`PUT /api/tutor/courses/:id`** (Steps 2-4 - Progress Updates)
    - **Access**: Course Owner Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: Incremental updates for Step 2 (media & descriptions), Step 3 (modules, lessons & quizzes), Step 4 (completion messages).

23. **`GET /api/tutor/courses`**
    - **Access**: Instructor Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Success Response (`200 OK`)**: Lists all courses owned by instructor across all status states.

24. **`GET /api/tutor/courses/:id`**
    - **Access**: Course Owner Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Success Response (`200 OK`)**: Returns full draft course with unmasked video URLs and quiz correct options.

25. **`POST /api/tutor/courses/:id/submit`** (Step 5 - Submit for Review)
    - **Access**: Course Owner Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Success Response (`200 OK`)**: `{ "message": "Course submitted for administrative review", "status": "pending" }`.

26. **`POST /api/tutor/courses/:id/appeal`**
    - **Access**: Course Owner Only
    - **Headers**: `Authorization: Bearer <token>`
    - **Request Body**: `{ "message": "Rejection reason addressed in module 2." }`
    - **Success Response (`201 Created`)**: Returns created appeal document.

#### Category 9: Admin Moderation & Operations (Unit 09)
27. **`GET /api/admin/dashboard-stats`** - Platform metrics summary.
28. **`GET /api/admin/recent-registrations`** - User registration log.
29. **`GET /api/admin/recent-transactions`** - Platform transactions log.
30. **`GET /api/admin/users`** - Directory of users with role & status filter.
31. **`DELETE /api/admin/users/:id`** - Soft-deletes user account.
32. **`PUT /api/admin/tutors/:id/approval`** - Accepts/rejects tutor (`{ "status": "approved" | "rejected" }`).
33. **`GET /api/admin/courses/pending`** - Pending courses review queue.
34. **`GET /api/admin/courses/all`** - Master platform course directory.
35. **`PUT /api/admin/courses/:id/status`** - Moderates course status (`published` or `rejected`).
36. **`GET /api/admin/appeals`** - Lists pending appeals.
37. **`PUT /api/admin/appeals/:id/status`** - Resolves appeal (`resolved`).
38. **`GET /api/admin/finance`** - Financial revenue breakdown.
39. **`POST /api/admin/broadcast`** - Creates platform broadcast notification (`{ "title": "...", "message": "...", "targetRole": "all" | "students" | "instructors" }`).

#### Category 10: Course Enrollments & Paystack Checkout (Unit 10)
40. **`POST /api/enrollments/enroll/:courseId`**
    - **Access**: Bearer Auth Required
    - **Description**: Instant free course enrollment (`courseType === "free"`).
    - **Success Response (`201 Created`)**: Returns new `Enrollment` document.

41. **`POST /api/enrollments/checkout`**
    - **Access**: Bearer Auth Required
    - **Request Body**: `{ "reference": "PAYSTACK_REF_123456", "courseId": "651a3c4d5e6f7a8b9c0d1234" }`
    - **Description**: Server-side Paystack verification. Checks reference uniqueness, verifies amount, records `Transaction`, and creates `Enrollment`.
    - **Success Response (`201 Created`)**: Returns enrollment details and transaction receipt.

42. **`GET /api/enrollments/my-courses`**
    - **Access**: Bearer Auth Required
    - **Success Response (`200 OK`)**: Returns student's active courses with completion percentages.

#### Category 11: Idempotent Paystack Webhooks (Unit 11)
43. **`POST /api/webhooks/paystack`**
    - **Access**: Paystack Webhook Engine Only
    - **Headers**: `x-paystack-signature: <hmac-sha512-hash>`
    - **Description**: Asynchronously handles `charge.success` events. Idempotently skips already-processed references.
    - **Success Response (`200 OK`)**: `{ "status": "success", "message": "Webhook processed" }`.

#### Category 12: Learning Engine & Assessment (Unit 12)
44. **`GET /api/learning/:courseId/questions`** & **`POST /api/learning/:courseId/questions`** - Q&A discussion board.
45. **`GET /api/learning/:courseId/notes`** & **`POST /api/learning/:courseId/notes`** - Private student lesson notes.
46. **`GET /api/learning/:courseId/announcements`** - Instructor announcements.
47. **`POST /api/learning/:courseId/quiz/:moduleId/submit`**
    - **Request Body**: `{ "answers": [{ "questionIndex": 0, "selectedOptionIndex": 2 }] }`
    - **Description**: Server-side quiz evaluation comparing submitted answers with hidden `correctOptionIndex`. Returns percentage score and pass status.
48. **`POST /api/learning/:courseId/progress`**
    - **Request Body**: `{ "lessonId": "651a3c4d5e6f7a8b9c0d9999", "completed": true, "videoPositionSeconds": 450 }`
    - **Description**: Updates lesson progress and recalculates course completion percentage.
49. **`GET /api/learning/:courseId/certificate`**
    - **Description**: Generates and retrieves completion certificate metadata when course completion equals 100%.

#### Category 13: Real-Time Messaging & In-App Notifications (Unit 13)
50. **`GET /api/messages/conversations`** - Lists user conversations.
51. **`POST /api/messages/conversations/new`** - Creates or retrieves 1:1 conversation (`{ "recipientId": "...", "courseId": "..." }`).
52. **`GET /api/messages/:conversationId`** - Fetches message thread history.
53. **`POST /api/messages/:conversationId`** - Posts message and emits `new_message` over Socket.io (`{ "text": "Hello instructor!" }`).
54. **`GET /api/notifications`** - Retrieves user notifications.
55. **`POST /api/notifications/mark-read`** - Marks notifications as read (`{ "notificationIds": ["..."] }`).

#### Category 14: Socket.io Real-Time WebSockets Specification
* **Handshake Authentication**: `const socket = io("http://localhost:3001", { auth: { token: "<jwt_token>" } });`
* **Real-Time Events**:
  1. `join_user`: Client joins personal room `user:<userId>` upon connection.
  2. `join_conversation`: Client joins room `conv:<conversationId>`. Payload: `{ "conversationId": "..." }`.
  3. `leave_conversation`: Client leaves room `conv:<conversationId>`. Payload: `{ "conversationId": "..." }`.
  4. `typing`: Client signals typing status. Payload: `{ "conversationId": "..." }`. Broadcast to `conv:<conversationId>`.
  5. `stop_typing`: Client signals stop typing. Payload: `{ "conversationId": "..." }`. Broadcast to `conv:<conversationId>`.
  6. `new_message`: Emitted to `conv:<conversationId>` when a new message is posted. Payload contains full message object.
  7. `new_notification`: Server pushes real-time toast notification to room `user:<userId>`. Payload contains notification object.
  8. `error`: Server emits runtime Socket authentication or room error to client (`{ "error": "Invalid token" }`).

---

### 3.4 Client JavaScript Engine & Interactive Sandbox (`src/views/docs.html`)

Embedded client-side JavaScript (`<script>`) provides rich interactivity:

1. **Instant Search & Category Filtering**:
   - Event listener on `#apiSearchInput` filtering cards by title, endpoint path, method badge, or category tag in real time (`element.style.display = match ? 'block' : 'none'`).
2. **Copy to Clipboard Helpers**:
   - One-click copy for endpoint paths, cURL command templates, and JSON body payloads with temporary UI state update ("Copied!").
3. **Interactive Live Testing Sandbox**:
   - Clicking "Try It Out" on any endpoint card toggles an interactive request form drawer.
   - Form reads target HTTP method, endpoint path (replacing path variables like `:id` or `:courseId` from user inputs), and request body JSON textarea.
   - Reads Bearer Token from global input (`#globalJwtToken`) and attaches `Authorization: Bearer <token>` header.
   - Executes native `fetch()` request against server base URL (`http://localhost:3001`).
   - Displays HTTP response status code badge (e.g. `200 OK` in green or `401 Unauthorized` in red), response latency in milliseconds, and pretty-printed JSON response payload in `<pre><code>`.
4. **Token Persistence**:
   - Saves global JWT input into `localStorage.setItem('gloxad_doc_token', token)` on change and restores value on page reload.

---

## 4. Dependencies

* **Packages To Install**: None.
* **Architecture Rules**: Uses vanilla HTML5, CSS3, and modern browser ES6+ JavaScript embedded inside `src/views/docs.html`. Zero external dependencies or Node build steps required.

---

## 5. Verification Checklist

- [ ] **File Location**: `src/views/docs.html` exists and is formatted validly.
- [ ] **Express Route Mapping**: Navigating to `http://localhost:3001/` in any browser serves `src/views/docs.html` with status code `200 OK` and header `Content-Type: text/html`.
- [ ] **Visual Theme & Typography**: Page uses Google Font `Inter`, clean `#F7F8FC` background, white surface cards with `#D9DDE8` borders, and dark `#1B1B24` syntax-highlighted code blocks.
- [ ] **Method Badges Compliance**: All endpoints display correct color badges: `GET` (Green), `POST` (Blue), `PUT` (Amber), `DELETE` (Red), `SOCKET.IO` (Purple).
- [ ] **Complete REST Endpoints Coverage**: All 43 REST endpoints across all 12 domain categories are fully documented with HTTP method, path, security guard, headers, request body schema, status code mappings, and response payloads.
- [ ] **Complete WebSockets Coverage**: All 8 Socket.io events (`join_user`, `join_conversation`, `leave_conversation`, `typing`, `stop_typing`, `new_message`, `new_notification`, `error`) and handshake authentication are explicitly documented.
- [ ] **Architectural Invariants Callouts**: Top banner clearly documents uniform error schema `{ "error": "<msg>" }`, zero raw file buffering, content protection, server-side Paystack verification, and `_id` consistency.
- [ ] **Interactive Search**: Typing in the search input filters endpoints dynamically without page reloads.
- [ ] **Copy Buttons**: Clicking copy snippets copies exact path or JSON payload to clipboard.
- [ ] **Interactive Sandbox Execution**: Pasting a valid JWT token into the header bar and submitting a live "Try It Out" request executes a real HTTP request to `http://localhost:3001` and renders the real server JSON response.
