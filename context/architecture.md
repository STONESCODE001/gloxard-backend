# Architecture - Gloxad Academy Backend API

## Technology Stack

| Layer | Technology | Version / Spec | Role & Rationale |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v18+ | Event-driven JavaScript runtime executing ES Modules (`"type": "module"`). |
| **Web Framework** | Express.js | v5.x | Lightweight, high-speed RESTful routing and middleware pipeline. |
| **Database** | MongoDB | v6+ / Cloud Atlas | Document-based NoSQL database for flexible nested course structures and user profiles. |
| **Object Modeling** | Mongoose ODM | v9.x | Schema definition, validation, population, and query building for MongoDB. |
| **Real-Time Communication** | Socket.io | v4.x | Bi-directional WebSocket server for 1:1/group chats, typing indicators, and notifications. |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | RFC 7519 | Stateless JWT token issuance and signature verification in `Authorization: Bearer` headers. |
| **Password Hashing** | `bcryptjs` | v6.x | One-way salt hashing (cost factor 10-12) for user password security. |
| **File Storage Service** | AWS S3 (`@aws-sdk/client-s3`) | SDK v3 | Cloud object storage for media files; uploads use S3 pre-signed PUT URLs. |
| **Payment Gateway** | Paystack REST API | NGN Currency | Server-side transaction verification and HMAC-SHA512 webhook signature handling. |
| **Email Transporter** | Nodemailer | SMTP / API | Sending 4-digit verification OTPs, 5-digit password reset OTPs, and receipt emails. |
| **Security & Headers** | `cors` & `helmet` | Standard | Credentialed CORS whitelist (`FRONTEND_ORIGIN`) and HTTP security response headers. |
| **Rate Limiting** | `express-rate-limit` | Standard | Protection against brute-force attacks on auth, OTP, and messaging endpoints. |
| **API Documentation** | Express Static HTML | Vanilla HTML/CSS | Interactive HTML API reference page served at `GET /` for frontend developer integration. |

---

## System Boundaries & Directory Responsibilities

The codebase follows a strict modular structure. Each directory owns a single, isolated responsibility:

```
gloxard/
├── context/
│   ├── project-overview.md  # High-level goals, user flow, and scope
│   └── architecture.md      # Technical architecture, system boundaries, and invariants
├── src/
│   ├── app.js               # Express application setup, global middleware, and route mounting
│   ├── server.js (index.js) # HTTP server listener, DB initialization, and Socket.io setup
│   ├── config/              # Environment validation and DB connection configurations
│   ├── constants/           # Enums (Roles, Statuses, Course Types) and global defaults
│   ├── middlewares/         # Auth verification, role guards, input validation, and error handling
│   ├── models/              # Mongoose data schemas and database models
│   ├── controllers/         # Endpoint request handling, business logic, and response generation
│   ├── routes/              # Express Router definitions mapping endpoints to controllers/middlewares
│   ├── socket/              # Socket.io connection handlers, room management, and event emitters
│   ├── utils/               # Third-party integrations (S3, Paystack, Nodemailer, JWT, Hash)
│   └── views/               # HTML template for the frontend API documentation page
```

### Exact Folder Responsibilities

* `src/config/`:
  * `db.js`: Establishes and manages Mongoose connection lifecycle to MongoDB.
  * `env.js`: Reads and validates required environment variables (`MONGODB_URI`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `AWS_S3_BUCKET`, `FRONTEND_ORIGIN`).
* `src/constants/`:
  * `roles.js`: Defines roles (`student`, `instructor`, `admin`).
  * `status.js`: Defines enums (`draft`, `pending`, `published`, `rejected` for courses; `pending`, `approved`, `rejected` for tutors).
* `src/middlewares/`:
  * `auth.middleware.js`: Extracts Bearer token from headers, verifies JWT, and attaches `req.user`.
  * `role.middleware.js`: Rejects requests with HTTP 403 if `req.user.role` does not match allowed roles.
  * `error.middleware.js`: Global Express error handler formatting all unhandled errors into `{ "error": "<message>" }`.
  * `validate.middleware.js`: Schema validation for request body, query params, and URL parameters.
  * `rateLimiter.middleware.js`: Configures IP rate limiters for login, OTP, and message routes.
* `src/models/`:
  * Defines 14 Mongoose collections: `User`, `Otp`, `Category`, `Course`, `Enrollment`, `Transaction`, `Review`, `PlatformSettings`, `Appeal`, `Conversation`, `Message`, `Notification`, `QuestionNoteMisc`.
* `src/controllers/`:
  * Implements pure controller functions. Controllers MUST NOT contain raw SQL/query building logic or direct Socket.io room manipulations; they delegate DB ops to Mongoose models and real-time events to `socket.handler.js`.
* `src/routes/`:
  * Maps REST endpoints to controllers and applies middleware chains (e.g. `router.post('/tutor/courses', authGuard, roleGuard('instructor'), createCourseController)`).
* `src/socket/`:
  * `socket.handler.js`: Manages Socket.io server instance, authenticates socket handshakes via JWT, handles room joins (`user:<userId>`, `conv:<conversationId>`), and emits events (`new_message`, `new_notification`, `typing`).
* `src/utils/`:
  * Isolated utility modules: `jwt.js` (sign/verify), `hash.js` (bcrypt compare/hash), `s3.js` (generate presigned URLs), `paystack.js` (verify transaction API), `email.js` (send mail).

---

## Storage Model

Data is strictly partitioned across three distinct storage tiers to maximize performance and security:

### 1. Database (MongoDB)
All persistent structured data lives in MongoDB.
* **User Data**: User accounts, email verification status, hashed passwords, bios, experience proofs, social links, notification preferences.
* **Auth & Security Data**: Hashed OTP records with TTL indexes (`expiresAt`).
* **Catalog & Authoring Data**: Categories (with image URLs), course metadata, module structures, lesson metadata, quiz questions/options (including server-only `correctOptionIndex`), draft states, rejection reasons.
* **Enrollments & Transactions**: Student-course enrollment records, completed lesson arrays, server-verified Paystack transaction records (reference, amount, shares).
* **Learning & Interaction Data**: Q&A questions/replies, student private notes, instructor announcements, course reviews, tutor replies.
* **Messaging & Notifications**: Conversations, message history with sender IDs, in-app notifications.
* **Platform Operations Data**: PlatformSettings singleton holding signup toggles, deletion grace days, signature URL.

### 2. Cloud File Storage (AWS S3)
Raw binary files and media assets **NEVER** pass through or reside on the Node.js API server filesystem. They are stored directly in AWS S3 buckets under isolated folder prefixes:
* `avatars/`: User profile pictures.
* `courses/thumbnails/`: Course cover images.
* `courses/trailers/`: Promotional course trailer videos.
* `courses/videos/`: Lesson video files (accessible only via S3 CDN URLs).
* `courses/resources/`: Downloadable lecture PDFs and supplementary materials.
* `certifications/`: Tutor qualification PDFs submitted during onboarding.
* `certificates/`: Generated student course completion certificates.
* `signatures/`: Authorized platform signee signature images.

### 3. Cache Tier (In-Memory / MongoDB Indexed)
* **Categories & Public Feeds**: Category trees (`GET /api/categories`) and public course feeds are cached in Node.js memory or optimized with MongoDB indexes (`slug`, `status`, `courseType`, `text`).
* **Active User Socket Sessions**: Socket.io maintains an in-memory mapping of active `userId` to active socket connections for instant push notifications.

---

## Auth and Access Model

Authentication and authorization follow a strict, multi-layered model:

### 1. Authentication Lifecycle & Session Refresh
* **Registration**: User registers via `POST /api/auth/signup`. Passwords are salted and hashed using `bcrypt` (10-12 rounds) before persistence.
* **Token Issuance**: `POST /api/auth/signin` returns a signed JWT containing `{ sub: userId, role: user.role }` signed with `JWT_SECRET`.
* **Token Transmission**: Clients attach the token in the HTTP header: `Authorization: Bearer <token>`.
* **Token Verification**: `auth.middleware.js` decodes the token, verifies expiry, queries `User.findById(sub)`, and populates `req.user`.
* **Token Refresh**: `POST /api/auth/refresh` verifies current token signature and `tokenVersion`, issuing a fresh 7-day access token.
* **Multi-Origin CORS**: The backend parses comma-separated origins in `FRONTEND_ORIGIN` to enable seamless development (`localhost`) and production cross-origin requests.

### 2. Role-Based Access Control (RBAC)
Routes are protected by explicit role middleware guards:
* **Public Routes**: Accessible without token (`/api/courses`, `/api/categories`, `/api/auth/signin`, `/api/auth/signup`).
* **Student Routes**: Require authenticated user with `role === 'student'` or higher (`/api/enrollments/*`, `/api/learning/*`).
* **Instructor Routes**: Require authenticated user with `role === 'instructor'` and `approvalStatus === 'approved'` (`/api/tutor/*`).
* **Admin Routes**: Require authenticated user with `role === 'admin'` (`/api/admin/*`).

### 3. Resource Ownership Controls
In addition to role guards, controllers enforce strict resource ownership checks:
* **Course Editing**: Tutors can ONLY edit courses where `course.instructor === req.user._id`.
* **Private Notes**: Students can ONLY read/write notes where `note.user === req.user._id`.
* **Conversation Messages**: Users can ONLY fetch or send messages in conversations where `conversation.participants.includes(req.user._id)`.
* **Paystack Verification**: Payments are verified against `metadata.student_id === req.user._id` to prevent cross-account credit claims.

---

## Background & Real-Time Task Model

The API handles real-time tasks and asynchronous workflows through dedicated services:

1. **Email Dispatching**: OTP emails (`verify-email`, `forget-passwd`) and payment receipts are sent asynchronously via `utils/email.js`. Failures are logged without blocking HTTP responses.
2. **Socket.io Real-Time Event Engine**:
   * **Connection Handshake**: Socket connections authenticate using the JWT token presented in `socket.handshake.auth.token`.
   * **User Rooms**: Every connected user joins room `user:<userId>` to receive personal push notifications.
   * **Conversation Rooms**: Users join room `conv:<conversationId>` upon opening a chat view to receive live `new_message` and `typing` events.
3. **Paystack Webhook Listener**:
   * `POST /api/webhooks/paystack` listens for asynchronous `charge.success` events from Paystack servers.
   * The webhook validates the `x-paystack-signature` header using `crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)`.
   * Upon signature verification, enrollment creation and notification dispatch execute idempotently.

---

## Invariants — Non-Negotiable Codebase Rules

The codebase MUST NEVER violate the following strict architectural rules under any circumstances:

1. **Rule 1: Uniform Error Schema**: 100% of error responses produced by any route, controller, or middleware MUST return a JSON object with the exact key shape `{ "error": "Human-readable message" }` and an appropriate HTTP status code (`400`, `401`, `403`, `404`, `409`, `422`, `429`). No raw HTML errors or unformatted stack traces may ever be returned to clients.
2. **Rule 2: Zero Raw File Buffering on API Server**: The Express API server MUST NEVER handle raw file byte streams or multipart form uploads in server memory for media assets. All uploads MUST use S3 presigned URLs (`POST /api/upload/presigned-url`), forcing the client browser to upload bytes directly to AWS S3.
3. **Rule 3: Server-Side Quiz & Content Protection**: The server MUST NEVER expose `correctOptionIndex` or paid lesson `videoUrl` values to un-enrolled users in public endpoints. Quiz submissions (`POST /api/learning/:courseId/quiz/:moduleId/submit`) MUST be evaluated strictly server-side using the answer key stored in MongoDB.
4. **Rule 4: Mandatory Server-Side Payment Verification**: The API MUST NEVER trust client-provided payment amounts or completion statuses. All paid enrollments MUST execute server-side verification against the Paystack REST API (`https://api.paystack.co/transaction/verify/:reference`) using `PAYSTACK_SECRET_KEY` and check for duplicate references (idempotency).
5. **Rule 5: Strict Identifier Standard**: All MongoDB primary key identifiers returned in JSON payloads MUST be named `_id` as a string. No endpoint may rename `_id` to `id` or `courseId` in top-level object representations.
