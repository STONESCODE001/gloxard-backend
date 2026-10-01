# Specification: Unit 13 — Real-Time Messaging & In-App Notifications (REST + Socket.io)

> **Spec Identifier**: `13-real-time-messaging-notifications`  
> **Target Spec File**: `context/specs/13-real-time-messaging-notifications.md`  
> **Master Build Plan**: [`context/specs/00-build-plan.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/specs/00-build-plan.md)  
> **Progress Tracker**: [`context/progress-tracker.md`](file:///c:/Users/THE%20LAPTOP%20STORE/Desktop/gloxard/context/progress-tracker.md)  
> **Status**: Ready for Implementation  
> **Applicable Invariants**: `context/architecture.md` (Rules 1, 2, 5, and 6)  

---

## 1. Goal

Implement the real-time messaging engine, in-app notification system, REST API endpoints (`/api/messages/*` and `/api/notifications/*`), and Socket.io WebSocket server (`src/socket/socket.handler.js`) with JWT handshake authentication. Enable 1:1 and group course chat conversations, instant live message delivery, typing indicators, user room push notifications, and update the interactive API documentation portal served at `GET /`.

---

## 2. Design

### 2.1 Visual & Structural Decisions for API Documentation Portal (`src/views/docs.html`)

Following `context/architecture.md` and the Sheybi Design System (`context/ui-context.md`), this unit updates the interactive **Backend API Documentation Portal** served at `GET /` (`src/views/docs.html`).

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
* **Socket.io Event Badges**:
  * `WS Event`: Background `#F3E8FF`, Text `#6B21A8`, Border `#C084FC`
* **Access Security Guard**:
  * `Auth Guard`: Required (`Authorization: Bearer <token>` for REST; Socket Handshake `auth: { token: "<jwt>" }`).

---

### 2.2 Endpoint Structural Layout & REST Payloads

#### 1. `GET /api/messages/conversations`
* **Access**: Authenticated Users (Students, Instructors, Admins)
* **Header**: `Authorization: Bearer <token>`
* **Purpose**: Retrieves all active 1:1 and course group conversations where the authenticated user is a participant. Returns populated participant details, last message snippet, unread message status, and `updatedAt` sorted in descending order.
* **Success Response (`200 OK`)**:
  ```json
  {
    "conversations": [
      {
        "_id": "651a3c4d5e6f7a8b9c0d1111",
        "participants": [
          {
            "_id": "651a2b3c4d5e6f7a8b9c0d12",
            "firstName": "Alex",
            "lastName": "Rivera",
            "avatar": "https://s3.amazonaws.com/gloxard/avatars/alex.jpg",
            "role": "student"
          },
          {
            "_id": "651a2b3c4d5e6f7a8b9c0d99",
            "firstName": "Sarah",
            "lastName": "Dev",
            "avatar": "https://s3.amazonaws.com/gloxard/avatars/sarah.jpg",
            "role": "instructor"
          }
        ],
        "courseId": "651a3c4d5e6f7a8b9c0d1234",
        "lastMessage": {
          "_id": "651a3c4d5e6f7a8b9c0d2222",
          "sender": "651a2b3c4d5e6f7a8b9c0d99",
          "text": "Welcome to Python Masterclass!",
          "createdAt": "2026-10-01T21:40:00.000Z"
        },
        "unreadCount": 1,
        "updatedAt": "2026-10-01T21:40:00.000Z"
      }
    ]
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`: Token missing or invalid.

---

#### 2. `POST /api/messages/conversations/new`
* **Access**: Authenticated Users
* **Header**: `Authorization: Bearer <token>`
* **Request Body**:
  ```json
  {
    "recipientId": "651a2b3c4d5e6f7a8b9c0d99",
    "courseId": "651a3c4d5e6f7a8b9c0d1234"
  }
  ```
* **Purpose**: Creates a new 1:1 conversation between the requesting user and `recipientId`, or returns an existing conversation if one already exists between these users. Optionally associates the conversation with a `courseId`.
* **Success Response (`200 OK` or `201 Created`)**:
  ```json
  {
    "message": "Conversation initialized",
    "conversation": {
      "_id": "651a3c4d5e6f7a8b9c0d1111",
      "participants": [
        "651a2b3c4d5e6f7a8b9c0d12",
        "651a2b3c4d5e6f7a8b9c0d99"
      ],
      "courseId": "651a3c4d5e6f7a8b9c0d1234",
      "lastMessage": null,
      "updatedAt": "2026-10-01T21:45:00.000Z"
    }
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `recipientId` is missing or equal to current user ID.
  * `401 Unauthorized`: Token missing or invalid.
  * `404 Not Found`: Target recipient user does not exist.

---

#### 3. `GET /api/messages/:conversationId`
* **Access**: Authenticated Participants of the Conversation
* **Header**: `Authorization: Bearer <token>`
* **Path Parameter**: `conversationId` (MongoDB ObjectId)
* **Query Parameters**: `page` (default 1), `limit` (default 50)
* **Purpose**: Fetches paginated message history for a specific conversation. Automatically updates the `readBy` array on unread messages for the requesting user.
* **Success Response (`200 OK`)**:
  ```json
  {
    "messages": [
      {
        "_id": "651a3c4d5e6f7a8b9c0d2222",
        "conversationId": "651a3c4d5e6f7a8b9c0d1111",
        "sender": {
          "_id": "651a2b3c4d5e6f7a8b9c0d99",
          "firstName": "Sarah",
          "lastName": "Dev",
          "avatar": "https://s3.amazonaws.com/gloxard/avatars/sarah.jpg"
        },
        "text": "Welcome to Python Masterclass!",
        "readBy": [
          "651a2b3c4d5e6f7a8b9c0d99",
          "651a2b3c4d5e6f7a8b9c0d12"
        ],
        "createdAt": "2026-10-01T21:40:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalMessages": 1
    }
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`: Token missing or invalid.
  * `403 Forbidden`: Authenticated user is not a participant in this conversation.
  * `404 Not Found`: Conversation ID not found.

---

#### 4. `POST /api/messages/:conversationId`
* **Access**: Authenticated Participants of the Conversation
* **Header**: `Authorization: Bearer <token>`
* **Path Parameter**: `conversationId` (MongoDB ObjectId)
* **Request Body**:
  ```json
  {
    "text": "Hi Sarah! I have a question about module 3."
  }
  ```
* **Purpose**: Saves a new chat message to MongoDB, updates `lastMessage` and `updatedAt` on the `Conversation` model, and emits a real-time `new_message` Socket.io event to room `conv:<conversationId>`.
* **Success Response (`201 Created`)**:
  ```json
  {
    "message": "Message sent successfully",
    "data": {
      "_id": "651a3c4d5e6f7a8b9c0d3333",
      "conversationId": "651a3c4d5e6f7a8b9c0d1111",
      "sender": {
        "_id": "651a2b3c4d5e6f7a8b9c0d12",
        "firstName": "Alex",
        "lastName": "Rivera",
        "avatar": "https://s3.amazonaws.com/gloxard/avatars/alex.jpg"
      },
      "text": "Hi Sarah! I have a question about module 3.",
      "readBy": [
        "651a2b3c4d5e6f7a8b9c0d12"
      ],
      "createdAt": "2026-10-01T21:50:00.000Z"
    }
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: Message text is empty or invalid.
  * `401 Unauthorized`: Token missing or invalid.
  * `403 Forbidden`: Authenticated user is not a participant in this conversation.
  * `404 Not Found`: Conversation ID not found.

---

#### 5. `GET /api/notifications`
* **Access**: Authenticated Users
* **Header**: `Authorization: Bearer <token>`
* **Query Parameters**: `unreadOnly` (boolean, default false), `page` (default 1), `limit` (default 20)
* **Purpose**: Fetches in-app notifications for the authenticated user (or targeted role broadcasts), sorted with unread/newest notifications first.
* **Success Response (`200 OK`)**:
  ```json
  {
    "notifications": [
      {
        "_id": "651a3c4d5e6f7a8b9c0d4444",
        "recipient": "651a2b3c4d5e6f7a8b9c0d12",
        "title": "Course Enrolled Successfully",
        "message": "You are now enrolled in Python Masterclass",
        "type": "enrollment_success",
        "read": false,
        "link": "/courses/python-masterclass",
        "createdAt": "2026-10-01T21:30:00.000Z"
      }
    ],
    "unreadCount": 1
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`: Token missing or invalid.

---

#### 6. `POST /api/notifications/mark-read`
* **Access**: Authenticated Users
* **Header**: `Authorization: Bearer <token>`
* **Request Body**:
  ```json
  {
    "notificationIds": [
      "651a3c4d5e6f7a8b9c0d4444"
    ],
    "markAll": false
  }
  ```
* **Purpose**: Marks specified notifications (or all notifications if `markAll: true`) as `read: true` for the authenticated recipient user.
* **Success Response (`200 OK`)**:
  ```json
  {
    "message": "Notifications marked as read",
    "updatedCount": 1
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`: Token missing or invalid.

---

### 2.3 Socket.io Real-Time Event Layout & Specifications

#### 1. Socket Connection & JWT Handshake
* **Client Handshake Setup**:
  ```javascript
  const socket = io("http://localhost:3001", {
    auth: { token: "<jwt_access_token>" }
  });
  ```
* **Authentication Handler**:
  * Extract token from `socket.handshake.auth.token` or `socket.handshake.query.token`.
  * Verify token using `jwt.verify(token, env.JWT_SECRET)`.
  * Attach `socket.user = { _id, role, firstName, lastName }`.
  * Automatically join room `user:<socket.user._id>`.
  * If token invalid, reject handshake with `new Error("Authentication error")`.

#### 2. Socket Event Catalog

| Event Name | Direction | Payload Shape | Description |
| :--- | :--- | :--- | :--- |
| `join_user` | Client $\rightarrow$ Server | `{ "userId": "..." }` | Automatically called on connection; joins room `user:<userId>`. |
| `join_conversation` | Client $\rightarrow$ Server | `{ "conversationId": "..." }` | Client joins conversation room `conv:<conversationId>`. Validates membership. |
| `leave_conversation` | Client $\rightarrow$ Server | `{ "conversationId": "..." }` | Client leaves conversation room `conv:<conversationId>`. |
| `typing` | Client $\rightarrow$ Server | `{ "conversationId": "..." }` | Broadcasts `typing` event to room `conv:<conversationId>` excluding sender. |
| `stop_typing` | Client $\rightarrow$ Server | `{ "conversationId": "..." }` | Broadcasts `stop_typing` event to room `conv:<conversationId>` excluding sender. |
| `new_message` | Server $\rightarrow$ Client | Message object payload | Emitted to room `conv:<conversationId>` when a message is posted. |
| `new_notification` | Server $\rightarrow$ Client | Notification object payload | Emitted to room `user:<recipientId>` when a notification is generated. |

---

## 3. Implementation

### 3.1 Data Models

#### 1. `src/models/Conversation.model.js`
* **Schema Fields**:
  * `participants`: Array of `Schema.Types.ObjectId`, ref `'User'`, required, indexed.
  * `lastMessage`: `Schema.Types.ObjectId`, ref `'Message'`, default `null`.
  * `courseId`: `Schema.Types.ObjectId`, ref `'Course'`, default `null`.
  * `isGroup`: `Boolean`, default `false`.
* **Timestamps**: Enabled (`createdAt`, `updatedAt`).
* **Transforms**: Convert `_id` to string, remove `__v`.

#### 2. `src/models/Message.model.js`
* **Schema Fields**:
  * `conversationId`: `Schema.Types.ObjectId`, ref `'Conversation'`, required, indexed.
  * `sender`: `Schema.Types.ObjectId`, ref `'User'`, required.
  * `text`: `String`, required, trim: true.
  * `readBy`: Array of `Schema.Types.ObjectId`, ref `'User'`, default `[]`.
* **Timestamps**: Enabled (`createdAt`, `updatedAt`).
* **Transforms**: Convert `_id` to string, remove `__v`.

#### 3. `src/models/Notification.model.js`
* Verify and maintain existing schema in `src/models/Notification.model.js` with fields `recipient`, `targetRole`, `title`, `message`, `type`, `read`, `link`, `createdAt`. Ensure proper `toJSON` transform (`_id` string, remove `__v`).

---

### 3.2 Socket.io Engine Module (`src/socket/socket.handler.js`)

* **Responsibilities**:
  1. Initialize `io = new Server(httpServer, { cors: { origin: env.FRONTEND_ORIGIN } })`.
  2. Apply authentication middleware on `io.use(...)` verifying JWT.
  3. Connection listener (`io.on("connection", (socket) => ...)`):
     * Log client connection.
     * Socket joins `user:${socket.user._id}`.
     * Handle `join_conversation` event: verify if `socket.user._id` is in conversation participants, then `socket.join("conv:" + conversationId)`.
     * Handle `leave_conversation` event: `socket.leave("conv:" + conversationId)`.
     * Handle `typing` & `stop_typing` events: `socket.to("conv:" + conversationId).emit(...)`.
     * Disconnect handler: log client disconnect.
  4. Helper functions exported:
     * `emitNewMessage(conversationId, messageData)`: emits `new_message` to room `conv:<conversationId>`.
     * `emitNotification(recipientId, notificationData)`: emits `new_notification` to room `user:<recipientId>`.
     * `broadcastNotification(targetRole, notificationData)`: emits `new_notification` to role rooms or all users.

---

### 3.3 HTTP Server Integration (`src/index.js`)

* Refactor `src/index.js` to create an HTTP server using `http.createServer(app)`.
* Pass the `httpServer` instance to `initSocket(httpServer)` from `src/socket/socket.handler.js`.
* Listen on `httpServer.listen(PORT)` instead of `app.listen(PORT)`.

---

### 3.4 Controller Implementation

#### 1. `src/controllers/message.controller.js`
* `getConversationsController(req, res, next)`: Query `Conversation.find({ participants: req.user._id })`, populate `participants` (selecting `firstName lastName avatar role`) and `lastMessage`. Calculate unread messages count per conversation. Return 200 OK.
* `createOrGetConversationController(req, res, next)`: Read `recipientId`, `courseId` from body. Validate `recipientId` != `req.user._id`. Search for existing conversation between `req.user._id` and `recipientId`. If exists, return 200 OK with conversation. If not, create conversation record, populate participants, return 201 Created.
* `getMessagesController(req, res, next)`: Read `conversationId` from params. Verify user is in conversation participants. Query `Message.find({ conversationId })` paginated. Update unread messages `readBy` array with `req.user._id`. Return 200 OK.
* `sendMessageController(req, res, next)`: Read `conversationId` from params and `text` from body. Validate user is in conversation participants. Create and save `Message`. Update `Conversation` `lastMessage` and `updatedAt`. Trigger `emitNewMessage(conversationId, populatedMessage)`. Return 201 Created.

#### 2. `src/controllers/notification.controller.js`
* `getNotificationsController(req, res, next)`: Query `Notification.find({ $or: [{ recipient: req.user._id }, { targetRole: req.user.role }, { targetRole: 'all' }] })`. Sort by `createdAt: -1`. Return 200 OK with notification list and unread count.
* `markNotificationsReadController(req, res, next)`: Read `notificationIds` and `markAll` from body. If `markAll === true`, update all notifications for `req.user._id` to `read: true`. Else update specified `notificationIds`. Return 200 OK with updated count.

---

### 3.5 Routes Registration

#### 1. `src/routes/message.routes.js`
* Mount under `/api/messages`:
  * `GET /conversations` $\rightarrow$ `authGuard`, `getConversationsController`
  * `POST /conversations/new` $\rightarrow$ `authGuard`, `createOrGetConversationController`
  * `GET /:conversationId` $\rightarrow$ `authGuard`, `getMessagesController`
  * `POST /:conversationId` $\rightarrow$ `authGuard`, `sendMessageController`

#### 2. `src/routes/notification.routes.js`
* Mount under `/api/notifications`:
  * `GET /` $\rightarrow$ `authGuard`, `getNotificationsController`
  * `POST /mark-read` $\rightarrow$ `authGuard`, `markNotificationsReadController`

#### 3. Update `src/app.js`
* Mount `messageRoutes` under `/api/messages`.
* Mount `notificationRoutes` under `/api/notifications`.

---

### 3.6 Interactive API Documentation Updates (`src/views/docs.html`)

* Add **Category Section 8: Real-Time Messaging & In-App Notifications** to `src/views/docs.html`.
* Include documentation cards for all 6 REST endpoints and table for all 7 Socket.io real-time events (`join_user`, `join_conversation`, `leave_conversation`, `typing`, `stop_typing`, `new_message`, `new_notification`).

---

## 4. Dependencies

* `socket.io`: Socket.io server package for Node.js real-time WebSockets.
  ```bash
  npm install socket.io
  ```

---

## 5. Verification Checklist

- [ ] **Socket.io Server Initialization**: `httpServer` created and Socket.io listening on port `3001` with CORS enabled.
- [ ] **JWT Handshake Security**: Unauthenticated socket connections rejected with 401 error; valid JWT connections accepted and socket assigned to `user:<userId>` room.
- [ ] **Conversation Management**: `POST /api/messages/conversations/new` creates or fetches 1:1 conversation without creating duplicate pairs.
- [ ] **Conversation List**: `GET /api/messages/conversations` returns active conversations populated with participant metadata and `lastMessage`.
- [ ] **Message History**: `GET /api/messages/:conversationId` enforces participant authorization (returns 403 for non-participants) and marks messages as read for caller.
- [ ] **Message Delivery & Real-Time Broadcast**: `POST /api/messages/:conversationId` saves message to MongoDB and emits `new_message` to room `conv:<conversationId>`.
- [ ] **Typing Indicators**: `typing` and `stop_typing` socket events broadcast correctly to conversation room members.
- [ ] **In-App Notification Fetching**: `GET /api/notifications` returns user notifications sorted by newest first with accurate `unreadCount`.
- [ ] **Mark Read Endpoint**: `POST /api/notifications/mark-read` updates notification status to `read: true`.
- [ ] **Real-Time Notification Push**: `emitNotification` helper successfully sends `new_notification` events to `user:<userId>` room.
- [ ] **Uniform Error Schema**: Any error returns `{ "error": "<message>" }`.
- [ ] **Identifier Consistency**: All returned object IDs use `_id` string representation.
- [ ] **Documentation Sync**: `src/views/docs.html` updated with endpoints and socket events.
