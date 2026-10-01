# Specification: Unit 11 — Idempotent Paystack Webhook Handler

> **Spec Identifier**: `11-idempotent-paystack-webhook-processing`  
> **Target Spec File**: `context/specs/11-idempotent-paystack-webhook-processing.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 4, and 5)  

---

## 1. Goal

Implement the HMAC-SHA512 signature-verified, idempotent Paystack webhook processing endpoint (`POST /api/webhooks/paystack`) to handle asynchronous payment notifications (`charge.success`) sent directly from Paystack servers. Ensure cryptographic authenticity verification against raw payload bodies, guarantee zero duplicate database writes or double accounting on retried events, calculate instructor (70%) and platform (30%) revenue splits, create course enrollments automatically upon successful payment, and synchronize updates with the interactive API documentation portal served at `GET /`.

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
* **Webhook Security Guard Badge**:
  * `Webhook Signature Guard`: Required (`x-paystack-signature` header containing HMAC-SHA512 hex digest computed over raw request body using `PAYSTACK_SECRET_KEY`).
  * `Auth Guard`: None required (Public webhook listener endpoint invoked by Paystack servers).

---

### 2.2 Endpoint Structural Layout & Payloads

#### 1. `POST /api/webhooks/paystack`
* **Access**: External Webhook Listener (Secured cryptographically via `x-paystack-signature` HMAC-SHA512 validation).
* **Header**: `x-paystack-signature: <hmac_sha512_hex_string>`
* **Request Body Example (`charge.success`)**:
  ```json
  {
    "event": "charge.success",
    "data": {
      "id": 302948201,
      "domain": "test",
      "status": "success",
      "reference": "PAYSTACK_REF_1029384756",
      "amount": 2500000,
      "message": null,
      "gateway_response": "Successful",
      "paid_at": "2026-10-01T21:10:00.000Z",
      "created_at": "2026-10-01T21:09:45.000Z",
      "channel": "card",
      "currency": "NGN",
      "ip_address": "102.164.0.1",
      "metadata": {
        "student_id": "651a2b3c4d5e6f7a8b9c0d12",
        "course_id": "651a3c4d5e6f7a8b9c0d1234",
        "referrer": "checkout_modal"
      },
      "customer": {
        "id": 987654,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "customer_code": "CUS_xn74t5s6v6895"
      }
    }
  }
  ```
* **Purpose**: Processes Paystack `charge.success` events asynchronously. Verifies HMAC-SHA512 signature, verifies reference uniqueness (idempotency), records `Transaction` with revenue shares (70% instructor, 30% platform), creates active `Enrollment`, increments course `enrolledCount`, and creates student `Notification`.
* **Idempotency Guarantee**: If a transaction with `reference` already exists with status `"success"`, immediately returns HTTP 200 `{ "status": "success", "message": "Webhook already processed", "reference": "PAYSTACK_REF_1029384756" }` without modifying database records or double-counting revenue.
* **Success Responses (`200 OK`)**:
  * **New Transaction Processed**:
    ```json
    {
      "status": "success",
      "message": "Webhook processed successfully",
      "reference": "PAYSTACK_REF_1029384756",
      "transactionId": "651a9c3d4e5f6a7b8c9d0e1f"
    }
    ```
  * **Replayed Webhook (Idempotent duplicate)**:
    ```json
    {
      "status": "success",
      "message": "Webhook already processed",
      "reference": "PAYSTACK_REF_1029384756"
    }
    ```
  * **Ignored Non-Payment Event** (e.g., `transfer.success`):
    ```json
    {
      "status": "success",
      "message": "Event ignored",
      "event": "transfer.success"
    }
    ```
* **Error Responses**:
  * `401 Unauthorized`: Signature missing or invalid (`{ "error": "Invalid Paystack signature" }`).
  * `400 Bad Request`: Payload missing required fields (`{ "error": "Invalid webhook payload structure" }`).
  * `404 Not Found`: Metadata references non-existent user or course (`{ "error": "Referenced user or course not found" }`).

---

## 3. Implementation

The implementation is broken down into four sequential sub-sections:

### 3.1 Raw Request Body Preservation & Signature Validation Middleware

Paystack signature verification requires the exact raw unparsed request payload body buffer to compute `crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)`.

1. **Express Raw Body Capturing**:
   * Configure Express JSON middleware in `src/app.js` or dedicated route middleware to preserve `req.rawBody` buffer:
     ```javascript
     app.use(express.json({
       verify: (req, res, buf) => {
         req.rawBody = buf;
       }
     }));
     ```
2. **Signature Verification Middleware** (`src/middlewares/webhook.middleware.js`):
   * Extract header `x-paystack-signature` from `req.headers`.
   * Check if signature header exists; if missing, return `401` with `{ "error": "Invalid Paystack signature" }`.
   * Read `PAYSTACK_SECRET_KEY` from environment configuration (`src/config/env.js`).
   * Compute expected signature:
     ```javascript
     const hash = crypto
       .createHmac('sha512', config.PAYSTACK_SECRET_KEY)
       .update(req.rawBody || JSON.stringify(req.body))
       .digest('hex');
     ```
   * Perform constant-time string comparison using `crypto.timingSafeEqual` to prevent timing side-channel attacks.
   * If signatures do not match, return `401` with `{ "error": "Invalid Paystack signature" }`.
   * On match, invoke `next()`.

---

### 3.2 Webhook Controller & Idempotent Processing Logic (`src/controllers/webhook.controller.js`)

Implement `handlePaystackWebhook` in `src/controllers/webhook.controller.js`:

1. **Event Type Check**:
   * Extract `event` and `data` from `req.body`.
   * If `event !== 'charge.success'`, log debug event type and return HTTP 200 `{ "status": "success", "message": "Event ignored", "event": event }`.
2. **Idempotency Verification**:
   * Query `Transaction` collection by `reference`: `await Transaction.findOne({ reference: data.reference })`.
   * If existing transaction is found and `existingTx.status === 'success'`:
     * Return HTTP 200 `{ "status": "success", "message": "Webhook already processed", "reference": data.reference }`.
3. **Metadata Extraction & Verification**:
   * Extract `student_id` (or `userId`) and `course_id` (or `courseId`) from `data.metadata`.
   * If metadata is missing required IDs, attempt fallback extraction or reject with `400 Bad Request` `{ "error": "Invalid webhook payload structure: missing metadata IDs" }`.
   * Fetch `User.findById(student_id)` and `Course.findById(course_id)`.
   * If user or course does not exist, return `404 Not Found` `{ "error": "Referenced user or course not found" }`.
4. **Financial Computation**:
   * Standardize amount: convert Paystack Kobo to standard Naira (`amountInNaira = data.amount / 100`).
   * Compute instructor revenue share (70%): `instructorShare = amountInNaira * 0.70`.
   * Compute platform revenue share (30%): `platformShare = amountInNaira * 0.30`.
5. **Atomic Database State Updates**:
   * **Transaction Record**: Upsert or create `Transaction` document:
     ```javascript
     const transaction = await Transaction.findOneAndUpdate(
       { reference: data.reference },
       {
         reference: data.reference,
         user: student._id,
         course: course._id,
         amount: amountInNaira,
         currency: data.currency || 'NGN',
         status: 'success',
         instructorShare,
         platformShare
       },
       { upsert: true, new: true }
     );
     ```
   * **Enrollment Record**: Upsert `Enrollment` document:
     ```javascript
     await Enrollment.findOneAndUpdate(
       { user: student._id, course: course._id },
       {
         user: student._id,
         course: course._id,
         price: amountInNaira,
         status: 'active'
       },
       { upsert: true, new: true }
     );
     ```
   * **Course Enrollment Counter**: Increment course enrollment tally:
     ```javascript
     await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });
     ```
   * **Student Notification**: Create in-app notification confirming enrollment:
     ```javascript
     await Notification.create({
       recipient: student._id,
       title: 'Enrollment Confirmed',
       message: `You have successfully enrolled in ${course.title}.`,
       type: 'system',
       read: false,
       link: `/courses/${course.slug}`
     });
     ```
6. **Response Dispatch**:
   * Return HTTP 200 with `{ "status": "success", "message": "Webhook processed successfully", "reference": data.reference, "transactionId": transaction._id }`.

---

### 3.3 Express Router Integration (`src/routes/webhook.routes.js` & `src/app.js`)

1. **Route Definition**:
   * Create `src/routes/webhook.routes.js`:
     ```javascript
     import { Router } from 'express';
     import { handlePaystackWebhook } from '../controllers/webhook.controller.js';
     import { verifyPaystackSignature } from '../middlewares/webhook.middleware.js';

     const router = Router();

     router.post('/paystack', verifyPaystackSignature, handlePaystackWebhook);

     export default router;
     ```
2. **Mounting in `src/app.js`**:
   * Import `webhookRoutes` in `src/app.js`.
   * Mount under `/api/webhooks`: `app.use('/api/webhooks', webhookRoutes);`.

---

### 3.4 API Documentation Update (`src/views/docs.html`)

Update `src/views/docs.html` to document `POST /api/webhooks/paystack`:

1. Append a **Payments & Webhooks** section to the endpoint tables.
2. Render table row with:
   * **Method**: `POST` badge (`#DBEAFE` background, `#1E40AF` text).
   * **Endpoint**: `/api/webhooks/paystack`.
   * **Guard**: `x-paystack-signature` HMAC-SHA512.
   * **Description**: Handles asynchronous Paystack `charge.success` events idempotently.
   * **Request Body**: Paystack webhook event JSON payload.
   * **Response Payload**: `{ "status": "success", "message": "Webhook processed successfully", "reference": "PAYSTACK_REF_1029384756" }`.
   * **Status Codes**: `200 OK`, `401 Unauthorized`, `400 Bad Request`, `404 Not Found`.

---

## 4. Dependencies

* **Node.js Native `crypto` Module**: Used for `crypto.createHmac('sha512', secret)` signature generation and `crypto.timingSafeEqual` comparison.
* **Existing Project Dependencies**: `express`, `mongoose`.
* **New npm Packages**: None (Uses native Node.js standard library).

---

## 5. Verification Checklist

Execute the following verification steps upon completing implementation:

- [ ] **1. Missing Signature Test**: Send a `POST /api/webhooks/paystack` request without `x-paystack-signature` header. Verify server returns HTTP 401 `{ "error": "Invalid Paystack signature" }`.
- [ ] **2. Invalid Signature Test**: Send a `POST /api/webhooks/paystack` request with an incorrect `x-paystack-signature` header. Verify server returns HTTP 401 `{ "error": "Invalid Paystack signature" }`.
- [ ] **3. Ignored Event Test**: Send a cryptographically valid webhook with `event: "transfer.success"`. Verify server returns HTTP 200 `{ "status": "success", "message": "Event ignored", "event": "transfer.success" }` and creates no database records.
- [ ] **4. Valid `charge.success` Initial Event Test**: Send a cryptographically valid `charge.success` webhook payload containing valid `student_id` and `course_id` in metadata. Verify:
  - Returns HTTP 200 `{ "status": "success", "message": "Webhook processed successfully", ... }`.
  - A `Transaction` document is created with status `"success"`, `instructorShare` (70%), and `platformShare` (30%).
  - An `Enrollment` document is created with status `"active"`.
  - Target `Course` document's `enrolledCount` increments by 1.
  - A `Notification` document is created for the student.
- [ ] **5. Idempotent Replay Test**: Send the exact same `charge.success` webhook payload a second time with the same reference. Verify:
  - Server returns HTTP 200 `{ "status": "success", "message": "Webhook already processed", ... }`.
  - No duplicate `Transaction` or `Enrollment` records are created.
  - `enrolledCount` remains unchanged (does not double increment).
- [ ] **6. Invalid Metadata Reference Test**: Send a signed `charge.success` payload with a non-existent `student_id` or `course_id`. Verify server returns HTTP 404 `{ "error": "Referenced user or course not found" }`.
- [ ] **7. Architectural Invariants Verification**:
  - [ ] **Rule 1**: All error responses strictly match `{ "error": "<message>" }`.
  - [ ] **Rule 4**: Server verifies signature cryptographically and enforces reference idempotency.
  - [ ] **Rule 5**: Database primary keys are returned as `_id`.
  - [ ] **Documentation Sync**: `src/views/docs.html` updated with `POST /api/webhooks/paystack`.
