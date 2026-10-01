# Specification: Unit 08 — 5-Step Course Authoring Wizard & Review Pipeline

> **Spec Identifier**: `08-course-authoring-review-pipeline`  
> **Target Spec File**: `context/specs/08-course-authoring-review-pipeline.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 3, and 5)  

---

## 1. Goal

Implement the complete 5-step incremental course authoring, management, submission, and appeal pipeline (`POST /api/tutor/courses`, `PUT /api/tutor/courses/:id`, `GET /api/tutor/courses`, `GET /api/tutor/courses/:id`, `POST /api/tutor/courses/:id/submit`, and `POST /api/tutor/courses/:id/appeal`) alongside the `Appeal` Mongoose data model. Enforce strict instructor ownership, full unshielded draft previews for course owners, step-by-step completeness validation prior to admin review submission, uniform `{ "error": "<message>" }` error responses, and synchronization with the interactive API documentation portal served at `GET /`.

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
  * `PUT`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
  * `GET`: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
* **RBAC & Ownership Security Guard Badge**:
  * `Auth Guard`: Required (`Authorization: Bearer <token>`)
  * `Role`: `instructor` (or `admin`)
  * `Ownership`: Required (`course.instructor === req.user._id`)

---

### 2.2 Endpoint Structural Layout & Payloads

1. **Endpoint Card 1: `POST /api/tutor/courses` (Step 1 — Initial Course Draft Creation)**
   - **Access**: Authenticated Instructor (`instructor` role).
   - **Header**: `Authorization: Bearer <token>`
   - **Purpose**: Initializes a new course draft record with basic info (Step 1) and assigns `status: "draft"` and `instructor: req.user._id`.
   - **Request Body Schema**:
     ```json
     {
       "title": "Complete Full-Stack Web Development BootCamp",
       "subtitle": "Master React, Node.js, Express, and MongoDB from scratch",
       "category": "Development & Engineering",
       "subCategory": "Web Development",
       "topic": "Full-Stack",
       "language": "English",
       "level": "beginner",
       "courseType": "paid",
       "price": 25000,
       "discountPrice": 18000
     }
     ```
   - **Behavior**:
     - Validates mandatory Step 1 fields (`title`, `category`, `courseType`).
     - Auto-generates a clean, unique URL-friendly `slug` from `title` (e.g., `"complete-full-stack-web-development-bootcamp"`).
     - Sets `status` to `"draft"` and `instructor` to `req.user._id`.
     - Returns HTTP 201 Created with the full created draft course object.
   - **Response Structure (`201 Created`)**:
     ```json
     {
       "message": "Course draft created successfully",
       "course": {
         "_id": "651a2b3c4d5e6f7a8b9c0d20",
         "title": "Complete Full-Stack Web Development BootCamp",
         "subtitle": "Master React, Node.js, Express, and MongoDB from scratch",
         "slug": "complete-full-stack-web-development-bootcamp",
         "category": "Development & Engineering",
         "subCategory": "Web Development",
         "topic": "Full-Stack",
         "language": "English",
         "level": "beginner",
         "courseType": "paid",
         "price": 25000,
         "discountPrice": 18000,
         "status": "draft",
         "instructor": "651a2b3c4d5e6f7a8b9c0d10",
         "modules": [],
         "createdAt": "2026-10-01T20:45:00.000Z",
         "updatedAt": "2026-10-01T20:45:00.000Z"
       }
     }
     ```
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `403 Forbidden`: `{ "error": "Access denied. Instructor role required" }`
     - `400 Bad Request`: `{ "error": "Title, category, and course type are required" }`

2. **Endpoint Card 2: `PUT /api/tutor/courses/:id` (Steps 2–4 — Incremental Wizard Step Updates)**
   - **Access**: Authenticated Instructor (Course owner only).
   - **Header**: `Authorization: Bearer <token>`
   - **Parameter**: `:id` (MongoDB Course `_id`).
   - **Purpose**: Incrementally updates course content across Steps 2 (Advanced Info), 3 (Curriculum & Lessons & Quizzes), and 4 (Publish Messages).
   - **Request Body Schema (Flexible Step Payload)**:
     ```json
     {
       "thumbnail": "https://gloxad-media.s3.amazonaws.com/courses/thumbnails/fullstack.jpg",
       "trailerVideoUrl": "https://gloxad-media.s3.amazonaws.com/courses/trailers/fullstack-promo.mp4",
       "description": "Comprehensive step-by-step guide to building modern full-stack web applications...",
       "skills": ["JavaScript", "Node.js", "React", "MongoDB", "Express.js"],
       "targetAudience": ["Aspiring Web Developers", "Computer Science Students"],
       "requirements": ["Basic computer literacy"],
       "modules": [
         {
           "title": "Module 1: Introduction to Web Architecture",
           "lessons": [
             {
               "title": "Lesson 1: How the Web Works",
               "duration": "12:45",
               "isFreePreview": true,
               "videoUrl": "https://gloxad-media.s3.amazonaws.com/courses/videos/lesson1.mp4"
             },
             {
               "title": "Lesson 2: Setting Up Node.js Environment",
               "duration": "18:20",
               "isFreePreview": false,
               "videoUrl": "https://gloxad-media.s3.amazonaws.com/courses/videos/lesson2.mp4"
             }
           ],
           "quizzes": [
             {
               "title": "Module 1 Quiz",
               "passingScore": 70,
               "questions": [
                 {
                   "questionText": "What protocol does HTTP build upon?",
                   "options": ["UDP", "TCP", "ICMP", "FTP"],
                   "correctOptionIndex": 1
                 }
               ]
             }
           ]
         }
       ],
       "welcomeMessage": "Welcome to the Complete Full-Stack BootCamp! Get ready to build real projects.",
       "congratsMessage": "Congratulations on completing the course! You are now ready to build full-stack web apps."
     }
     ```
   - **Behavior**:
     - Verifies course exists and `course.instructor.toString() === req.user._id.toString()`.
     - Rejects edits if course is currently `pending` or `published` (returns `400 Bad Request`). Edits are permitted only when `status === "draft"` or `status === "rejected"`.
     - If `title` is updated, re-generates slug.
     - Performs deep update of modified fields while preserving existing values.
     - Returns HTTP 200 OK with updated course object.
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `403 Forbidden`: `{ "error": "You do not have permission to edit this course" }`
     - `404 Not Found`: `{ "error": "Course not found" }`
     - `400 Bad Request`: `{ "error": "Cannot edit a course that is currently pending review or published" }`

3. **Endpoint Card 3: `GET /api/tutor/courses` (Instructor Course Directory)**
   - **Access**: Authenticated Instructor (`instructor` role).
   - **Header**: `Authorization: Bearer <token>`
   - **Purpose**: Retrieves all courses created by the authenticated instructor across all status lifecycles (`draft`, `pending`, `published`, `rejected`).
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "courses": [
         {
           "_id": "651a2b3c4d5e6f7a8b9c0d20",
           "title": "Complete Full-Stack Web Development BootCamp",
           "slug": "complete-full-stack-web-development-bootcamp",
           "category": "Development & Engineering",
           "courseType": "paid",
           "price": 25000,
           "status": "draft",
           "enrolledCount": 0,
           "createdAt": "2026-10-01T20:45:00.000Z",
           "updatedAt": "2026-10-01T20:50:00.000Z"
         }
       ]
     }
     ```
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `403 Forbidden`: `{ "error": "Access denied. Instructor role required" }`

4. **Endpoint Card 4: `GET /api/tutor/courses/:id` (Instructor Single Course Draft Preview)**
   - **Access**: Authenticated Instructor (Course owner only).
   - **Header**: `Authorization: Bearer <token>`
   - **Parameter**: `:id` (MongoDB Course `_id`).
   - **Purpose**: Returns full course object for author preview. Unlike public discovery endpoints, this returns **UNSHIELDED** data (`videoUrl` and `correctOptionIndex` included for all lessons/quizzes).
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "course": {
         "_id": "651a2b3c4d5e6f7a8b9c0d20",
         "title": "Complete Full-Stack Web Development BootCamp",
         "slug": "complete-full-stack-web-development-bootcamp",
         "subtitle": "Master React, Node.js, Express, and MongoDB from scratch",
         "category": "Development & Engineering",
         "subCategory": "Web Development",
         "topic": "Full-Stack",
         "language": "English",
         "level": "beginner",
         "courseType": "paid",
         "price": 25000,
         "discountPrice": 18000,
         "thumbnail": "https://gloxad-media.s3.amazonaws.com/courses/thumbnails/fullstack.jpg",
         "trailerVideoUrl": "https://gloxad-media.s3.amazonaws.com/courses/trailers/fullstack-promo.mp4",
         "description": "Comprehensive step-by-step guide to building modern full-stack web applications...",
         "skills": ["JavaScript", "Node.js", "React", "MongoDB", "Express.js"],
         "targetAudience": ["Aspiring Web Developers"],
         "requirements": ["Basic computer literacy"],
         "modules": [
           {
             "_id": "651a2b3c4d5e6f7a8b9c0d21",
             "title": "Module 1: Introduction to Web Architecture",
             "lessons": [
               {
                 "_id": "651a2b3c4d5e6f7a8b9c0d22",
                 "title": "Lesson 1: How the Web Works",
                 "duration": "12:45",
                 "isFreePreview": true,
                 "videoUrl": "https://gloxad-media.s3.amazonaws.com/courses/videos/lesson1.mp4"
               }
             ],
             "quizzes": [
               {
                 "_id": "651a2b3c4d5e6f7a8b9c0d24",
                 "title": "Module 1 Quiz",
                 "passingScore": 70,
                 "questions": [
                   {
                     "_id": "651a2b3c4d5e6f7a8b9c0d25",
                     "questionText": "What protocol does HTTP build upon?",
                     "options": ["UDP", "TCP", "ICMP", "FTP"],
                     "correctOptionIndex": 1
                   }
                 ]
               }
             ]
           }
         ],
         "welcomeMessage": "Welcome to the Complete Full-Stack BootCamp!",
         "congratsMessage": "Congratulations on completing the course!",
         "status": "draft",
         "instructor": "651a2b3c4d5e6f7a8b9c0d10"
       }
     }
     ```
   - **Error Handling**:
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`
     - `403 Forbidden`: `{ "error": "You do not have permission to view this course draft" }`
     - `404 Not Found`: `{ "error": "Course not found" }`

5. **Endpoint Card 5: `POST /api/tutor/courses/:id/submit` (Step 5 — Final Review & Submit for Moderation)**
   - **Access**: Authenticated Instructor (Course owner only).
   - **Header**: `Authorization: Bearer <token>`
   - **Parameter**: `:id` (MongoDB Course `_id`).
   - **Purpose**: Validates completeness across all 5 wizard steps and transitions course status from `draft` or `rejected` to `pending` for admin review.
   - **Validation Rules**:
     - **Step 1 check**: `title`, `category`, `courseType` present; if `courseType === "paid"`, `price` must be `> 0`.
     - **Step 2 check**: `thumbnail` and `description` (min length 20 chars) present; `skills` must have at least 1 item.
     - **Step 3 check**: `modules` must contain at least 1 module, and modules must contain at least 1 lesson with non-empty `videoUrl`.
     - **Step 4 check**: `welcomeMessage` and `congratsMessage` must be non-empty strings.
   - **Behavior**:
     - If all validations pass, updates `status` to `"pending"`.
     - Returns HTTP 200 OK with success confirmation message and updated course object.
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "message": "Course submitted successfully for administrative review",
       "course": {
         "_id": "651a2b3c4d5e6f7a8b9c0d20",
         "title": "Complete Full-Stack Web Development BootCamp",
         "status": "pending",
         "updatedAt": "2026-10-01T20:55:00.000Z"
       }
     }
     ```
   - **Error Handling**:
     - `400 Bad Request`: `{ "error": "Course incomplete: At least one module with a lesson video is required before submitting for review" }`
     - `403 Forbidden`: `{ "error": "You do not have permission to submit this course" }`

6. **Endpoint Card 6: `POST /api/tutor/courses/:id/appeal` (Course Rejection Appeal)**
   - **Access**: Authenticated Instructor (Course owner only).
   - **Header**: `Authorization: Bearer <token>`
   - **Parameter**: `:id` (MongoDB Course `_id`).
   - **Purpose**: Submits an appeal message for a course that was rejected by an admin.
   - **Request Body Schema**:
     ```json
     {
       "message": "I have updated Module 2 lesson videos and improved course description clarity as requested in the moderation feedback."
     }
     ```
   - **Behavior**:
     - Verifies course `status === "rejected"`. Rejects appeal creation if course is not in `rejected` status.
     - Validates non-empty appeal `message`.
     - Creates a new `Appeal` record in MongoDB with `courseId`, `instructorId: req.user._id`, `message`, and `status: "pending"`.
     - Returns HTTP 201 Created with created appeal object.
   - **Response Structure (`201 Created`)**:
     ```json
     {
       "message": "Course rejection appeal submitted successfully",
       "appeal": {
         "_id": "651a2b3c4d5e6f7a8b9c0f80",
         "courseId": "651a2b3c4d5e6f7a8b9c0d20",
         "instructorId": "651a2b3c4d5e6f7a8b9c0d10",
         "message": "I have updated Module 2 lesson videos...",
         "status": "pending",
         "createdAt": "2026-10-01T21:00:00.000Z",
         "updatedAt": "2026-10-01T21:00:00.000Z"
       }
     }
     ```
   - **Error Handling**:
     - `400 Bad Request`: `{ "error": "Appeals can only be submitted for rejected courses" }` or `{ "error": "Appeal message is required" }`
     - `403 Forbidden`: `{ "error": "You do not have permission to appeal for this course" }`

---

## 3. Implementation

The implementation is broken into four distinct, sequentially executable sub-sections.

---

### Sub-section 3.1: Appeal Data Model & Course Model Extensions (`src/models/Appeal.model.js` & `src/models/Course.model.js`)

#### 1. Create `src/models/Appeal.model.js`
Create `src/models/Appeal.model.js` to manage course rejection appeals:

```javascript
import mongoose from "mongoose";

const appealSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
      index: true
    },
    adminNotes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Appeal = mongoose.model("Appeal", appealSchema);
```

#### 2. Ensure Slug Helper in `src/models/Course.model.js`
Ensure `Course.model.js` includes slug generation utility function:
```javascript
export const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};
```

---

### Sub-section 3.2: Authoring Controller Implementation (`src/controllers/tutor.controller.js`)

Extend [`src/controllers/tutor.controller.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/controllers/tutor.controller.js) with authoring pipeline functions:

```javascript
import mongoose from "mongoose";
import { Course, generateSlug } from "../models/Course.model.js";
import { Appeal } from "../models/Appeal.model.js";

/**
 * POST /api/tutor/courses
 * Step 1: Create Initial Course Draft
 */
export const createCourseDraft = async (req, res, next) => {
  try {
    const { title, subtitle, category, subCategory, topic, language, level, courseType, price, discountPrice } = req.body;

    if (!title || !category || !courseType) {
      return res.status(400).json({ error: "Title, category, and course type are required" });
    }

    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let count = 1;
    while (await Course.exists({ slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    const course = await Course.create({
      title,
      subtitle: subtitle || "",
      slug,
      category,
      subCategory: subCategory || "",
      topic: topic || "",
      language: language || "English",
      level: level || "beginner",
      courseType: courseType.toLowerCase(),
      price: courseType === "free" ? 0 : Number(price) || 0,
      discountPrice: discountPrice ? Number(discountPrice) : 0,
      status: "draft",
      instructor: req.user._id
    });

    return res.status(201).json({
      message: "Course draft created successfully",
      course
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tutor/courses/:id
 * Steps 2–4: Incremental Wizard Update
 */
export const updateCourseDraft = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Course not found" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "You do not have permission to edit this course" });
    }

    if (["pending", "published"].includes(course.status)) {
      return res.status(400).json({ error: "Cannot edit a course that is currently pending review or published" });
    }

    const updateFields = { ...req.body };

    if (updateFields.title && updateFields.title !== course.title) {
      let baseSlug = generateSlug(updateFields.title);
      let slug = baseSlug;
      let count = 1;
      while (await Course.exists({ slug, _id: { $ne: course._id } })) {
        slug = `${baseSlug}-${count++}`;
      }
      updateFields.slug = slug;
    }

    delete updateFields.status;
    delete updateFields.instructor;

    const updatedCourse = await Course.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true });

    return res.status(200).json({
      message: "Course draft updated successfully",
      course: updatedCourse
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tutor/courses
 * List Instructor Owned Courses
 */
export const getInstructorCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ instructor: req.user._id })
      .sort({ createdAt: -1 })
      .select("title slug category courseType price status enrolledCount createdAt updatedAt")
      .lean();

    return res.status(200).json({ courses });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tutor/courses/:id
 * Unshielded Author Draft Preview
 */
export const getInstructorCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Course not found" });
    }

    const course = await Course.findById(id).lean();
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "You do not have permission to view this course draft" });
    }

    return res.status(200).json({ course });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tutor/courses/:id/submit
 * Step 5: Submit Course for Admin Moderation
 */
export const submitCourseForReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Course not found" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You do not have permission to submit this course" });
    }

    // Step 1 Validation
    if (!course.title || !course.category || !course.courseType) {
      return res.status(400).json({ error: "Course incomplete: Step 1 basic info (title, category, courseType) is required" });
    }
    if (course.courseType === "paid" && (!course.price || course.price <= 0)) {
      return res.status(400).json({ error: "Course incomplete: Paid courses must have a price greater than 0" });
    }

    // Step 2 Validation
    if (!course.thumbnail || !course.description || course.description.trim().length < 20) {
      return res.status(400).json({ error: "Course incomplete: Step 2 thumbnail and detailed description (at least 20 chars) are required" });
    }
    if (!Array.isArray(course.skills) || course.skills.length === 0) {
      return res.status(400).json({ error: "Course incomplete: Step 2 requires at least one target skill" });
    }

    // Step 3 Validation
    if (!Array.isArray(course.modules) || course.modules.length === 0) {
      return res.status(400).json({ error: "Course incomplete: Step 3 requires at least one curriculum module" });
    }
    const hasLesson = course.modules.some(mod => Array.isArray(mod.lessons) && mod.lessons.length > 0 && mod.lessons.some(l => l.videoUrl && l.videoUrl.trim() !== ""));
    if (!hasLesson) {
      return res.status(400).json({ error: "Course incomplete: At least one module with a lesson video is required before submitting for review" });
    }

    // Step 4 Validation
    if (!course.welcomeMessage || !course.congratsMessage) {
      return res.status(400).json({ error: "Course incomplete: Step 4 welcome and congratulations messages are required" });
    }

    course.status = "pending";
    await course.save();

    return res.status(200).json({
      message: "Course submitted successfully for administrative review",
      course
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tutor/courses/:id/appeal
 * Submit Appeal for Rejected Course
 */
export const appealCourseRejection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Course not found" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You do not have permission to appeal for this course" });
    }

    if (course.status !== "rejected") {
      return res.status(400).json({ error: "Appeals can only be submitted for rejected courses" });
    }

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Appeal message is required" });
    }

    const appeal = await Appeal.create({
      courseId: course._id,
      instructorId: req.user._id,
      message: message.trim(),
      status: "pending"
    });

    return res.status(201).json({
      message: "Course rejection appeal submitted successfully",
      appeal
    });
  } catch (error) {
    next(error);
  }
};
```

---

### Sub-section 3.3: Route Definition & Express Mounting (`src/routes/tutor.routes.js` & `src/app.js`)

#### 1. Router Definitions (`src/routes/tutor.routes.js`)
Map endpoints in [`src/routes/tutor.routes.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/routes/tutor.routes.js):

```javascript
import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  showcaseExpertiseController,
  getDashboardStatsController,
  getEarningsController,
  createCourseDraft,
  updateCourseDraft,
  getInstructorCourses,
  getInstructorCourseById,
  submitCourseForReview,
  appealCourseRejection
} from "../controllers/tutor.controller.js";

const router = Router();

// Apply Auth Guard across all tutor routes
router.use(authMiddleware);

// Onboarding & Analytics
router.post("/showcase-expertise", showcaseExpertiseController);
router.get("/dashboard-stats", roleMiddleware("instructor"), getDashboardStatsController);
router.get("/earnings", roleMiddleware("instructor"), getEarningsController);

// Course Authoring Wizard & Review Pipeline
router.post("/courses", roleMiddleware("instructor"), createCourseDraft);
router.get("/courses", roleMiddleware("instructor"), getInstructorCourses);
router.get("/courses/:id", roleMiddleware("instructor"), getInstructorCourseById);
router.put("/courses/:id", roleMiddleware("instructor"), updateCourseDraft);
router.post("/courses/:id/submit", roleMiddleware("instructor"), submitCourseForReview);
router.post("/courses/:id/appeal", roleMiddleware("instructor"), appealCourseRejection);

export default router;
```

#### 2. Express Application Mounting (`src/app.js`)
Ensure router is mounted under `/api/tutor` in [`src/app.js`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/app.js).

---

### Sub-section 3.4: Interactive Documentation Portal Update (`src/views/docs.html`)

Update [`src/views/docs.html`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/src/views/docs.html):
1. Add sidebar link for **"Section 8. 5-Step Course Authoring & Review Pipeline"**.
2. Add section container detailing all 6 new endpoints:
   - `POST /api/tutor/courses`
   - `PUT /api/tutor/courses/:id`
   - `GET /api/tutor/courses`
   - `GET /api/tutor/courses/:id`
   - `POST /api/tutor/courses/:id/submit`
   - `POST /api/tutor/courses/:id/appeal`
3. Include parameters table, headers, JSON request body schemas, and JSON response examples.

---

## 4. Dependencies

* **Packages to Install**: None.
* **Existing Dependencies Used**: `express`, `mongoose`, `jsonwebtoken`.

---

## 5. Verification Checklist

Execute the following test steps to verify 100% compliance with business logic and architectural invariants.

### Test 1: Draft Course Creation (Step 1)
- [ ] Send `POST /api/tutor/courses` with valid Step 1 body and `Authorization: Bearer <instructor_token>`.
- [ ] Verify `HTTP 201 Created` with generated `slug`, `status: "draft"`, and `instructor: req.user._id`.
- [ ] Attempt same request with missing `title`. Verify `HTTP 400 Bad Request` with `{ "error": "Title, category, and course type are required" }`.

### Test 2: Incremental Draft Updates (Steps 2–4)
- [ ] Send `PUT /api/tutor/courses/:id` updating thumbnail, modules, lessons, quizzes, and welcome messages.
- [ ] Verify `HTTP 200 OK` and updated fields in MongoDB.

### Test 3: Unshielded Instructor Draft Preview
- [ ] Send `GET /api/tutor/courses/:id` with instructor token.
- [ ] Verify `HTTP 200 OK` returning unshielded `videoUrl` and `correctOptionIndex` for author verification.

### Test 4: Resource Ownership Protection
- [ ] Send `PUT /api/tutor/courses/:id` using a different instructor's token.
- [ ] Verify `HTTP 403 Forbidden` with `{ "error": "You do not have permission to edit this course" }`.

### Test 5: Complete Step Validation & Review Submission (Step 5)
- [ ] Send `POST /api/tutor/courses/:id/submit` on an incomplete course (e.g. no lessons).
- [ ] Verify `HTTP 400 Bad Request` specifying missing required content.
- [ ] Complete all 5 steps via `PUT`, then re-submit `POST /api/tutor/courses/:id/submit`.
- [ ] Verify `HTTP 200 OK` and `status` transitions to `"pending"`.

### Test 6: Rejected Course Appeal
- [ ] On a course with `status: "rejected"`, send `POST /api/tutor/courses/:id/appeal` with `{ "message": "..." }`.
- [ ] Verify `HTTP 201 Created` and creation of `Appeal` document in MongoDB with `status: "pending"`.
- [ ] Attempt appeal on a `draft` or `published` course. Verify `HTTP 400 Bad Request` with `{ "error": "Appeals can only be submitted for rejected courses" }`.

### Architectural Invariants Checklist
- [x] **Rule 1 (Uniform Error Schema)**: Errors return `{ "error": "<message>" }` with standard HTTP status code.
- [x] **Rule 3 (Server Content Protection)**: Author draft preview endpoint `GET /api/tutor/courses/:id` is restricted strictly to course owner or admin.
- [x] **Rule 5 (Strict Identifier Standard)**: All primary keys in JSON output are named `_id` as string.
