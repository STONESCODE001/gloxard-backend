# Unit 19 Specification: Trimester LMS Core — Cohorts, Curriculum, Quizzes & Assignments (Phase 3)

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Architectural Standards: [`architecture.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/architecture.md)  
> Alignment Handoff: [`BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/BACKEND_TO_FRONTEND_ALIGNMENT_DOC.md)  
> Prior Specs: [`17-infrastructure-partner-applications.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/17-infrastructure-partner-applications.md), [`18-institution-onboarding-workspace-billing.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/18-institution-onboarding-workspace-billing.md)

---

## 1. Goal

Implement the Trimester Cohort Learning Management System under a dedicated `/api/lms/*` namespace, featuring multi-cohort resolution with enrollment gating, unified student dashboards, daily curriculum progress tracking with threaded discussions, server-timed quizzes (with a 15-second network grace window, instant answer checks, and best-score retakes), and assignment submissions with instructor grading queues.

---

## 2. Design

### 2.1 Data Models & Schemas

#### 1. `Trimester.model.js` (`Trimester`)
* **Collection Name**: `trimesters`
* **Purpose**: Defines academic trimester terms.
* **Fields**:
  * `number`: `{ type: Number, required: true, enum: [1, 2, 3] }`.
  * `title`: `{ type: String, required: true, trim: true }` (e.g. "Trimester 1 - 2026").
  * `startDate`: `{ type: Date, required: true }`.
  * `endDate`: `{ type: Date, required: true }`.
  * `weeks`: `{ type: Number, required: true, default: 12 }`.
  * `enrollmentClosesAt`: `{ type: Date, required: true }`.
  * `status`: `{ type: String, enum: ["upcoming", "active", "completed"], default: "upcoming" }`.
  * `createdAt`, `updatedAt` (timestamps).

#### 2. `Cohort.model.js` (`Cohort`)
* **Collection Name**: `cohorts`
* **Purpose**: Independent cohort running a course within a trimester (isolated from self-paced courses).
* **Fields**:
  * `name`: `{ type: String, required: true, trim: true }` (e.g. "Cohort B").
  * `courseId`: `{ type: Schema.Types.ObjectId, ref: "Course", required: true, index: true }`.
  * `trimesterId`: `{ type: Schema.Types.ObjectId, ref: "Trimester", required: true, index: true }`.
  * `instructorIds`: `[{ type: Schema.Types.ObjectId, ref: "User", index: true }]`.
  * `studentIds`: `[{ type: Schema.Types.ObjectId, ref: "User", index: true }]`.
  * `capacity`: `{ type: Number, default: 50 }`.
  * `timezone`: `{ type: String, default: "Africa/Lagos" }`.
  * `currentWeek`: `{ type: Number, default: 1 }`.
  * `status`: `{ type: String, enum: ["enrolling", "active", "completed", "archived"], default: "enrolling", index: true }`.
  * `createdAt`, `updatedAt` (timestamps).

#### 3. `LmsLessonProgress.model.js` (`LmsLessonProgress`)
* **Collection Name**: `lmslessonprogress`
* **Fields**:
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }`.
  * `lessonId`: `{ type: Schema.Types.ObjectId, required: true, index: true }`.
  * `moduleId`: `{ type: Schema.Types.ObjectId, required: true }`.
  * `status`: `{ type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" }`.
  * `watchedSeconds`: `{ type: Number, default: 0 }`.
  * `objectivesDone`: `[{ type: String }]`.
  * `completedAt`: `{ type: Date, default: null }`.
  * `createdAt`, `updatedAt` (timestamps).
* **Index**: Compound unique index `{ cohortId: 1, userId: 1, lessonId: 1 }`.

#### 4. `LmsQuizAttempt.model.js` (`LmsQuizAttempt`)
* **Collection Name**: `lmsquizattempts`
* **Fields**:
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `quizId`: `{ type: Schema.Types.ObjectId, required: true, index: true }`.
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }`.
  * `attemptNumber`: `{ type: Number, required: true, default: 1 }`.
  * `startedAt`: `{ type: Date, default: Date.now }`.
  * `expiresAt`: `{ type: Date, required: true }`.
  * `answers`: `[{ questionId: Schema.Types.ObjectId, optionId: String, flagged: Boolean, checkedAt: Date, isCorrect: Boolean }]`.
  * `score`: `{ type: Number, default: 0 }`.
  * `total`: `{ type: Number, default: 0 }`.
  * `percent`: `{ type: Number, default: 0 }`.
  * `passed`: `{ type: Boolean, default: false }`.
  * `status`: `{ type: String, enum: ["in_progress", "submitted", "expired"], default: "in_progress", index: true }`.
  * `submittedAt`: `{ type: Date, default: null }`.
  * `createdAt`, `updatedAt` (timestamps).

#### 5. `LmsAssignment.model.js` & `LmsSubmission.model.js`
* **`LmsAssignment`**:
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `moduleId`: `{ type: Schema.Types.ObjectId, required: true }`.
  * `title`: `{ type: String, required: true }`.
  * `summary`: `{ type: String, default: "" }`.
  * `description`: `{ type: String, required: true }`.
  * `dueAt`: `{ type: Date, required: true, index: true }`.
  * `rubric`: `[{ criterion: String, points: Number }]`.
  * `maxFileMB`: `{ type: Number, default: 50 }`.
  * `allowedTypes`: `[{ type: String, default: ["zip", "pdf"] }]`.
  * `allowRepoLink`: `{ type: Boolean, default: true }`.
  * `allowLate`: `{ type: Boolean, default: true }`.
  * `latePenaltyPercent`: `{ type: Number, default: 0 }`.
* **`LmsSubmission`**:
  * `assignmentId`: `{ type: Schema.Types.ObjectId, ref: "LmsAssignment", required: true, index: true }`.
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }`.
  * `fileKey`: `{ type: String, default: "" }` (S3 `submissions/` key).
  * `repoUrl`: `{ type: String, default: "" }` (Validated `https://github.com/<owner>/<repo>`).
  * `comment`: `{ type: String, default: "" }`.
  * `submittedAt`: `{ type: Date, default: Date.now }`.
  * `isLate`: `{ type: Boolean, default: false }`.
  * `status`: `{ type: String, enum: ["submitted", "pending_review", "graded"], default: "pending_review", index: true }`.
  * `grade`:
    * `score`: `{ type: Number, default: null }`.
    * `max`: `{ type: Number, default: 100 }`.
    * `feedback`: `{ type: String, default: "" }`.
    * `rubricScores`: `[{ criterion: String, pointsAwarded: Number }]`.
    * `gradedBy`: `{ type: Schema.Types.ObjectId, ref: "User", default: null }`.
    * `gradedAt`: `{ type: Date, default: null }`.
  * **Index**: `{ assignmentId: 1, userId: 1 }`.

#### 6. `LmsLessonComment.model.js` (`LmsLessonComment`)
* **Collection Name**: `lmslessoncomments`
* **Fields**:
  * `lessonId`: `{ type: Schema.Types.ObjectId, required: true, index: true }`.
  * `cohortId`: `{ type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true }`.
  * `userId`: `{ type: Schema.Types.ObjectId, ref: "User", required: true }`.
  * `authorRole`: `{ type: String, default: "student" }`.
  * `body`: `{ type: String, required: true, trim: true }`.
  * `likes`: `[{ type: Schema.Types.ObjectId, ref: "User" }]`.
  * `parentId`: `{ type: Schema.Types.ObjectId, ref: "LmsLessonComment", default: null, index: true }`.
  * `createdAt`, `updatedAt` (timestamps).

---

### 2.2 Endpoint Architecture & RBAC Safeguards

All endpoints under `/api/lms/*` require `authGuard` and pass through the **Cohort Resolution Guard** (`cohortGuard`):
* Reads `?cohortId=<id>`.
* If missing: Automatically resolves to the user's most recent active cohort enrollment.
* Verifies membership:
  * Students must be in `cohort.studentIds`.
  * Instructors must be in `cohort.instructorIds`.
  * Admins have universal platform access.
* Returns `403 { "error": "You are not enrolled in this cohort", "code": "COHORT_ACCESS_DENIED" }` if unauthorized.

| Endpoint | HTTP Method | Role | Description |
| :--- | :--- | :--- | :--- |
| **Context & Dashboard** | | | |
| `/api/lms/me` | `GET` | Authenticated | Returns `{ role, cohorts: [{ _id, name, trimester, programTitle, currentWeek }], activeCohortId }`. |
| `/api/lms/dashboard/student` | `GET` | `student` | Returns `{ cohort, progress { overall, week, assignments { done, total }, attendance }, upNext, upcoming, announcements }`. |
| **Curriculum & Lessons** | | | |
| `/api/lms/cohorts/:cohortId/curriculum` | `GET` | Enrolled | Returns curriculum modules with lessons and per-lesson status (`not_started`, `in_progress`, `completed`). |
| `/api/lms/lessons/:lessonId` | `GET` | Enrolled | Lesson view: `{ trimester, module, title, video { playbackUrl, durationSec }, notes, objectives, attachments, progressPercent, next, previousId }`. |
| `/api/lms/lessons/:lessonId/progress` | `PUT` | Enrolled | Idempotent progress updater (`watchedSeconds`, `completed`, `objectivesDone`). Recalculates dashboard percentages. |
| `/api/lms/lessons/:lessonId/comments` | `GET/POST` | Enrolled | Threaded discussions with replies, like counts, and "Instructor" role badges. |
| `/api/lms/comments/:id/replies` | `POST` | Enrolled | Posts reply to a comment thread. |
| `/api/lms/comments/:id/like` | `POST/DELETE`| Enrolled | Toggles like on a lesson comment. |
| **Quizzes Engine** | | | |
| `/api/lms/quizzes/:quizId` | `GET` | Enrolled | Quiz overview: `{ title, programTitle, moduleName, timeLimitMinutes, questionCount, passMarkPercent }`. (Answers strictly omitted). |
| `/api/lms/quizzes/:quizId/attempts` | `POST` | Enrolled | Starts or resumes timed attempt. Sets `expiresAt = startedAt + timeLimitMinutes`. Strips correct answers. |
| `/api/lms/quiz-attempts/:attemptId/answers`| `POST` | Enrolled | Saves answer choice. With `check: true`, validates answer immediately, returns `{ correct, correctOptionId, explanation }`, and locks answer. |
| `/api/lms/quiz-attempts/:attemptId/submit` | `POST` | Enrolled | Submits attempt. Enforces server countdown with 15s grace window; auto-grades and records best score across attempts (up to 3 retakes). |
| **Assignments & Grading Queue** | | | |
| `/api/lms/assignments` | `GET` | Enrolled | Lists cohort assignments with filter (`all`, `upcoming`, `past`) and submission status (`not_started`, `submitted`, `pending_review`, `graded`). |
| `/api/lms/assignments/:id` | `GET` | Enrolled | Full assignment detail with description, rubric, maxFileMB, and student's own submission. |
| `/api/lms/assignments/:id/submissions` | `POST` | `student` | Submits assignment via GitHub repo URL (`https://github.com/<owner>/<repo>`) or S3 fileKey (`submissions/`). Allows resubmissions before instructor grades. |
| `/api/lms/instructor/grading-queue` | `GET` | `instructor` | Grading queue for instructor: `{ pending, items: [{ submissionId, module, assignmentTitle, student, submittedAt, overdue }] }`. |
| `/api/lms/submissions/:id/grade` | `PUT` | `instructor` | Scores submission with rubric breakdown, feedback, and triggers student notification. |

---

### 2.3 Progress & Grading Calculation Rules

1. **Overall Program Progress**:
   $$\text{overallPercent} = \frac{\text{completed lessons} + \text{passed quizzes} + \text{submitted assignments}}{\text{total required items}} \times 100$$
2. **Current Week Progress**:
   $$\text{weekPercent} = \frac{\text{completed week items}}{\text{total week items}} \times 100$$
3. **Quiz Timing & Retake Policy**:
   * Timer countdown strictly based on `expiresAt` stored in DB.
   * If submitted within `expiresAt + 15 seconds`: accept and grade normally.
   * If submitted after grace window: auto-grade saved answers up to expiry, mark status `expired`.
   * Max 3 attempts allowed per quiz. The student's recorded grade is the **best score** achieved.
4. **Assignment Resubmission & Late Policy**:
   * Submissions past `dueAt` are accepted if `allowLate: true`, marked with `isLate: true`, and display a `"Late"` badge in the instructor queue.
   * Students can edit/resubmit their work freely until an instructor grades it (`status: "graded"` locks submission).

---

## 3. Implementation

### 3.1 Model & Schema Files
1. **Create `src/models/Trimester.model.js`**
2. **Create `src/models/Cohort.model.js`**
3. **Create `src/models/LmsLessonProgress.model.js`**
4. **Create `src/models/LmsQuizAttempt.model.js`**
5. **Create `src/models/LmsAssignment.model.js` & `src/models/LmsSubmission.model.js`**
6. **Create `src/models/LmsLessonComment.model.js`**

### 3.2 Middlewares & Resolution Logic
1. **Cohort Guard Middleware (`src/middlewares/cohort.middleware.js`)**:
   * Reads `req.query.cohortId` or resolves user's most recent active cohort.
   * Verifies enrollment membership in `Cohort`.
   * Attaches `req.cohort` and `req.cohortId`.

### 3.3 Controllers & Routes
1. **LMS Context & Dashboard Controller (`src/controllers/lmsDashboard.controller.js`)**:
   * `getLmsMe`: Returns user cohorts array and resolved active cohort ID.
   * `getStudentDashboard`: Aggregates progress metrics, upcoming deadlines, up-next lesson, and announcements.
2. **LMS Curriculum Controller (`src/controllers/lmsCurriculum.controller.js`)**:
   * `getCohortCurriculum`: Returns module lesson tree with lesson completion states.
   * `getLessonDetail`: Returns lesson metadata, signed video URL, notes, objectives, attachments, next/prev navigation.
   * `updateLessonProgress`: Idempotently updates watched time and completed objectives.
   * `getComments`, `createComment`, `replyComment`, `toggleCommentLike`: Threaded discussion board.
3. **LMS Quiz Controller (`src/controllers/lmsQuiz.controller.js`)**:
   * `getQuizOverview`: Metadata without answers.
   * `startQuizAttempt`: Enforces 3-attempt limit, sets `expiresAt`, returns question list.
   * `answerQuestion`: Records answer; with `check: true` verifies correctness server-side and locks answer.
   * `submitQuizAttempt`: Evaluates submission, applies 15s grace window, computes score/percentage/passed, updates best score.
4. **LMS Assignment Controller (`src/controllers/lmsAssignment.controller.js`)**:
   * `listAssignments`: Filters assignments by upcoming, past, all with student submission state.
   * `getAssignment`: Full assignment detail and student's submission.
   * `submitAssignment`: Validates GitHub URL format or S3 `submissions/` key, checks late deadline, permits pre-grading resubmission.
   * `getGradingQueue`: Instructor pending submissions queue.
   * `gradeSubmission`: Updates grade, score, feedback, rubric breakdown, and creates notification.
5. **Route Mounts**:
   * Create `src/routes/lms.routes.js` and mount under `/api/lms` in `src/app.js`.

### 3.4 Seed & Interactive Documentation Sync
1. **Interactive Docs Portal (`src/views/docs.html`)**:
   * Add Section "Trimester LMS Core" covering all 17 Phase 3 endpoints with live test drawers.
2. **Seed Engine (`src/seed.js`)**:
   * Seed sample Trimesters, Cohorts, LMS modules, lessons, quizzes, and assignments.
3. **Smoke Suite (`scripts/test-e2e-smoke.js`)**:
   * Add `FLOW 11: LMS Cohort Gating, Curriculum Progress, Server-Timed Quiz & Assignment Submission Flow`.

---

## 4. Dependencies
**No new external packages required.** All logic utilizes existing packages:
* `mongoose`
* `express`
* `crypto`

---

## 5. Verification Checklist
- [ ] Non-enrolled user receives `403 COHORT_ACCESS_DENIED` on any `/api/lms/*` call.
- [ ] `GET /api/lms/me` returns user cohorts and active cohort ID.
- [ ] `GET /api/lms/dashboard/student` returns accurate progress percentages and upcoming deliverables.
- [ ] `GET /api/lms/cohorts/:cohortId/curriculum` returns full module tree with completion statuses.
- [ ] `GET /api/lms/lessons/:lessonId` returns unshielded lesson content for enrolled students.
- [ ] `PUT /api/lms/lessons/:lessonId/progress` idempotently updates progress and objectives.
- [ ] `POST /api/lms/quizzes/:quizId/attempts` starts timed attempt with `expiresAt`.
- [ ] `POST /api/lms/quiz-attempts/:attemptId/answers` with `check: true` returns immediate correctness and locks question.
- [ ] `POST /api/lms/quiz-attempts/:attemptId/submit` enforces server timer countdown and 15s grace window.
- [ ] Quiz retakes respect the 3-attempt limit and retain the best score.
- [ ] `POST /api/lms/assignments/:id/submissions` validates GitHub URL or S3 key and permits resubmission before grading.
- [ ] `GET /api/lms/instructor/grading-queue` lists pending student submissions for instructor.
- [ ] `PUT /api/lms/submissions/:id/grade` records score, feedback, and rubric breakdown.
- [ ] `npm run build` passes with 0 syntax errors.
- [ ] `npm run test:smoke` passes 100%.
