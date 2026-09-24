# AI Workflow Rules - Gloxad Academy Backend API

This document defines mandatory operational rules for any AI coding agent working on the **Gloxad Academy Backend API**. You MUST follow these rules strictly. Do not deviate from these directives under any circumstances.

---

## 1. Overall Development Approach

1. **Spec-Driven Execution**: Read and follow the specification documents in `context/` (`project-overview.md`, `architecture.md`, `code-standards.md`) and `IMPLEMENTATION_PLAN.md`. Implement only what is explicitly specified.
2. **Sequential Milestone Progress**: Execute development strictly milestone-by-milestone (Milestones 1 through 9). Do NOT jump ahead to future milestones until the current milestone is 100% complete and verified.
3. **Behave as the Backend Engineer**: Focus 100% on backend API routes, Mongoose models, security rules, Paystack/S3 integration, Socket.io handlers, and the static HTML API documentation page (`GET /`). Do NOT build or generate frontend UI application components.

---

## 2. Strict Scoping Rules

1. **Single Unit Isolation**: Work on ONE buildable unit at a time. Do NOT edit files or routes belonging to subsequent milestones during an active milestone.
2. **Zero Speculative Code**: Do NOT write speculative code, unused utility functions, "future-proofing" abstractions, or unrequested helper files. If a feature or endpoint is not in the specification, do NOT implement it.
3. **No Unrequested Dependencies**: Do NOT install new npm packages unless instructed by the current milestone plan or explicitly confirmed by the user.
4. **Preserve Unrelated Files**: Do NOT refactor, format, or modify existing files that are outside the scope of the current task.

---

## 3. When and How to Split Work

1. **Sub-Task Decomposition**: If a milestone contains more than 3 endpoints or schemas (e.g. Milestone 2 Auth with 9 endpoints), break the implementation into step-by-step sub-tasks:
   - *Step A*: Define Mongoose Models.
   - *Step B*: Implement Utilities & Helpers.
   - *Step C*: Implement Controllers & Route definitions.
   - *Step D*: Verify and test routes.
2. **Atomic Commits**: Ensure code is runnable and syntactically valid at the conclusion of each sub-task. Never leave broken code across sub-task boundaries.

---

## 4. Handling Missing or Ambiguous Requirements

1. **Do NOT Guess or Hallucinate**: NEVER infer missing schema properties, secret keys, or endpoint behaviors when requirements are unclear.
2. **Protocol for Ambiguity**:
   - *Step 1*: Check `context/architecture.md` and `IMPLEMENTATION_PLAN.md` for existing definitions.
   - *Step 2*: If still ambiguous, STOP immediately and ask the user for explicit clarification.
   - *Step 3*: Do NOT supply placeholder logic, dummy fallback values, or silent try-catch blocks to hide missing parameters.

---

## 5. Protected Files & Directories

The following files and directories MUST NOT be deleted, renamed, or modified without explicit user instruction:

1. **Context Files**: `context/project-overview.md`, `context/architecture.md`, `context/code-standards.md`, and `context/ai-workflow-rules.md` (except to log progress if instructed).
2. **Master Specification**: `IMPLEMENTATION_PLAN.md`.
3. **Environment Templates**: `.env.example` (only update when new valid environment variables are explicitly added).
4. **Git Metadata**: `.git/` and `.gitignore`.

---

## 6. Keeping Documentation in Sync

1. **HTML API Documentation Update (`GET /`)**: Every time a REST endpoint or Socket.io event is created or updated, immediately update the HTML API documentation template (`src/views/docs.html` or equivalent static view) to reflect the new route, HTTP method, required headers, request body shape, and status codes.
2. **Environment Variable Logging**: When a new environment variable is introduced, add it immediately to `.env.example` with a dummy placeholder value.

---

## 7. Mandatory Verification Checklist Before Completing a Unit

Before declaring any buildable unit or milestone complete, you MUST execute and satisfy every item on this checklist:

- [ ] **Syntax & Import Check**: Verify all `import` statements include explicit `.js` extensions and that no CommonJS `require()` remains.
- [ ] **Uniform Error Response Check**: Confirm that all new routes and error branches return JSON formatted strictly as `{ "error": "<message>" }`.
- [ ] **Role & Access Control Check**: Verify that proper authentication (`authGuard`) and role middleware (`roleGuard`) are applied to protected routes.
- [ ] **Primary Key Naming Check**: Verify that all response objects return MongoDB identifiers named `_id` as a string.
- [ ] **API Docs Synchronization Check**: Confirm the HTML API documentation page (`GET /`) includes accurate descriptions, payloads, and status codes for all newly implemented endpoints.
- [ ] **Server Startup Verification**: Run the application (`npm run dev` or `node src/server.js`) to verify zero runtime exceptions during startup.
