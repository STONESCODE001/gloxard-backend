# Specification: Milestone 1 — User Authentication, Email & OTP System

> **Spec Identifier**: `01-auth-email-otp`  
> **Target Spec File**: `context/specs/01-auth-email-otp.md`  
> **Status**: Ready for Implementation  
> **Applicable Rules**: `context/architecture.md`, `context/project-overview.md`, `context/code-standards.md`, `context/ui-context.md`  

---

## 1. Goal

Implement a secure, stateless authentication and account recovery system featuring JWT Bearer authorization, bcrypt password hashing, 4-digit email OTP verification for instructors, and 5-digit password recovery OTPs backed by TTL-indexed MongoDB records. The feature exposes 9 standard `/api/auth/*` REST endpoints adhering to the uniform `{ "error": "<message>" }` response format and documents them on the interactive HTML API documentation portal at `GET /`.

---

## 2. Design (Visual and Structural Decisions)

In strict accordance with `context/architecture.md` and `context/ui-context.md` (Gloxad Academy API Documentation Design System), this milestone updates and serves the **Backend API Documentation Web Portal** at `GET /` (`src/views/docs.html`).

### Visual Decisions (Gloxad Academy UI Tokens from `context/ui-context.md`)
* **Theme**: Technical, minimal, and engineering-focused light theme with embedded CSS variables.
* **Colors & Semantic Tokens**:
  * Base Background (`--color-surface-base`): `#F8FAFC`
  * Card Surface (`--color-surface-card`): `#FFFFFF`
  * Code Surface (`--color-surface-code`): `#0F172A`
  * Table Header (`--color-surface-table-header`): `#F1F5F9`
  * Subtle Border (`--color-border-subtle`): `#E2E8F0`
  * Primary Text (`--color-text-primary`): `#0F172A`
  * Secondary Text (`--color-text-secondary`): `#475569`
  * Muted Text (`--color-text-muted`): `#94A3B8`
  * Code Text (`--color-text-code`): `#F8FAFC`
  * Brand Accent (`--color-accent-brand`): `#4F46E5`
  * Badge Accent (`--color-accent-badge`): `#EEF2FF`
* **HTTP Method Badges**:
  * `POST`: Background `#DBEAFE`, Text `#1D4ED8`, Border `#93C5FD`
  * `GET`: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
  * `PUT`: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
  * `DELETE`: Background `#FEE2E2`, Text `#B91C1C`, Border `#FCA5A5`
* **Status Code Badges**:
  * `2xx Success`: Background `#F0FDF4`, Text `#166534`
  * `4xx Client Error` (`400`, `404`, `409`): Background `#FFEDD5`, Text `#9A3412`
  * `Auth Error` (`401`, `403`): Background `#F3E8FF`, Text `#6B21A8`
  * `5xx Server Error`: Background `#FEF2F2`, Text `#991B1B`
* **Typography**:
  * Sans-Serif Stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  * Monospace / Code Stack: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`
* **Border Radius & Elevation**:
  * Cards & Code Blocks: `radius-lg` (`8px` / `0.5rem`)
  * Badges & Status Pills: `radius-sm` (`4px` / `0.25rem`)
  * Table Containers & Inputs: `radius-md` (`6px` / `0.375rem`)
  * Card Border: `1px solid var(--color-border-subtle)` with soft elevation.

### Structural Decisions (API Portal Layout)
1. **Header**: Brand title "Gloxad Academy Backend API", environment badge (`development` / `port 3001`), and base URL pill (`http://localhost:3001/api`).
2. **Interactive Section**: "Authentication & Account Recovery" section grouping the 9 endpoints.
3. **Endpoint Details Card (`<details class="endpoint-card">`)**:
   - Header summary: HTTP Method badge, route path (`/api/auth/signup`), auth requirement tag (`Public` or `Bearer Token`), and short description.
   - Body: Description, Headers table (`Content-Type`, `Authorization`), Request Payload JSON schema/sample, and Response Payloads for both Success (`200`/`201`) and Errors (`400`, `401`, `404`, `409`).

---

## 3. Implementation

The implementation is partitioned into 6 modular sub-sections to guarantee isolation and zero orphaned code.

### Sub-section 3.1: Environment Variables & Database Models

#### 1. Environment Config (`src/config/env.js` and `.env.example`)
Validate and export:
* `PORT` (default: `3001`)
* `MONGODB_URI` (MongoDB connection URI)
* `JWT_SECRET` (minimum 32-character secret string)
* `JWT_EXPIRES_IN` (default: `"7d"`)
* `FRONTEND_ORIGIN` (default: `"http://localhost:3000"`)
* `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (Optional for SMTP mail delivery)

#### 2. User Model Update (`src/models/User.model.js`)
Refine existing `User.model.js` to strictly match `architecture.md`:
* Fields:
  * `firstName`: `{ type: String, required: true, trim: true }`
  * `lastName`: `{ type: String, trim: true, default: "" }`
  * `name`: `{ type: String, trim: true }` (pre-save computed full name)
  * `username`: `{ type: String, unique: true, lowercase: true, trim: true, index: true }`
  * `email`: `{ type: String, required: true, unique: true, lowercase: true, trim: true, index: true }`
  * `password`: `{ type: String, required: true }` (renamed from `passwordHash` to standard field, hashed via pre-save hook)
  * `role`: `{ type: String, enum: ["student", "instructor", "admin"], default: "student" }`
  * `approvalStatus`: `{ type: String, enum: ["pending", "approved", "rejected"], default: "approved" }` (instructors default to `"pending"`)
  * `isVerified`: `{ type: Boolean, default: false }`
  * `avatarUrl`: `{ type: String, default: "" }`
  * `bio`: `{ type: String, default: "" }`
  * `socials`: Nested object `{ website, facebook, instagram, linkedin, twitter, whatsapp, youtube }`
  * `notificationPreferences`: Nested object with boolean flags
  * `lastLoginAt`: `{ type: Date, default: null }`
* Primary Key Invariant: Retain `_id` and never project or rename to `id`.
* Password security: `toJSON` transform must strip `password` and `__v`.

#### 3. OTP Model Creation (`src/models/Otp.model.js`)
* Fields:
  * `email`: `{ type: String, required: true, lowercase: true, trim: true, index: true }`
  * `code`: `{ type: String, required: true }` (bcrypt-hashed OTP string)
  * `type`: `{ type: String, enum: ["email_verification", "password_reset"], required: true }`
  * `expiresAt`: `{ type: Date, required: true, expires: 0 }` (MongoDB TTL index: automatically deletes expired records)
  * `consumed`: `{ type: Boolean, default: false }`

---

### Sub-section 3.2: Cryptographic, Token & Email Utilities

#### 1. Hash Utility (`src/utils/hash.js`)
* `hashValue(plainText, saltRounds = 10)`: Hashes passwords or OTP codes using `bcryptjs`.
* `compareValue(plainText, hashedValue)`: Compares plain input against stored bcrypt hash.

#### 2. JWT Utility (`src/utils/jwt.js`)
* `signToken(payload)`: Signs `{ sub: user._id, role: user.role }` with `process.env.JWT_SECRET` and expiration (`7d`).
* `verifyToken(token)`: Verifies signature and returns decoded claims, or throws `JsonWebTokenError`/`TokenExpiredError`.

#### 3. Email Dispatch Utility (`src/utils/email.js`)
* Implements the **Hybrid Transporter Pattern**:
  * Checks if `SMTP_HOST` and `SMTP_USER` are present in `process.env`.
  * If configured: Initializes `nodemailer.createTransport` and delivers real HTML/plain text email.
  * If unconfigured or development mode: Safely logs the dispatched OTP code to the server console:
    ```
    [DEV EMAIL DISPATCH]
    To: instructor@example.com
    Subject: Gloxad Academy - Email Verification OTP
    OTP Code: 4821 (Expires in 15 minutes)
    ```
* Methods:
  * `sendEmailVerificationOtp(email, otp)` (4-digit OTP)
  * `sendPasswordResetOtp(email, otp)` (5-digit OTP)

---

### Sub-section 3.3: Middlewares

#### 1. Authentication Middleware (`src/middlewares/auth.middleware.js`)
* Reads `req.headers.authorization`.
* Ensures format: `Bearer <token>`. Returns `401 { "error": "Authentication token missing or malformed" }` if absent.
* Verifies token via `verifyToken(token)`.
* Queries user by `sub` (`User.findById(decoded.sub).select("-password")`).
* If user does not exist or `user.isActive === false`, returns `401 { "error": "User account not found or deactivated" }`.
* Attaches populated user document to `req.user` and calls `next()`.

#### 2. Role Authorization Middleware (`src/middlewares/role.middleware.js`)
* Factory function: `roleGuard(...allowedRoles)`.
* Checks `allowedRoles.includes(req.user.role)`.
* Returns `403 { "error": "Access forbidden: insufficient role permissions" }` if role does not match.

#### 3. Rate Limiter Middleware (`src/middlewares/rateLimiter.middleware.js`)
* Uses `express-rate-limit`:
  * `authLimiter`: 10 requests per 15 minutes for `/signin` and `/signup`.
  * `otpLimiter`: 5 requests per 15 minutes for `/verify-email`, `/forget-passwd`, `/verify-otp`, `/reset-passwd`.

#### 4. Centralized Error Handler (`src/middlewares/error.middleware.js`)
* Formats all thrown exceptions and unhandled errors into:
  ```json
  { "error": "<Human-readable message>" }
  ```
* Catches MongoDB duplicate key error (`code === 11000`) and converts to `409 { "error": "User with this email or username already exists" }`.
* Catches Mongoose `ValidationError` and returns `400 { "error": "<field error messages>" }`.

---

### Sub-section 3.4: Controllers & Endpoint Logic (`src/controllers/auth.controller.js`)

Implement 9 controllers adhering to Rule 1 (`{ "error": ... }`) and Rule 5 (`_id` identifier):

1. **`signup` (`POST /api/auth/signup`)**:
   - Payload: `{ email, password, firstName, lastName, role }` (`role` can be `student` or `instructor`, default `student`).
   - Validates required fields.
   - Checks duplicate email/username.
   - Creates user. If `role === 'instructor'`, sets `approvalStatus: 'pending'` and `isVerified: false`, generates 4-digit OTP, saves hashed OTP to DB, and dispatches email verification OTP.
   - Returns `201 { "message": "User registered successfully", "user": { "_id", "email", "firstName", "lastName", "role", "isVerified" } }`.

2. **`signin` (`POST /api/auth/signin`)**:
   - Payload: `{ email, password }` (or username).
   - Validates existence and checks password via `user.comparePassword(password)`.
   - Generates JWT token: `{ sub: user._id, role: user.role }`.
   - Updates `lastLoginAt = new Date()`.
   - Returns `200 { "token": "...", "user": { "_id", "email", "firstName", "lastName", "role", "approvalStatus", "isVerified", "avatarUrl" } }`.

3. **`getMe` (`GET /api/auth/me`)**:
   - Protected with `authGuard`.
   - Returns `200 { "user": req.user }`.

4. **`signout` (`POST /api/auth/signout`)**:
   - Acknowledges session invalidation on client side.
   - Returns `200 { "message": "Successfully signed out" }`.

5. **`verifyEmail` (`POST /api/auth/verify-email`)**:
   - Payload: `{ email, otp }` (4-digit OTP).
   - Finds latest active OTP record with `type: "email_verification"`, `consumed: false`.
   - Verifies OTP match and checks expiration.
   - Updates `user.isVerified = true` and marks OTP as `consumed: true`.
   - Returns `200 { "message": "Email verified successfully" }`.

6. **`forgotPassword` (`POST /api/auth/forget-passwd`)**:
   - Payload: `{ email }`.
   - Checks if user exists. If user does not exist, returns `200 { "message": "If the account exists, an OTP has been sent" }` to prevent user enumeration attacks.
   - Generates 5-digit numeric OTP, saves hashed record in `Otp` collection with 15-minute TTL.
   - Dispatches password recovery email.
   - Returns `200 { "message": "Password reset OTP dispatched to email" }`.

7. **`verifyOtp` (`POST /api/auth/verify-otp`)**:
   - Payload: `{ email, otp }` (5-digit OTP).
   - Validates OTP without consuming it (allows UI to confirm OTP validity before prompting for new password).
   - Returns `200 { "valid": true, "message": "OTP is valid" }`.

8. **`resetPassword` (`POST /api/auth/reset-passwd`)**:
   - Payload: `{ email, otp, newPassword }`.
   - Validates 5-digit OTP, marks it `consumed: true`.
   - Hashes `newPassword`, updates user record, and clears session.
   - Returns `200 { "message": "Password reset successfully. You can now sign in with your new password." }`.

9. **`updatePassword` (`POST /api/auth/update-password`)**:
   - Protected with `authGuard`.
   - Payload: `{ currentPassword, newPassword }`.
   - Verifies `currentPassword`.
   - Saves new password.
   - Returns `200 { "message": "Password updated successfully" }`.

---

### Sub-section 3.5: Routing & Express App Assembly

* **`src/routes/auth.routes.js`**:
  Defines router and attaches rate limiters and auth guards:
  ```javascript
  router.post('/signup', authLimiter, signup);
  router.post('/signin', authLimiter, signin);
  router.get('/me', authGuard, getMe);
  router.post('/signout', signout);
  router.post('/verify-email', otpLimiter, verifyEmail);
  router.post('/forget-passwd', otpLimiter, forgotPassword);
  router.post('/verify-otp', otpLimiter, verifyOtp);
  router.post('/reset-passwd', otpLimiter, resetPassword);
  router.post('/update-password', authGuard, updatePassword);
  ```
* **`src/app.js`**:
  - Mounts routes under `/api/auth`:
    ```javascript
    app.use('/api/auth', authRouter);
    ```
  - Serves static documentation view at `GET /`:
    ```javascript
    app.get('/', (req, res) => res.sendFile(path.resolve('src/views/docs.html')));
    ```
  - Applies global 404 handler returning `{ "error": "Route not found" }`.
  - Applies global error handling middleware `errorMiddleware`.

---

### Sub-section 3.6: HTML API Documentation View (`src/views/docs.html`)

* Create `src/views/docs.html` conforming strictly to `context/ui-context.md`:
  - Technical, clean interface with sticky top navigation and Gloxad Academy branding.
  - Interactive search / filter bar.
  - Section for **"Authentication & Recovery (`/api/auth`)"** documenting all 9 endpoints.
  - For each endpoint:
    - Method badge (`POST`, `GET`).
    - Exact URL path (`/api/auth/signup`, `/api/auth/signin`, etc.).
    - Access requirements (`Public`, `Bearer Token`).
    - Copyable sample JSON request payloads and sample success/error responses.
    - Status code pills (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `409 Conflict`).

---

## 4. Dependencies

The following packages are required for this milestone:

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `jsonwebtoken` | `^9.0.2` | Signing and verifying stateless JWT Bearer tokens |
| `bcryptjs` | `^2.4.3` | Cross-platform salt hashing and password/OTP verification |
| `nodemailer` | `^6.9.16` | Transporting OTP emails via SMTP or dev console logging |
| `express-rate-limit` | `^7.5.0` | IP rate-limiting protection for auth and OTP routes |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing with credentials whitelist |
| `helmet` | `^8.0.0` | HTTP security response headers |

Installation command:
```bash
npm install jsonwebtoken bcryptjs nodemailer express-rate-limit cors helmet
```

---

## 5. Verification Checklist

Execute these concrete curl requests against the running server (`http://localhost:3001` or configured `PORT`) to verify milestone completion:

### 1. Public Health & Global Error Verification
- [ ] **Health Check**:
  ```bash
  curl -X GET http://localhost:3001/
  ```
  *Expected*: Returns HTTP 200 HTML page (`src/views/docs.html`) styled according to `context/ui-context.md`.
- [ ] **Undefined Route Invariant**:
  ```bash
  curl -X GET http://localhost:3001/api/unknown-endpoint
  ```
  *Expected Status*: `404 Not Found`  
  *Expected Body*: `{"error": "Route not found"}`

---

### 2. User Registration (`POST /api/auth/signup`)
- [ ] **Validation Failure (Missing Required Fields)**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}'
  ```
  *Expected Status*: `400 Bad Request`  
  *Expected Body*: `{"error": "First name, email, and password are required"}`

- [ ] **Successful Student Signup**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signup \
    -H "Content-Type: application/json" \
    -d '{
      "email": "student@gloxad.com",
      "password": "Password123!",
      "firstName": "Alex",
      "lastName": "Johnson",
      "role": "student"
    }'
  ```
  *Expected Status*: `201 Created`  
  *Expected Body*:
  ```json
  {
    "message": "User registered successfully",
    "user": {
      "_id": "<mongo_id>",
      "email": "student@gloxad.com",
      "firstName": "Alex",
      "lastName": "Johnson",
      "role": "student",
      "isVerified": false
    }
  }
  ```

- [ ] **Duplicate Email Conflict**:
  Repeat the previous student signup request.  
  *Expected Status*: `409 Conflict`  
  *Expected Body*: `{"error": "User with this email or username already exists"}`

- [ ] **Instructor Signup (Triggers 4-digit OTP)**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signup \
    -H "Content-Type: application/json" \
    -d '{
      "email": "instructor@gloxad.com",
      "password": "Password123!",
      "firstName": "Sarah",
      "lastName": "Connor",
      "role": "instructor"
    }'
  ```
  *Expected Status*: `201 Created`  
  *Expected Console Output*: `[DEV EMAIL DISPATCH] To: instructor@gloxad.com | Subject: Gloxad Academy - Email Verification OTP | OTP Code: <4-digit-code>`

---

### 3. Email OTP Verification (`POST /api/auth/verify-email`)
- [ ] **Invalid / Expired OTP**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/verify-email \
    -H "Content-Type: application/json" \
    -d '{"email": "instructor@gloxad.com", "otp": "0000"}'
  ```
  *Expected Status*: `400 Bad Request`  
  *Expected Body*: `{"error": "Invalid or expired OTP code"}`

- [ ] **Successful OTP Verification**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/verify-email \
    -H "Content-Type: application/json" \
    -d '{"email": "instructor@gloxad.com", "otp": "<4-digit-code-from-console>"}'
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: `{"message": "Email verified successfully"}`

---

### 4. Authentication & JWT Issuance (`POST /api/auth/signin`)
- [ ] **Invalid Password**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email": "student@gloxad.com", "password": "WrongPassword!"}'
  ```
  *Expected Status*: `401 Unauthorized`  
  *Expected Body*: `{"error": "Invalid email or password"}`

- [ ] **Successful Signin**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email": "student@gloxad.com", "password": "Password123!"}'
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*:
  ```json
  {
    "token": "<JWT_STRING>",
    "user": {
      "_id": "<mongo_id>",
      "email": "student@gloxad.com",
      "firstName": "Alex",
      "lastName": "Johnson",
      "role": "student"
    }
  }
  ```

---

### 5. Protected User Context (`GET /api/auth/me`)
- [ ] **Unauthenticated Access (No Token)**:
  ```bash
  curl -X GET http://localhost:3001/api/auth/me
  ```
  *Expected Status*: `401 Unauthorized`  
  *Expected Body*: `{"error": "Authentication token missing or malformed"}`

- [ ] **Authenticated Access (Valid Bearer Token)**:
  ```bash
  curl -X GET http://localhost:3001/api/auth/me \
    -H "Authorization: Bearer <JWT_STRING>"
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: Full user object (excluding `password` and `__v`, with MongoDB identifier `_id`).

---

### 6. Password Recovery Lifecycle
- [ ] **Request Password Reset (`POST /api/auth/forget-passwd`)**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/forget-passwd \
    -H "Content-Type: application/json" \
    -d '{"email": "student@gloxad.com"}'
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: `{"message": "Password reset OTP dispatched to email"}`  
  *Expected Console Output*: `[DEV EMAIL DISPATCH] To: student@gloxad.com | Subject: Gloxad Academy - Password Reset OTP | OTP Code: <5-digit-code>`

- [ ] **Verify Reset OTP Without Consuming (`POST /api/auth/verify-otp`)**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/verify-otp \
    -H "Content-Type: application/json" \
    -d '{"email": "student@gloxad.com", "otp": "<5-digit-code>"}'
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: `{"valid": true, "message": "OTP is valid"}`

- [ ] **Consume OTP & Reset Password (`POST /api/auth/reset-passwd`)**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/reset-passwd \
    -H "Content-Type: application/json" \
    -d '{
      "email": "student@gloxad.com",
      "otp": "<5-digit-code>",
      "newPassword": "NewSecurePassword123!"
    }'
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: `{"message": "Password reset successfully. You can now sign in with your new password."}`

- [ ] **Verify Re-Signin with New Password**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email": "student@gloxad.com", "password": "NewSecurePassword123!"}'
  ```
  *Expected Status*: `200 OK`

---

### 7. Authenticated Password Update (`POST /api/auth/update-password`)
- [ ] **Update Password**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/update-password \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <NEW_JWT_STRING>" \
    -d '{
      "currentPassword": "NewSecurePassword123!",
      "newPassword": "FinalPassword456!"
    }'
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: `{"message": "Password updated successfully"}`

---

### 8. Signout (`POST /api/auth/signout`)
- [ ] **Signout Call**:
  ```bash
  curl -X POST http://localhost:3001/api/auth/signout
  ```
  *Expected Status*: `200 OK`  
  *Expected Body*: `{"message": "Successfully signed out"}`
