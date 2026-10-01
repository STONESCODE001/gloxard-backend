# Specification: Unit 09 — Admin Moderation, User Management & Platform Operations

> **Spec Identifier**: `09-admin-moderation-operations`  
> **Target Spec File**: `context/specs/09-admin-moderation-operations.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1 and 5)  

---

## 1. Goal

Implement the administrative moderation, user lifecycle management, course review, rejection appeal resolution, platform analytics, and notification broadcasting suite (`/api/admin/*`) restricted strictly to accounts with the `admin` role. Enforce strict role-based access control (RBAC), uniform `{ "error": "<message>" }` error responses, MongoDB `_id` identifier integrity, and real-time synchronization with the interactive API documentation portal served at `GET /`.

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
  * `GET`: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
  * `POST`: Background `#DBEAFE`, Text `#1E40AF`, Border `#93C5FD`
  * `PUT`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
  * `DELETE`: Background `#FEE2E2`, Text `#B91C1C`, Border `#FCA5A5`
* **RBAC Security Guard Badge**:
  * `Auth Guard`: Required (`Authorization: Bearer <token>`)
  * `Role Guard`: `admin` only (returns HTTP 403 Forbidden for `student` or `instructor` callers)

---

### 2.2 Endpoint Structural Layout & Payloads

#### 1. `GET /api/admin/dashboard-stats`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Purpose**: Retrieves high-level platform health metrics including user counts, course status breakdown, pending tutor applications, and gross financial volume.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "stats": {
      "totalUsers": 1250,
      "totalStudents": 1100,
      "totalInstructors": 145,
      "pendingTutors": 8,
      "totalCourses": 64,
      "publishedCourses": 48,
      "pendingCourses": 12,
      "rejectedCourses": 4,
      "totalEnrollments": 3420,
      "grossRevenue": 4850000
    }
  }
  ```

---

#### 2. `GET /api/admin/recent-registrations`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?limit=10` (default 10, max 50)
* **Purpose**: Retrieves the most recently created user accounts sorted descending by creation date.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "users": [
      {
        "_id": "651a2b3c4d5e6f7a8b9c0d12",
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane.doe@example.com",
        "role": "student",
        "approvalStatus": "approved",
        "isVerified": true,
        "isDeactivated": false,
        "createdAt": "2026-10-01T20:45:00.000Z"
      }
    ],
    "count": 1
  }
  ```

---

#### 3. `GET /api/admin/recent-transactions`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?limit=10` (default 10, max 50)
* **Purpose**: Retrieves recent financial transactions with user and course metadata.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "transactions": [
      {
        "_id": "651b3c4d5e6f7a8b9c0d1122",
        "reference": "TX_9876543210",
        "user": {
          "_id": "651a2b3c4d5e6f7a8b9c0d12",
          "firstName": "Jane",
          "lastName": "Doe",
          "email": "jane.doe@example.com"
        },
        "course": {
          "_id": "651a2b3c4d5e6f7a8b9c0d99",
          "title": "Full-Stack Node.js Masterclass"
        },
        "amount": 25000,
        "currency": "NGN",
        "status": "success",
        "instructorShare": 17500,
        "platformShare": 7500,
        "createdAt": "2026-10-01T19:30:00.000Z"
      }
    ],
    "count": 1
  }
  ```

---

#### 4. `GET /api/admin/users`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?role=student|instructor|admin`, `?status=pending|approved|rejected`, `?search=`, `?page=1`, `?limit=10`
* **Purpose**: Fetches a paginated, searchable directory of users with filtering options.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "users": [
      {
        "_id": "651a2b3c4d5e6f7a8b9c0d10",
        "firstName": "Alex",
        "lastName": "Tutor",
        "email": "alex.tutor@example.com",
        "role": "instructor",
        "approvalStatus": "pending",
        "isVerified": true,
        "isDeactivated": false,
        "title": "Senior Full-Stack Instructor",
        "areaOfExpertise": "Software Engineering",
        "experienceYears": 6,
        "createdAt": "2026-09-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

#### 5. `DELETE /api/admin/users/:id`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Purpose**: Deactivates (soft-deletes) a user account, preventing login and access. Prevents deactivating the active admin account.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "message": "User account deactivated successfully",
    "user": {
      "_id": "651a2b3c4d5e6f7a8b9c0d12",
      "email": "jane.doe@example.com",
      "isDeactivated": true
    }
  }
  ```
* **Error Handling**:
  * `400 Bad Request`: `{ "error": "Cannot deactivate your own admin account" }`
  * `404 Not Found`: `{ "error": "User account not found" }`

---

#### 6. `PUT /api/admin/tutors/:id/approval`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Request Body Schema**:
  ```json
  {
    "status": "approved",
    "rejectionReason": "Optional reason if rejecting"
  }
  ```
* **Behavior**:
  * Validates `status` is either `"approved"` or `"rejected"`.
  * Updates `user.approvalStatus` to the submitted status.
  * If status is `"approved"`, sets `user.role = "instructor"`.
  * If status is `"rejected"`, saves `user.rejectionReason` if provided.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "message": "Tutor application status updated to approved",
    "user": {
      "_id": "651a2b3c4d5e6f7a8b9c0d10",
      "firstName": "Alex",
      "lastName": "Tutor",
      "email": "alex.tutor@example.com",
      "role": "instructor",
      "approvalStatus": "approved",
      "updatedAt": "2026-10-01T21:00:00.000Z"
    }
  }
  ```

---

#### 7. `GET /api/admin/courses/pending`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?page=1`, `?limit=10`
* **Purpose**: Retrieves all course drafts submitted by instructors awaiting admin moderation (`status: "pending"`).
* **Response Structure (`200 OK`)**:
  ```json
  {
    "courses": [
      {
        "_id": "651a2b3c4d5e6f7a8b9c0d99",
        "title": "Advanced Microservices with Node.js",
        "slug": "advanced-microservices-with-nodejs",
        "category": "651a2b3c4d5e6f7a8b9c0d01",
        "subCategory": "Backend Engineering",
        "topic": "Microservices",
        "price": 30000,
        "courseType": "paid",
        "status": "pending",
        "instructor": {
          "_id": "651a2b3c4d5e6f7a8b9c0d10",
          "firstName": "Alex",
          "lastName": "Tutor",
          "email": "alex.tutor@example.com"
        },
        "createdAt": "2026-10-01T18:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

#### 8. `GET /api/admin/courses/all`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?status=draft|pending|published|rejected`, `?search=`, `?page=1`, `?limit=10`
* **Purpose**: Retrieves the full platform course catalog across all statuses.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "courses": [
      {
        "_id": "651a2b3c4d5e6f7a8b9c0d99",
        "title": "Advanced Microservices with Node.js",
        "slug": "advanced-microservices-with-nodejs",
        "status": "published",
        "instructor": {
          "_id": "651a2b3c4d5e6f7a8b9c0d10",
          "firstName": "Alex",
          "lastName": "Tutor"
        },
        "enrolledCount": 150,
        "rating": 4.8
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

#### 9. `PUT /api/admin/courses/:id/status`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Request Body Schema**:
  ```json
  {
    "status": "published",
    "rejectionReason": "Violates curriculum quality guidelines regarding audio volume."
  }
  ```
* **Behavior**:
  * Accepts `status` (`"published"` or `"rejected"`).
  * If `"rejected"`, `rejectionReason` is required.
  * Updates `course.status`, `course.rejectionReason`, `course.reviewedAt = new Date()`, and `course.reviewedBy = req.user._id`.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "message": "Course status updated to published successfully",
    "course": {
      "_id": "651a2b3c4d5e6f7a8b9c0d99",
      "title": "Advanced Microservices with Node.js",
      "status": "published",
      "rejectionReason": null,
      "reviewedAt": "2026-10-01T21:10:00.000Z"
    }
  }
  ```

---

#### 10. `GET /api/admin/appeals`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?status=pending|resolved|dismissed`, `?page=1`, `?limit=10`
* **Purpose**: Retrieves course rejection appeals submitted by instructors.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "appeals": [
      {
        "_id": "651a2b3c4d5e6f7a8b9c0d77",
        "courseId": {
          "_id": "651a2b3c4d5e6f7a8b9c0d99",
          "title": "Advanced Microservices with Node.js",
          "status": "rejected"
        },
        "instructorId": {
          "_id": "651a2b3c4d5e6f7a8b9c0d10",
          "firstName": "Alex",
          "lastName": "Tutor",
          "email": "alex.tutor@example.com"
        },
        "message": "We have re-recorded all audio tracks in HD quality as requested.",
        "status": "pending",
        "createdAt": "2026-10-01T19:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

#### 11. `PUT /api/admin/appeals/:id/status`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Request Body Schema**:
  ```json
  {
    "status": "resolved",
    "resolutionNotes": "Audio issues resolved. Course has been published."
  }
  ```
* **Behavior**:
  * Validates `status` is `"resolved"` or `"dismissed"`.
  * Updates `appeal.status` and `appeal.resolutionNotes`.
  * If resolved and notes indicate publication, optionally transitions matching course status to `"pending"` or `"published"`.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "message": "Course appeal status updated successfully",
    "appeal": {
      "_id": "651a2b3c4d5e6f7a8b9c0d77",
      "status": "resolved",
      "resolutionNotes": "Audio issues resolved. Course has been published.",
      "updatedAt": "2026-10-01T21:15:00.000Z"
    }
  }
  ```

---

#### 12. `GET /api/admin/finance`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Purpose**: Aggregates platform financial metrics, gross transactions, instructor payouts balance, and platform commission.
* **Response Structure (`200 OK`)**:
  ```json
  {
    "finance": {
      "grossRevenue": 4850000,
      "platformCommission": 1455000,
      "instructorPayoutsTotal": 3395000,
      "currency": "NGN",
      "totalSuccessfulTransactions": 194,
      "monthlyBreakdown": [
        {
          "month": "2026-10",
          "revenue": 2100000,
          "transactions": 84
        },
        {
          "month": "2026-09",
          "revenue": 2750000,
          "transactions": 110
        }
      ]
    }
  }
  ```

---

#### 13. `POST /api/admin/broadcast`
* **Access**: Authenticated (`admin` role).
* **Header**: `Authorization: Bearer <token>`
* **Request Body Schema**:
  ```json
  {
    "targetRole": "all",
    "title": "Platform Scheduled Maintenance",
    "message": "Gloxad Academy will undergo scheduled database maintenance on Sunday at 02:00 UTC.",
    "link": "/announcements/maintenance"
  }
  ```
* **Behavior**:
  * Validates `targetRole` (`"all"`, `"student"`, `"instructor"`), `title`, and `message`.
  * Finds matching target user IDs based on `targetRole`.
  * Bulk inserts `Notification` documents for all matched users.
* **Response Structure (`201 Created`)**:
  ```json
  {
    "message": "Broadcast notification dispatched successfully to 1250 users",
    "broadcast": {
      "targetRole": "all",
      "title": "Platform Scheduled Maintenance",
      "dispatchedCount": 1250,
      "createdAt": "2026-10-01T21:20:00.000Z"
    }
  }
  ```

---

## 3. Implementation

### 3.1 Schema & Model Updates / Verification
Verify and extend existing Mongoose schemas to support admin features:

1. **`User.model.js`**:
   - Ensure fields exist:
     - `approvalStatus`: `{ type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }`
     - `isDeactivated`: `{ type: Boolean, default: false }`
     - `rejectionReason`: `{ type: String, default: null }`

2. **`Course.model.js`**:
   - Ensure fields exist:
     - `status`: `{ type: String, enum: ['draft', 'pending', 'published', 'rejected'], default: 'draft' }`
     - `rejectionReason`: `{ type: String, default: null }`
     - `reviewedAt`: `{ type: Date, default: null }`
     - `reviewedBy`: `{ type: Schema.Types.ObjectId, ref: 'User', default: null }`

3. **`Appeal.model.js`**:
   - Schema defined in Unit 08:
     - `courseId`: `{ type: Schema.Types.ObjectId, ref: 'Course', required: true }`
     - `instructorId`: `{ type: Schema.Types.ObjectId, ref: 'User', required: true }`
     - `message`: `{ type: String, required: true }`
     - `status`: `{ type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' }`
     - `resolutionNotes`: `{ type: String, default: null }`
     - `timestamps`: `true`

4. **`Notification.model.js`**:
   - Verify/create schema:
     - `recipient`: `{ type: Schema.Types.ObjectId, ref: 'User', required: true }`
     - `targetRole`: `{ type: String, enum: ['all', 'student', 'instructor'], default: null }`
     - `title`: `{ type: String, required: true }`
     - `message`: `{ type: String, required: true }`
     - `type`: `{ type: String, default: 'system_broadcast' }`
     - `read`: `{ type: Boolean, default: false }`
     - `link`: `{ type: String, default: null }`
     - `timestamps`: `true`

---

### 3.2 Controller Implementation (`src/controllers/admin.controller.js`)

Implement the administrative controller module with the following exported functions:

* `getDashboardStatsController`: Aggregates DB document counts using `User.countDocuments`, `Course.countDocuments`, `Enrollment.countDocuments`, and `Transaction.aggregate` for gross revenue.
* `getRecentRegistrationsController`: Queries `User.find().sort({ createdAt: -1 }).limit(limit).select('-password')`.
* `getRecentTransactionsController`: Queries `Transaction.find().sort({ createdAt: -1 }).limit(limit).populate('user', 'firstName lastName email').populate('course', 'title')`.
* `getUsersController`: Constructs dynamic filter object (`role`, `approvalStatus`, search text regex on `firstName`, `lastName`, `email`), executes paginated query.
* `deactivateUserController`: Checks `req.params.id !== req.user._id.toString()`, updates `isDeactivated: true`.
* `moderateTutorApprovalController`: Validates `status` in `['approved', 'rejected']`, updates user record, sets `role = 'instructor'` if approved.
* `getPendingCoursesController`: Queries `Course.find({ status: 'pending' }).populate('instructor', 'firstName lastName email')` with pagination.
* `getAllCoursesController`: Queries `Course.find(filter).populate('instructor', 'firstName lastName email')` with pagination.
* `moderateCourseStatusController`: Validates `status` in `['published', 'rejected']`, checks `rejectionReason` if rejected, updates course fields (`reviewedAt`, `reviewedBy`).
* `getAppealsController`: Queries `Appeal.find(filter).populate('courseId', 'title status').populate('instructorId', 'firstName lastName email')`.
* `moderateAppealStatusController`: Updates `appeal.status` and `appeal.resolutionNotes`.
* `getFinanceMetricsController`: Performs Mongoose aggregation pipelines on `Transaction` collection to calculate gross revenue, platform share (30%), instructor payouts (70%), and monthly breakdown.
* `broadcastNotificationController`: Identifies target users via `User.find({ role: ... })`, constructs array of notification documents, executes `Notification.insertMany`.

---

### 3.3 Route Definitions & Middleware Guard Wiring (`src/routes/admin.routes.js`)

Create `src/routes/admin.routes.js` and apply middleware guards:

```javascript
import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware.js';
import { roleGuard } from '../middlewares/role.middleware.js';
import {
  getDashboardStatsController,
  getRecentRegistrationsController,
  getRecentTransactionsController,
  getUsersController,
  deactivateUserController,
  moderateTutorApprovalController,
  getPendingCoursesController,
  getAllCoursesController,
  moderateCourseStatusController,
  getAppealsController,
  moderateAppealStatusController,
  getFinanceMetricsController,
  broadcastNotificationController
} from '../controllers/admin.controller.js';

const router = Router();

// Apply authGuard and roleGuard('admin') to all admin endpoints
router.use(authGuard, roleGuard('admin'));

router.get('/dashboard-stats', getDashboardStatsController);
router.get('/recent-registrations', getRecentRegistrationsController);
router.get('/recent-transactions', getRecentTransactionsController);

router.get('/users', getUsersController);
router.delete('/users/:id', deactivateUserController);
router.put('/tutors/:id/approval', moderateTutorApprovalController);

router.get('/courses/pending', getPendingCoursesController);
router.get('/courses/all', getAllCoursesController);
router.put('/courses/:id/status', moderateCourseStatusController);

router.get('/appeals', getAppealsController);
router.put('/appeals/:id/status', moderateAppealStatusController);

router.get('/finance', getFinanceMetricsController);
router.post('/broadcast', broadcastNotificationController);

export default router;
```

Mount in `src/app.js`:
```javascript
import adminRouter from './routes/admin.routes.js';

app.use('/api/admin', adminRouter);
```

---

### 3.4 API Documentation Portal Sync (`src/views/docs.html`)

Synchronize `src/views/docs.html` by adding an **Admin Operations & Moderation** section detailing all 13 `/api/admin/*` endpoints, required headers, query parameters, payload shapes, and status codes (`200`, `201`, `400`, `401`, `403`, `404`).

---

## 4. Dependencies

* **Packages to Install**: None (Uses existing Express v5.x, Mongoose v9.x, and native Node.js ES Modules).

---

## 5. Verification Checklist

* [ ] **RBAC Protection**: Non-admin users (`student`, `instructor`, unauthenticated) receive HTTP 401/403 on all `/api/admin/*` endpoints.
* [ ] **Dashboard Metrics**: `GET /api/admin/dashboard-stats` correctly returns aggregated platform user, course, and revenue metrics.
* [ ] **User Management**: `GET /api/admin/users` supports filtering by role/status and text search with correct pagination.
* [ ] **Self-Deactivation Guard**: `DELETE /api/admin/users/:id` rejects deactivating the calling admin's own account with HTTP 400.
* [ ] **Tutor Approval**: `PUT /api/admin/tutors/:id/approval` successfully updates tutor status and sets `role = 'instructor'` upon approval.
* [ ] **Course Moderation**: `PUT /api/admin/courses/:id/status` updates course status to `published` or `rejected`, enforcing `rejectionReason` when rejected.
* [ ] **Appeal Handling**: `GET /api/admin/appeals` lists appeals and `PUT /api/admin/appeals/:id/status` resolves/dismisses appeals with resolution notes.
* [ ] **Financial Reporting**: `GET /api/admin/finance` returns accurate transaction totals, commission splits, and monthly breakdown.
* [ ] **Broadcast Notifications**: `POST /api/admin/broadcast` successfully creates notification records for targeted user roles.
* [ ] **Uniform Error Format**: Every failure scenario returns strictly formatted `{ "error": "<message>" }`.
* [ ] **Identifier Standard**: All returned MongoDB IDs preserve the `_id` string property name.
* [ ] **Documentation Sync**: `src/views/docs.html` updated with interactive docs for all 13 admin endpoints.
