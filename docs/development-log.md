# CNAM-VMS Development Log

**City of Norwich Aviation Museum — Volunteer Management System**

This log records the development history of the VMS: what has been built, decisions made, issues encountered, and what is planned next. It is kept updated automatically by the GitHub Copilot Agent with each development session.

---

## How to Read This Log

Entries are listed in reverse chronological order (newest first). Each entry records:

- **What was done** — features built, bugs fixed, or documentation added
- **Decisions** — why things were done a certain way
- **Known issues or limitations** at the time of writing
- **Next steps** — what has been identified as coming next

---

## 4 March 2026 — Initial Documentation

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

- Created `docs/startup-guide.md` — a plain-English step-by-step guide for administrators to install, configure, and start the application on a server for the first time. Covers Node.js and PostgreSQL prerequisites, environment variable configuration, database migration, seeding, PM2 setup, troubleshooting, and backups.
- Created `docs/user-manual.md` — a jargon-free, UK English instruction manual aimed at volunteers and administrators who use the system day to day. Covers all currently implemented features: signing in, the dashboard, the admin panel, file uploads, signing out, and account statuses.
- Created this `docs/development-log.md` to record development history going forward.
- Updated `docs/deployment.md` to clarify the reason the `--legacy-peer-deps` flag is needed (peer dependency constraints in the Auth.js v5 beta).
- Fixed the `scripts/restore.sh` restore script — `pg_restore` was called with the `DATABASE_URL` as a positional argument instead of via the correct `--dbname` flag.
- Removed a broken link on the sign-in page that pointed to `/auth/signup` (a page that does not yet exist), replacing it with a note directing users to contact their administrator.
- Standardised use of `npm ci` (rather than `npm install`) throughout the README and deployment documentation.

**Decisions:**

- Documentation is written in UK English throughout, following the brief from the museum.
- The startup guide assumes Ubuntu 22.04 as the server OS, as this is the most commonly used LTS Linux distribution for hosting. Steps should work on similar distributions.
- The development log is ordered newest-first to make it easy to see what is current without scrolling to the bottom.

**Known limitations at this stage:**

- Task management, scheduling, and announcements are visible as cards on the dashboard but are not yet functional — they link to `#` (a placeholder). These will be implemented in a future session.
- There is no user management UI yet — administrators cannot add, approve, or suspend users through the web interface; this currently requires direct database access.
- Roles and capabilities cannot yet be managed through the web interface.
- There is no way for a new volunteer to request access through the website — they need to contact an administrator who must add them directly to the database.

**Next steps identified:**

- [ ] Build user management screens in the admin panel (list users, approve/suspend, assign roles)
- [ ] Build role and capability management screens
- [ ] Implement task management (create, assign, complete tasks)
- [ ] Implement scheduling / shift calendar
- [ ] Implement announcements
- [ ] Add a "request access" form so new volunteers can self-register (pending admin approval)
- [ ] Build a file library page so uploaded documents can be browsed and downloaded
- [ ] Add profile page where volunteers can update their name and contact details
- [ ] Set up automated testing

---

## 4 March 2026 — Initial Application Build

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Built the complete initial version of the CNAM-VMS from scratch. The repository previously contained only a README and `.gitignore` file. The following was implemented:

### Infrastructure and configuration

- `package.json` — project metadata, scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`)
- `tsconfig.json` and `tsconfig.seed.json` — TypeScript configuration for the application and the database seed script respectively
- `next.config.mjs` — Next.js configuration
- `tailwind.config.ts` and `postcss.config.js` — Tailwind CSS styling setup
- `.eslintrc.json` — code quality rules
- `.env.example` — documented template for all environment variables
- `.gitignore` — extended to exclude `node_modules`, `.next`, `uploads`, `.env`, and `tsconfig.tsbuildinfo`

### Database (Prisma + PostgreSQL)

Schema defined in `prisma/schema.prisma` with eight models:

| Model | Purpose |
|---|---|
| `User` | A person who uses the system. Has a `status` field: `PENDING`, `ACTIVE`, or `SUSPENDED`. |
| `Account` | Linked authentication provider accounts (Auth.js internal) |
| `Session` | Active login sessions (Auth.js internal) |
| `VerificationToken` | Magic link tokens for email sign-in (Auth.js internal) |
| `Role` | A named collection of permissions (e.g. "Root", "Volunteer") |
| `Capability` | An individual permission, identified by a dot-notation key (e.g. `admin:users.write`) |
| `RoleCapability` | Links roles to the capabilities they grant |
| `UserRole` | Links users to the roles they hold |
| `AuditLog` | A time-stamped record of every significant action in the system |
| `FileAsset` | Metadata about each uploaded file |

**Seed script** (`prisma/seed.ts`): Creates two built-in roles and ten capabilities, and creates the first administrator user from the `ROOT_USER_EMAIL` environment variable.

Initial capabilities created:

| Capability key | What it allows |
|---|---|
| `admin:users.read` | View all users |
| `admin:users.write` | Create, update, and delete users |
| `admin:roles.read` | View roles and capabilities |
| `admin:roles.write` | Create, update, and delete roles |
| `admin:audit.read` | View audit logs |
| `admin:files.read` | View all uploaded files |
| `admin:files.write` | Upload and manage files |
| `admin:theme.write` | Manage site theme and settings |
| `volunteer:tasks.read` | View tasks |
| `volunteer:tasks.write` | Create and update tasks |

### Authentication (Auth.js v5)

- Passwordless email sign-in using "magic links" (a secure link sent by email — no password required)
- Email addresses are normalised to lowercase, so `James@EXAMPLE.COM` and `james@example.com` are treated as the same account
- `SUSPENDED` users are blocked from signing in and see an appropriate error message
- New users who sign in for the first time are created automatically with `PENDING` status (awaiting admin approval)
- Custom pages for sign-in, email verification confirmation, errors, and access-denied

### Authorisation

Helper functions in `src/lib/auth-helpers.ts`:

- `requireAuth()` — ensures a page is only accessible to signed-in users
- `requireCapability(key)` — ensures a page is only accessible to users with a specific capability
- `requireActiveUser()` — ensures a page is only accessible to users with `ACTIVE` status
- `hasCapability(user, key)` — checks whether a user has a given capability (returns true/false)
- `hasAnyCapability(user, keys)` — checks whether a user has any of a list of capabilities

Capabilities are attached to the user's session when they sign in, so page-level checks are fast and do not require an extra database query on every page load.

### Pages

| URL | Who can access | What it does |
|---|---|---|
| `/` | Anyone | Landing page with sign-in link |
| `/auth/signin` | Anyone | Email sign-in form |
| `/auth/verify-request` | Anyone | "Check your email" confirmation |
| `/auth/error` | Anyone | Displays sign-in errors |
| `/dashboard` | Signed-in users | Personal dashboard with task, schedule, and announcements cards |
| `/admin` | Users with `admin:users.read` | Admin panel: stats, user info, recent audit log |
| `/upload` | Users with `admin:files.write` | File upload form |
| `/unauthorized` | Anyone | Shown when a user tries to access a page they do not have permission for |

### File uploads

- API endpoint `POST /api/upload`
- Only accessible to users with the `admin:files.write` capability
- Validates file type by both extension and MIME type
- Prevents malicious path traversal (i.e. a file cannot be saved outside the designated upload folder)
- Maximum file size is configurable via `UPLOAD_MAX_SIZE_MB` (default: 10 MB)
- Allowed file types: JPEG, PNG, GIF, WebP (images); PDF; Word (DOCX); Excel (XLSX); CSV; plain text
- File metadata is stored in the `FileAsset` table; the actual files are stored on disk

### Notifications

`src/lib/notifications.ts` provides:

- An email notification service using Nodemailer (sends real emails when `EMAIL_SERVER_HOST` is configured)
- A console stub for development (prints to the terminal instead of sending emails)
- Helper functions: `notifyTaskAssigned`, `notifyTaskOverdue`, `notifyAnnouncement`
- Branded HTML email template matching the museum's colour scheme

### Audit logging

`src/lib/audit.ts` — every significant action (sign-in, user creation, file upload) is automatically recorded in the `AuditLog` table with a timestamp, the user who performed the action, and details of what was affected.

### Operations

- `scripts/backup.sh` — takes a full database backup (using `pg_dump`) and compresses the uploads folder; automatically deletes backups older than 30 days
- `scripts/restore.sh` — restores a database backup and optionally an uploads archive
- `.github/workflows/ci.yml` — GitHub Actions pipeline that runs on every code push: TypeScript type check → lint → build

### Documentation

- `README.md` updated with feature list, quick-start instructions, and project structure
- `docs/deployment.md` — detailed deployment guide covering environment variables, PM2, Nginx, backup scheduling, and upload directory permissions

**Decisions:**

- **Next.js 14 App Router** chosen for its server-side rendering capabilities and clean file-based routing. This also allows the authentication checks to happen on the server, which is more secure than checking permissions only in the browser.
- **Passwordless email authentication** chosen to eliminate the need for volunteers to remember passwords, and to avoid the security risks associated with storing password hashes.
- **Capability-based permissions** (rather than simple role checks) chosen to allow fine-grained control. A future update could allow custom roles to be created with specific combinations of capabilities, without requiring code changes.
- **PostgreSQL** chosen for reliability and full support for the advanced data types (JSON for audit log details, etc.) that the application uses.
- **Tailwind CSS** chosen for rapid, consistent styling without needing to write separate CSS files.

**Known limitations at initial build:**

- Task management, scheduling, and announcements are UI placeholders only — no backend functionality yet
- No user management UI
- No role management UI
- Backup/restore scripts are server-side tools; there is no in-app backup facility

---

*This log is maintained by the GitHub Copilot Agent. Each development session adds a new entry at the top.*
