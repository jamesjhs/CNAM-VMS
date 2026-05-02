# CNAM-VMS Technical Architecture & Information Flows

**Version 0.5.1 — May 2026**

This document provides a comprehensive technical overview of the CNAM-VMS system, including architecture, information flows, dependencies, database schema, and key functions. It is intended for developers, system architects, and technical administrators.

---

## 1. System Architecture Overview

### High-Level Architecture Layers

The CNAM-VMS follows a three-tier architecture:

1. **Presentation Layer** — React components running in the browser
2. **Application Layer** — Next.js server with business logic, Auth.js middleware, and API routes
3. **Data Layer** — SQLite database with SQLCipher encryption

### Technology Stack by Layer

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Client** | React 19 + TypeScript | UI rendering |
| **Client Styling** | Tailwind CSS + PostCSS | Component styling |
| **Server** | Next.js 16 App Router | Page routing & API |
| **Auth** | Auth.js v5 (NextAuth) | Authentication & sessions |
| **Database** | SQLite + better-sqlite3 | Data persistence |
| **Encryption** | SQLCipher (AES-256) | Database encryption at-rest |
| **Email** | Nodemailer | OTP & password reset emails |
| **ID Generation** | CUID2 | Unique identifiers |

---

## 2. Information Flows

### 2.1 User Sign-In Flow

```
1. User enters email + password on signin page
2. Browser POSTs to /api/auth/signin
3. Next.js validates credentials against bcrypt hash in DB
4. On success: generate 6-digit OTP code
5. Send OTP via email (Nodemailer → SMTP)
6. Return temporary session token
7. User enters OTP on verify page
8. Browser POSTs to /api/auth/verify with OTP + temp token
9. Server validates OTP against database
10. On success: create JWT token (contains user ID + cached capabilities)
11. Store session in DB; return JWT in Set-Cookie header
12. Browser redirected to /dashboard with authenticated session
```

**Files involved:**
- `src/auth.ts` — Auth.js configuration & providers
- `src/lib/auth-adapter.ts` — SQLite session adapter
- `src/app/auth/signin/page.tsx` — Sign-in UI
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js handler

### 2.2 Capability-Based Access Control

```
1. When user signs in, JWT token contains:
   - userId
   - userStatus (PENDING, ACTIVE, SUSPENDED)
   - mustChangePassword (boolean)
   - capabilities: ['admin.users.read', 'admin.users.write', ...]

2. Capability cache TTL = 5 minutes
   - For 5 minutes: capabilities read from JWT (no DB hit)
   - After 5 minutes: next request queries DB for fresh capabilities
   - Allows rapid permission changes without forcing re-login

3. When accessing protected route:
   - Middleware calls fetchUserClaims() to get current capabilities
   - Route handler calls requireCapability('admin.users.read')
   - If missing: returns 403 Forbidden

4. Capabilities stored as many-to-many:
   user → user_roles → roles ← role_capabilities ← capabilities
```

**Files involved:**
- `src/auth.ts` — Capability caching logic
- `src/lib/auth-helpers.ts` — requireCapability(), requireRole()
- `src/lib/capabilities.ts` — Capability definitions
- `src/lib/db.ts` — Capability queries

### 2.3 Event Sign-Up Flow

```
1. User views calendar at /schedule
2. Browser GETs /schedule; server queries events table for current month
3. User clicks day in calendar; panel shows events for that day
4. User clicks "Sign up" for specific event
5. Browser POSTs to /api/events/signup with eventId
6. Server:
   a. Checks user is ACTIVE status
   b. Queries event table for max volunteers
   c. Counts current signups
   d. If space available: inserts into event_signups table
   e. Records audit log entry
   f. Returns success response
7. Browser updates UI (button changes to "Withdraw")
8. If user clicks "Withdraw":
   - Server deletes from event_signups
   - Records audit log
```

**Files involved:**
- `src/app/schedule/page.tsx` — Calendar UI
- `src/app/api/events/route.ts` — Event queries
- `src/lib/calendar.ts` — Calendar utilities
- `src/lib/audit.ts` — Audit logging

### 2.4 File Upload & Download Flow

**Upload:**
```
1. Admin navigates to /admin/upload
2. Selects file from computer (multipart form-data)
3. Browser POSTs to /api/upload
4. Server:
   a. Validates file type against whitelist
   b. Validates file size ≤ UPLOAD_MAX_SIZE_MB
   c. Saves to UPLOAD_DIR on disk
   d. Generates CUID2 identifier
   e. Records entry in uploaded_files table
   f. Logs audit event: "file.uploaded"
5. Returns file ID + metadata
6. File immediately appears in File Library for all users
```

**Download:**
```
1. User navigates to /files
2. Server queries uploaded_files table; returns list to browser
3. User clicks "Download" on specific file
4. Browser GETs /api/files/{fileId}
5. Server:
   a. Queries uploaded_files table
   b. Checks user is signed in (implicit via middleware)
   c. Reads file from disk
   d. Streams to browser with correct Content-Type & Content-Disposition
6. Browser saves file to user's Downloads folder
```

**Files involved:**
- `src/lib/uploads.ts` — Validation & storage logic
- `src/app/api/upload/route.ts` — Upload handler
- `src/app/api/files/[id]/route.ts` — Download handler
- `src/app/files/page.tsx` — File library UI

### 2.5 Email Notification Flow

```
1. Application needs to notify user (e.g., OTP, password reset)
2. Calls notifyUser(userId, 'otp', data)
3. mail.ts creates Nodemailer transport:
   - If SMTP configured: uses real SMTP
   - If not: uses log-only stub (prints to console in dev)
4. Sends email via SMTP to user's email address
5. If delivery fails: error logged; notification not retried (fire-and-forget)
```

**Files involved:**
- `src/lib/notifications.ts` — High-level API
- `src/lib/mail.ts` — Nodemailer setup

### 2.6 Audit Logging Flow

**Every protected action triggers audit log:**
```
1. Admin creates a user via /admin/users
2. Route handler calls logAudit('user.created', 'user', newUserId, {email, name})
3. logAudit() inserts row into audit_log table:
   - id: CUID2
   - actor: current user's email
   - action: 'user.created'
   - resourceType: 'user'
   - resourceId: new user's ID
   - details: JSON object with changes
   - createdAt: current timestamp (ISO 8601)
4. Admin can view full log at /admin/audit
5. Logs are paginated; can be filtered by date range, actor, action
```

**Files involved:**
- `src/lib/audit.ts` — logAudit() function
- `src/app/admin/audit/page.tsx` — Audit log viewer

---

## 3. Database Schema Overview

### 3.1 Core Tables

**Users & Authentication**
```sql
-- Main user account
users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  status TEXT, -- PENDING, ACTIVE, SUSPENDED
  accountType TEXT, -- VOLUNTEER, STAFF, MEMBER
  passwordHash TEXT, -- bcrypt
  mustChangePassword INTEGER, -- boolean
  createdAt TEXT, -- ISO 8601
  updatedAt TEXT
)

-- OAuth providers (currently unused, but framework in place)
accounts (
  id, userId, type, provider, providerAccountId, ...
)

-- Authorization via roles
roles (id, name, description, ...)
user_roles (userId, roleId)
role_capabilities (roleId, capabilityId)
capabilities (id, key, description) -- e.g., 'admin.users.read'
```

**Scheduling**
```sql
events (
  id, title, description, startTime, endTime,
  maxVolunteers, location, eventType, ...
)

event_signups (
  id, eventId, userId, signupTime, status, ...
  UNIQUE(eventId, userId)
)

volunteer_availability (
  id, userId, activities (JSON), notes, updatedAt
)
```

**Teams & Tasks**
```sql
teams (id, name, description, leaderId, ...)
team_members (id, teamId, userId, joinedAt)
team_tasks (
  id, teamId, title, description, urgency,
  taskType, membersNeeded, supervisorRequired, status, ...
)
team_work_logs (id, taskId, userId, hoursSpent, notes, ...)
```

**Content**
```sql
announcements (id, title, content, isPinned, createdBy, createdAt, ...)
uploaded_files (
  id, filename, originalName, mimeType, fileSize,
  uploadedBy, uploadedAt, ...
)
site_content (key, content, updatedAt) -- 'privacy-policy', etc.
```

**Session & Audit**
```sql
sessions (id, userId, expiresAt, createdAt)
jwt_tokens (id, userId, token, expiresAt, createdAt) -- if needed
audit_log (
  id, actor, action, resourceType, resourceId,
  details (JSON), createdAt
)
```

### 3.2 Key Relationships

```
User
  ├─ (1:M) user_roles → Role
  │         ├─ (M:M) role_capabilities → Capability
  │         └─ (M:M) team_members → Team
  ├─ (1:M) event_signups → Event
  ├─ (1:1) volunteer_availability
  ├─ (1:M) uploaded_files (uploaded by)
  ├─ (1:M) team_work_logs (work done by)
  └─ (1:M) audit_log (actions by)

Team
  ├─ (1:M) team_members → User
  ├─ (1:M) team_tasks → TeamTask
  └─ (M:M) team_leaders → User (via leaderId foreign key)

Event
  └─ (1:M) event_signups → User
```

---

## 4. Key Files & Module Responsibilities

### 4.1 Core Application Files

| File | Lines | Responsibility |
|------|-------|-----------------|
| `src/auth.ts` | ~150 | Auth.js config; JWT caching; OTP verification |
| `src/lib/db.ts` | ~300 | SQLite singleton; schema init; query helpers |
| `src/lib/auth-adapter.ts` | ~200 | SQLite adapter for Auth.js (sessions) |
| `src/lib/auth-helpers.ts` | ~100 | Middleware guards (requireCapability, etc.) |
| `src/lib/capabilities.ts` | ~50 | Capability constants |
| `src/lib/password.ts` | ~30 | bcrypt hashing |
| `src/lib/mail.ts` | ~50 | Nodemailer setup |
| `src/lib/notifications.ts` | ~60 | High-level notification API |
| `src/lib/audit.ts` | ~30 | Audit log recording |
| `src/lib/uploads.ts` | ~80 | File validation & storage |
| `src/lib/calendar.ts` | ~100 | Calendar utilities |

### 4.2 Page Components

| Path | Type | Responsibility |
|------|------|-----------------|
| `src/app/auth/signin/page.tsx` | Page | Email + password form |
| `src/app/auth/verify-otp/page.tsx` | Page | 6-digit OTP entry |
| `src/app/auth/change-password/page.tsx` | Page | Password change form |
| `src/app/dashboard/page.tsx` | Page | User home page |
| `src/app/schedule/page.tsx` | Page | Calendar & event signup |
| `src/app/teams/page.tsx` | Page | Teams list & task details |
| `src/app/profile/page.tsx` | Page | User profile editing |
| `src/app/files/page.tsx` | Page | File library UI |
| `src/app/announcements/page.tsx` | Page | Announcements feed |
| `src/app/admin/*` | Pages | Admin panel (users, roles, audit, etc.) |

### 4.3 API Routes

| Route | Method | Responsibility |
|-------|--------|-----------------|
| `/api/auth/[...nextauth]` | GET, POST | Auth.js handlers (signin, callback, signout) |
| `/api/upload` | POST | File upload |
| `/api/files/:id` | GET | File download |
| `/api/events` | GET | List events |
| `/api/events/signup` | POST | Sign up for event |
| `/api/events/withdraw` | POST | Withdraw from event |

---

## 5. Key Functions & Exports

### 5.1 Database Module (src/lib/db.ts)

```typescript
export function getDb(): Database
  // Returns singleton SQLite connection
  // Initializes schema on first call
  // Uses global symbol to survive HMR

export function now(): string
  // Returns current ISO 8601 timestamp
  // Used for all createdAt/updatedAt fields

export function packBool(value: boolean): number
  // Converts boolean to 0/1 for SQLite
  // Example: packBool(true) → 1

export function unpackBool(value: number): boolean
  // Converts 0/1 back to boolean
  // Example: unpackBool(1) → true

export function packTs(date: Date): string
  // Converts Date object to ISO 8601 string
  // Example: packTs(new Date()) → '2026-05-02T16:01:29.356Z'

export function initSchema(db: Database): void
  // Called automatically on first getDb() call
  // Creates all tables with IF NOT EXISTS
```

### 5.2 Auth Module (src/lib/auth-helpers.ts)

```typescript
export async function requireSession(request: NextRequest)
  // Returns session object or throws 401
  // Extracts from JWT cookie

export async function requireCapability(cap: string, request: NextRequest)
  // Checks user has specified capability
  // Throws 403 if missing
  // Refreshes JWT if cache TTL exceeded

export async function requireRole(role: string, request: NextRequest)
  // Checks user has specified role
  // Throws 403 if missing

export async function getCurrentUser(request: NextRequest): Promise<User | null>
  // Returns current user object or null if not authenticated

export async function logAudit(
  actor: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>
): Promise<void>
  // Records action in audit_log table
  // Called by admin actions
```

### 5.3 Notifications Module (src/lib/notifications.ts)

```typescript
export async function notifyUser(
  userId: string,
  type: 'otp' | 'password-reset' | 'event-reminder',
  data: Record<string, any>
): Promise<void>
  // Sends email via mail.ts
  // Falls back to console.log if SMTP not configured
  // Type determines email template
```

### 5.4 Uploads Module (src/lib/uploads.ts)

```typescript
export function validateUpload(filename: string, size: number)
  : { valid: boolean; error?: string }
  // Validates file type (whitelist) and size
  // Returns validation result

export async function storeUpload(file: File, userId: string)
  : Promise<{ id: string; filename: string }>
  // Saves file to UPLOAD_DIR
  // Records in uploaded_files table
  // Returns file ID for retrieval

export async function getFileForDownload(fileId: string)
  : Promise<{ path: string; filename: string; mimeType: string }>
  // Queries uploaded_files table
  // Returns full path for streaming
```

---

## 6. Data Types & TypeScript Interfaces

All database row types defined in `src/types/db-types.ts`:

```typescript
type User = {
  id: string;
  email: string;
  name?: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  accountType: 'VOLUNTEER' | 'STAFF' | 'MEMBER';
  passwordHash?: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

type Event = {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  maxVolunteers?: number;
  location?: string;
};

type EventSignup = {
  id: string;
  eventId: string;
  userId: string;
  signupTime: string;
  status: 'SIGNED_UP' | 'WITHDRAWN';
};

// ... and more
```

---

## 7. Deployment & Build Process

### 7.1 Build Output

```
npm run build
  ↓
Compiles TypeScript + React
  ↓
next build (with --max-old-space-size=512)
  ↓
Outputs:
  .next/                     (build artifacts)
  .next/standalone/          (self-contained server)
  .next/standalone/server.js (entry point)
  .next/standalone/.next/static/ (assets)
  .next/standalone/public/   (static files)
```

### 7.2 Production Deployment

Copy **only** `.next/standalone/` and `public/` to server:

```bash
# On production server:
cd /app/cnam-vms
node .next/standalone/server.js
# Listens on PORT (default 3001)
```

Can be managed with PM2:
```bash
npm install -g pm2
pm2 start .next/standalone/server.js \
  --name cnam-vms \
  --env production \
  --error /var/log/cnam-vms.log \
  --output /var/log/cnam-vms.log
```

### 7.3 Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL="file:./data/cnam-vms.db"
DB_ENCRYPTION_KEY="$(openssl rand -base64 32)"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="https://vms.example.com"
# ... SMTP, file upload, bootstrap variables
```

Initialize database:
```bash
npm run db:seed
```

---

## 8. Security Architecture

### 8.1 Encryption

- **Database at-rest**: AES-256 via SQLCipher (DB_ENCRYPTION_KEY env var)
- **Passwords**: bcrypt (cost factor 12)
- **JWT tokens**: Signed with AUTH_SECRET
- **In-transit**: HTTPS via Cloudflare tunnel (TLS 1.3)

### 8.2 Access Control

- **Authentication**: Email + OTP (two-factor)
- **Authorization**: Capability-based access control (RBAC derivative)
- **Session management**: JWT in httpOnly cookies (not localStorage)
- **CSRF**: Built into Auth.js middleware

### 8.3 Input Validation

- **File uploads**: Type whitelist + size limit + filename sanitization
- **SQL queries**: Prepared statements with parameter binding (no string interpolation)
- **API inputs**: Validated in route handlers before DB operations
- **Audit logging**: All admin actions logged with full context

### 8.4 Security Headers

Set in `next.config.mjs`:
- **X-Frame-Options**: DENY (no iframe embedding)
- **X-Content-Type-Options**: nosniff (prevent MIME sniffing)
- **Content-Security-Policy**: Strict (no external scripts)
- **Permissions-Policy**: Disable camera, mic, geolocation
- **Referrer-Policy**: strict-origin-when-cross-origin

---

## 9. Performance Optimization

### 9.1 Database Optimization

- **Singleton connection**: Single SQLite connection reused across requests (persists in Node.js global)
- **Prepared statements**: Pre-compiled SQL; parameter binding avoids re-parsing
- **Indexes**: Created on foreign keys and common query columns
- **Transactions**: Used for multi-step operations (atomicity)

### 9.2 Application Optimization

- **JWT capability cache**: 5-minute TTL reduces DB queries by ~95%
- **Standalone build**: Eliminates unused dependencies; reduces deployment size
- **Tree-shaking**: Next.js optimizes next-auth imports
- **No source maps in prod**: Reduces build size and memory usage
- **Next.js static optimization**: Pages rendered on-demand (no pre-build)

### 9.3 Frontend Optimization

- **Tailwind CSS**: Purged to only used classes
- **React Server Components**: Most pages rendered server-side (no JS bloat)
- **Streaming**: Large responses streamed to reduce TTFB
- **Caching**: ETag headers for static assets

---

## 10. Monitoring & Troubleshooting

### 10.1 Logging

- **Server logs**: Errors, warnings, info (console.log in Next.js)
- **Email logs**: If SMTP disabled, emails printed to stdout (server logs)
- **Audit log**: All admin actions in DB (queryable via /admin/audit)
- **PM2 logs**: If running under PM2, logs in /var/log/cnam-vms.log

### 10.2 Common Issues

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Database locked | Another process has DB open | Restart server; check no migrations running |
| Auth middleware error | JWT signature invalid or corrupt | Clear cookies; re-login; check AUTH_SECRET hasn't changed |
| Email not sending | SMTP misconfigured or network issue | Check EMAIL_SERVER_* variables; test with `telnet smtp.host 587` |
| File upload fails | Wrong file type or exceeds size | Verify UPLOAD_MAX_SIZE_MB; check MIME type whitelist in uploads.ts |
| Out of memory on build | Node allocation too low | Already set to 512 MB; if persists, increase server RAM or defer dependencies |

---

## 11. Development Workflow

### 11.1 Local Development

```bash
# Install dependencies
npm ci

# Start dev server with hot-reload
npm run dev
# Server runs on http://localhost:3001

# Type-check (recommended before commits)
npm run typecheck

# Lint code
npm run lint

# Run database seed (creates root user + roles)
npm run db:seed
```

### 11.2 Testing Strategy

Currently: **no automated tests**.

Recommended approach for future:
- **Unit tests** (Jest) for utilities: password hashing, calendar logic, file validation
- **Integration tests** (Playwright) for critical flows: signin → event signup → file download
- **E2E tests** (Playwright) for admin workflows: user creation → role assignment → audit log

### 11.3 Code Organization

- **Pages** under `/app` — use Server Components by default; minimal client logic
- **Utilities** under `/lib` — pure functions, database queries, business logic
- **Types** in `/types` and inline — avoid generic `any` type
- **Components** under `/components` — shared UI (mostly layout/nav); most features are page-specific
- **API routes** under `/api` — thin layer; delegate to `/lib` functions

---

## 12. Future Considerations

### 12.1 Scalability Limits

- **SQLite**: Single-file, lock-based concurrency. Can handle ~100 concurrent users; beyond that consider PostgreSQL migration
- **File uploads**: Stored on local disk; at scale consider cloud storage (S3) + reference in DB
- **Email**: Currently synchronous; at scale consider job queue (Bull/RabbitMQ) for fire-and-forget

### 12.2 Potential Enhancements

- OAuth integration (Google, GitHub already in schema)
- Real-time notifications via WebSocket or Server-Sent Events
- Advanced scheduling algorithms (conflict detection, volunteer matching)
- Mobile app via React Native or Flutter
- Analytics & reporting dashboard
- Integration with external calendar systems (Google Calendar, Outlook)

---

## Appendix: Quick Reference

### Environment Variables Checklist
- [ ] `DATABASE_URL` — SQLite file path
- [ ] `DB_ENCRYPTION_KEY` — 32-byte base64 string (use `openssl rand -base64 32`)
- [ ] `AUTH_SECRET` — 32-byte base64 string (use `openssl rand -base64 32`)
- [ ] `AUTH_URL` — Public URL (e.g., https://vms.example.com)
- [ ] `EMAIL_SERVER_*` — SMTP credentials (optional; logs to console if unset)
- [ ] `UPLOAD_DIR` — Writable directory for file uploads
- [ ] `UPLOAD_MAX_SIZE_MB` — Max file size (default 10)
- [ ] `PORT` — Server port (default 3001)

### Package.json Scripts
- `npm run dev` — Development server
- `npm run build` — Production build
- `npm start` — Run production server
- `npm run lint` — Lint code
- `npm run typecheck` — Type-check without emitting
- `npm run db:seed` — Initialize database
- `npm run db:set-initial-password` — Set root password
- `npm run db:reset-password` — Reset user password
- `npm run db:create-user` — Create user from CLI

### Key Capabilities (Permissions)
- `admin:users.read` — View users
- `admin:users.write` — Create/edit/delete users
- `admin:roles.read` — View roles
- `admin:roles.write` — Create/edit/delete roles
- `admin:teams.read` — View teams
- `admin:teams.write` — Manage teams
- `admin:audit.read` — View audit log
- `admin:files.read` — View files
- `admin:files.write` — Upload files
- `admin:announcements.write` — Create announcements
- `admin:training.write` — Manage training data
- `admin:content.write` — Edit site content (privacy policy, etc.)

---

**Document version:** 0.5.0  
**Last updated:** May 2026  
**For questions or corrections:** Contact the development team
