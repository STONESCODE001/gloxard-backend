# Unit 20 Specification: LMS Live Classrooms, Community, Certificates & Analytics (Phase 4)

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Architectural Standards: [`architecture.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/architecture.md)  
> Alignment Handoff: [`BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md)  
> Prior Specs: [`17-infrastructure-partner-applications.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/17-infrastructure-partner-applications.md), [`18-institution-onboarding-workspace-billing.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/18-institution-onboarding-workspace-billing.md), [`19-trimester-lms-core.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/19-trimester-lms-core.md)

---

## 1. Goal

Integrate LiveKit Cloud video classrooms and Socket.io `/live` real-time synchronization for live cohort lectures, build cohort community discussion channels with threaded moderation, implement automated verifiable PDF certificate issuance with embedded verification QR codes, and deliver instructor cohort rosters and platform-wide LMS analytics.

---

## 2. Design

### 2.1 Data Models & Schemas

#### 1. `LmsLiveSession.model.js` (`LmsLiveSession`)
* **Collection Name**: `lmslivesessions`
* **Fields**:
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `title`: `{ type: String, required: true, trim: true }`.
  * `description`: `{ type: String, default: "" }`.
  * `instructorId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }`.
  * `startsAt`: `{ type: Date, required: true, index: true }`.
  * `endsAt`: `{ type: Date, required: true }`.
  * `status`: `{ type: String, enum: ["scheduled", "live", "ended"], default: "scheduled", index: true }`.
  * `provider`: `{ type: String, default: "livekit" }`.
  * `roomName`: `{ type: String, required: true, unique: true }`.
  * `recordingUrl`: `{ type: String, default: "" }`.
  * `createdAt`, `updatedAt` (timestamps).

#### 2. `LmsAttendance.model.js` (`LmsAttendance`)
* **Collection Name**: `lmsattendances`
* **Fields**:
  * `sessionId`: `{ type: Schema.Types.ObjectId, ref: "LmsLiveSession", required: true, index: true }`.
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }`.
  * `status`: `{ type: String, enum: ["present", "absent", "excused"], default: "absent" }`.
  * `joinedAt`: `{ type: Date, default: null }`.
  * `leftAt`: `{ type: Date, default: null }`.
  * `durationMinutes`: `{ type: Number, default: 0 }`.
* **Index**: Compound unique index `{ sessionId: 1, userId: 1 }`.

#### 3. `LmsPoll.model.js` & `LmsChatMessage.model.js`
* **`LmsPoll`**:
  * `sessionId`: `{ type: Schema.Types.ObjectId, ref: "LmsLiveSession", required: true, index: true }`.
  * `question`: `{ type: String, required: true }`.
  * `options`: `[{ type: String, required: true }]`.
  * `votes`: `[{ userId: { type: Schema.Types.ObjectId, ref: "User" }, optionIndex: Number }]`.
  * `status`: `{ type: String, enum: ["open", "closed"], default: "open" }`.
  * `createdAt`: `{ type: Date, default: Date.now }`.
* **`LmsChatMessage`**:
  * `sessionId`: `{ type: Schema.Types.ObjectId, ref: "LmsLiveSession", required: true, index: true }`.
  * `authorId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true }`.
  * `authorName`: `{ type: String, required: true }`.
  * `authorRole`: `{ type: String, default: "student" }`.
  * `text`: `{ type: String, required: true, trim: true }`.
  * `createdAt`: `{ type: Date, default: Date.now, index: true }`.

#### 4. `LmsChannel.model.js`, `LmsPost.model.js` & `LmsReply.model.js`
* **`LmsChannel`**:
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `name`: `{ type: String, required: true }` (Default seeded: "General", "Q&A", "Project Showcase", "Study Groups").
  * `slug`: `{ type: String, required: true }`.
  * `postCount`: `{ type: Number, default: 0 }`.
  * `isNew`: `{ type: Boolean, default: false }`.
* **`LmsPost`**:
  * `channelId`: `{ type: Schema.Types.ObjectId, ref: "LmsChannel", required: true, index: true }`.
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `authorId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true }`.
  * `tag`: `{ type: String, enum: ["Discussion", "Showcase", "Q&A"], default: "Discussion" }`.
  * `title`: `{ type: String, required: true, maxlength: 120, trim: true }`.
  * `body`: `{ type: String, required: true, maxlength: 5000, trim: true }`.
  * `likes`: `[{ type: Schema.Types.ObjectId, ref: "User" }]`.
  * `likesCount`: `{ type: Number, default: 0 }`.
  * `repliesCount`: `{ type: Number, default: 0 }`.
  * `isReported`: `{ type: Boolean, default: false }`.
  * `createdAt`, `updatedAt` (timestamps).
* **`LmsReply`**:
  * `postId`: `{ type: Schema.Types.ObjectId, ref: "LmsPost", required: true, index: true }`.
  * `authorId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true }`.
  * `body`: `{ type: String, required: true, trim: true }`.
  * `createdAt`: `{ type: Date, default: Date.now }`.

#### 5. `LmsCertificate.model.js` (`LmsCertificate`)
* **Collection Name**: `lmscertificates`
* **Fields**:
  * `certificateId`: `{ type: String, required: true, unique: true, index: true }` (Unguessable crypto token, e.g. `GLX-CERT-9A8B7C6D5E4F`).
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }`.
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `courseId`: `{ type: Schema.Types.ObjectId, ref: "Course", required: true }`.
  * `title`: `{ type: String, required: true }`.
  * `subtitle`: `{ type: String, default: "Full-Stack Web Development" }`.
  * `badge`: `{ type: String, default: "Gloxad Certified" }`.
  * `pdfKey`: `{ type: String, default: "" }` (S3 `certificates/` private key).
  * `issuedAt`: `{ type: Date, default: Date.now }`.
  * `revokedAt`: `{ type: Date, default: null }`.

---

### 2.2 Endpoint Architecture & RBAC Safeguards

| Endpoint | Method | Guard | Description |
| :--- | :--- | :--- | :--- |
| **Live Classroom & WebRTC** | | | |
| `/api/lms/live-sessions` | `GET` | Enrolled | Returns sessions list + header countdown info (`next: { title, startsAt }`). |
| `/api/lms/live-sessions` | `POST` | `instructor` | Schedules live lecture with title, start/end time, description. |
| `/api/lms/live-sessions/:id` | `PUT/DELETE` | `instructor` | Updates or cancels scheduled session. |
| `/api/lms/live-sessions/:id/join` | `POST` | Enrolled | Issues `@livekit/components-react` credentials: `{ provider: "livekit", serverUrl, roomToken, roomName, role: "host" \| "viewer" }`. Records attendance. |
| `/api/lms/live-sessions/:id/chat` | `GET` | Enrolled | Paged chat history (limit=50, backwards paging) for on-mount room loading. |
| `/api/lms/live-sessions/:id/polls` | `POST` | `instructor` | Creates live class poll and broadcasts via socket. |
| `/api/lms/polls/:pollId/votes` | `POST` | Enrolled | Submits single vote per user; results streamed to instructor. |
| `/api/lms/live-sessions/:id/attendance` | `GET/PUT` | `instructor` | Roster attendance view and manual status override (`excused`/`present`). |
| **Community Discussion Forum** | | | |
| `/api/lms/channels` | `GET` | Enrolled | Lists cohort channels (auto-seeds General, Q&A, Showcase, Study Groups). |
| `/api/lms/posts` | `GET` | Enrolled | Paginated feed of posts filtered by `cohortId` or `channelId`. General feed shows all. |
| `/api/lms/posts` | `POST` | Enrolled | Creates post (sanitized, max 120 title, max 5000 body, rate-limited). |
| `/api/lms/posts/:id/like` | `POST/DELETE` | Enrolled | Toggles like on post. |
| `/api/lms/posts/:id/replies` | `GET/POST` | Enrolled | Reads and creates replies to post. |
| `/api/lms/posts/:id` | `DELETE` | Author/Admin | Soft deletes post. |
| `/api/lms/posts/:id/report` | `POST` | Enrolled | Flags post for moderation. |
| **Certificates Engine** | | | |
| `/api/lms/certificates/me` | `GET` | `student` | Returns `{ inProgress: [...], earned: [...] }`. |
| `/api/lms/certificates/:id/pdf` | `GET` | Enrolled | Emits signed GET URL to server-generated certificate PDF with embedded QR code. |
| `/api/learning/verify-certificate/:certificateId` | `GET` | Public | Public credential verification page/payload. |
| **Instructor & Admin Analytics** | | | |
| `/api/lms/instructor/cohorts` | `GET` | `instructor` | Lists cohorts taught by current instructor. |
| `/api/lms/instructor/cohorts/:id/overview` | `GET` | `instructor` | Cohort performance metrics: avg completion %, active students, avg grade, grade trend. |
| `/api/lms/instructor/cohorts/:id/roster` | `GET` | `instructor` | Paginated student roster with attendance %, progress %, and last active date. |
| `/api/lms/admin/analytics` | `GET` | `admin` | Platform analytics: totalRevenue, enrollments, completionRate, platformHealth, enrollmentTrends. |
| `/api/lms/admin/certificates/recent` | `GET` | `admin` | Recent certificate issuance audit feed. |

---

### 2.3 Real-Time Live Classroom Socket Contract (`/live` namespace)

* **Handshake**: JWT token passed in `socket.handshake.auth.token`.
* **Events**:
  * `chat:message`: Emitted to room `session:<id>` and persisted to `LmsChatMessage`.
  * `hand:raise` / `hand:lower`: Broadcasts `{ userId, name }` to all participants.
  * `poll:launched` / `poll:closed`: Broadcasts live poll updates and final aggregates.
  * `participants:update`: Emits `{ count }` and active user avatars.
  * `session:ended`: Broadcasts host termination to trigger room exit.

---

## 3. Implementation

### 3.1 Model & Schema Files
1. **Create `src/models/LmsLiveSession.model.js`**
2. **Create `src/models/LmsAttendance.model.js`**
3. **Create `src/models/LmsPoll.model.js` & `src/models/LmsChatMessage.model.js`**
4. **Create `src/models/LmsChannel.model.js`, `src/models/LmsPost.model.js` & `src/models/LmsReply.model.js`**
5. **Create `src/models/LmsCertificate.model.js`**

### 3.2 LiveKit & Real-Time Engine
1. **LiveKit Token Service (`src/utils/livekit.js`)**:
   * Uses `livekit-server-sdk` `AccessToken` and `VideoGrant`.
   * Maps roles: instructor -> `host` (can publish, record, mute), student -> `viewer`/`participant`.
   * Formats response: `{ provider: "livekit", serverUrl: env.LIVEKIT_URL, roomToken, roomName, role }`.
2. **Socket.io `/live` Namespace Handler (`src/socket/live.handler.js`)**:
   * Authenticates token, manages `session:<id>` rooms, records attendance timestamps upon join/leave.

### 3.3 Certificate PDF & QR Code Service
1. **Certificate Generator Utility (`src/utils/certificate.js`)**:
   * Uses `qrcode` to generate PNG buffer of the public verification URL (`${FRONTEND_URL}/verify-certificate/${certId}`).
   * Uses `pdfkit` to draw Sheybi-branded certificate PDF with recipient name, course title, issuance date, signee signature, and embedded verification QR code.
   * Uploads generated PDF directly to S3 private bucket under `certificates/` and returns `pdfKey`.

### 3.4 Controllers & Routes
1. **LMS Live Class Controller (`src/controllers/lmsLive.controller.js`)**:
   * Scheduling, join token generation, chat history retrieval, poll creation/voting, and attendance roster.
2. **LMS Community Controller (`src/controllers/lmsCommunity.controller.js`)**:
   * Channel listing with auto-seeding, post creation with XSS sanitization, liking, threaded replies, moderation.
3. **LMS Certificate Controller (`src/controllers/lmsCertificate.controller.js`)**:
   * In-progress and earned certificates retrieval, on-demand PDF generation with signed GET link.
4. **LMS Instructor Analytics Controller (`src/controllers/lmsInstructor.controller.js`)**:
   * Instructor cohorts listing, cohort overview KPIs, student roster with attendance & progress percentages.
5. **LMS Admin Analytics Controller (`src/controllers/lmsAdmin.controller.js`)**:
   * Total revenue, enrollments, completion rates, uptime health metric, and recent certificates.
6. **Mount in `src/routes/lms.routes.js` and `src/app.js`**.

### 3.5 Documentation & Smoke Tests
1. **Interactive Docs Portal (`src/views/docs.html`)**:
   * Add Section "LMS Live Classrooms, Community & Certificates" covering all 18 Phase 4 endpoints.
2. **Seed Engine (`src/seed.js`)**:
   * Seed live sessions, attendance records, community posts/replies, and issued certificates.
3. **Smoke Suite (`scripts/test-e2e-smoke.js`)**:
   * Add `FLOW 12: Live Class Room Token, Polls, Community Discussion, Certificate PDF Issuance, and Analytics`.

---

## 4. Dependencies

* **`livekit-server-sdk`**: For cryptographic WebRTC room token generation.
* **`pdfkit`**: Lightweight, pure Node.js vector PDF creation.
* **`qrcode`**: Fast QR code generator for certificate verification stamps.

---

## 5. Verification Checklist

- [ ] `GET /api/lms/live-sessions` returns scheduled sessions and header countdown.
- [ ] `POST /api/lms/live-sessions/:id/join` returns valid LiveKit credentials (`provider`, `serverUrl`, `roomToken`, `roomName`, `role`).
- [ ] Socket `/live` namespace connects with JWT, joins `session:<id>`, and broadcasts chat/polls.
- [ ] `GET /api/lms/live-sessions/:id/chat` returns backwards-paginated chat history.
- [ ] `GET /api/lms/channels` seeds and returns the 4 standard cohort channels.
- [ ] `POST /api/lms/posts` validates length, sanitizes input, and returns populated author metadata.
- [ ] `POST /api/lms/posts/:id/like` toggles like state accurately per user.
- [ ] `GET /api/lms/certificates/me` lists in-progress and earned credentials.
- [ ] `GET /api/lms/certificates/:id/pdf` generates and serves a verified PDF with embedded QR code.
- [ ] `GET /api/lms/instructor/cohorts/:id/overview` calculates accurate cohort averages.
- [ ] `GET /api/lms/instructor/cohorts/:id/roster` returns student attendance and progress.
- [ ] `GET /api/lms/admin/analytics` provides aggregated platform revenue and uptime health.
- [ ] `npm run build` syntax checks pass 100%.
- [ ] `npm run test:smoke` passes 100% assertions.
