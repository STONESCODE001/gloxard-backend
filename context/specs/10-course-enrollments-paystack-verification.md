# Specification: Unit 10 — Course Enrollments & Paystack Verification

> **Spec Identifier**: `10-course-enrollments-paystack-verification`  
> **Target Spec File**: `context/specs/10-course-enrollments-paystack-verification.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 4, and 5)  

---

## 1. Goal

Implement the course enrollment and server-side payment verification suite (`/api/enrollments/*`) enabling instant zero-cost enrollment for free courses, mandatory server-side Paystack transaction verification (`https://api.paystack.co/transaction/verify/:reference`) for paid courses, duplicate payment reference protection (idempotency), revenue share splitting (instructor vs. platform), and user course progress tracking initialization. Enforce strict role-based access control (RBAC), uniform `{ "error": "<message>" }` error responses, MongoDB `_id` identifier integrity, and real-time synchronization with the interactive API documentation portal served at `GET /`.

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
  * `Role Guard`: `student` or `instructor` or `admin` (authenticated users)

---

### 2.2 Endpoint Structural Layout & Payloads

#### 1. `POST /api/enrollments/enroll/:courseId`
* **Access**: Authenticated (`student`, `instructor`, `admin` roles).
* **Header**: `Authorization: Bearer <token>`
* **Path Parameter**: `courseId` (MongoDB ObjectId or course slug)
* **Purpose**: Performs instant zero-cost enrollment for free courses (`courseType === "free"`). Rejects paid courses with HTTP 400 instructing the caller to complete checkout verification instead.
* **Success Response (`201 Created` or `200 OK` if already enrolled)**:
  ```json
  {
    "message": "Enrolled successfully in free course",
    "enrollment": {
      "_id": "651a9c3d4e5f6a7b8c9d0e1f",
      "user": "651a2b3c4d5e6f7a8b9c0d12",
      "course": "651a3c4d5e6f7a8b9c0d1234",
      "enrolledAt": "2026-10-01T21:00:00.000Z",
      "completedLessons": [],
      "lastAccessedLesson": null,
      "quizScores": [],
      "progressPercentage": 0,
      "isCompleted": false,
      "completedAt": null
    }
  }
  ```
* **Error Scenarios**:
  * `400 Bad Request`: Course is paid (`{ "error": "This course is a paid course. Please proceed to payment checkout." }`).
  * `400 Bad Request`: Course is not published (`{ "error": "Cannot enroll in a course that is not published" }`).
  * `404 Not Found`: Invalid course ID (`{ "error": "Course not found" }`).

---

#### 2. `POST /api/enrollments/checkout`
* **Access**: Authenticated (`student`, `instructor`, `admin` roles).
* **Header**: `Authorization: Bearer <token>`
* **Request Body**:
  ```json
  {
    "courseId": "651a3c4d5e6f7a8b9c0d1234",
    "reference": "PAYSTACK_REF_1029384756"
  }
  ```
* **Purpose**: Validates Paystack payment reference server-side against Paystack API (`https://api.paystack.co/transaction/verify/:reference`), verifies price accuracy (converts Naira to Paystack Kobo format), prevents duplicate reference processing (idempotency), calculates instructor revenue share (70%) and platform revenue share (30%), records a `Transaction` document, creates an `Enrollment` document, and increments the course's `enrolledCount`.
* **Idempotency Guarantee**: If a transaction with the given reference already exists with status `"success"`, returns the existing enrollment and transaction without creating duplicate records or double-counting revenue.
* **Success Response (`201 Created` / `200 OK`)**:
  ```json
  {
    "message": "Payment verified and course enrollment completed successfully",
    "enrollment": {
      "_id": "651a9c3d4e5f6a7b8c9d0e1f",
      "user": "651a2b3c4d5e6f7a8b9c0d12",
      "course": "651a3c4d5e6f7a8b9c0d1234",
      "enrolledAt": "2026-10-01T21:05:00.000Z",
      "completedLessons": [],
      "lastAccessedLesson": null,
      "quizScores": [],
      "progressPercentage": 0,
      "isCompleted": false,
      "completedAt": null
    },
    "transaction": {
      "_id": "651a8b7c6d5e4f3a2b1c0d9e",
      "reference": "PAYSTACK_REF_1029384756",
      "user": "651a2b3c4d5e6f7a8b9c0d12",
      "course": "651a3c4d5e6f7a8b9c0d1234",
      "amount": 15000,
      "currency": "NGN",
      "status": "success",
      "instructorShare": 10500,
      "platformShare": 4500,
      "createdAt": "2026-10-01T21:05:00.000Z"
    }
  }
  ```
* **Error Scenarios**:
  * `400 Bad Request`: Missing `courseId` or `reference` (`{ "error": "courseId and reference are required" }`).
  * `400 Bad Request`: Paystack verification fails or transaction status is not `"success"` (`{ "error": "Payment verification failed: Transaction was not successful" }`).
  * `400 Bad Request`: Paid amount does not match expected course price (`{ "error": "Payment amount mismatch. Expected: 15000 NGN, Paid: 10000 NGN" }`).
  * `404 Not Found`: Target course does not exist (`{ "error": "Course not found" }`).

---

#### 3. `GET /api/enrollments/my-courses`
* **Access**: Authenticated (`student`, `instructor`, `admin` roles).
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `?page=1&limit=10`
* **Purpose**: Retrieves all course enrollments for the authenticated calling user, with populated course metadata (`title`, `subtitle`, `slug`, `thumbnail`, `instructor`, `modulesCount`, `lessonsCount`) and real-time learning progress statistics.
* **Success Response (`200 OK`)**:
  ```json
  {
    "enrollments": [
      {
        "_id": "651a9c3d4e5f6a7b8c9d0e1f",
        "course": {
          "_id": "651a3c4d5e6f7a8b9c0d1234",
          "title": "Complete Web Development Bootcamp",
          "slug": "complete-web-development-bootcamp",
          "thumbnail": "https://s3.amazonaws.com/gloxard/courses/thumbnails/bootcamp.jpg",
          "instructor": {
            "_id": "651a1a2b3c4d5e6f7a8b9c0d",
            "firstName": "Alex",
            "lastName": "Tutor",
            "avatarUrl": "https://s3.amazonaws.com/gloxard/avatars/alex.jpg"
          },
          "level": "beginner",
          "courseType": "paid"
        },
        "enrolledAt": "2026-10-01T21:05:00.000Z",
        "completedLessons": ["651a4b5c6d7e8f9a0b1c2d3e"],
        "progressPercentage": 25,
        "isCompleted": false,
        "completedAt": null
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

#### 4. `GET /api/enrollments/check/:courseId`
* **Access**: Authenticated (`student`, `instructor`, `admin` roles).
* **Header**: `Authorization: Bearer <token>`
* **Path Parameter**: `courseId` (MongoDB ObjectId or slug)
* **Purpose**: Checks whether the authenticated calling user is enrolled in a specific course.
* **Success Response (`200 OK`)**:
  ```json
  {
    "isEnrolled": true,
    "enrollment": {
      "_id": "651a9c3d4e5f6a7b8c9d0e1f",
      "enrolledAt": "2026-10-01T21:05:00.000Z",
      "progressPercentage": 25,
      "isCompleted": false
    }
  }
  ```

---

## 3. Implementation

### 3.1 Data Models (`src/models/`)

#### 1. `src/models/Enrollment.model.js`
Create the Mongoose schema for tracking course enrollments:
```js
import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedLessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    lastAccessedLesson: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    quizScores: [
      {
        moduleId: { type: String, required: true },
        score: { type: Number, required: true },
        passed: { type: Boolean, required: true },
        attemptedAt: { type: Date, default: Date.now },
      },
    ],
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate enrollment records per user & course
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
```

---

#### 2. `src/models/Transaction.model.js`
Create the Mongoose schema for financial records and Paystack verifications:
```js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    instructorShare: {
      type: Number,
      default: 0,
    },
    platformShare: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
```

---

### 3.2 Paystack Utility (`src/utils/paystack.js`)
Create the server-side Paystack API verification helper using `axios` or native `fetch`:
```js
import axios from 'axios';
import { env } from '../config/env.js';

/**
 * Verifies a transaction reference directly with Paystack REST API.
 * @param {string} reference - Paystack payment reference string
 * @returns {Promise<Object>} Paystack transaction data object
 */
export const verifyPaystackTransaction = async (reference) => {
  const secretKey = env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables');
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data && response.data.status === true) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Paystack verification failed');
    }
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`Paystack API Error: ${error.response.data.message}`);
    }
    throw error;
  }
};
```

---

### 3.3 Enrollment Controller (`src/controllers/enrollment.controller.js`)
Implement the business logic for course enrollments, free enrollment handling, checkout verification, and my-courses query:

```js
import { Enrollment } from '../models/Enrollment.model.js';
import { Transaction } from '../models/Transaction.model.js';
import { Course } from '../models/Course.model.js';
import { verifyPaystackTransaction } from '../utils/paystack.js';

// Constant revenue share ratios
const INSTRUCTOR_SHARE_RATIO = 0.70; // 70%
const PLATFORM_SHARE_RATIO = 0.30;   // 30%

/**
 * Instant enrollment for free courses
 * POST /api/enrollments/enroll/:courseId
 */
export const enrollFreeCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.status !== 'published') {
      return res.status(400).json({ error: 'Cannot enroll in a course that is not published' });
    }

    if (course.courseType !== 'free') {
      return res.status(400).json({ error: 'This course is a paid course. Please proceed to payment checkout.' });
    }

    // Check if already enrolled
    let enrollment = await Enrollment.findOne({ user: userId, course: course._id });
    if (enrollment) {
      return res.status(200).json({
        message: 'Already enrolled in this course',
        enrollment,
      });
    }

    // Create enrollment
    enrollment = await Enrollment.create({
      user: userId,
      course: course._id,
      enrolledAt: new Date(),
    });

    // Increment course enrollment count
    await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });

    return res.status(201).json({
      message: 'Enrolled successfully in free course',
      enrollment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Paid course checkout verification
 * POST /api/enrollments/checkout
 */
export const checkoutPaidCourse = async (req, res, next) => {
  try {
    const { courseId, reference } = req.body;
    const userId = req.user._id;

    if (!courseId || !reference) {
      return res.status(400).json({ error: 'courseId and reference are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.status !== 'published') {
      return res.status(400).json({ error: 'Cannot enroll in a course that is not published' });
    }

    // Idempotency check: check if reference has already been processed successfully
    let existingTx = await Transaction.findOne({ reference });
    if (existingTx && existingTx.status === 'success') {
      const existingEnrollment = await Enrollment.findOne({ user: userId, course: course._id });
      return res.status(200).json({
        message: 'Payment already verified and course unlocked',
        enrollment: existingEnrollment,
        transaction: existingTx,
      });
    }

    // Verify transaction with Paystack API
    const paystackData = await verifyPaystackTransaction(reference);

    if (paystackData.status !== 'success') {
      return res.status(400).json({ error: 'Payment verification failed: Transaction was not successful' });
    }

    // Paystack amount is in Kobo (1 NGN = 100 Kobo)
    const paidAmountNaira = paystackData.amount / 100;
    const expectedPrice = course.discountPrice > 0 ? course.discountPrice : course.price;

    if (paidAmountNaira < expectedPrice) {
      return res.status(400).json({
        error: `Payment amount mismatch. Expected: ${expectedPrice} NGN, Paid: ${paidAmountNaira} NGN`,
      });
    }

    // Calculate shares
    const instructorShare = Math.round(paidAmountNaira * INSTRUCTOR_SHARE_RATIO * 100) / 100;
    const platformShare = Math.round(paidAmountNaira * PLATFORM_SHARE_RATIO * 100) / 100;

    // Create or update Transaction document
    const transaction = await Transaction.create({
      reference,
      user: userId,
      course: course._id,
      amount: paidAmountNaira,
      currency: paystackData.currency || 'NGN',
      status: 'success',
      gatewayResponse: paystackData,
      instructorShare,
      platformShare,
    });

    // Create Enrollment document
    let enrollment = await Enrollment.findOne({ user: userId, course: course._id });
    if (!enrollment) {
      enrollment = await Enrollment.create({
        user: userId,
        course: course._id,
        enrolledAt: new Date(),
      });
      // Increment enrolled count
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });
    }

    return res.status(201).json({
      message: 'Payment verified and course enrollment completed successfully',
      enrollment,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get authenticated user's enrolled courses
 * GET /api/enrollments/my-courses
 */
export const getMyCourses = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [enrollments, total] = await Promise.all([
      Enrollment.find({ user: userId })
        .populate({
          path: 'course',
          select: 'title subtitle slug thumbnail level courseType price instructor',
          populate: {
            path: 'instructor',
            select: 'firstName lastName avatarUrl',
          },
        })
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enrollment.countDocuments({ user: userId }),
    ]);

    return res.status(200).json({
      enrollments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check enrollment status for a specific course
 * GET /api/enrollments/check/:courseId
 */
export const checkEnrollmentStatus = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    // Resolve course by ID or slug
    let course = await Course.findById(courseId);
    if (!course) {
      course = await Course.findOne({ slug: courseId });
    }
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const enrollment = await Enrollment.findOne({ user: userId, course: course._id }).lean();

    return res.status(200).json({
      isEnrolled: !!enrollment,
      enrollment: enrollment || null,
    });
  } catch (error) {
    next(error);
  }
};
```

---

### 3.4 Express Routes (`src/routes/enrollment.routes.js`)
Define and protect the enrollment routes:
```js
import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware.js';
import {
  enrollFreeCourse,
  checkoutPaidCourse,
  getMyCourses,
  checkEnrollmentStatus,
} from '../controllers/enrollment.controller.js';

const router = Router();

// All enrollment routes require user authentication
router.use(authGuard);

router.post('/enroll/:courseId', enrollFreeCourse);
router.post('/checkout', checkoutPaidCourse);
router.get('/my-courses', getMyCourses);
router.get('/check/:courseId', checkEnrollmentStatus);

export default router;
```

---

### 3.5 App Integration (`src/app.js`)
Mount the new enrollment routes under `/api/enrollments`:
```js
import enrollmentRoutes from './routes/enrollment.routes.js';

// Mount enrollment routes
app.use('/api/enrollments', enrollmentRoutes);
```

---

### 3.6 Interactive API Documentation Update (`src/views/docs.html`)
Update `src/views/docs.html` to document all 4 new endpoints with their HTTP methods, access guards, request parameters/bodies, status codes, and sample response JSON objects.

---

## 4. Dependencies

* **`axios`**: Required for server-side REST HTTP calls to Paystack verification API (`https://api.paystack.co/transaction/verify/:reference`).

Install command:
```bash
npm install axios
```

---

## 5. Verification Checklist

- [ ] **Dependency**: `axios` package is installed and imported in `src/utils/paystack.js`.
- [ ] **Model Definition**: `Enrollment.model.js` exists with unique compound index on `{ user: 1, course: 1 }`.
- [ ] **Model Definition**: `Transaction.model.js` exists with unique index on `reference` field.
- [ ] **Free Course Enrollment**: `POST /api/enrollments/enroll/:courseId` permits instant enrollment for `free` courses and rejects `paid` courses with HTTP 400.
- [ ] **Paid Course Checkout**: `POST /api/enrollments/checkout` performs server-side Paystack verification, verifies price matching (Naira to Kobo conversion), records `Transaction` and `Enrollment` documents, and splits revenue (70% instructor, 30% platform).
- [ ] **Idempotency Protection**: Submitting the same Paystack payment reference twice returns existing enrollment and transaction without duplicate database creation.
- [ ] **Enrolled Courses Listing**: `GET /api/enrollments/my-courses` returns user's active enrolled courses with populated course metadata and progress percentages.
- [ ] **Enrollment Check**: `GET /api/enrollments/check/:courseId` correctly identifies if a student is enrolled in a course.
- [ ] **Uniform Error Schema**: 100% of error responses return `{ "error": "<message>" }` with appropriate status code (`400`, `401`, `403`, `404`).
- [ ] **Docs Synchronization**: `src/views/docs.html` is updated to detail all new enrollment endpoints.
