# Specification: Unit 04 — User Profile Management & AWS S3 Presigned Media Offloading

> **Spec Identifier**: `04-user-profile-s3-upload`  
> **Target Spec File**: `context/specs/04-user-profile-s3-upload.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 2, and 5)  

---

## 1. Goal

Provide a secure, direct-to-cloud file upload service using AWS S3 PUT presigned URLs and allow authenticated users to update their full profile metadata while strictly guaranteeing zero raw file byte streaming on the API server. The unit introduces `POST /api/upload/presigned-url` and `PUT /api/auth/update-profile`, enforcing JWT Bearer authorization, input validation, unique username collision checks, and uniform `{ "error": "<message>" }` error shapes, synchronized with the interactive HTML API documentation portal at `GET /`.

---

## 2. Design for the API Documentation Portal (`src/views/docs.html`)

In strict accordance with `context/architecture.md` and `context/ui-context.md`, this unit updates the interactive **Backend API Documentation Portal** served at `GET /` (`src/views/docs.html`).

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
  * `PUT`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
  * `POST`: Background `#DBEAFE`, Text `#1D4ED8`, Border `#93C5FD`
* **Status Code Badges**:
  * `200 Success`: Background `#F0FDF4`, Text `#166534`
  * `400 Bad Request`: Background `#FFEDD5`, Text `#9A3412`
  * `401 / 403 Security Error`: Background `#F3E8FF`, Text `#6B21A8`
  * `409 Conflict`: Background `#FEE2E2`, Text `#991B1B`

### 2.2 Structural Layout & Component Hierarchy
1. **Cloud Upload Services Section**:
   - Header summary: `POST /api/upload/presigned-url`, Auth requirement badge (`Bearer Token Required`).
   - Description: Short-lived (15-minute) AWS S3 PUT presigned URL generation for client-side direct uploads.
   - Request Headers Table: `Authorization: Bearer <jwt>`, `Content-Type: application/json`.
   - Payload Parameters Table: `filename` (string, required), `fileType` (MIME string, required), `folder` (enum: `avatars`, `courses`, `certifications`, `resources`).
   - Response Cards:
     - `200 OK`: Returns `uploadUrl` (S3 presigned PUT link), `fileUrl` (public S3 asset link), `key`, `expiresIn: 900`.
     - `400 Bad Request`: `{ "error": "Filename and fileType are required" }`.
     - `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`.
2. **User Profile Management Section**:
   - Header summary: `PUT /api/auth/update-profile`, Auth requirement badge (`Bearer Token Required`).
   - Description: Partial profile update for authenticated students and tutors.
   - Request Payload Inspector: JSON schema documenting all editable user metadata.
   - Response Cards:
     - `200 OK`: `{ "message": "Profile updated successfully", "user": { ... } }`.
     - `400 Bad Request`: `{ "error": "Username is already taken" }`.

---

## 3. Implementation Details

Implementation is divided into 4 isolated, sequentially executable sub-sections.

---

### Sub-section 3.1: Environment Variables & S3 Utility (`src/config/env.js` & `src/utils/s3.js`)

#### 1. Environment Variable Loader (`src/config/env.js` and `.env.example`)
Expand `src/config/env.js` to parse optional AWS S3 credentials with safe fallback support:
* `AWS_REGION` (default: `"us-east-1"`)
* `AWS_ACCESS_KEY_ID` (AWS IAM Access Key)
* `AWS_SECRET_ACCESS_KEY` (AWS IAM Secret Key)
* `AWS_S3_BUCKET` (default: `"gloxad-media-bucket"`)

#### 2. AWS S3 Utility (`src/utils/s3.js`)
* Initialize AWS S3 SDK v3 client:
  ```javascript
  import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  ```
* Implement Safe Dev Fallback:
  * If `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is missing in `process.env`, log a dev warning (`[S3 DEV NOTICE] AWS credentials missing. Operating in mock presigned mode.`) and return simulated presigned upload URLs:
    * `uploadUrl`: `http://localhost:3001/api/upload/mock-put/<folder>/<key>`
    * `fileUrl`: `https://gloxad-dev.s3.amazonaws.com/<folder>/<key>`
* Folder Prefix Validation Rules:
  * Allowed folders: `avatars`, `courses`, `certifications`, `resources`.
  * If an invalid folder is provided, default to `"resources"`.
* Key Naming Standard:
  * Key format: `<folder>/<timestamp>-<uuid>_<sanitized_filename>`
  * Example: `avatars/1727520000000-a1b2c3d4_profile.png`
* Presigned URL Expiration:
  * Set `expiresIn: 900` (seconds = 15 minutes).

---

### Sub-section 3.2: Presigned Upload Controller & Route (`src/controllers/upload.controller.js` & `src/routes/upload.routes.js`)

#### 1. Endpoint Contract: `POST /api/upload/presigned-url`
* **Security**: Protected by `authMiddleware` (`Authorization: Bearer <token>`).
* **Request Headers**:
  ```http
  Authorization: Bearer <jwt_access_token>
  Content-Type: application/json
  ```
* **Request Body Payload**:
  ```json
  {
    "filename": "lecture1_intro.mp4",
    "fileType": "video/mp4",
    "folder": "courses"
  }
  ```
* **Validation Rules**:
  * `filename`: Must be a non-empty string. If missing/empty, return `400 { "error": "Filename and fileType are required" }`.
  * `fileType`: Must be a valid MIME string (`image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `application/pdf`, `application/octet-stream`). If missing/empty, return `400 { "error": "Filename and fileType are required" }`.
  * `folder`: Must be one of `avatars`, `courses`, `certifications`, `resources`. Default: `resources`.
* **Success Response (HTTP 200 OK)**:
  ```json
  {
    "uploadUrl": "https://gloxad-media-bucket.s3.us-east-1.amazonaws.com/courses/1727520000000-abc123_lecture1_intro.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
    "fileUrl": "https://gloxad-media-bucket.s3.us-east-1.amazonaws.com/courses/1727520000000-abc123_lecture1_intro.mp4",
    "key": "courses/1727520000000-abc123_lecture1_intro.mp4",
    "expiresIn": 900
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`:
    ```json
    { "error": "Authentication token missing or malformed" }
    ```
  * `400 Bad Request`:
    ```json
    { "error": "Filename and fileType are required" }
    ```

#### 2. Route Definition (`src/routes/upload.routes.js`)
```javascript
import { Router } from "express";
import { getPresignedUrl } from "../controllers/upload.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/presigned-url", authMiddleware, getPresignedUrl);

export default router;
```

---

### Sub-section 3.3: User Model Refinement & Profile Update Controller (`src/models/User.model.js`, `src/controllers/auth.controller.js`, `src/routes/auth.routes.js`)

#### 1. User Model Schema Fields (`src/models/User.model.js`)
Ensure all editable profile fields from backend specs are defined:
* `firstName`: `{ type: String, trim: true }`
* `lastName`: `{ type: String, trim: true, default: "" }`
* `username`: `{ type: String, unique: true, lowercase: true, trim: true, index: true }`
* `avatarUrl`: `{ type: String, default: "" }`
* `biography`: `{ type: String, default: "" }`
* `title`: `{ type: String, default: "" }`
* `phoneNumber`: `{ type: String, default: "" }`
* `university`: `{ type: String, default: "" }`
* `level`: `{ type: String, default: "" }`
* `skills`: `[{ type: String, trim: true }]`
* `socialLinks`: Nested object:
  ```javascript
  {
    website: { type: String, default: "" },
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    twitter: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    youtube: { type: String, default: "" }
  }
  ```
* `notificationPreferences`: Nested object:
  ```javascript
  {
    coursePurchases: { type: Boolean, default: true },
    courseReviews: { type: Boolean, default: true },
    lectureComments: { type: Boolean, default: true },
    lectureNotesDownloads: { type: Boolean, default: true },
    commentReplies: { type: Boolean, default: true },
    dailyProfileVisits: { type: Boolean, default: false },
    lectureFileDownloads: { type: Boolean, default: true }
  }
  ```

#### 2. Endpoint Contract: `PUT /api/auth/update-profile`
* **Security**: Protected by `authMiddleware` (`Authorization: Bearer <token>`).
* **Request Payload (Partial Updates Supported)**:
  ```json
  {
    "firstName": "Alexander",
    "lastName": "Johnson",
    "username": "alexj_updated",
    "avatarUrl": "https://gloxad-media-bucket.s3.us-east-1.amazonaws.com/avatars/1727520000-user.png",
    "biography": "Full-stack instructor and web developer.",
    "title": "Senior Software Instructor",
    "phoneNumber": "+2348012345678",
    "university": "University of Lagos",
    "level": "Graduate",
    "skills": ["JavaScript", "Node.js", "MongoDB"],
    "socialLinks": {
      "github": "https://github.com/alexj",
      "linkedin": "https://linkedin.com/in/alexj"
    },
    "notificationPreferences": {
      "dailyProfileVisits": true
    }
  }
  ```
* **Validation & Controller Logic (`src/controllers/auth.controller.js`)**:
  * Extract only allowed fields from `req.body` to prevent unauthorized mass-assignment (e.g. changing `role`, `isVerified`, or `password`).
  * If `username` is present in payload:
    * Check if another user already has this username:
      ```javascript
      const existingUser = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existingUser) {
        return res.status(400).json({ error: "Username is already taken" });
      }
      ```
  * Merge nested `socialLinks` and `notificationPreferences` with existing user data so partial updates do not erase existing sub-document fields.
  * Execute `User.findByIdAndUpdate(req.user._id, updatePayload, { new: true, runValidators: true })`.
* **Success Response (HTTP 200 OK)**:
  ```json
  {
    "message": "Profile updated successfully",
    "user": {
      "_id": "673f8a92b234fa001234abcd",
      "email": "student@gloxad.com",
      "firstName": "Alexander",
      "lastName": "Johnson",
      "username": "alexj_updated",
      "role": "student",
      "isEmailVerified": true,
      "approvalStatus": "approved",
      "certifications": [],
      "avatarUrl": "https://gloxad-media-bucket.s3.us-east-1.amazonaws.com/avatars/1727520000-user.png",
      "biography": "Full-stack instructor and web developer.",
      "title": "Senior Software Instructor",
      "phoneNumber": "+2348012345678",
      "university": "University of Lagos",
      "level": "Graduate",
      "skills": ["JavaScript", "Node.js", "MongoDB"],
      "socialLinks": {
        "website": "",
        "facebook": "",
        "instagram": "",
        "linkedin": "https://linkedin.com/in/alexj",
        "twitter": "",
        "whatsapp": "",
        "youtube": "",
        "github": "https://github.com/alexj"
      },
      "notificationPreferences": {
        "coursePurchases": true,
        "courseReviews": true,
        "lectureComments": true,
        "lectureNotesDownloads": true,
        "commentReplies": true,
        "dailyProfileVisits": true,
        "lectureFileDownloads": true
      },
      "createdAt": "2026-09-28T10:00:00.000Z",
      "updatedAt": "2026-09-28T12:00:00.000Z"
    }
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{ "error": "Username is already taken" }`
  * `401 Unauthorized`: `{ "error": "Authentication token missing or malformed" }`

---

### Sub-section 3.4: API Documentation Portal Sync (`src/views/docs.html`)

Add full endpoint documentation blocks into `src/views/docs.html` adhering to Gloxad Academy visual design tokens:
1. **Section 1: User & Profile Management**
   - Documentation for `PUT /api/auth/update-profile`
2. **Section 2: Cloud Upload Services**
   - Documentation for `POST /api/upload/presigned-url`

---

## 4. Dependencies

Install the official AWS SDK v3 packages:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Package Details
- `@aws-sdk/client-s3`: S3 Client for constructing `PutObjectCommand` instances.
- `@aws-sdk/s3-request-presigner`: Utility for calculating S3 HMAC signatures and producing short-lived presigned upload URLs.

---

## 5. Exhaustive Verification & Test Suite

Follow these exact shell commands and test scenarios to verify 100% compliance with all unit requirements and architectural invariants.

### Test 1: Generate Presigned Upload URL (Unauthenticated)
```bash
curl -X POST http://localhost:3001/api/upload/presigned-url \
  -H "Content-Type: application/json" \
  -d '{"filename": "avatar.png", "fileType": "image/png", "folder": "avatars"}'
```
* **Expected Output**: `HTTP 401 Unauthorized`
* **JSON Body**: `{"error": "Authentication token missing or malformed"}`

---

### Test 2: Generate Presigned Upload URL (Missing Body Params)
```bash
# 1. Sign in to obtain token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"student@gloxad.com","password":"Password123!"}' | jq -r '.token')

# 2. Call endpoint without required body fields
curl -X POST http://localhost:3001/api/upload/presigned-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```
* **Expected Output**: `HTTP 400 Bad Request`
* **JSON Body**: `{"error": "Filename and fileType are required"}`

---

### Test 3: Generate Presigned Upload URL (Valid Request)
```bash
curl -X POST http://localhost:3001/api/upload/presigned-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "my_avatar.jpg", "fileType": "image/jpeg", "folder": "avatars"}'
```
* **Expected Output**: `HTTP 200 OK`
* **JSON Body Keys**: Contains `uploadUrl`, `fileUrl`, `key`, and `expiresIn: 900`.

---

### Test 4: Update Profile (Duplicate Username Check)
```bash
# Attempt to update username to a username already registered by another user
curl -X PUT http://localhost:3001/api/auth/update-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "existing_user"}'
```
* **Expected Output**: `HTTP 400 Bad Request`
* **JSON Body**: `{"error": "Username is already taken"}`

---

### Test 5: Update Profile (Successful Update)
```bash
curl -X PUT http://localhost:3001/api/auth/update-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "biography": "Senior Node.js Developer",
    "university": "Unilag",
    "skills": ["JavaScript", "Express", "MongoDB"],
    "avatarUrl": "https://gloxad-media-bucket.s3.us-east-1.amazonaws.com/avatars/test.jpg"
  }'
```
* **Expected Output**: `HTTP 200 OK`
* **JSON Body**: `{"message": "Profile updated successfully", "user": { ... }}` with populated updated fields and preserved `_id`.

---

### Test 6: Verify API Documentation Web Portal
```bash
curl -s http://localhost:3001/ | grep -E "update-profile|presigned-url"
```
* **Expected Output**: HTML source contains documentation sections for both `PUT /api/auth/update-profile` and `POST /api/upload/presigned-url`.

---

## 6. Invariants Checklist
- [x] **Rule 1 (Uniform Error Schema)**: 100% of errors return `{ "error": "<message>" }`.
- [x] **Rule 2 (Zero File Buffering)**: Raw file byte streaming is 100% offloaded to AWS S3 via presigned PUT URLs.
- [x] **Rule 5 (Strict Identifier Standard)**: `_id` is preserved as a string across all responses and never projected to `id`.
