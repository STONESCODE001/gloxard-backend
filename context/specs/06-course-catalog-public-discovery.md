# Specification: Unit 06 — Course Catalog & Public Discovery (with Content Protection)

> **Spec Identifier**: `06-course-catalog-public-discovery`  
> **Target Spec File**: `context/specs/06-course-catalog-public-discovery.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 3, and 5)  

---

## 1. Goal

Implement the public course catalog, search, filtering, and single course detail retrieval endpoints (`GET /api/courses` and `GET /api/courses/:slugOrId`) powered by a comprehensive Mongoose `Course` schema with MongoDB text search indexes. Enforce strict server-side content protection (Rule 3) by redacting lesson `videoUrl` (except for free preview lessons) and quiz `correctOptionIndex` from non-enrolled or unauthenticated callers, while ensuring uniform `{ "error": "<message>" }` error schemas, string `_id` primary key identifiers, and synchronization with the API documentation portal at `GET /`.

---

## 2. Design

### 2.1 Visual & UI Tokens for API Documentation Portal (`src/views/docs.html`)
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
* **Content Protection Indicator Badge**:
  * `Content Shield Active`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`

### 2.2 Endpoint Structural Layout & Payloads

1. **Endpoint Card 1: `GET /api/courses`**
   - **Access**: Public (No authentication required).
   - **Query Parameters**:
     - `search` (string, optional): Text search query matched against title, subtitle, topic, description, and skills.
     - `category` (string, optional): Case-insensitive category slug or name filter.
     - `subCategory` (string, optional): Case-insensitive subcategory slug or name filter.
     - `courseType` (string, optional): `free`, `paid`, or `trimester`.
     - `level` (string, optional): `beginner`, `intermediate`, `advanced`, or `all-levels`.
     - `minPrice` / `maxPrice` (number, optional): Price range bounds.
     - `sort` (string, optional): `popular` (`enrolledCount: -1`), `newest` (`createdAt: -1`), `price-asc` (`price: 1`), `price-desc` (`price: -1`), `rating` (`rating.average: -1`). Default: `newest`.
     - `page` (number, default: 1): Page number (minimum 1).
     - `limit` (number, default: 10): Items per page (minimum 1, maximum 50).
   - **Behavior**: Strictly returns courses where `status === "published"`. Strips hidden module details in catalog view.
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "courses": [
         {
           "_id": "651a2b3c4d5e6f7a8b9c0d20",
           "title": "Complete Full-Stack Web Development BootCamp",
           "slug": "complete-full-stack-web-development-bootcamp",
           "subtitle": "Master React, Node.js, Express, and MongoDB",
           "category": "Development & Engineering",
           "subCategory": "Web Development",
           "topic": "Full-Stack",
           "level": "beginner",
           "courseType": "paid",
           "price": 25000,
           "discountPrice": 18000,
           "thumbnail": "https://gloxad-media.s3.amazonaws.com/courses/thumbnails/fullstack.jpg",
           "trailerVideoUrl": "https://gloxad-media.s3.amazonaws.com/courses/trailers/fullstack-promo.mp4",
           "rating": { "average": 4.8, "count": 124 },
           "enrolledCount": 450,
           "instructor": {
             "_id": "651a2b3c4d5e6f7a8b9c0d10",
             "firstName": "Alex",
             "lastName": "Tutor",
             "avatarUrl": "https://gloxad-media.s3.amazonaws.com/avatars/alex.jpg"
           },
           "createdAt": "2026-09-15T10:00:00.000Z"
         }
       ],
       "pagination": {
         "total": 42,
         "page": 1,
         "limit": 10,
         "totalPages": 5,
         "hasNextPage": true,
         "hasPrevPage": false
       }
     }
     ```

2. **Endpoint Card 2: `GET /api/courses/:slugOrId`**
   - **Access**: Public (Optional `Authorization: Bearer <token>` for enrollment verification).
   - **Parameter**: `:slugOrId` (Course MongoDB `_id` or URL `slug`).
   - **Content Protection Rules (Rule 3)**:
     - **Unauthenticated or Non-Enrolled Caller**:
       - `modules[].lessons[].videoUrl`: Redacted (`null`), UNLESS `lesson.isFreePreview === true`.
       - `modules[].quizzes[].questions[].correctOptionIndex`: Removed from all quiz questions.
     - **Enrolled Student or Course Instructor/Admin Caller**:
       - `modules[].lessons[].videoUrl`: Full S3 URL exposed for all lessons.
       - `modules[].quizzes[].questions[].correctOptionIndex`: Removed for students (evaluated server-side in Unit 12); exposed ONLY for course author instructor/admin.
   - **Response Structure (`200 OK`)**:
     ```json
     {
       "course": {
         "_id": "651a2b3c4d5e6f7a8b9c0d20",
         "title": "Complete Full-Stack Web Development BootCamp",
         "slug": "complete-full-stack-web-development-bootcamp",
         "description": "Comprehensive guide to building modern web applications...",
         "skills": ["JavaScript", "React", "Node.js", "MongoDB"],
         "targetAudience": ["Aspiring Web Developers", "Computer Science Students"],
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
               },
               {
                 "_id": "651a2b3c4d5e6f7a8b9c0d23",
                 "title": "Lesson 2: Setting Up Node.js Environment",
                 "duration": "18:20",
                 "isFreePreview": false,
                 "videoUrl": null
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
                     "options": ["UDP", "TCP", "ICMP", "FTP"]
                   }
                 ]
               }
             ]
           }
         ],
         "isEnrolled": false
       }
     }
     ```

---

## 3. Implementation

Implementation is structured into 4 distinct, sequentially executable sub-sections with complete code implementations.

---

### Sub-section 3.1: Mongoose Course Schema & Indexes (`src/models/Course.model.js`)

Create `src/models/Course.model.js` with subdocuments, master schema, and performance indexes.

```javascript
import mongoose from "mongoose";

// Lesson Subdocument Schema
const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    videoUrl: { type: String, default: "" },
    duration: { type: String, default: "00:00" },
    isFreePreview: { type: Boolean, default: false }
  },
  { _id: true }
);

// Quiz Question Subdocument Schema
const quizQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true },
    options: [{ type: String, required: true, trim: true }],
    correctOptionIndex: { type: Number, required: true }
  },
  { _id: true }
);

// Quiz Subdocument Schema
const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    passingScore: { type: Number, default: 70 },
    questions: [quizQuestionSchema]
  },
  { _id: true }
);

// Module Subdocument Schema
const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    lessons: [lessonSchema],
    quizzes: [quizSchema]
  },
  { _id: true }
);

// Master Course Schema
const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    subtitle: { type: String, trim: true, default: "" },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    subCategory: { type: String, trim: true, default: "" },
    topic: { type: String, trim: true, default: "" },
    language: { type: String, default: "English" },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "all-levels"],
      default: "beginner"
    },
    courseType: {
      type: String,
      enum: ["free", "paid", "trimester"],
      required: true,
      index: true
    },
    price: { type: Number, default: 0, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    thumbnail: { type: String, default: "" },
    trailerVideoUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    skills: [{ type: String, trim: true }],
    targetAudience: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    modules: [moduleSchema],
    welcomeMessage: { type: String, default: "" },
    congratsMessage: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "pending", "published", "rejected"],
      default: "draft",
      index: true
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    enrolledCount: { type: Number, default: 0, index: true },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 }
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

// MongoDB Compound & Full-Text Indexes
courseSchema.index({
  title: "text",
  subtitle: "text",
  description: "text",
  topic: "text",
  skills: "text"
});

export const Course = mongoose.model("Course", courseSchema);
```

---

### Sub-section 3.2: Content Shielding & Course Controller (`src/controllers/course.controller.js`)

Create `src/controllers/course.controller.js` featuring complete business logic, content shielding, and edge-case sanitization.

```javascript
import mongoose from "mongoose";
import { Course } from "../models/Course.model.js";

/**
 * Content Shielding Helper: Redacts video URLs and quiz answers per Rule 3.
 */
export const applyContentShield = (courseObj, isEnrolled, isInstructorOrAdmin) => {
  const sanitized = JSON.parse(JSON.stringify(courseObj));

  if (Array.isArray(sanitized.modules)) {
    sanitized.modules.forEach((mod) => {
      // Shield Lesson Videos
      if (Array.isArray(mod.lessons)) {
        mod.lessons.forEach((lesson) => {
          if (!isEnrolled && !isInstructorOrAdmin && !lesson.isFreePreview) {
            lesson.videoUrl = null;
          }
        });
      }

      // Shield Quiz Answer Keys
      if (Array.isArray(mod.quizzes)) {
        mod.quizzes.forEach((quiz) => {
          if (Array.isArray(quiz.questions)) {
            quiz.questions.forEach((q) => {
              if (!isInstructorOrAdmin) {
                delete q.correctOptionIndex;
              }
            });
          }
        });
      }
    });
  }

  return sanitized;
};

/**
 * GET /api/courses
 * Public course catalog with full-text search, multi-filters, sorting, and pagination.
 */
export const getCourses = async (req, res, next) => {
  try {
    const {
      search,
      category,
      subCategory,
      courseType,
      level,
      minPrice,
      maxPrice,
      sort = "newest",
      page = 1,
      limit = 10
    } = req.query;

    const query = { status: "published" };

    // Full-text search
    if (search && search.trim() !== "") {
      query.$text = { $search: search.trim() };
    }

    // Category and subcategory filtering (case-insensitive exact string match)
    if (category && category.trim() !== "") {
      const sanitizedCategory = category.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.category = new RegExp(`^${sanitizedCategory}$`, "i");
    }
    if (subCategory && subCategory.trim() !== "") {
      const sanitizedSubCategory = subCategory.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.subCategory = new RegExp(`^${sanitizedSubCategory}$`, "i");
    }

    // Enum filters
    if (courseType && ["free", "paid", "trimester"].includes(courseType.toLowerCase())) {
      query.courseType = courseType.toLowerCase();
    }
    if (level && ["beginner", "intermediate", "advanced", "all-levels"].includes(level.toLowerCase())) {
      query.level = level.toLowerCase();
    }

    // Price range filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        query.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        query.price.$lte = Number(maxPrice);
      }
    }

    // Sort mapping
    let sortOptions = { createdAt: -1 };
    switch (sort) {
      case "popular":
        sortOptions = { enrolledCount: -1 };
        break;
      case "price-asc":
        sortOptions = { price: 1 };
        break;
      case "price-desc":
        sortOptions = { price: -1 };
        break;
      case "rating":
        sortOptions = { "rating.average": -1 };
        break;
      case "newest":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    // Pagination bounds
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("instructor", "firstName lastName avatarUrl bio")
        .select("-modules.lessons.videoUrl -modules.quizzes.questions.correctOptionIndex")
        .lean(),
      Course.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      courses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:slugOrId
 * Public single course view with role-based content protection.
 */
export const getCourseBySlugOrId = async (req, res, next) => {
  try {
    const { slugOrId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(slugOrId);
    const query = isObjectId ? { _id: slugOrId } : { slug: slugOrId.toLowerCase().trim() };

    const course = await Course.findOne({ ...query, status: "published" })
      .populate("instructor", "firstName lastName avatarUrl bio expertiseBio")
      .lean();

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    let isEnrolled = false;
    let isInstructorOrAdmin = false;

    if (req.user) {
      const userId = req.user._id.toString();
      const userRole = req.user.role;

      if (userRole === "admin" || (course.instructor && course.instructor._id.toString() === userId)) {
        isInstructorOrAdmin = true;
      }

      if (!isInstructorOrAdmin) {
        const enrollment = await mongoose.model("Enrollment").findOne({
          user: req.user._id,
          course: course._id
        });
        isEnrolled = !!enrollment;
      }
    }

    const sanitizedCourse = applyContentShield(course, isEnrolled, isInstructorOrAdmin);

    return res.status(200).json({
      course: sanitizedCourse,
      isEnrolled: isInstructorOrAdmin ? true : isEnrolled
    });
  } catch (error) {
    next(error);
  }
};
```

---

### Sub-section 3.3: Route Definitions & Optional Auth Middleware (`src/routes/course.routes.js` & `src/middlewares/optionalAuth.middleware.js`)

#### 1. Optional Auth Middleware (`src/middlewares/optionalAuth.middleware.js`)
Create lightweight middleware to extract `req.user` without rejecting unauthenticated calls:
```javascript
import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";

export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.sub).select("-password");
    }
  } catch (error) {
    // Silently ignore expired/invalid tokens for optional auth
    req.user = null;
  }
  next();
};
```

#### 2. Course Router (`src/routes/course.routes.js`)
```javascript
import { Router } from "express";
import { getCourses, getCourseBySlugOrId } from "../controllers/course.controller.js";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware.js";

const router = Router();

router.get("/courses", getCourses);
router.get("/courses/:slugOrId", optionalAuthMiddleware, getCourseBySlugOrId);

export default router;
```

#### 3. Express App Mounting (`src/app.js`)
Mount route in `src/app.js`:
```javascript
import courseRoutes from "./routes/course.routes.js";

app.use("/api", courseRoutes);
```

---

### Sub-section 3.4: Interactive API Documentation Portal Update (`src/views/docs.html`)

Update `src/views/docs.html`:
1. Add navigation section **"6. Course Catalog & Public Discovery"** to index and body.
2. Render formatted documentation cards detailing parameter descriptions, payload schemas, and HTTP status codes (`200 OK`, `404 Not Found`).

---

## 4. Dependencies

* **Packages to Install**: None.
  * Utilizes native Node.js ES Modules and established project dependencies (`express`, `mongoose`, `jsonwebtoken`).

---

## 5. Verification Checklist

Execute the following cURL test commands to verify 100% compliance with functionality and architectural invariants.

### Test 1: Public Course Listing (Default Pagination & Sorting)
```bash
curl -i -X GET http://localhost:3001/api/courses
```
* **Expected Result**: `HTTP 200 OK`
* **JSON Structure**: `{ "courses": [...], "pagination": { "total": ..., "page": 1, "limit": 10, ... } }`.
* **Invariant Validation**: Only courses with `status === "published"` are returned. Primary keys strictly named `_id`.

---

### Test 2: Search & Multi-Filter Query
```bash
curl -i -X GET "http://localhost:3001/api/courses?search=javascript&category=development-engineering&courseType=paid&sort=popular&page=1&limit=5"
```
* **Expected Result**: `HTTP 200 OK`
* **JSON Structure**: Array of matching published courses sorted by `enrolledCount` descending.

---

### Test 3: Public Course View by Slug (Content Shield Verification)
```bash
curl -i -X GET http://localhost:3001/api/courses/complete-full-stack-web-development-bootcamp
```
* **Expected Result**: `HTTP 200 OK`
* **Content Shield Validation**:
  * Lessons with `isFreePreview: false` MUST have `videoUrl: null`.
  * Lessons with `isFreePreview: true` MUST expose full S3 `videoUrl`.
  * All quiz questions MUST NOT contain the `correctOptionIndex` property.

---

### Test 4: Course View by Non-Existent Identifier / Slug
```bash
curl -i -X GET http://localhost:3001/api/courses/non-existent-course-slug
```
* **Expected Result**: `HTTP 404 Not Found`
* **Uniform Error Validation**: `{ "error": "Course not found" }`

---

### Test 5: Verify API Documentation Web Portal Sync
```bash
curl -s http://localhost:3001/ | grep -E "courses|slugOrId"
```
* **Expected Result**: HTML contains endpoint documentation sections for `GET /api/courses` and `GET /api/courses/:slugOrId`.

---

### Architectural Invariants Checklist
- [x] **Rule 1 (Uniform Error Schema)**: Errors return `{ "error": "<message>" }` with appropriate status code (`404`).
- [x] **Rule 3 (Server Content Protection)**: Un-enrolled/public users never receive paid lesson `videoUrl` or quiz `correctOptionIndex`.
- [x] **Rule 5 (Strict Identifier Standard)**: All primary key identifiers in JSON output are named `_id` as string representations.
