# Specification: Unit 12 — Learning Engine & Quiz Grading

> **Spec Identifier**: `12-learning-engine-quiz-grading`  
> **Target Spec File**: `context/specs/12-learning-engine-quiz-grading.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 3, and 5)  

---

## 1. Goal

Implement the student learning interaction, lesson progress tracking, server-side quiz grading engine, private study notes, course Q&A discussion board, announcements, and verifiable completion certificate system under `/api/learning/*`. Ensure strict enrollment authorization guards, zero disclosure of hidden quiz answer keys (`correctOptionIndex`) to client callers, uniform `{ "error": "<message>" }` response schemas, MongoDB `_id` string property consistency, and live updates to the interactive API documentation portal served at `GET /`.

---

## 2. Design

### 2.1 Visual & Structural Decisions for API Documentation Portal (`src/views/docs.html`)
Following `context/architecture.md` and project UI standards, this unit updates the interactive **Backend API Documentation Portal** served at `GET /` (`src/views/docs.html`).

* **Theme Tokens**:
  * Surface Base (`--color-surface-base`): `#F8FAFC`
  * Card Surface (`--color-surface-card`): `#FFFFFF`
  * Code Surface (`--color-surface-code`): `#0F172A`
  * Header Surface (`--color-surface-table-header`): `#F1F5F9`
  * Subdued Border (`--color-border-subtle`): `#E2E8F0`
  * Text Primary (`--color-text-primary`): `#0F172A`
  * Accent Brand (`--color-accent-brand`): `#4F46E5`
* **HTTP Method Badges**:
  * `GET`: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
  * `POST`: Background `#DBEAFE`, Text `#1E40AF`, Border `#93C5FD`
  * `PUT`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
  * `DELETE`: Background `#FEE2E2`, Text `#B91C1C`, Border `#FCA5A5`
* **RBAC & Enrollment Security Guard**:
  * `Auth Guard`: Required (`Authorization: Bearer <token>`)
  * `Enrollment Guard`: Active enrollment in specified course required for students (instructors/admins bypass for course management).

---

### 2.2 Endpoint Structural Layout & Payloads

#### 1. `POST /api/learning/:courseId/progress`
* **Access**: Authenticated & Enrolled Students (or Instructor/Admin)
* **Header**: `Authorization: Bearer <token>`
* **Path Parameter**: `courseId` (MongoDB ObjectId or course slug)
* **Request Body**:
  ```json
  {
    "lessonId": "651a3c4d5e6f7a8b9c0d5678",
    "playbackPosition": 245,
    "isCompleted": true
  }
  ```
* **Purpose**: Updates student playback position for a lesson and optionally marks the lesson as completed. Automatically recalculates `progressPercentage` = `(completedLessons.length / totalLessonsInCourse) * 100`. When `progressPercentage === 100`, sets `isCompleted = true` and `completedAt = Date.now()`.
* **Success Response (`200 OK`)**:
  ```json
  {
    "message": "Lesson progress updated successfully",
    "progress": {
      "courseId": "651a3c4d5e6f7a8b9c0d1234",
      "lastAccessedLesson": "651a3c4d5e6f7a8b9c0d5678",
      "lastPlaybackPosition": 245,
      "completedLessons": [
        "651a3c4d5e6f7a8b9c0d5678"
      ],
      "progressPercentage": 25,
      "isCompleted": false,
      "completedAt": null
    }
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`: Token missing or invalid.
  * `403 Forbidden`: User is not enrolled in the course.
  * `404 Not Found`: Course or lesson ID not found.

---

#### 2. `POST /api/learning/:courseId/quiz/:quizId/submit`
* **Access**: Authenticated & Enrolled Students
* **Header**: `Authorization: Bearer <token>`
* **Path Parameters**: `courseId`, `quizId` (or `moduleId`)
* **Request Body**:
  ```json
  {
    "answers": [
      {
        "questionId": "651a3c4d5e6f7a8b9c0d9001",
        "selectedOptionIndex": 1
      },
      {
        "questionId": "651a3c4d5e6f7a8b9c0d9002",
        "selectedOptionIndex": 0
      }
    ]
  }
  ```
* **Purpose**: Evaluates quiz answers strictly server-side by looking up `correctOptionIndex` from the course quiz definition in MongoDB. Calculates percentage score (`correctCount / totalQuestions * 100`), compares against `passingScore` (default 70%), records attempt on `Enrollment.quizScores`, and returns detailed pass/fail breakdown without leaking unselected answer keys.
* **Success Response (`200 OK`)**:
  ```json
  {
    "message": "Quiz evaluated successfully",
    "result": {
      "quizId": "651a3c4d5e6f7a8b9c0d9000",
      "quizTitle": "Module 1 Assessment",
      "score": 100,
      "passingScore": 70,
      "passed": true,
      "totalQuestions": 2,
      "correctAnswers": 2,
      "breakdown": [
        {
          "questionId": "651a3c4d5e6f7a8b9c0d9001",
          "selectedOptionIndex": 1,
          "isCorrect": true
        },
        {
          "questionId": "651a3c4d5e6f7a8b9c0d9002",
          "selectedOptionIndex": 0,
          "isCorrect": true
        }
      ]
    }
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: Missing or malformed answers array.
  * `403 Forbidden`: User is not enrolled in the course.
  * `404 Not Found`: Quiz or course not found.

---

#### 3. `GET /api/learning/:courseId/questions` & `POST /api/learning/:courseId/questions`
* **Access**: Authenticated & Enrolled Students, Course Instructor, Admins
* **Header**: `Authorization: Bearer <token>`
* **Path Parameter**: `courseId`
* **GET Purpose**: Retrieves Q&A discussion threads for the course, optionally filtered by `?lessonId=`. Includes author user details (`firstName`, `lastName`, `avatarUrl`, `role`) and nested replies.
* **GET Success Response (`200 OK`)**:
  ```json
  {
    "questions": [
      {
        "_id": "651a3c4d5e6f7a8b9c0d7777",
        "course": "651a3c4d5e6f7a8b9c0d1234",
        "lessonId": "651a3c4d5e6f7a8b9c0d5678",
        "user": {
          "_id": "651a2b3c4d5e6f7a8b9c0d12",
          "firstName": "Jane",
          "lastName": "Doe",
          "avatarUrl": "https://s3.amazonaws.com/...",
          "role": "student"
        },
        "title": "Question about Async/Await",
        "content": "How do we handle unhandled promise rejections in Express v5?",
        "replies": [
          {
            "_id": "651a3c4d5e6f7a8b9c0d8888",
            "user": {
              "_id": "651a2b3c4d5e6f7a8b9c0d99",
              "firstName": "Alex",
              "lastName": "Instructor",
              "avatarUrl": "https://s3.amazonaws.com/...",
              "role": "instructor"
            },
            "content": "Express v5 automatically passes rejected promises to the global error middleware!",
            "createdAt": "2026-10-01T21:10:00.000Z"
          }
        ],
        "createdAt": "2026-10-01T21:00:00.000Z"
      }
    ]
  }
  ```
* **POST Request Body (`POST /api/learning/:courseId/questions`)**:
  ```json
  {
    "lessonId": "651a3c4d5e6f7a8b9c0d5678",
    "title": "Question about Async/Await",
    "content": "How do we handle unhandled promise rejections in Express v5?"
  }
  ```
* **POST Reply Endpoint (`POST /api/learning/:courseId/questions/:questionId/reply`)**:
  ```json
  {
    "content": "Express v5 automatically passes rejected promises to the global error middleware!"
  }
  ```

---

#### 4. `GET /api/learning/:courseId/notes` & `POST /api/learning/:courseId/notes` & `DELETE /api/learning/:courseId/notes/:noteId`
* **Access**: Authenticated & Enrolled Students (Private to each student)
* **Header**: `Authorization: Bearer <token>`
* **POST Request Body**:
  ```json
  {
    "lessonId": "651a3c4d5e6f7a8b9c0d5678",
    "timestamp": 120,
    "content": "Remember to use try-catch blocks or global error handler for async operations."
  }
  ```
* **GET Success Response (`200 OK`)**:
  ```json
  {
    "notes": [
      {
        "_id": "651a3c4d5e6f7a8b9c0d6666",
        "course": "651a3c4d5e6f7a8b9c0d1234",
        "lessonId": "651a3c4d5e6f7a8b9c0d5678",
        "timestamp": 120,
        "content": "Remember to use try-catch blocks or global error handler for async operations.",
        "createdAt": "2026-10-01T21:05:00.000Z"
      }
    ]
  }
  ```

---

#### 5. `GET /api/learning/:courseId/announcements` & `POST /api/learning/:courseId/announcements`
* **Access**: 
  * `GET`: Enrolled Students, Instructor, Admin
  * `POST`: Course Instructor, Admin
* **POST Request Body**:
  ```json
  {
    "title": "Live Q&A Session Scheduled",
    "content": "Join us live this Friday at 4 PM UTC for a deep dive into Mongoose v9 schemas."
  }
  ```
* **GET Success Response (`200 OK`)**:
  ```json
  {
    "announcements": [
      {
        "_id": "651a3c4d5e6f7a8b9c0d5555",
        "course": "651a3c4d5e6f7a8b9c0d1234",
        "instructor": {
          "_id": "651a2b3c4d5e6f7a8b9c0d99",
          "firstName": "Alex",
          "lastName": "Instructor",
          "avatarUrl": "https://s3.amazonaws.com/..."
        },
        "title": "Live Q&A Session Scheduled",
        "content": "Join us live this Friday at 4 PM UTC for a deep dive into Mongoose v9 schemas.",
        "createdAt": "2026-10-01T20:00:00.000Z"
      }
    ]
  }
  ```

---

#### 6. `GET /api/learning/:courseId/certificate`
* **Access**: Authenticated & Enrolled Students (who completed 100% of course) or Course Instructor / Admin
* **Header**: `Authorization: Bearer <token>`
* **Purpose**: Checks if user's enrollment `progressPercentage === 100` and `isCompleted === true`. Generates and returns certificate verification payload with unique certificate code (`GLX-CERT-<USER_ID_SUFFIX>-<COURSE_ID_SUFFIX>`), completion timestamp, student name, course title, and instructor name.
* **Success Response (`200 OK`)**:
  ```json
  {
    "message": "Certificate retrieved successfully",
    "certificate": {
      "certificateId": "GLX-CERT-0D12-1234",
      "studentName": "Jane Doe",
      "courseTitle": "Fullstack Node.js Masterclass",
      "instructorName": "Alex Instructor",
      "issuedAt": "2026-10-01T21:12:00.000Z",
      "verificationUrl": "http://localhost:3001/api/learning/verify-certificate/GLX-CERT-0D12-1234"
    }
  }
  ```
* **Error Response (`400 Bad Request`)**:
  * `{ "error": "Course incomplete. Certificate can only be issued upon 100% course progress completion." }`

---

## 3. Implementation

The implementation is divided into four sub-sections:

### 3.1 Data Schema Updates & Model Creation
1. **Update `Enrollment.model.js`**:
   Extend `enrollmentSchema` to include tracking fields:
   * `completedLessons`: `[{ type: Schema.Types.ObjectId }]` (or Strings representing lesson IDs).
   * `lastAccessedLesson`: `{ type: Schema.Types.ObjectId, default: null }`
   * `lastPlaybackPosition`: `{ type: Number, default: 0 }`
   * `quizScores`: `[{ quizId: Schema.Types.ObjectId, score: Number, passingScore: Number, passed: Boolean, attemptedAt: { type: Date, default: Date.now } }]`
   * `progressPercentage`: `{ type: Number, default: 0, min: 0, max: 100 }`
   * `isCompleted`: `{ type: Boolean, default: false }`
   * `completedAt`: `{ type: Date, default: null }`
   * `certificateId`: `{ type: String, default: null }`

2. **Create `src/models/QuestionNoteMisc.model.js`**:
   Define unified/dedicated schemas for Q&A, private student notes, and announcements:
   * `Question`: `course` (ref Course), `lessonId`, `user` (ref User), `title`, `content`, `replies`: `[{ user: ref User, content: String, createdAt: Date }]`.
   * `Note`: `course` (ref Course), `lessonId`, `user` (ref User), `timestamp` (Number), `content`.
   * `Announcement`: `course` (ref Course), `instructor` (ref User), `title`, `content`.

---

### 3.2 Middlewares & Authorization Guards
Create/Update `src/middlewares/enrollment.middleware.js`:
* `checkEnrollment`: Middleware that verifies `req.user` has an active enrollment (`Enrollment.findOne({ user: req.user._id, course: courseId, status: 'active' })`).
* Instructors (who own the course) and Admins automatically bypass the student enrollment check.

---

### 3.3 Controller Business Logic (`src/controllers/learning.controller.js`)
* `updateProgressController`: Validates course & lesson exist, adds `lessonId` to `completedLessons` if not already present, updates `lastAccessedLesson` and `lastPlaybackPosition`, calculates total lessons in course across all modules, updates `progressPercentage`, sets `isCompleted = true` and `completedAt = Date.now()` when 100% reached.
* `submitQuizController`: Extracts user answers from `req.body.answers`. Loads `Course` by `courseId`, locates the specified quiz in `modules[].quizzes[]`. Compares each `selectedOptionIndex` against hidden `correctOptionIndex`. Computes score percentage. Records score in `Enrollment.quizScores`. Returns evaluation breakdown.
* `getQuestionsController` & `createQuestionController` & `replyQuestionController`: Manages course Q&A discussions.
* `getNotesController` & `createNoteController` & `deleteNoteController`: Manages private student notes.
* `getAnnouncementsController` & `createAnnouncementController`: Manages course announcements.
* `getCertificateController`: Validates 100% completion, assigns/fetches `certificateId`, formats certificate response object.

---

### 3.4 Routes & Documentation Integration
* **Routes (`src/routes/learning.routes.js`)**:
  Attach routes to Express Router and mount under `/api/learning`:
  * `POST /:courseId/progress` -> `authGuard`, `checkEnrollment`, `updateProgressController`
  * `POST /:courseId/quiz/:quizId/submit` -> `authGuard`, `checkEnrollment`, `submitQuizController`
  * `GET /:courseId/questions` -> `authGuard`, `checkEnrollment`, `getQuestionsController`
  * `POST /:courseId/questions` -> `authGuard`, `checkEnrollment`, `createQuestionController`
  * `POST /:courseId/questions/:questionId/reply` -> `authGuard`, `checkEnrollment`, `replyQuestionController`
  * `GET /:courseId/notes` -> `authGuard`, `checkEnrollment`, `getNotesController`
  * `POST /:courseId/notes` -> `authGuard`, `checkEnrollment`, `createNoteController`
  * `DELETE /:courseId/notes/:noteId` -> `authGuard`, `checkEnrollment`, `deleteNoteController`
  * `GET /:courseId/announcements` -> `authGuard`, `checkEnrollment`, `getAnnouncementsController`
  * `POST /:courseId/announcements` -> `authGuard`, `roleGuard('instructor', 'admin')`, `createAnnouncementController`
  * `GET /:courseId/certificate` -> `authGuard`, `checkEnrollment`, `getCertificateController`

* **Documentation Update (`src/views/docs.html`)**:
  Update HTML documentation table with all 11 new endpoints, request headers, body formats, success JSON payloads, and HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`).

---

## 4. Dependencies

* **Node Native / Standard Libraries**: None required beyond standard Mongoose ODM and Express Router.
* **New npm Packages**: None (Uses existing `mongoose`, `express`, `jsonwebtoken`).

---

## 5. Verification Checklist

- [ ] **Enrollment Guard Enforcement**: Un-enrolled student attempting to post notes, progress, or submit quiz receives HTTP 403 `{ "error": "You must be enrolled in this course to access learning content" }`.
- [ ] **Server-Side Quiz Protection**: Hidden `correctOptionIndex` is NEVER exposed to client. Quiz grading is performed strictly server-side against MongoDB records.
- [ ] **Lesson Progress & Auto-Completion**: Updating lesson progress correctly updates `completedLessons`, calculates `progressPercentage`, and automatically sets `isCompleted = true` and `completedAt` when progress reaches 100%.
- [ ] **Private Notes Isolation**: Calling `GET /api/learning/:courseId/notes` returns only the calling student's private notes.
- [ ] **Q&A Thread & Replies**: Students and instructors can ask questions and post replies, correctly returning author profiles.
- [ ] **Instructor Announcements**: Instructors/admins can publish announcements; students can retrieve them.
- [ ] **Verifiable Completion Certificate**: `GET /api/learning/:courseId/certificate` returns a certificate for completed courses, but returns HTTP 400 for incomplete courses.
- [ ] **Uniform Error Responses**: All error responses return `{ "error": "<message>" }` with appropriate status code (`400`, `401`, `403`, `404`).
- [ ] **API Documentation Portal**: `src/views/docs.html` is updated with all Unit 12 endpoints.
