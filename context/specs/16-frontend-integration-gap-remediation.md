# Unit 16 Specification: Frontend Integration Gap Remediation

> Master Build Plan: [`00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> Architectural Standards: [`architecture.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/architecture.md)

---

## 1. Goal

Eliminate all integration blockers and schema discrepancies identified in the frontend API audit by implementing 6 missing REST endpoints (`GET /api/admin/users/:id`, `GET /api/admin/courses/:id`, `GET /api/tutor/search-instructors`, `POST /api/courses/:id/reviews`, `POST /api/auth/refresh`, `GET/PUT /api/admin/settings`), adding a complete Course Reviews & Ratings Engine, expanding schema models (`imageUrl` on Categories, `experienceProofs` on Users, `PlatformSettings`), standardizing field name aliases across all responses, enabling multi-origin CORS, and syncing the interactive HTML API documentation portal and project context files.

---

## 2. Design

### 2.1 Data Models & Schema Enhancements

1. **`Review.model.js` (New Model)**:
   - `course`: `{ type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true }`
   - `student`: `{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }`
   - `rating`: `{ type: Number, required: true, min: 1, max: 5 }`
   - `comment`: `{ type: String, required: true, trim: true }`
   - `tutorReply`: `{ comment: { type: String, default: "" }, createdAt: { type: Date, default: null } }`
   - Unique compound index on `{ course: 1, student: 1 }` to prevent duplicate student reviews per course.

2. **`PlatformSettings.model.js` (New Model)**:
   - Singleton document holding platform configurations:
     - `allowSignups`: `{ type: Boolean, default: true }`
     - `allowPasswordReset`: `{ type: Boolean, default: true }`
     - `deletionGraceDays`: `{ type: Number, default: 30 }`
     - `signatureUrl`: `{ type: String, default: "" }`

3. **`User.model.js` Extensions**:
   - `experienceProofs`: `{ type: [String], default: [] }`
   - Expanded `toJSON` and `toObject` transform functions to guarantee consistent response dual-key aliases:
     - `isVerified` and `isEmailVerified` (both set to boolean state)
     - `bio`, `biography`, and `expertiseBio` (all set to user bio text)
     - `socials` and `socialLinks` (both set to social links object)
     - `avatar` and `avatarUrl` (both set to avatar image URL)

4. **`Category.model.js` Extensions**:
   - `imageUrl`: `{ type: String, default: "", trim: true }`

---

### 2.2 Endpoint Architecture & RBAC Safeguards

All endpoints strictly adhere to Rule 1 (`{ "error": "<message>" }`) and Rule 5 (`_id` identifier retention):

| Endpoint | HTTP Method | Guard / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/refresh` | `POST` | `authGuard` (or valid JWT) | Refresh access token using active Bearer token and current `tokenVersion`. |
| `/api/admin/users/:id` | `GET` | `authGuard`, `admin` | Fetch complete user profile including onboarding credential fields. |
| `/api/admin/courses/:id` | `GET` | `authGuard`, `admin` | Fetch full unshielded course details for review regardless of status. |
| `/api/admin/settings` | `GET` | `authGuard`, `admin` | Retrieve current platform settings singleton. |
| `/api/admin/settings` | `PUT` | `authGuard`, `admin` | Update platform settings toggles, grace days, and signature image. |
| `/api/admin/reviews` | `GET` | `authGuard`, `admin` | List all platform course reviews with optional rating/course filtering. |
| `/api/admin/reviews/:id` | `DELETE` | `authGuard`, `admin` | Moderation delete of a review and auto-recalculate course rating. |
| `/api/tutor/search-instructors` | `GET` | `authGuard`, `instructor` | Search approved instructors by name/email/username for co-instructors. |
| `/api/tutor/reviews` | `GET` | `authGuard`, `instructor` | Fetch student reviews for courses created by signed-in instructor. |
| `/api/tutor/reviews/:id/reply` | `POST` | `authGuard`, `instructor` | Post an instructor response to a student review on their course. |
| `/api/courses/:id/reviews` | `POST` | `authGuard`, `student` | Submit rating & review for an enrolled course. Updates course `rating`. |
| `/api/courses/:id/reviews` | `GET` | Public / Optional Auth | Paginated list of student reviews for a course. |

---

## 3. Implementation

### 3.1 Model & Schema Files

1. **Create `src/models/Review.model.js`**:
   - Define Mongoose schema for course reviews with indexes, timestamping, and static helper method `recalculateCourseRating(courseId)` that updates `Course.rating` and `Course.ratingsCount`.

2. **Create `src/models/PlatformSettings.model.js`**:
   - Define Mongoose schema and helper `getOrCreateSettings()` to guarantee a single document exists.

3. **Update `src/models/User.model.js`**:
   - Add `experienceProofs: { type: [String], default: [] }`.
   - Update `toJSON` and `toObject` transform hooks to populate `isEmailVerified`, `isVerified`, `biography`, `bio`, `expertiseBio`, `socialLinks`, `socials`, `avatarUrl`, and `avatar`.

4. **Update `src/models/Category.model.js`**:
   - Add `imageUrl: { type: String, default: "" }` field to category schema.

---

### 3.2 Authentication & Middleware Updates

1. **Token Refresh Controller (`src/controllers/auth.controller.js`)**:
   - Implement `refreshTokenController`: Extracts Bearer token from header (or body `{ token }`), verifies signature, checks user existence and `tokenVersion` match, and generates a fresh 7-day JWT token returning `200 { token, user }`.

2. **Multi-Origin CORS Support (`src/config/env.js` & `src/app.js`)**:
   - Update `env.js` and `app.js` to handle comma-separated strings in `FRONTEND_ORIGIN` (e.g. `http://localhost:3000,https://gloxard-web.onrender.com`), enabling both development and production origins.

---

### 3.3 Admin Operations Expansion

1. **Admin Single User Details (`GET /api/admin/users/:id`)**:
   - In `src/controllers/admin.controller.js`, implement `getUserDetailsController`. Return populated user document including `experienceProofs`, `certifications`, `certificationsUrl`, `socials`, and `notificationPreferences`.

2. **Admin Single Course Unshielded View (`GET /api/admin/courses/:id`)**:
   - In `src/controllers/admin.controller.js`, implement `getAdminCourseDetailsController`. Find course by `_id` without filtering by status or shielding lesson video URLs / quiz answers.

3. **Admin Platform Settings Controllers (`GET/PUT /api/admin/settings`)**:
   - Implement `getPlatformSettingsController` and `updatePlatformSettingsController` in `src/controllers/admin.controller.js`.

4. **Admin Pending Courses Category Population (`GET /api/admin/courses/pending`)**:
   - Update `getPendingCoursesController` to populate `category` with `{ _id, name, slug, icon, imageUrl }` so the category name is returned instead of an unpopulated ID string.

5. **Admin Review Moderation Controllers (`GET /api/admin/reviews` & `DELETE /api/admin/reviews/:id`)**:
   - Implement review listing and deletion in `src/controllers/admin.controller.js`. Deleting a review triggers rating recalculation for the affected course.

---

### 3.4 Tutor Workflow Enhancements

1. **Instructor Search (`GET /api/tutor/search-instructors?q=`)**:
   - In `src/controllers/tutor.controller.js`, implement `searchInstructorsController`. Search users with `role: "instructor"` and `approvalStatus: "approved"` using regex match on `name`, `username`, or `email`.

2. **Tutor Review Management (`GET /api/tutor/reviews` & `POST /api/tutor/reviews/:id/reply`)**:
   - In `src/controllers/tutor.controller.js`, implement fetching reviews for the tutor's courses and replying to specific reviews (`tutorReply: { comment, createdAt }`).

---

### 3.5 Course Rating & Review Engine

1. **Student Review Creation (`POST /api/courses/:id/reviews`)**:
   - In `src/controllers/course.controller.js`, verify caller is enrolled in the course via `Enrollment` query.
   - Upsert review document and execute rating recalculation (`Review.recalculateCourseRating(courseId)`).

2. **Public Review Listing (`GET /api/courses/:id/reviews`)**:
   - In `src/controllers/course.controller.js`, fetch paginated reviews for a course populated with student avatar, name, and rating.

---

### 3.6 Interactive Documentation Portal Sync

1. **Update `src/views/docs.html`**:
   - Add documentation sections, request/response payload examples, and interactive "Try It Out" test drawers for all new endpoints:
     - `POST /api/auth/refresh`
     - `GET /api/admin/users/:id`
     - `GET /api/admin/courses/:id`
     - `GET /api/admin/settings` & `PUT /api/admin/settings`
     - `GET /api/admin/reviews` & `DELETE /api/admin/reviews/:id`
     - `GET /api/tutor/search-instructors`
     - `GET /api/tutor/reviews` & `POST /api/tutor/reviews/:id/reply`
     - `POST /api/courses/:id/reviews` & `GET /api/courses/:id/reviews`

---

### 3.7 Database Seeding & Smoke Test Suite Update

1. **Update `src/seed.js`**:
   - Seed initial platform settings document.
   - Seed sample course reviews and tutor replies.
   - Ensure categories include `imageUrl` and instructors include `experienceProofs`.

2. **Update `scripts/smoke-test.js`**:
   - Add automated test assertions covering token refresh, platform settings CRUD, instructor search, review creation & rating recalculation, admin single user fetch, and admin single course fetch.

---

## 4. Dependencies

No new third-party npm packages required. Implementation utilizes existing project dependencies:
- `express` v5.x
- `mongoose` v9.x
- `jsonwebtoken`
- `cors`
- `helmet`

---

## 5. Verification Checklist

- [ ] `POST /api/auth/refresh` returns `200 OK` with a valid refreshed JWT token and user profile.
- [ ] `GET /api/admin/users/:id` returns `200 OK` with full profile and onboarding credentials (`experienceProofs`, `certificationsUrl`, etc.).
- [ ] `GET /api/admin/courses/:id` returns `200 OK` with unshielded course data regardless of status.
- [ ] `GET /api/admin/settings` & `PUT /api/admin/settings` successfully read and update platform configuration toggles and signature image URL.
- [ ] `GET /api/admin/courses/pending` returns populated category object with `name` and `_id`.
- [ ] `GET /api/tutor/search-instructors?q=john` returns matching approved instructors.
- [ ] `POST /api/courses/:id/reviews` creates a student review and auto-updates course average `rating` and `ratingsCount`.
- [ ] `GET /api/tutor/reviews` returns student reviews for the instructor's courses.
- [ ] `POST /api/tutor/reviews/:id/reply` records the instructor's reply on the review.
- [ ] `GET /api/admin/reviews` and `DELETE /api/admin/reviews/:id` work correctly, updating course average rating on deletion.
- [ ] User profile responses contain all dual-key aliases (`isVerified`/`isEmailVerified`, `bio`/`biography`, `socials`/`socialLinks`, `avatar`/`avatarUrl`).
- [ ] Interactive HTML API Documentation at `GET /` renders documentation blocks and test drawers for all new endpoints.
- [ ] `npm run seed` and `npm run test:smoke` complete with 100% pass rate.

---

## 6. Context Files Updates Required

The following project context documentation files will be updated as part of this unit:

1. **`context/project-overview.md`**:
   - Update REST endpoint count from 35+ to 45+.
   - Add Review System, Platform Settings, Token Refresh, and Instructor Search to user flows and category lists.
2. **`context/architecture.md`**:
   - Update model list from 12 to 14 Mongoose collections (adding `Review` and `PlatformSettings`).
   - Document Token Refresh lifecycle and multi-origin CORS support.
3. **`context/progress-tracker.md`**:
   - Add **Unit 16: Frontend Integration Gap Remediation** to the master units summary.
4. **`context/specs/00-build-plan.md`**:
   - Append Unit 16 milestone and specification details.
