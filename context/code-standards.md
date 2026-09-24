# Code Standards & Conventions - Gloxad Academy Backend API

This document establishes the coding conventions, framework patterns, route structures, file organization, and styling rules for the **Gloxad Academy Backend API**.

---

## 1. Code Style & Syntax Conventions

### Language & Module System
* **ES Modules**: Use ES Modules syntax exclusively (`import` / `export`). The `package.json` must include `"type": "module"`.
* **No `require()`**: Never use CommonJS `require()` or `module.exports`.
* **Async / Await**: Use native `async/await` for asynchronous code instead of callback chains or bare `.then()/.catch()` where possible.
* **Explicit File Extensions**: Always include file extensions in relative imports (e.g. `import connectDB from './config/db.js'`).

### Naming Conventions
* **Files & Directories**: `camelCase` for utilities, controllers, and middlewares (e.g. `auth.controller.js`, `role.middleware.js`).
* **Mongoose Models**: `PascalCase` matching the singular noun of the entity (e.g. `User.model.js`, `Course.model.js`, `Enrollment.model.js`).
* **Variables & Functions**: `camelCase` for variable names, function names, and instance properties (e.g. `generateToken`, `userEmail`, `isVerified`).
* **Constants & Enums**: `UPPER_SNAKE_CASE` for global environment variables and constant enums (e.g. `JWT_SECRET`, `COURSE_STATUS`, `ROLES`).

---

## 2. API Route Structure & Conventions

### Base Path & Endpoint Naming
* **Base Path**: All RESTful endpoints MUST start with `/api` (e.g. `http://localhost:3001/api`).
* **Resource Pluralization**: Use plural nouns for resources (e.g. `/api/courses`, `/api/categories`, `/api/notifications`).
* **Sub-resource Nesting**: Nest sub-resources logically under parent resources (e.g. `/api/learning/:courseId/questions`, `/api/learning/:courseId/notes`).

### HTTP Methods
* `GET`: Fetch resources or search lists (must be idempotent and read-only).
* `POST`: Create new resources, trigger authentication, or execute payment checkouts.
* `PUT`: Update existing resources or increment wizard steps.
* `DELETE`: Remove or soft-delete resources.

### Standardized Status Codes & Response Shapes

| HTTP Status | Condition | Response Payload Shape |
| :--- | :--- | :--- |
| **200 OK** | Successful read, update, or action | `{ "data": ... }` or resource object/array |
| **201 Created** | Successful entity creation | `{ "data": ... }` or created resource object |
| **400 Bad Request** | Schema validation failure or missing field | `{ "error": "Human-readable error message" }` |
| **401 Unauthorized** | Token missing, expired, or invalid | `{ "error": "Authentication token missing or invalid" }` |
| **403 Forbidden** | Role mismatch or lack of resource ownership | `{ "error": "You do not have permission to access this resource" }` |
| **404 Not Found** | Target resource ID or route does not exist | `{ "error": "Requested resource not found" }` |
| **409 Conflict** | Duplicate unique field (e.g. email, reference) | `{ "error": "Resource with this email/reference already exists" }` |
| **422 Unprocessable** | Semantic error (e.g. course must be in draft state) | `{ "error": "Cannot submit course from current state" }` |
| **429 Rate Limited** | Request limit exceeded for IP/user | `{ "error": "Too many attempts, please try again later" }` |

---

## 3. Framework & Controller Patterns (Express.js & Mongoose)

### Controller Implementation Pattern
Controllers MUST be wrapped with an async error wrapper or utilize try-catch blocks delegating unhandled exceptions to the `next(error)` middleware.

```javascript
// Example: src/controllers/category.controller.js
import { Category } from '../models/Category.model.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    return res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};
```

### Route Declaration Pattern
Routes must define middleware chains in a single readable line: `[Validation] -> [AuthGuard] -> [RoleGuard] -> [Controller]`.

```javascript
// Example: src/routes/course.routes.js
import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware.js';
import { roleGuard } from '../middlewares/role.middleware.js';
import { createDraftCourse } from '../controllers/course.controller.js';

const router = Router();

router.post(
  '/tutor/courses',
  authGuard,
  roleGuard('instructor'),
  createDraftCourse
);

export default router;
```

### Mongoose Schema Conventions
* **String Trim**: Set `trim: true` on string fields to remove whitespace.
* **Lowercase Emails**: Set `lowercase: true` on email fields.
* **Timestamps**: Enable `{ timestamps: true }` on schemas to automatically track `createdAt` and `updatedAt`.
* **Lean Queries**: Use `.lean()` on read-only queries to bypass Mongoose document hydration overhead.

---

## 4. File & Folder Organization

```
gloxard/
├── src/
│   ├── app.js                   # Application middleware & routing entry point
│   ├── server.js                # Server setup, DB connection, and Socket.io
│   ├── config/
│   │   ├── db.js                # Mongoose connection logic
│   │   └── env.js               # Environment variable validation
│   ├── constants/
│   │   └── index.js             # System roles, statuses, and pagination defaults
│   ├── middlewares/
│   │   ├── auth.middleware.js   # JWT authentication middleware
│   │   ├── role.middleware.js   # Role-based authorization guard
│   │   └── error.middleware.js  # Global JSON error handler ({ error: "..." })
│   ├── models/
│   │   ├── User.model.js        # User Mongoose schema
│   │   └── Course.model.js      # Course Mongoose schema
│   ├── controllers/
│   │   ├── auth.controller.js   # Signup, signin, OTP controller logic
│   │   └── course.controller.js # Public & tutor course controller logic
│   ├── routes/
│   │   ├── auth.routes.js       # Auth endpoint routes
│   │   └── course.routes.js     # Course endpoint routes
│   ├── socket/
│   │   └── socket.handler.js    # Socket.io connection & event logic
│   ├── utils/
│   │   ├── jwt.js               # Token generation & verification helpers
│   │   └── s3.js                # Presigned URL generation helpers
│   └── views/
│       └── docs.html            # Frontend API documentation HTML template
```

---

## 5. Styling Rules for the HTML API Documentation Page

The HTML API Documentation page served at `GET /` MUST adhere to clean, modern visual design rules:

### Visual Language & Design Tokens
* **Typography**: Use standard clean system fonts or Google Font `Inter` (`font-family: 'Inter', sans-serif`).
* **Colors**:
  * Primary Accent: `#4F46E5` (Indigo)
  * Background: `#F7F8FC`
  * Surface Card: `#FFFFFF`
  * Text Primary: `#111827`
  * Text Muted: `#6B7280`
  * Method Badges:
    * `GET`: `#16A34A` (Green pill, soft background `#DCFCE7`)
    * `POST`: `#2563EB` (Blue pill, soft background `#DBEAFE`)
    * `PUT`: `#D97706` (Amber pill, soft background `#FEF3C7`)
    * `DELETE`: `#DC2626` (Red pill, soft background `#FEE2E2`)

### Layout & Component Structure
* **Card Elevation**: Clean 1px soft border (`#D9DDE8`) with subtle card shadow (`0 1px 3px rgba(0,0,0,0.05)`).
* **Border Radius**: 8px (`0.5rem`) on cards and code blocks.
* **Code Snippets**: Styled `<pre><code>` blocks with dark background (`#1B1B24`) and light monospaced text for JSON payloads.
