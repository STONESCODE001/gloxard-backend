# UI Context & Design System - Gloxad Academy API Documentation

This document defines the visual design tokens, HTML layout patterns, component standards, and typography rules for the **Gloxad Academy API Documentation page** served at `GET /`. 

The visual design is minimal, technical, and engineering-focused. It uses standard semantic engineering colors for HTTP methods and status codes, implemented strictly with plain HTML5 and embedded CSS variables.

---

## 1. Color Palette & Semantic Tokens

Every color used in the API documentation MUST reference one of the following semantic tokens. Do NOT invent or use raw hex colors outside this table.

| Category | Token Name | Hex Value | Semantic Usage & Role |
| :--- | :--- | :--- | :--- |
| **HTTP Methods** | `color-method-get-text` | `#15803D` | Text for `GET` method badge |
| **HTTP Methods** | `color-method-get-bg` | `#DCFCE7` | Background for `GET` method badge |
| **HTTP Methods** | `color-method-get-border` | `#86EFAC` | Border for `GET` method badge |
| **HTTP Methods** | `color-method-post-text` | `#1D4ED8` | Text for `POST` method badge |
| **HTTP Methods** | `color-method-post-bg` | `#DBEAFE` | Background for `POST` method badge |
| **HTTP Methods** | `color-method-post-border` | `#93C5FD` | Border for `POST` method badge |
| **HTTP Methods** | `color-method-put-text` | `#B45309` | Text for `PUT` method badge |
| **HTTP Methods** | `color-method-put-bg` | `#FEF3C7` | Background for `PUT` method badge |
| **HTTP Methods** | `color-method-put-border` | `#FDE68A` | Border for `PUT` method badge |
| **HTTP Methods** | `color-method-delete-text` | `#B91C1C` | Text for `DELETE` method badge |
| **HTTP Methods** | `color-method-delete-bg` | `#FEE2E2` | Background for `DELETE` method badge |
| **HTTP Methods** | `color-method-delete-border` | `#FCA5A5` | Border for `DELETE` method badge |
| **Status Codes** | `color-status-2xx-text` | `#166534` | Text for 2xx Success status (`200`, `201`) |
| **Status Codes** | `color-status-2xx-bg` | `#F0FDF4` | Background for 2xx Success status |
| **Status Codes** | `color-status-4xx-text` | `#9A3412` | Text for 4xx Client Error status (`400`, `404`, `409`) |
| **Status Codes** | `color-status-4xx-bg` | `#FFEDD5` | Background for 4xx Client Error status |
| **Status Codes** | `color-status-auth-text` | `#6B21A8` | Text for Auth Error status (`401`, `403`) |
| **Status Codes** | `color-status-auth-bg` | `#F3E8FF` | Background for Auth Error status |
| **Status Codes** | `color-status-5xx-text` | `#991B1B` | Text for 5xx Server Error status (`500`, `502`) |
| **Status Codes** | `color-status-5xx-bg` | `#FEF2F2` | Background for 5xx Server Error status |
| **Surfaces** | `color-surface-base` | `#F8FAFC` | HTML document main background |
| **Surfaces** | `color-surface-card` | `#FFFFFF` | Endpoint card & section container background |
| **Surfaces** | `color-surface-code` | `#0F172A` | Background for `<pre><code>` code blocks |
| **Surfaces** | `color-surface-table-header` | `#F1F5F9` | Background for table headers (`<thead>`) |
| **Borders** | `color-border-subtle` | `#E2E8F0` | Card borders, table grid lines, dividers |
| **Borders** | `color-border-focus` | `#4F46E5` | Active focus indicator border |
| **Text** | `color-text-primary` | `#0F172A` | Headings, endpoint titles, primary body text |
| **Text** | `color-text-secondary` | `#475569` | Subtitles, field descriptions, headers |
| **Text** | `color-text-muted` | `#94A3B8` | Non-critical hints, metadata, line numbers |
| **Text** | `color-text-code` | `#F8FAFC` | Text color inside code blocks |
| **Accents** | `color-accent-brand` | `#4F46E5` | Top navbar brand accent bar |
| **Accents** | `color-accent-badge` | `#EEF2FF` | Category and role tag backgrounds |

---

## 2. Typography Recommendations

The documentation relies on system font stacks for maximum loading speed and crisp readability.

* **Primary Sans-Serif Stack**: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
* **Code / Monospace Stack**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`

| Scale Token | Font Family | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `font-title` | Sans-Serif | 24px | 32px | 700 | Page main header (`<h1>`) |
| `font-section` | Sans-Serif | 18px | 26px | 600 | Category section headers (`<h2>`) |
| `font-endpoint` | Monospace | 15px | 22px | 600 | Method badge & route path text |
| `font-body` | Sans-Serif | 14px | 20px | 400 | Descriptions, table cell body text |
| `font-code` | Monospace | 13px | 18px | 400 | Request & Response JSON payloads |
| `font-badge` | Monospace | 12px | 16px | 700 | HTTP method badges and status pills |

---

## 3. Border Radius Scale

| Scale Token | Value (px / rem) | Usage Target |
| :--- | :--- | :--- |
| `radius-sm` | 4px (`0.25rem`) | HTTP method badges, status pills, role tags |
| `radius-md` | 6px (`0.375rem`) | Table containers, search inputs |
| `radius-lg` | 8px (`0.5rem`) | Endpoint cards, `<pre><code>` blocks |
| `radius-full` | 9999px | Circle indicators & user role tags |

---

## 4. Component Conventions

The documentation page is constructed strictly with standard, semantic HTML5 elements without third-party framework overhead:

1. **Endpoint Card (`<details class="endpoint-card">`)**:
   * Summary line contains: Method badge (`<span class="badge badge-get">GET</span>`), Path (`<code>/api/auth/me</code>`), Access pill (`<span class="tag">Signed in</span>`), and Short description.
2. **Parameters Table (`<table class="params-table">`)**:
   * Simple HTML table listing `Field`, `Type`, `Required`, and `Description`.
3. **Payload Code Block (`<pre><code class="language-json">`)**:
   * Dark background (`color-surface-code`), monospace text (`color-text-code`), containing formatted JSON request/response examples.
4. **Status Code Badges (`<span class="status-code status-200">200 OK</span>`)**:
   * Color-coded pills displaying the return HTTP status code.

---

## 5. Layout Patterns

The HTML documentation page follows a single-page clean responsive layout:

```
+------------------------------------------------------------------+
| HEADER (Logo: Gloxad Academy API | Base: http://localhost:3001)  |
+------------------------------------------------------------------+
| MAIN CONTAINER (Max-width: 1100px, Margin: 0 auto)               |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | SECTION 1: Authentication                                  |  |
|  |   [POST] /api/auth/signup  (Student / Tutor Registration)  |  |
|  |   [POST] /api/auth/signin  (User Login & JWT Issue)        |  |
|  |   [GET]  /api/auth/me      (Get Current User Details)      |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | SECTION 2: Course Catalog & Discovery                      |  |
|  |   [GET]  /api/courses      (Search & Filter Courses)       |  |
|  |   [GET]  /api/courses/:id  (Single Course Details)         |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 6. Engineering Symbol & Icon Conventions

To maintain a minimal footprint without loading heavy icon fonts or libraries, use native Unicode engineering symbols:

* `⚡` **Base API**: Represents endpoint base URL (`http://localhost:3001/api`).
* `🔒` **Auth Guard**: Indicates protected routes requiring `Authorization: Bearer <token>`.
* `👤` **Student Role**: Indicates student-accessible routes.
* `👨‍🏫` **Instructor Role**: Indicates tutor-accessible routes (`role=instructor`).
* `🛡️` **Admin Role**: Indicates admin-only routes (`role=admin`).
* `📋` **Payload**: Request Body JSON section.
* `📤` **Response**: Response JSON section.
