# Copilot Instructions for CNAM-VMS

## Project Overview

**CNAM-VMS** is a Next.js-based volunteer management system for the City of Norwich Aviation Museum. It provides two-factor authentication, capability-based access control, scheduling, team management, training tracking, audit logging, and file management.

### Tech Stack
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: SQLite with SQLCipher encryption (`better-sqlite3-multiple-ciphers`)
- **Auth**: Next.js Auth.js (v5 beta) with email + OTP verification
- **UI**: React 19, Tailwind CSS
- **Styling**: PostCSS with Tailwind
- **Build**: Standalone output for lightweight deployments

## Build, Test & Lint Commands

### Development
```bash
npm run dev              # Start dev server on port 3001 (or $PORT env var)
npm run typecheck       # Type-check without emitting (watch-friendly alternative to build)
```

### Production
```bash
npm run build           # Build for production (memory-limited to 512MB)
npm start               # Run production server (uses .next/standalone/server.js)
```

### Code Quality
```bash
npm run lint            # Run ESLint (uses Next.js core-web-vitals config)
```

### Database Management
```bash
npm run db:seed                      # Create root user and initialize capabilities/roles
npm run db:set-initial-password      # Set root user's initial password
npm run db:reset-password            # Reset password for a user
npm run db:create-user               # Create a new user from CLI
```

## Architecture

### Page Organization (Next.js App Router)

Pages are organized by feature/role under `src/app/`:

- **`/auth/`** — Login, OTP verification, password reset flows; public pages
- **`/api/`** — Internal API routes (auth callbacks, file upload/download, auth routes)
- **`/admin/`** — Protected admin panel (users, roles, teams, schedule, training, content management)
- **`/dashboard/`** — Home page for signed-in users
- **`/profile/`** — User self-service settings
- **`/schedule/`** — Calendar and event management
- **`/teams/`** — Team and task overview
- **`/announcements/`** — Public announcements feed
- **`/volunteer/`** — Volunteer availability tracking
- **`/files/`** — File library (upload, browse, download)

### Database & ORM

The application uses **raw SQL** with `better-sqlite3` (not an ORM like Prisma). Database access is centralized in `src/lib/db.ts`:

- **Encryption**: SQLCipher (AES-256) via `DB_ENCRYPTION_KEY` environment variable
- **Schema**: Initialized on first connection in `db.ts` using `db.exec()`
- **Singleton pattern**: Global database instance reused across Hot Module Replacement cycles
- **Data types**: Timestamps stored as ISO 8601 strings; booleans as 0/1 integers

### Authentication & Authorization

**Auth.js (NextAuth.js v5)** configuration in `src/auth.ts`:

- **Provider**: Credentials-based (email + hashed password)
- **JWT Caching**: Capabilities and user status are cached in JWT with a 5-minute TTL to reduce DB queries
- **Capabilities System**: Fine-grained permissions (not roles) control access; stored in a many-to-many relationship: `user_roles` → `role_capabilities` → `capabilities`
- **Custom Adapter**: `src/lib/auth-adapter.ts` implements the NextAuth adapter for SQLite
- **Password Hashing**: bcrypt (see `src/lib/password.ts`)

### API Routes

- **`/api/auth/*`** — Handled by Auth.js (signin, callback, signout, session)
- **`/api/upload`** — File upload endpoint (multipart form-data)
- **`/api/files/:id`** — Secure file download with authorization checks

### Shared Utilities

Key modules in `src/lib/`:

- **`db.ts`** — Database singleton, schema initialization, helper functions
- **`db-types.ts`** — TypeScript types for database rows
- **`auth-helpers.ts`** — Session and authorization helpers (e.g., `requireCapability()`, `requireRole()`)
- **`capabilities.ts`** — Capability definitions (e.g., 'admin.users.view')
- **`mail.ts`** — Nodemailer setup (with log-only stub fallback when no SMTP configured)
- **`notifications.ts`** — High-level notification abstraction (email events)
- **`calendar.ts`** — Calendar utilities for scheduling
- **`uploads.ts`** — File upload validation and storage
- **`audit.ts`** — Audit log recording for key actions

### Component Structure

Shared components in `src/components/` are minimal—mostly layout/navigation:

- `NavBar.tsx` — Header navigation and user menu
- `MobileMenu.tsx` — Mobile-responsive navigation
- `UploadForm.tsx` — Reusable file upload UI

## Key Conventions

### TypeScript & Strict Mode

- **Strict mode is enabled**; use explicit types, avoid `any`
- **Path aliases**: Use `@/` for imports from `src/` (configured in `tsconfig.json`)
- **Type declarations**: DB row types live in `src/types/db-types.ts`; API types in respective route files

### Database

- **Timestamps**: Always ISO 8601 strings (`TEXT` columns); helpers: `now()` returns current ISO string, `packTs()` formats dates
- **Booleans**: Stored as integers (0/1); use `packBool()` / `unpackBool()` converters
- **IDs**: CUID2 (generated by `@paralleldrive/cuid2`); always `TEXT` columns, always unique constraints
- **Queries**: Use `db.prepare()` for typed statements; bind parameters with `?` placeholders
- **Transactions**: Wrap multi-step operations in `db.transaction()` to ensure atomicity

### Security & CSP

- **Content Security Policy**: Configured in `next.config.mjs`; allows inline scripts/styles (Next.js requirement)
- **Headers**: Includes X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and others
- **HTTPS & TLS**: The app runs behind a Cloudflare tunnel (plain HTTP internally); HSTS intentionally omitted
- **Password resets**: Links include signed tokens; valid for a short period only

### Environment Variables

All required config is in `.env` (copy from `.env.example`). Key categories:

- **Database**: `DATABASE_URL`, `DB_ENCRYPTION_KEY`
- **Auth**: `AUTH_SECRET`, `AUTH_URL`
- **Email**: `EMAIL_SERVER_*`, `EMAIL_FROM` (or omit to print email to logs)
- **Bootstrap**: `ROOT_USER_EMAIL`, `ROOT_USER_NAME`
- **File uploads**: `UPLOAD_DIR`, `UPLOAD_MAX_SIZE_MB`
- **Server**: `PORT` (defaults to 3001)

## Deployment Notes

- **Standalone build**: `npm run build` produces `/.next/standalone/` + copied assets; deploy only that folder
- **Memory**: Build is limited to 512 MB (see `package.json` `build` script)
- **File uploads**: Must be writable by the Node process (usually `/var/uploads/cnam-vms`)
- **Process manager**: PM2 or similar for process supervision
- **See `docs/deployment.md`** for full server setup (Nginx reverse proxy, etc.)

## Common Tasks

### Add a new capability/permission
1. Define the capability in `src/lib/capabilities.ts` (e.g., `'admin.users.edit'`)
2. Insert into the `capabilities` table in a seed script or manually
3. Assign to roles via `role_capabilities` join table
4. Use `requireCapability()` in route handlers

### Create a new admin page
1. Create folder under `src/app/admin/` (e.g., `src/app/admin/new-feature/`)
2. Add `page.tsx` with a client/server component
3. Wrap with `requireCapability('admin.new-feature.view')` at the top
4. Use shared nav; pages inherit layout from `src/app/admin/layout.tsx`

### Send an email notification
1. Call `notifyUser()` from `src/lib/notifications.ts`
2. It abstracts over `mail.ts` (Nodemailer)
3. In development, email is printed to server logs if no SMTP is configured

### Add a database table
1. Add `CREATE TABLE IF NOT EXISTS ...` statement to `initSchema()` in `src/lib/db.ts`
2. Add corresponding type definition to `src/types/db-types.ts`
3. Export helper queries from `src/lib/db.ts` if needed

## Testing & Debugging

- **No automated test suite exists** — tests would be welcome but are not currently implemented
- **Type checking**: `npm run typecheck` is fast and catches many issues before runtime
- **Development**: Use `npm run dev` to test locally; logs include email output if SMTP is not configured
- **Database debugging**: SQLite commands can be run directly; schema is always readable in `src/lib/db.ts`
