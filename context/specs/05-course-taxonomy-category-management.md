# Specification: Unit 05 — Course Taxonomy & Category Management

> **Spec Identifier**: `05-course-taxonomy-category-management`  
> **Target Spec File**: `context/specs/05-course-taxonomy-category-management.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1 and 5)  

---

## 1. Goal

Implement a hierarchical course taxonomy system that enables public retrieval of course categories, subcategories, and topics while restricting creation, editing, and deletion strictly to administrative users (`role === 'admin'`). This unit introduces `GET /api/categories`, `POST /api/admin/categories`, `PUT /api/admin/categories/:id`, and `DELETE /api/admin/categories/:id`, enforcing slug generation, duplicate prevention, course dependency checks on deletion, strict `_id` identifier naming, uniform `{ "error": "<message>" }` response shapes, and complete synchronization with the interactive API documentation portal at `GET /`.

---

## 2. Design for the API Documentation Portal (`src/views/docs.html`)

In strict alignment with `context/architecture.md` and `context/ui-context.md`, this unit expands the interactive **Backend API Documentation Portal** served at `GET /` (`src/views/docs.html`).

### 2.1 Visual Tokens & Badges (from `context/ui-context.md`)
* **Theme**: Technical, engineering-focused light mode with CSS custom properties.
* **Colors**:
  * Base Background (`--color-surface-base`): `#F8FAFC`
  * Card Surface (`--color-surface-card`): `#FFFFFF`
  * Code Surface (`--color-surface-code`): `#0F172A`
  * Table Header (`--color-surface-table-header`): `#F1F5F9`
  * Border (`--color-border-subtle`): `#E2E8F0`
  * Text Primary (`--color-text-primary`): `#0F172A`
  * Brand Accent (`--color-accent-brand`): `#4F46E5`
* **HTTP Method Badges**:
  * `GET`: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
  * `POST`: Background `#DBEAFE`, Text `#1D4ED8`, Border `#93C5FD`
  * `PUT`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
  * `DELETE`: Background `#FEE2E2`, Text `#B91C1C`, Border `#FCA5A5`
* **Status Code Badges**:
  * `200 Success`: Background `#F0FDF4`, Text `#166534`
  * `201 Created`: Background `#F0FDF4`, Text `#166534`
  * `400 Bad Request`: Background `#FFEDD5`, Text `#9A3412`
  * `401 / 403 Security Error`: Background `#F3E8FF`, Text `#6B21A8`
  * `409 Conflict`: Background `#FEE2E2`, Text `#991B1B`

### 2.2 Structural Layout & Component Hierarchy
1. **Course Taxonomy & Category Section**:
   - Header summary detailing public reading and administrative CRUD operations.
   - Endpoint Card 1: `GET /api/categories`
     - Access badge: `Public (No Token Required)`.
     - Description: Returns hierarchical tree of all categories, subcategories, and topics sorted by display order.
     - Response Card (`200 OK`):
       ```json
       {
         "categories": [
           {
             "_id": "651a2b3c4d5e6f7a8b9c0d1e",
             "name": "Development & Engineering",
             "slug": "development-engineering",
             "icon": "code-bracket",
             "order": 1,
             "subCategories": [
               {
                 "_id": "651a2b3c4d5e6f7a8b9c0d1f",
                 "name": "Web Development",
                 "slug": "web-development",
                 "topics": ["React", "Node.js", "TypeScript"]
               }
             ]
           }
         ]
       }
       ```
   - Endpoint Card 2: `POST /api/admin/categories`
     - Access badge: `Admin Only (Bearer Token Required)`.
     - Request Header Table: `Authorization: Bearer <jwt>`, `Content-Type: application/json`.
     - Payload Parameters Table: `name` (string, required), `icon` (string, optional), `order` (number, optional), `subCategories` (array of objects, optional).
     - Response Cards:
       - `201 Created`: `{ "message": "Category created successfully", "category": { ... } }`
       - `400 Bad Request`: `{ "error": "Category name is required" }`
       - `403 Forbidden`: `{ "error": "Access denied. Admin role required" }`
       - `409 Conflict`: `{ "error": "Category with this name already exists" }`
   - Endpoint Card 3: `PUT /api/admin/categories/:id`
     - Access badge: `Admin Only (Bearer Token Required)`.
     - Payload Parameters Table: `name` (string), `icon` (string), `order` (number), `subCategories` (array).
     - Response Cards:
       - `200 OK`: `{ "message": "Category updated successfully", "category": { ... } }`
       - `404 Not Found`: `{ "error": "Category not found" }`
       - `409 Conflict`: `{ "error": "Category name already exists" }`
   - Endpoint Card 4: `DELETE /api/admin/categories/:id`
     - Access badge: `Admin Only (Bearer Token Required)`.
     - Response Cards:
       - `200 OK`: `{ "message": "Category deleted successfully" }`
       - `409 Conflict`: `{ "error": "Cannot delete category associated with existing courses" }`

---

## 3. Implementation Details

Implementation is divided into 4 isolated, sequentially executable sub-sections.

---

### Sub-section 3.1: Category Mongoose Model (`src/models/Category.model.js`)

#### 1. Schema Definition
Create `src/models/Category.model.js` with hierarchical subcategory support:

* **Subcategory Subdocument Schema**:
  ```javascript
  import mongoose from "mongoose";

  const subCategorySchema = new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      slug: { type: String, lowercase: true, trim: true },
      topics: [{ type: String, trim: true }]
    },
    { _id: true }
  );
  ```
* **Category Master Schema**:
  ```javascript
  const categorySchema = new mongoose.Schema(
    {
      name: {
        type: String,
        required: [true, "Category name is required"],
        unique: true,
        trim: true,
        index: true
      },
      slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
      },
      icon: {
        type: String,
        default: ""
      },
      order: {
        type: Number,
        default: 0
      },
      subCategories: [subCategorySchema]
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
  ```

#### 2. Slugification Utility & Pre-Validation Middleware
* Implement a lightweight, deterministic string slugification helper function:
  ```javascript
  export const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-") // Replace spaces and non-word chars with hyphen
      .replace(/^-+|-+$/g, "");   // Strip leading and trailing hyphens
  };
  ```
* In `Category.model.js`, automatically populate `slug` for the parent category and all nested `subCategories` before validation and saving:
  ```javascript
  categorySchema.pre("validate", function (next) {
    if (this.name) {
      this.slug = slugify(this.name);
    }
    if (Array.isArray(this.subCategories)) {
      this.subCategories.forEach((sub) => {
        if (sub.name && !sub.slug) {
          sub.slug = slugify(sub.name);
        }
      });
    }
    next();
  });

  export const Category = mongoose.model("Category", categorySchema);
  ```

---

### Sub-section 3.2: Category Controller & Business Logic (`src/controllers/category.controller.js`)

Implement pure controller methods in `src/controllers/category.controller.js`:

#### 1. Public Read Endpoint: `getCategories` (`GET /api/categories`)
* **Access**: Public.
* **Logic**:
  1. Fetch all category documents from MongoDB sorted by `order` ascending, then `name` ascending (`Category.find().sort({ order: 1, name: 1 })`).
  2. Return `200 OK` with JSON object:
     ```json
     {
       "categories": [ ... ]
     }
     ```

#### 2. Admin Endpoint: `createCategory` (`POST /api/admin/categories`)
* **Access**: Restricted to `role === 'admin'`.
* **Request Body**:
  ```json
  {
    "name": "Data & AI",
    "icon": "cpu-chip",
    "order": 2,
    "subCategories": [
      { "name": "Machine Learning", "topics": ["Python", "PyTorch", "TensorFlow"] },
      { "name": "Data Engineering", "topics": ["SQL", "Spark", "Kafka"] }
    ]
  }
  ```
* **Validation & Business Rules**:
  1. Validate `name`: If missing or empty string, return `400 { "error": "Category name is required" }`.
  2. Case-Insensitive Name Duplicate Check:
     ```javascript
     const existing = await Category.findOne({
       name: { $regex: new RegExp(`^${name.trim()}$`, "i") }
     });
     if (existing) {
       return res.status(409).json({ error: "Category with this name already exists" });
     }
     ```
  3. Format `subCategories`: Ensure each subcategory has `name` and slugify automatically.
  4. Create and save new category document.
  5. Return `201 Created`:
     ```json
     {
       "message": "Category created successfully",
       "category": { ... }
     }
     ```

#### 3. Admin Endpoint: `updateCategory` (`PUT /api/admin/categories/:id`)
* **Access**: Restricted to `role === 'admin'`.
* **URL Parameter**: `:id` (MongoDB ObjectId).
* **Validation & Business Rules**:
  1. Validate `:id`: If invalid ObjectId string (`!mongoose.Types.ObjectId.isValid(id)`), return `400 { "error": "Invalid category ID format" }`.
  2. Find existing category: `const category = await Category.findById(id)`. If missing, return `404 { "error": "Category not found" }`.
  3. Duplicate Name Check (if `name` is being changed):
     If `req.body.name` is provided and differs from existing `category.name`, check if another category possesses the same case-insensitive name:
     ```javascript
     const collision = await Category.findOne({
       _id: { $ne: id },
       name: { $regex: new RegExp(`^${req.body.name.trim()}$`, "i") }
     });
     if (collision) {
       return res.status(409).json({ error: "Category name already exists" });
     }
     ```
  4. Update fields (`name`, `icon`, `order`, `subCategories`), trigger `slug` recalculation, and save.
  5. Return `200 OK`:
     ```json
     {
       "message": "Category updated successfully",
       "category": { ... }
     }
     ```

#### 4. Admin Endpoint: `deleteCategory` (`DELETE /api/admin/categories/:id`)
* **Access**: Restricted to `role === 'admin'`.
* **URL Parameter**: `:id` (MongoDB ObjectId).
* **Validation & Business Rules**:
  1. Validate `:id`: If invalid ObjectId string (`!mongoose.Types.ObjectId.isValid(id)`), return `400 { "error": "Invalid category ID format" }`.
  2. Find existing category: `const category = await Category.findById(id)`. If missing, return `404 { "error": "Category not found" }`.
  3. Course Dependency Safeguard:
     Check if any course in the database currently references this category by name or ID:
     ```javascript
     const activeCourseCount = await mongoose.model("Course").countDocuments({
       $or: [{ category: category.name }, { category: category._id }]
     });
     if (activeCourseCount > 0) {
       return res.status(409).json({
         error: "Cannot delete category currently associated with active courses"
       });
     }
     ```
  4. If zero courses reference the category, delete document: `await Category.findByIdAndDelete(id)`.
  5. Return `200 OK`:
     ```json
     {
       "message": "Category deleted successfully"
     }
     ```

---

### Sub-section 3.3: Route Definitions & Application Mounting (`src/routes/category.routes.js` & `src/app.js`)

#### 1. Category Routes (`src/routes/category.routes.js`)
Assemble router mapping public and admin operations to handlers:
```javascript
import { Router } from "express";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/category.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = Router();

// Public route
router.get("/categories", getCategories);

// Admin-only management routes
router.post(
  "/admin/categories",
  authMiddleware,
  roleMiddleware("admin"),
  createCategory
);

router.put(
  "/admin/categories/:id",
  authMiddleware,
  roleMiddleware("admin"),
  updateCategory
);

router.delete(
  "/admin/categories/:id",
  authMiddleware,
  roleMiddleware("admin"),
  deleteCategory
);

export default router;
```

#### 2. Express Application Mounting (`src/app.js`)
Mount category routes under `/api` in `src/app.js`:
```javascript
import categoryRoutes from "./routes/category.routes.js";

// Mount API routes
app.use("/api", categoryRoutes);
```

---

### Sub-section 3.4: Documentation Portal Synchronization (`src/views/docs.html`)

Update `src/views/docs.html` served at `GET /` to incorporate the complete Category Taxonomy reference:
1. Add section header **"5. Course Taxonomy & Category Management"** in the navigation index and body view.
2. Render formatted endpoint documentation cards for:
   - `GET /api/categories` (Public)
   - `POST /api/admin/categories` (Admin)
   - `PUT /api/admin/categories/:id` (Admin)
   - `DELETE /api/admin/categories/:id` (Admin)
3. Include request headers, URL parameters, JSON body schemas, and response samples matching `200`, `201`, `400`, `401`, `403`, `404`, and `409` HTTP status codes.

---

## 4. Dependencies

* **Packages to Install**: None.
  * All implementation logic utilizes standard ES Modules, core Node.js features, and existing core dependencies (`express`, `mongoose`).

---

## 5. Exhaustive Verification & Test Suite

Follow these exact cURL commands and test scenarios to verify 100% compliance with all unit requirements and architectural invariants.

### Test 1: Fetch Categories List (Public Access)
```bash
curl -i -X GET http://localhost:3001/api/categories
```
* **Expected Output**: `HTTP 200 OK`
* **JSON Body**: `{"categories": [...]}` containing array of category documents sorted by `order` and `name`.

---

### Test 2: Create Category (Unauthenticated Call)
```bash
curl -i -X POST http://localhost:3001/api/admin/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Design & UX"}'
```
* **Expected Output**: `HTTP 401 Unauthorized`
* **JSON Body**: `{"error": "Authentication token missing or malformed"}`

---

### Test 3: Create Category (Non-Admin User Call)
```bash
# Obtain student or instructor token
STUDENT_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"student@gloxad.com","password":"Password123!"}' | jq -r '.token')

curl -i -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Design & UX"}'
```
* **Expected Output**: `HTTP 403 Forbidden`
* **JSON Body**: `{"error": "Access denied. Admin role required"}`

---

### Test 4: Create Category (Missing Required Name)
```bash
# Obtain admin token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gloxad.com","password":"AdminPassword123!"}' | jq -r '.token')

curl -i -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```
* **Expected Output**: `HTTP 400 Bad Request`
* **JSON Body**: `{"error": "Category name is required"}`

---

### Test 5: Create Category (Valid Admin Creation)
```bash
curl -i -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Design & UX",
    "icon": "paint-brush",
    "order": 3,
    "subCategories": [
      {"name": "UI Design", "topics": ["Figma", "Design Systems"]},
      {"name": "UX Research", "topics": ["User Interviews", "Usability Testing"]}
    ]
  }'
```
* **Expected Output**: `HTTP 201 Created`
* **JSON Body**: `{"message": "Category created successfully", "category": { "_id": "...", "name": "Design & UX", "slug": "design-ux", ... }}`

---

### Test 6: Create Category (Duplicate Name Prevention)
```bash
curl -i -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "design & ux"}'
```
* **Expected Output**: `HTTP 409 Conflict`
* **JSON Body**: `{"error": "Category with this name already exists"}`

---

### Test 7: Update Category (Valid Update)
```bash
# Retrieve category ID from created category
CAT_ID=$(curl -s -X GET http://localhost:3001/api/categories | jq -r '.categories[0]._id')

curl -i -X PUT http://localhost:3001/api/admin/categories/$CAT_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Design & User Experience", "order": 1}'
```
* **Expected Output**: `HTTP 200 OK`
* **JSON Body**: `{"message": "Category updated successfully", "category": { ... }}` with updated slug `design-user-experience`.

---

### Test 8: Delete Category (Course Dependency Safeguard)
```bash
# Attempt to delete a category associated with active courses
curl -i -X DELETE http://localhost:3001/api/admin/categories/$CAT_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
* **Expected Output** (if course references category): `HTTP 409 Conflict`
* **JSON Body**: `{"error": "Cannot delete category currently associated with active courses"}`

---

### Test 9: Delete Category (Unreferenced Category Deletion)
```bash
# Create temporary category to delete
TEMP_ID=$(curl -s -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Temporary Category"}' | jq -r '.category._id')

curl -i -X DELETE http://localhost:3001/api/admin/categories/$TEMP_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
* **Expected Output**: `HTTP 200 OK`
* **JSON Body**: `{"message": "Category deleted successfully"}`

---

### Test 10: Verify API Documentation Web Portal Integration
```bash
curl -s http://localhost:3001/ | grep -E "categories|admin/categories"
```
* **Expected Output**: HTML source includes documentation references for `GET /api/categories`, `POST /api/admin/categories`, `PUT /api/admin/categories/:id`, and `DELETE /api/admin/categories/:id`.

---

## 6. Architectural Invariants Checklist

- [x] **Rule 1 (Uniform Error Schema)**: 100% of error responses produced by controllers and middleware return exact `{ "error": "<message>" }` JSON objects with appropriate HTTP status codes (`400`, `401`, `403`, `404`, `409`).
- [x] **Rule 5 (Strict Identifier Standard)**: Primary key fields returned in all JSON outputs strictly retain `_id` as string representations and are never transformed or projected to `id`.
