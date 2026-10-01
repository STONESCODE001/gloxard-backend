# Specification: Unit 07 — Tutor Onboarding & Analytics

> **Spec Identifier**: `07-tutor-onboarding-analytics`  
> **Target Spec File**: `context/specs/07-tutor-onboarding-analytics.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1 and 5)  

---

## 1. Goal

Implement the instructor onboarding and performance analytics suite (`POST /api/tutor/showcase-expertise`, `GET /api/tutor/dashboard-stats`, and `GET /api/tutor/earnings`) to allow tutors to submit qualification credentials for administrative verification, monitor active course performance metrics, and track revenue balances. Enforce strict role authorization guards (`instructor`), uniform `{ "error": "<message>" }` error responses, non-destructive user schema updates, and synchronization with the interactive API documentation portal served at `GET /`.

---

## 2. Design

### 2.1 Visual & Structural Decisions for API Documentation Portal (`src/views/docs.html`)
Following `context/architecture.md` and `context/ui-context.md`, this unit updates the interactive **Backend API Documentation Portal** served at `GET /` (`src/views/docs.html`).

* **Theme Tokens**:
  * Surface Base (`--color-surface-base`): `#F8FAFC`
  * Card Surface (`--color-surface-card`): `#FFFFFF`
  * Code Surface (`--color-surface-code`): `#0F172A`
  * Header Surface (`--color-surface-table-header`): `#F1F5F9`
  * Subdued Border (`--color-border-subtle`): `#E2E8F0`
  * Text Primary (`--color-text-primary`): `#0F172A`
  * Accent Brand (`--color-accent-brand`): `#4F46E5`
* **HTTP Method Badges**:
  * `POST`: Background `#DBEAFE`, Text `#1E40AF`, Border `#93C5FD`
  * `GET`: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
* **RBAC Security Guard Badge**:
  * `Auth Guard`: Required (`Authorization: Bearer <token>`)
  * `Role`: `instructor` (or `student` for onboarding submission)

### 2.2 Endpoint Structural Layout & Payloads

1. **Endpoint Card 1: `POST /api/tutor/showcase-expertise`**
   - **Access**: Authenticated (`student` or `instructor` role).
   - **Header**: `Authorization: Bearer <token>`
   - **Purpose**: Submits tutor qualification profile, expertise summary, years of experience, and S3-hosted certification document links for admin review, transitioning `approvalStatus` to `"pending"`.
   - **Request Body Schema**:
     ```json
     {
       "title": "Senior Full-Stack Engineering Instructor",
       "areaOfExpertise": "Software Engineering & Web Development",
       "experienceYears": 6,
       "expertiseBio": "10+ years building scalable distributed systems and training 5,000+ developers globally.",
       "university": "University of Lagos",
       "skills": ["JavaScript", "Node.js", "React", "MongoDB", "System Design"],
       "certificationsUrl": "https://gloxad-media.s3.amazonaws.com/certifications/1727800000-alex_aws_cert.pdf",
       "certifications": ["AWS Certified Solutions Architect", "MongoDB Certified Developer"]
     }
     ```
   - **Behavior**:
     - Validates required fields (`areaOfExpertise`, `expertiseBio`).
     - Updates the caller's `User` record with the submitted showcase fields.
     - Transitions `approvalStatus` to `"pending"` (if not already approved) and sets role to `"instructor"` if caller was a `"student"`.
     - Preserves existing profile attributes and primary key `_id`.
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "message": "Tutor expertise showcase submitted successfully and is currently under administrative review",
       "user": {
         "_id": "651a2b3c4d5e6f7a8b9c0d10",
         "firstName": "Alex",
         "lastName": "Tutor",
         "name": "Alex Tutor",
         "email": "alex.tutor@example.com",
         "role": "instructor",
         "approvalStatus": "pending",
         "title": "Senior Full-Stack Engineering Instructor",
         "areaOfExpertise": "Software Engineering & Web Development",
         "experienceYears": 6,
         "expertiseBio": "10+ years building scalable distributed systems and training 5,000+ developers globally.",
         "university": "University of Lagos",
         "skills": ["JavaScript", "Node.js", "React", "MongoDB", "System Design"],
         "certificationsUrl": "https://gloxad-media.s3.amazonaws.com/certifications/1727800000-alex_aws_cert.pdf",
         "certifications": ["AWS Certified Solutions Architect", "MongoDB Certified Developer"],
         "avatarUrl": "https://gloxad-media.s3.amazonaws.com/avatars/alex.jpg",
         "isVerified": true,
         "createdAt": "2026-09-15T10:00:00.000Z",
         "updatedAt": "2026-10-01T20:20:00.000Z"
       }
     }
     ```
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `400 Bad Request`: `{ "error": "Area of expertise and expertise bio are required" }`

2. **Endpoint Card 2: `GET /api/tutor/dashboard-stats`**
   - **Access**: Authenticated (`instructor` role).
   - **Header**: `Authorization: Bearer <token>`
   - **Purpose**: Retrieves aggregated performance metrics for the authenticated instructor across all owned courses.
   - **Behavior**:
     - Computes total courses count (`Course.countDocuments({ instructor: req.user._id })`).
     - Computes published courses count (`status === "published"`).
     - Computes pending courses count (`status === "pending"`).
     - Computes draft courses count (`status === "draft"`).
     - Computes total unique enrolled students across instructor's courses (`Enrollment` aggregate or sum of `enrolledCount` across courses).
     - Computes average rating across published courses.
     - Computes total gross revenue generated by instructor's courses.
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "totalCourses": 12,
       "publishedCourses": 8,
       "pendingCourses": 2,
       "draftCourses": 2,
       "totalStudents": 1420,
       "averageRating": 4.85,
       "totalReviews": 310,
       "totalRevenue": 3550000
     }
     ```
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `403 Forbidden`: `{ "error": "Access denied. Instructor role required" }`

3. **Endpoint Card 3: `GET /api/tutor/earnings`**
   - **Access**: Authenticated (`instructor` role).
   - **Header**: `Authorization: Bearer <token>`
   - **Purpose**: Retrieves comprehensive financial breakdown, instructor revenue share balance, monthly earnings trajectory, and recent sales transactions.
   - **Behavior**:
     - Calculates `totalEarnings` (80% instructor share of gross sales on paid courses).
     - Calculates `withdrawableBalance` and `pendingBalance`.
     - Aggregates monthly earnings trajectory (`monthlyBreakdown`: array of `{ month: "YYYY-MM", grossRevenue: number, instructorEarnings: number, enrollments: number }`).
     - Retrieves recent transactions list for instructor's courses (`recentTransactions`: array of transaction summaries).
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "totalEarnings": 2840000,
       "withdrawableBalance": 2100000,
       "pendingBalance": 740000,
       "revenueSharePercentage": 80,
       "monthlyBreakdown": [
         {
           "month": "2026-08",
           "grossRevenue": 1500000,
           "instructorEarnings": 1200000,
           "enrollments": 60
         },
         {
           "month": "2026-09",
           "grossRevenue": 2050000,
           "instructorEarnings": 1640000,
           "enrollments": 82
         }
       ],
       "recentTransactions": [
         {
           "_id": "651a2b3c4d5e6f7a8b9c0e50",
           "courseTitle": "Complete Full-Stack Web Development BootCamp",
           "studentName": "John Doe",
           "amount": 25000,
           "instructorShare": 20000,
           "status": "success",
           "createdAt": "2026-09-28T14:30:00.000Z"
         }
       ]
     }
     ```
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `403 Forbidden`: `{ "error": "Access denied. Instructor role required" }`

---

## 3. Implementation

The implementation is divided into four sub-sections:

### 3.1 Data Model Schema Extensions (`src/models/User.model.js`)
* Update `userSchema` in [`src/models/User.model.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/models/User.model.js) to support tutor showcase fields:
  * `experienceYears`: `{ type: Number, default: 0 }`
  * `expertiseBio`: `{ type: String, default: "", trim: true }`
  * `certificationsUrl`: `{ type: String, default: "", trim: true }`
* Ensure `toJSON` and `toObject` transforms include `experienceYears`, `expertiseBio`, `certificationsUrl`, `certifications`, `skills`, and `approvalStatus`.
* Pre-save hook: align `expertiseBio` with `bio`/`biography` if one is set and the other is empty.

### 3.2 Controller Business Logic (`src/controllers/tutor.controller.js`)
* Create `src/controllers/tutor.controller.js` with three main controller functions:
  1. `showcaseExpertiseController`:
     - Extracts `title`, `areaOfExpertise`, `experienceYears`, `expertiseBio`, `university`, `skills`, `certificationsUrl`, `certifications` from `req.body`.
     - Validates mandatory fields (`areaOfExpertise`, `expertiseBio`).
     - Updates `req.user` in MongoDB using `User.findByIdAndUpdate(req.user._id, ..., { new: true, runValidators: true })`.
     - If `user.role === "student"`, upgrades `role` to `"instructor"`.
     - Sets `approvalStatus = "pending"`.
     - Returns HTTP 200 with `{ message, user }`.
  2. `getDashboardStatsController`:
     - Queries MongoDB `Course` model for counts by `instructor: req.user._id` and `status`.
     - Queries `Enrollment` model or sums `enrolledCount` across instructor's courses.
     - Calculates average rating from published courses.
     - Returns HTTP 200 with stats object.
  3. `getEarningsController`:
     - Queries `Transaction` and `Course` models associated with instructor courses.
     - Computes gross revenue, instructor share (80%), withdrawable vs pending balances.
     - Aggregates monthly breakdown.
     - Returns HTTP 200 with earnings structure.

### 3.3 Router Mapping & Application Registration (`src/routes/tutor.routes.js` & `src/app.js`)
* Create `src/routes/tutor.routes.js`:
  - Instantiates Express Router.
  - Applies `authMiddleware` across all tutor endpoints.
  - Defines `POST /showcase-expertise` mapped to `showcaseExpertiseController`.
  - Defines `GET /dashboard-stats` with `roleMiddleware("instructor")` mapped to `getDashboardStatsController`.
  - Defines `GET /earnings` with `roleMiddleware("instructor")` mapped to `getEarningsController`.
* Mount tutor routes in [`src/app.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/app.js) under `/api/tutor`.

### 3.4 Interactive Documentation Portal Sync (`src/views/docs.html`)
* Update [`src/views/docs.html`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/views/docs.html):
  - Add navigation item link `Tutor Onboarding & Analytics` in sidebar navigation.
  - Add section container for Section 7 ("Tutor Onboarding & Analytics").
  - Render complete endpoint cards, method badges, parameters table, request body JSON previews, and response payload examples for `POST /api/tutor/showcase-expertise`, `GET /api/tutor/dashboard-stats`, and `GET /api/tutor/earnings`.

---

## 4. Dependencies

* **Dependencies to Install**: None.
* **Existing Dependencies Used**: `express`, `mongoose`, `jsonwebtoken`.

---

## 5. Verification Checklist

- [ ] **Data Model Validation**: `User.model.js` incorporates `experienceYears`, `expertiseBio`, and `certificationsUrl` while preserving JSON virtuals.
- [ ] **`POST /api/tutor/showcase-expertise` (Unauthenticated)**: Returns `401 {"error": "Authentication token missing or malformed"}`.
- [ ] **`POST /api/tutor/showcase-expertise` (Missing required fields)**: Returns `400 {"error": "Area of expertise and expertise bio are required"}`.
- [ ] **`POST /api/tutor/showcase-expertise` (Valid request)**: Updates user profile, sets `approvalStatus: "pending"`, upgrades student role to `instructor`, returns `200 OK` with updated user payload retaining `_id`.
- [ ] **`GET /api/tutor/dashboard-stats` (Non-instructor / Student)**: Returns `403 {"error": "Access denied. Instructor role required"}`.
- [ ] **`GET /api/tutor/dashboard-stats` (Authenticated Instructor)**: Returns `200 OK` with `totalCourses`, `publishedCourses`, `pendingCourses`, `draftCourses`, `totalStudents`, `averageRating`, and `totalRevenue`.
- [ ] **`GET /api/tutor/earnings` (Non-instructor / Student)**: Returns `403 {"error": "Access denied. Instructor role required"}`.
- [ ] **`GET /api/tutor/earnings` (Authenticated Instructor)**: Returns `200 OK` with `totalEarnings`, `withdrawableBalance`, `pendingBalance`, `monthlyBreakdown`, and `recentTransactions`.
- [ ] **Build Validation Check**: `npm run build` (`node scripts/build.js`) completes clean syntax checking across all project modules.
- [ ] **API Docs Portal Sync**: `GET /` renders documentation cards for all 3 Unit 07 endpoints.
