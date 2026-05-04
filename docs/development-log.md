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

---

## 4 May 2026 — Teams Page Restructure, Join Requests & Leader Management (v0.10.1)

**Agent session:** GitHub Copilot Cloud Agent

**What was done:**

Bugfix version bumped from 0.10.0 to 0.10.1. Four improvements to the Teams section of the VMS were shipped in this session.

### 1. Teams nav link shows member count

The **Teams** link in the navigation bar now shows a count in brackets of how many teams the current user is a member of (e.g. **Teams (3)**). This gives volunteers an at-a-glance reminder of their team memberships from any page.

**Files changed:**
- `src/components/NavBar.tsx` — queries `user_teams` for the logged-in user and renders the count badge

### 2. Teams page split into "My Teams" and "Other Teams"

The Teams list page (`/teams`) was rewritten to be membership-scoped:

- **My Teams** (top): Teams the current user belongs to, with unread-message count and active-task count badges. Each has a "Team page →" link.
- **Other Teams** (collapsed `<details>` section at the bottom): Teams the user is **not** a member of, shown without a team-page link. Each has a **Request to Join** button. If a request is already pending, the button shows **⏳ Request Pending**.
- Administrators with `admin:teams.read` see all teams in the "My Teams" section.

**Files changed:**
- `src/app/teams/page.tsx` — full rewrite

### 3. Team join requests and leader member management

A new `team_join_requests` database table was added to track requests from volunteers to join teams. Team leaders (and administrators) can now approve or deny these requests, and can also add members directly by email.

- Any signed-in user can submit a join request for a team they are not a member of.
- Requests can be re-submitted after a denial.
- Team leaders see a **Member Management** panel on their team's page with:
  - A list of pending join requests, each with **✓ Approve** and **✕ Deny** buttons.
  - A direct **Add Member** form (enter an email address to add immediately).
- These controls are also available to users with `admin:teams.write`.

**Files changed:**
- `src/lib/db.ts` — added `team_join_requests` table (`id`, `teamId`, `userId`, `status`, `requestedAt`, `resolvedAt`, `resolvedById`; UNIQUE on `teamId+userId`)
- `src/lib/db-types.ts` — added `JoinRequestStatus` type (`PENDING | APPROVED | DENIED`)
- `src/app/teams/actions.ts` (new) — `requestToJoinTeam`, `approveJoinRequest`, `denyJoinRequest`, `addTeamMemberByLeader` server actions
- `src/app/teams/[id]/page.tsx` — membership gate (non-members without `admin:teams.read` are redirected); "Member Management" panel for leaders and admins

### 4. Fixed ERROR 336804059 in team messages page

Opening the Messages tab within a team produced "ERROR 336804059". The root cause was a synchronous `db.prepare().run()` write executed during the Server Component render — a side-effect-in-render anti-pattern in Next.js App Router that causes errors under certain conditions.

**Fix:**
- Removed the inline DB write from the render.
- Created a new `MarkTeamRead` client component that calls the existing `markTeamRead` server action via `useEffect` (best-effort, errors silently ignored).
- Replaced the nested inline `'use server'` wrapper on the send-message form with a clean `.bind(null, teamId)` bound action; updated `sendTeamMessage` signature to accept `(teamId, FormData)`.

**Files changed:**
- `src/app/teams/[id]/messages/page.tsx` — DB write removed, `<MarkTeamRead>` added
- `src/components/MarkTeamRead.tsx` (new) — minimal client component
- `src/app/messages/actions.ts` — `sendTeamMessage` updated to accept `FormData`

### Decisions

- Non-members are redirected from team detail pages rather than shown an error, keeping restricted pages invisible (consistent with the broader security posture established in v0.8.0).
- Team leaders are identified by the existing `isLeader` flag on `user_teams`; no new capability was required.
- The DB write in the messages render was moved to a client-side effect rather than a server action form to avoid page-load jank (read-tracking is best-effort).

### Known issues / limitations

- No email notification is sent to team leaders when a new join request arrives. This is a future enhancement.

### Next steps

- Email notifications for join requests to team leaders
- Ability for volunteers to withdraw a pending join request

---

## 3 May 2026 — Security Hardening, Access Control & Self-Service Account Deletion (v0.8.0)

**Agent session:** GitHub Copilot CLI

**What was done:**

Version bumped from 0.7.1 to 0.8.0. Comprehensive security audit and hardening from the perspective of a penetration tester, iterating from least-privileged (volunteer) to most-privileged (root) user. All identified vulnerabilities have been patched.

### Feature: Self-Service Account Deletion

Users can now permanently delete their own accounts from the **My Profile** page.

- A new **Danger Zone** section appears at the bottom of every user's profile page.
- Deletion requires the user to enter their current password as a confirmation step (prevents accidental clicks and CSRF-style attacks).
- On success, the user is signed out immediately and redirected to the sign-in page with a confirmation message.
- The deletion cascades through all related tables (phones, event sign-ups, availability slots, team memberships, etc.) via existing `ON DELETE CASCADE` foreign keys.
- The action is logged to the audit trail (`USER_SELF_DELETED`).

**Files changed:**
- `src/app/profile/actions.ts` — Added `deleteOwnAccount` server action
- `src/app/profile/DeleteOwnAccountButton.tsx` — New client component with confirmation form
- `src/app/profile/page.tsx` — Added Danger Zone section
- `src/app/auth/signin/page.tsx` — Added `deleted=1` confirmation message

### Security Fix: Restricted Pages No Longer Visible to Unauthorised Users

Previously, accessing a restricted page (e.g., `/admin/users`) showed an explicit "Access Denied" page, confirming to an attacker that the resource exists.

**Fix:** `requireCapability` and `requireAnyCapability` now redirect to `/dashboard` (rather than `/unauthorized`) for missing permissions. The coordination layout redirect was also updated. Restricted pages are effectively invisible to users who lack the capability.

### Security Fix: Admin Overview Page Incorrect Capability Gate

The admin overview page (`/admin`) previously required `admin:users.read`. Users with other admin capabilities (e.g. `admin:announcements.write`) would see the Admin link in the navigation but be redirected on click.

**Fix:** The page now accepts any admin capability via `requireAnyCapability`. It also filters the displayed cards and statistics to only show sections the current user can access — users with partial admin permissions see only the sections relevant to them.

### Security Fix: Admin User Detail Page — Separation of Read vs Write

Previously, any user with `admin:users.read` could see all edit forms on the user detail page. Submitting them would fail at the server action level, but the forms were still visible and confusing.

**Fix:** All mutating UI elements (edit profile form, phone management, status management, password reset, role assignment, team assignment, delete button) are now hidden unless the user also has `admin:users.write`. Read-only users see the user's data and audit log without any mutation controls.

### Security Fix: IDOR — Phone Number Deletion Not Scoped to User

`removeUserPhone(userId, phoneId)` previously deleted by `phoneId` alone, meaning an admin with `admin:users.write` viewing user A's page could delete a phone record belonging to user B by supplying user B's phone ID.

**Fix:** The DELETE query now includes `AND userId = ?`, scoping deletion to the correct user.

### Security Fix: Suspended Users Not Blocked on Every Request

Suspended users with an active session could continue to browse the site for up to 60 seconds (the JWT capabilities cache TTL) after being suspended.

**Fix:** `requireAuth()` now checks `user.status === 'SUSPENDED'` and immediately redirects to `/auth/error?error=AccountSuspended`. This check runs on every page load, not just at JWT refresh time.

### Security Fix: OTP Logged in Plain Text

The server action `submitPassword` logged the raw OTP code to stdout: `OTP code is: 123456`. Anyone with access to the application logs (e.g. via PM2, server SSH) could intercept an OTP and bypass two-factor authentication.

**Fix:** The OTP value is no longer logged. Only a generic "sending verification code to user" message is emitted.

### Security Fix: No Validation of `status` and `accountType` Enum Parameters

The `updateUserStatus` and `updateUserProfile`/`createUser` server actions accepted arbitrary string values for the `status` and `accountType` parameters. A spoofed form POST could set a user's status or account type to any value (e.g. `"ADMIN"`).

**Fix:** Both parameters are now validated against their allowed enum values (`ACTIVE`/`PENDING`/`SUSPENDED` and `VOLUNTEER`/`STAFF`/`MEMBER`) before any database write. Invalid values are silently rejected.

### Security Fix: No Protection Against Deleting the Root User or Self

An admin with `admin:users.write` could:
1. Delete their own account via the admin panel, leaving an orphaned session.
2. Delete the root/superadmin account, permanently breaking system access.

**Fix:**
- `deleteUser` now rejects deletion of the actor's own account with an error redirecting back to the admin page.
- `deleteUser` now rejects deletion of the account whose email matches `ROOT_USER_EMAIL`, protecting the root account.
- The "Delete user" Danger Zone card on the admin user detail page is hidden entirely when viewing one's own profile.

### Security Fix: File Download API Permission Mismatch

The file download API (`/api/files/[id]`) required `admin:files.read`, but the files list page (`/files`) showed download links to all authenticated users. Regular volunteers would see the "Download" button but receive a 403 error when clicking it.

**Fix:** The download API now allows any authenticated user to download files, which matches the intent of the public files page. File upload and the admin file listing still require the appropriate write/read capabilities.

### Security Fix: Input Length Validation

Added maximum length constraints on all user-supplied text fields in server actions to prevent oversized inputs from filling the database or causing unexpected behaviour:

- User names: 150 characters
- Email addresses: 254 characters (RFC 5321 maximum)
- Role/team names and descriptions: 100 / 500 characters
- Announcement titles/bodies: 200 / 10,000 characters
- Phone labels: 50 characters (already existed in profile actions; now also in admin)

---

## 2 May 2026 — Staff Section Renamed to Coordination & SQL Fixes (v0.6.0)

**Agent session:** GitHub Copilot CLI

**What was done:**

Version bumped from 0.5.1 to 0.6.0. Completed Staff→Coordination section rename and fixed critical SQL column reference errors in coordination pages.

### Feature: Staff Section Renamed to "Coordination"

**Rationale:** The Staff section functions as a coordination hub rather than traditional staff management. Renaming clarifies its purpose for scheduling, volunteer management, and team coordination.

**Changes:**
- Renamed navigation button from "Staff" to "Coordination"
- Updated all navigation links from `/staff/*` to `/coordination/*`
- Renamed directory: `src/app/staff/` → `src/app/coordination/`
- Updated page component names (StaffPage → CoordinationPage, etc.)
- Updated sidebar labels and metadata titles

**Files changed:**
- `src/components/NavBar.tsx` — Button label, links, variable names
- `src/components/MobileMenu.tsx` — Mobile navigation section
- `src/app/coordination/layout.tsx` — Layout wrapper and sidebar
- `src/app/coordination/page.tsx` — Dashboard page
- `src/app/coordination/volunteers/page.tsx` — Volunteers list
- `src/app/coordination/availability/page.tsx` — Availability calendar
- `src/app/coordination/projects/page.tsx` — Projects list
- `src/app/coordination/messages/page.tsx` — Messaging interface

### Bug Fix 1: `no such column: u.phone` in Coordination Volunteers page

**Symptom:** Server error when loading `/coordination/volunteers` page.

**Root cause:** Query incorrectly referenced `u.phone` column that doesn't exist on the `users` table. Phone numbers are stored in the separate `user_phones` table.

**Fix:** Added subquery to fetch primary phone number:
```sql
(SELECT number FROM user_phones WHERE userId = u.id AND isPrimary = 1 LIMIT 1) as phone
```

### Bug Fix 2: `no such column: tt.status` in Coordination Projects page

**Symptom:** Server error when loading `/coordination/projects` page.

**Root cause:** Query incorrectly referenced `tt.status` column that doesn't exist on the `team_tasks` table. Task status is tracked via `isActive` (INTEGER: 0/1).

**Fix:** 
- Changed query to select `isActive` instead of `status`
- Updated UI badge logic to display:
  - **Active** (green) when `isActive = 1`
  - **Inactive** (gray) when `isActive = 0`

**Decisions:**

- Directory renamed rather than reverting links to maintain clearer navigation semantics
- Chose `isActive` status display (Active/Inactive) over attempting to track full task workflow states, as schema only supports boolean active flag
- Subquery for phone number allows fallback to null if no primary phone set (better UX than JOIN with potential missing rows)

**Testing:**
- Full build test passed with no compilation errors
- All coordination routes now accessible and loading without SQL errors

**Documentation updates:**
- Updated `docs/user-manual.md` version to 0.6.0
- Updated `docs/technical-architecture.md` version to 0.6.0
- Updated `src/app/help/page.tsx` to reference "Coordination" section instead of "Staff"
- Added this entry to development log

---

## 2 May 2026 — Museum Status Capability Fix & Training Policies Bug Fix (v0.5.1)

**Agent session:** GitHub Copilot CLI

**What was done:**

Version bumped from 0.5.0 to 0.5.1. Fixed two critical bugs preventing access to Museum Status & Hours and Training Policies admin pages.

### Bug 1: Museum Status access denied for admin users

**Symptom:** Root and Admin users could not access `/admin/museum` page; received "Access Denied" error despite having admin privileges.

**Root cause:** The `admin:museum.write` capability was defined in the system but was not being assigned to the Admin role during database seeding. The seed script only assigned it to the Root role.

**Fix:** Updated `scripts/seed.ts` to include `'admin:museum.write'` in the `adminCapKeys` array. Re-seeded the database with `npm run db:seed` after deleting the stale database file.

### Bug 2: Training Policies page server component render error

**Symptom:** Navigating to `/admin/training` resulted in a Server Component render error: `0n~dq4kpx9xxx.js:1 Uncaught Error: An error occurred in the Server Components render...`

**Root cause:** Column name mismatch in the database query. The page was querying for `trainingPolicyId` from the `training_policy_roles` table, but the actual column name is `policyId` (lowercase 'p').

**Fix:** Corrected the query in `src/app/admin/training/page.tsx` line 35 from:
```sql
SELECT trainingPolicyId, accountType FROM training_policy_roles
```
to:
```sql
SELECT policyId, accountType FROM training_policy_roles
```

**Additional fix:** Corrected `DATABASE_URL` in `.env` from PostgreSQL connection string to SQLite file path (`file:./data/cnam-vms.db`).

---

## 28 April 2026 — Runtime Proxy Error Fix & PM2 CWD Fix (v0.6.2)

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Version bumped from 0.6.1 to 0.6.2. Fixed a critical startup error that caused every request to return a 500 Internal Server Error immediately after server boot, and corrected a PM2 configuration issue that could prevent relative paths from resolving on some installations.

### Critical fix — `proxy` export not recognised as a function

**Symptom:** On `npm start` (and PM2), the server started but threw the following error on the very first request:

```
⨯ [Error: The Proxy file "/proxy" must export a function named `proxy` or a default function.]
```

**Root cause:** `src/auth.ts` initialised NextAuth using the _async factory_ form:

```ts
export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({ … }));
```

In next-auth v5, when the factory argument is an `async` function, the returned `auth` export is itself declared as an `async` function (`async (...args) => { … }`). Calling `auth(callback)` therefore returns a **`Promise`** (not a `Function`). Next.js 16 validates the proxy export with `typeof handlerUserland !== 'function'`; since a Promise has type `'object'`, the check fails and the error is thrown.

**Fix:** Changed to the static (non-async) configuration form:

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({ … });
```

With static config, `auth` is a synchronous function, so `auth(callback)` immediately returns a plain function — satisfying the Next.js check. No runtime behaviour changes: the database adapter and all callbacks are still called lazily (via `getDb()`) on each request, exactly as before.

### PM2 fix — working directory not guaranteed

`ecosystem.config.cjs` did not set a `cwd` option. When PM2 resurrected a saved process list after a reboot (or was started from a different directory), the working directory could differ from the project root, causing relative paths (e.g. `DATABASE_URL=file:./data/…`, `UPLOAD_DIR`) and the automatic `.env` loader bundled into the standalone server to fail.

Added `cwd: __dirname` to the ecosystem configuration. `__dirname` in a CommonJS module always resolves to the directory containing the file, so PM2 will always start the server process from the project root regardless of how PM2 itself is invoked.

### Documentation fixes

- `docs/deployment.md`: Updated the PM2 section to use `pm2 start ecosystem.config.cjs` instead of `pm2 start npm --name cnam-vms -- start`. Using the ecosystem file is more reliable (correct cwd, memory limits, restart policy) and consistent with the startup guide.
- `README.md`: Corrected the Quick Start URL from `http://localhost:3000` to `http://localhost:3001` (the default port used by this project).

**Decisions:**

- The static NextAuth config was chosen over an `await`-at-top-level workaround because top-level `await` in the proxy module would itself be a violation of the proxy file contract (the export must be a function value, not an awaited value). Static config is the intended pattern when no per-request dynamic configuration is needed.
- `__dirname` was used in `ecosystem.config.cjs` rather than `path.resolve(__filename, '..')` or `process.cwd()` because `__dirname` is always the directory of the file containing the expression, making it immune to how or where PM2 is launched.

---

## 28 April 2026 — Build Warning Fixes, Code Modernisation & Quality Pass (v0.6.1)

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Version bumped from 0.5.1 to 0.6.1. Addressed all warnings emitted by `npm run build`, eliminated a performance anti-pattern, and made targeted quality improvements throughout.

### Build warning fixes

- **Deprecated `middleware` file convention (Next.js 16.x):** Renamed `src/middleware.ts` → `src/proxy.ts` and updated the named export from `middleware` to `proxy`. Next.js 16 introduced the "proxy" convention as a replacement for the legacy "middleware" name; the build emitted a deprecation warning until this rename was done. The `export const runtime = 'nodejs'` segment config was also removed from the proxy file — the proxy always runs on the Node.js runtime in Next.js 16 and the declaration is disallowed there.

- **Turbopack NFT (Node File Tracing) trace warning:** The build warned that the entire project was being traced unintentionally, pointing to `next.config.mjs`. Root cause: three files used dynamic `path.resolve` / `path.join` calls that Turbopack could not statically scope, causing it to fall back to tracing all project files. Fixed by:
  - **`next.config.mjs`:** Removed the `fileURLToPath` + `path.dirname(import.meta.url)` pattern that derived `__dirname` at module level; replaced `outputFileTracingRoot: __dirname` with `outputFileTracingRoot: process.cwd()`. In a standard Next.js project the config is always executed from the project root, making these equivalent.
  - **`src/lib/uploads.ts`:** Added `/*turbopackIgnore: true*/` inline comments to the `path.join(process.cwd(), …)` and `path.resolve(UPLOAD_DIR, …)` calls.
  - **`src/lib/db.ts`:** Added `/*turbopackIgnore: true*/` to `path.resolve(process.cwd(), filePath)` inside `resolveDbPath()`.

### Performance improvement

- **N+1 query eliminated in `fetchUserClaims` (`src/auth.ts`):** The previous implementation fetched role→capability mappings in two stages: one query to get all `capabilityId` values, then a separate `SELECT key FROM capabilities WHERE id = ?` for each ID. This issued O(n) database round-trips per capabilities refresh. Replaced with a single three-table JOIN (`user_roles → role_capabilities → capabilities`) that returns all capability keys in one query. The result is deduplicated with `DISTINCT` at the SQL level, removing the need for a `Set`.

### Code quality fixes

- **Duplicate comment block removed (`src/auth.ts`):** A stale partial comment block appeared after the closing `}));` of the `NextAuth(…)` call — a copy/paste remnant. Removed.

- **Unreachable guard removed (`src/app/api/files/[id]/route.ts`):** A redundant `if (!user) { return 401 }` check appeared immediately after `const user = session.user as SessionUser;`. Since `session.user` was already asserted non-null by the check directly above, this branch could never be reached. Removed.

**Decisions:**

- `process.cwd()` was chosen over `import.meta.dirname` for `next.config.mjs` because `import.meta.dirname` requires Node.js ≥ 21.2, and the project targets Node.js 20+. `process.cwd()` is semantically identical for a config file that is always executed from the project root.
- The `/*turbopackIgnore: true*/` annotations are the approach recommended in the build warning itself; they suppress tracing for specific expressions without changing runtime behaviour.
- The N+1 fix is a drop-in replacement: same return type, same logic — only the number of DB round-trips changes (from 1 + N to 1).

**Result:** `npm run build` completes with 0 warnings and 0 errors.

---

## 27 April 2026 — Documentation & Dependency Update (v0.5.1)

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Version bumped from 0.5.0 to 0.5.1. Documentation, configuration, and dependency references updated throughout the project.

### Documentation changes

- **README.md:** Updated stack description from "PostgreSQL + Prisma ORM" to "SQLite + better-sqlite3"; removed Prisma CLI commands from Quick Start; corrected project structure section (removed stale `prisma/` directory listing; updated `lib/` description).
- **docs/deployment.md:** Removed PostgreSQL requirement; updated environment variable table to reflect SQLite (`DATABASE_URL`, `DB_ENCRYPTION_KEY`); removed `npx prisma migrate deploy` step; replaced HTTPS/SSL Nginx config with a plain HTTP reverse-proxy example (TLS termination is handled upstream by Cloudflare tunnel or a separate proxy, not by the app); updated backup/restore examples to use SQLite file paths.
- **docs/startup-guide.md:** Removed PostgreSQL prerequisite and setup instructions; replaced `DATABASE_URL` (PostgreSQL connection string) docs with SQLite path and `DB_ENCRYPTION_KEY` instructions; removed `npx prisma migrate deploy` step; merged Steps 4 & 5 (migrate + seed) into a single seed step; changed `AUTH_URL` example from `https://` to `http://`; removed SSL certificate requirement from "Making It Accessible on the Internet"; updated backup command (no longer needs `DATABASE_URL` exported); updated troubleshooting table.
- **.env.example:** Changed `AUTH_URL` example and comment from `https://` to `http://`.

### Server file changes

- **ecosystem.config.cjs:** Updated comment to reflect that the server runs on plain HTTP and TLS (if needed) is handled upstream.
- **tsconfig.json:** Removed stale `prisma/seed.ts` from the `exclude` list (the file no longer exists at that path).

### Dependency updates

- `react` updated from `^18.3.1` to `^19.2.5` (React 19; supported by Next.js 16).
- `react-dom` updated from `^18.3.1` to `^19.2.5`.
- `@types/react` updated from `^18.3.28` to `^19.2.14`.
- `@types/react-dom` updated from `^18.3.7` to `^19.2.3`.
- All other dependencies were already at their latest versions within their current major version ranges.

**Decisions:**

- HTTPS is intentionally not required at the application layer — the system is deployed behind a Cloudflare tunnel which provides TLS termination. Documenting an HTTPS/SSL nginx setup was misleading and unnecessary.
- Prisma and PostgreSQL were replaced by `better-sqlite3-multiple-ciphers` (SQLite with optional encryption) in an earlier session. This update removes all remaining documentation references to Prisma and PostgreSQL to avoid confusion.
- React 19 is the latest stable release and is explicitly supported by Next.js 16 (its peer dependency range includes `^19.0.0`). Upgrading avoids accumulating major-version debt.
- `tailwindcss`, `eslint`, and `typescript` were not upgraded to their new major versions (4.x, 10.x, and 6.x respectively) as these involve breaking configuration changes that are out of scope for this maintenance update.

---

## 21 April 2026 — Security Audit (v0.2.0)

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Full security audit of the codebase. Version bumped from 0.1.0 to 0.2.0.

### Critical / High Fixes

- **Broken middleware (CRITICAL):** `src/proxy.ts` was never executed by Next.js because middleware must be named `middleware.ts`. Renamed to `src/middleware.ts` so the mandatory password-change redirect now correctly fires. Removed the dead root-level `proxy.ts` file.

- **Host Header Injection in password reset (HIGH):** Both `src/app/auth/actions.ts` and `src/app/admin/users/actions.ts` built password reset URLs from the user-supplied `Host` and `X-Forwarded-Proto` HTTP headers. An attacker could send crafted headers to poison reset emails (classic "password reset poisoning"). Replaced with `process.env.AUTH_URL`, which is already a required deployment variable.

- **Plaintext verification tokens (HIGH):** OTP codes, completion tokens, and password-reset tokens were stored as plaintext in the `verification_tokens` table. An attacker with DB read access could extract them directly. All three are now hashed with SHA-256 before being stored; verification re-hashes the submitted value and compares with `crypto.timingSafeEqual`.

- **Timing-unsafe token comparison (HIGH):** The completion token in `src/auth.ts` was compared with `!==` — a non-constant-time string comparison that leaks information via timing. Replaced with `timingSafeEqual` using SHA-256 hashes (equal-length 64-char hex buffers).

### Medium Fixes

- **Missing Content-Security-Policy and HSTS headers (MEDIUM):** `next.config.mjs` set several security headers but was missing `Content-Security-Policy` and `Strict-Transport-Security`. Both have been added. The CSP defaults to `self` with `unsafe-inline` and `unsafe-eval` required for Next.js's runtime; can be tightened further if a nonce-based approach is adopted.

- **Synchronous blocking I/O (MEDIUM):** `src/app/api/files/[id]/route.ts` used `fs.readFileSync`; `src/app/admin/files/actions.ts` used `fs.existsSync`/`fs.unlinkSync`; `src/lib/uploads.ts` used `fs.existsSync`/`fs.mkdirSync`. All replaced with async equivalents (`fs/promises`) so the Node event loop is not blocked during file operations.

- **No upload rate limiting (MEDIUM):** `/api/upload` had no per-user rate limit beyond authentication. Added an in-memory sliding-window rate limiter (10 uploads per user per 60 seconds) with a `429 Too Many Requests` response.

### Low Fixes

- **Unvalidated hex colour values (LOW):** Job/schedule `colour` fields accepted arbitrary strings, which could produce unexpected output if rendered in a `style` attribute. Added a strict `#rrggbb` / `#rgb` validation regex; invalid values fall back to the default indigo colour.

- **Duplicate SMTP transport code (CODE QUALITY):** `src/lib/notifications.ts` duplicated the nodemailer transporter setup that already existed in `src/lib/mail.ts`. Refactored to delegate to `sendMail()` from `mail.ts`, removing the duplicate.

### Dependency Updates

- `next` upgraded from `16.1.6` → `16.2.4` — fixes CVEs: HTTP request smuggling (GHSA-ggv3-7p47-pfv8), CSRF bypass via null origin (GHSA-mq59-m269-xvcx, GHSA-jcc7-9wpm-mj36), DoS via Server Components (GHSA-q4gf-8mx6-v5v3), unbounded disk cache growth (GHSA-3x4c-7xq6-9pq8), postponed resume buffering DoS (GHSA-h27x-g6w4-24gq).
- `nodemailer` upgraded from `7.0.13` → `8.0.5` — fixes SMTP command injection via CRLF (GHSA-c7w3-x93f-qmm8, GHSA-vvjj-xcjg-gr5g).
- `eslint-config-next` upgraded from `16.1.6` → `16.2.4` to match Next.js.
- `brace-expansion`, `flatted`, `picomatch` updated via `npm audit fix` to resolve remaining moderate/high transitive CVEs.
- **Result: 0 known vulnerabilities** (`npm audit` clean).

**Next steps:**
- Consider tightening the CSP with a nonce-based approach (requires Next.js middleware integration) to remove `unsafe-inline`/`unsafe-eval`.
- Evaluate migrating OTP storage to bcrypt if database read speed improves enough to make SHA-256 rainbow tables a practical concern (currently mitigated by rate limiting + short expiry).
- Add integration tests for the auth flow.

---

## 8 March 2026 — Manual Update

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Updated `docs/user-manual.md` (Version 2.0) to reflect the current state of the application. The previous version (1.0) was written in March 2026 before most features were implemented and contained numerous "Coming soon" placeholders and inaccurate sign-in instructions (it described magic-link authentication, which was replaced by password + OTP).

Changes made to the user manual:

- **Sign-in section** completely rewritten to describe the current two-step flow: email + password, then a 6-digit email OTP. Documents the "Keep me signed in for 7 days" option, the 10-minute OTP expiry, and the brute-force lockout (5 failed attempts).
- **Forgot password / reset password** documented as a new sub-section within the sign-in section.
- **Home page and navigation bar** updated to reflect current nav links (Schedule, Announcements, Teams, Files).
- **Dashboard** section updated: removed three "Coming soon" placeholders; replaced with descriptions of the real Upcoming Events, Recent Announcements, My Availability, and My Profile cards.
- **New Section 8 — Announcements**: documents the announcements list, pinned announcements, and how announcements are ordered.
- **New Section 9 — Schedule & Calendar**: documents the month calendar, event colour coding, sign-up/withdraw, day availability recording, and the rolling duties panel.
- **New Section 10 — Teams**: documents the Teams page visible to all volunteers, including urgency badges, active tasks, work logs, and feedback.
- **New Section 11 — Availability Preferences**: documents the general activity preferences page at `/volunteer/availability`.
- **New Section 12 — Profile**: documents the profile page (name, telephone, roles, teams, capabilities).
- **New Section 13 — File Library**: documents the `/files` page available to all signed-in users.
- **New Section 14 — Managing Your Password**: documents first-time password setup, voluntary password change, and forgotten password reset flow.
- **Section 15 — Uploading Files** (previously Section 8): updated to mention the admin file management page and the File Library.
- **Section 16 — Admin Panel** (previously Section 9): massively expanded to cover all admin sections:
  - Overview (updated stats: Events count added)
  - User Management (add user, manage individual user, password reset, delete)
  - Roles and Permissions (create role, assign capabilities, full capability table)
  - Team Management (create team, set leader, task forms)
  - Training Policies (add, edit, deactivate)
  - Schedule Management (create event, delete event, admin availability view, job management)
  - Announcements Management (create, pin/unpin, delete)
  - File Management (download, delete)
  - Audit Log (pagination, filters)
  - Site Content (privacy policy editor)
- **Section 17 — Email Notifications** (previously Section 10): updated to reflect actual notifications sent (verification code, password reset), removed speculative future notifications.
- **Section 18 — Privacy and Security** (previously Section 11): corrected — passwords ARE stored (as scrypt hashes); updated to document two-step authentication.
- **Section 19 — FAQ** (previously Section 12): updated questions to match current sign-in flow; added entries for password reset and profile editing; corrected session-expiry description.

---

## 8 March 2026 — Teams, Training Policies, Site Content, and Password Authentication

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

### 1. Password-based authentication (replacing magic links)

The authentication system was rearchitected from passwordless magic links to a two-step email-and-password flow with one-time password (OTP) verification:

**New database fields on `User`** (migration `20240108000000_add_password_fields`):
- `passwordHash` — scrypt-hashed password, nullable (null = no password set)
- `mustChangePassword` — boolean flag; when true the user is redirected to the change-password page immediately after OTP verification

**New and updated auth pages:**

| Path | What it does |
|---|---|
| `/auth/signin` | Email + password form with optional "keep me signed in" checkbox |
| `/auth/verify-otp` | 6-digit OTP entry form; code sent to email after successful password check |
| `/auth/change-password` | Set or change password; mandatory mode (first login) or voluntary |
| `/auth/forgot-password` | Request a password reset email |
| `/auth/reset-password` | Set a new password via a time-limited email token |

**Security details:**
- Passwords hashed with scrypt via `src/lib/password.ts`
- OTP codes stored in `VerificationToken` with `identifier = "otp:{email}"`, expire in 10 minutes
- Brute-force protection: 5 failed OTP attempts (identifier `"otp-fail:{email}"`) cancels the code
- Password reset tokens: identifier `"pw-reset:{email}"`, expire in 24 hours
- Password attempt rate-limiting: 10 attempts per 15 minutes (identifier `"pw-fail:{email}"`)
- Session TTL: 2 hours (no "keep me signed in") or 7 days (with checkbox), stored in signed JWT
- `mustChangePassword` users are intercepted by proxy middleware and redirected to `/auth/change-password`

**Admin password reset:** Added `adminSendPasswordReset()` server action in `src/app/admin/users/actions.ts` allowing administrators to send a password reset email to any user from their manage page.

### 2. Team management (`/admin/teams`, `/teams`, `/teams/[id]`)

A full team management system was implemented covering both admin and volunteer-facing views.

**New database models (migration `20260308020000_add_team_tasks_and_leader`):**

| Model | Purpose |
|---|---|
| `Team` | A named group of volunteers with an optional team leader and description |
| `TeamMember` | Join table linking users to teams |
| `TeamTaskForm` | A template defining a piece of work (title, description, type, urgency, personnel, equipment, safety notes) |
| `TeamTask` | An active instance of a task form assigned to a team, with status tracking |
| `WorkLog` | A volunteer's record of work done on a task (duration, notes, observations) |
| `TaskFeedback` | Free-text feedback on a task |

**Capabilities added:** `admin:teams.read`, `admin:teams.write`, `admin:tasks.write`

**New pages:**

| Path | Access | Purpose |
|---|---|---|
| `/admin/teams` | `admin:teams.read` | Create, edit, delete teams; assign leader; link to task forms |
| `/admin/teams/tasks` | `admin:tasks.write` | Create, edit, delete task forms with all fields |
| `/teams` | Any signed-in user | Browse all teams and their active tasks |
| `/teams/[id]` | Any signed-in user | View a single team's details; submit work logs and feedback |

**Urgency levels:** `URGENT` (red), `MODERATE` (amber), `ROUTINE` (green)

**Task types:** Seeded with common aviation museum categories (maintenance, inspection, restoration, etc.)

### 3. Training policies (`/admin/training`)

A training compliance matrix was added to help administrators track which training requirements apply to each category of volunteer.

**New database model (migration `20260308010000_add_training_policies`):**

| Model | Purpose |
|---|---|
| `TrainingPolicy` | A named training requirement with frequency, description, and active flag |
| `TrainingPolicyRole` | Join table linking policies to account types (`VOLUNTEER`, `STAFF`, `MEMBER`) |

**Capability added:** `admin:training.write`

**Page:** `/admin/training` — create, edit, deactivate, and delete training policies; view compliance matrix table showing which account types each policy applies to.

### 4. Site content management (`/admin/content`, `/privacy`)

Administrators can now edit the privacy and cookie policy displayed publicly on the `/privacy` page.

**New database model (migration `20260308000000_add_site_content`):**

| Model | Purpose |
|---|---|
| `SiteContent` | Key-value store for site-wide text content; `key = 'privacy-policy'` for the privacy page |

**Page:** `/admin/content` — large textarea for editing the policy, save button, last-updated timestamp, and a preview link to `/privacy`. A warning banner is shown because the default content was drafted with AI assistance and requires legal review.

**Capability used:** `admin:theme.write` (already existed)

**Decisions:**

- Password authentication was chosen over magic links because volunteers expressed a preference for a conventional sign-in experience and because magic links require a functioning email server on every sign-in attempt.
- OTP as a second factor provides a meaningful security improvement without requiring hardware tokens or authenticator apps.
- Training policies are stored per account type (not per individual user) to keep the model simple for a small organisation. Individual compliance tracking (recording that a specific person has completed a specific training) is a potential future enhancement.
- Site content uses a generic key-value model (`SiteContent`) so that additional content areas can be added in future without schema changes.

**Known limitations at this stage:**

- Individual training completion is not yet tracked — the matrix shows what is required but not who has completed it.
- Teams do not have a discussion or messaging feature; communication happens outside the VMS.
- No email notifications are sent when new team tasks are created or work logs are submitted.

**Next steps identified:**

- [ ] Individual training completion tracking (record that a specific user has completed a specific policy)
- [ ] Email notification when a team task is created or updated
- [ ] Admin sign-up list view (see exactly which volunteers have signed up for a calendar event)
- [ ] Recurring availability patterns (e.g. "every Tuesday morning")
- [ ] System Settings page (site name, contact details, theme options)

---

## 6 March 2026 — Schedule & Calendar System

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

### Core calendar/scheduling feature

Implemented a full volunteer scheduling and availability system, covering all requirements from the brief:

#### New database models (migration `20240105000000_add_schedule`)

| Model | Purpose |
|---|---|
| `Job` | Defines roles that need filling. `isRolling=true` means the duty always needs doing (e.g. grass cutting); `isRolling=false` means it appears on a specific rostered event. |
| `CalendarEvent` | An admin-created entry on the calendar. Type can be `EVENT`, `ROSTER` (a specific shift to fill), or `HELP_NEEDED`. Has an optional job reference, optional time range, and optional maximum sign-up cap. Stored with PostgreSQL `DATE` type so time zones do not affect which day is displayed. |
| `EventSignup` | Records a volunteer's sign-up for a `CalendarEvent`. Enforces a unique constraint on (event, user) so a user can only sign up once. |
| `VolunteerDateSlot` | A volunteer's self-declared availability on a specific date: time range (from/until), job preferences (array of Job IDs), and optional notes. Unique per (user, date). |

#### Capabilities

- Added `admin:calendar.write` to `src/lib/capabilities.ts`
- The Root role automatically receives this capability on next sign-in (via the `promoteToRootUser` mechanism in `src/auth.ts`)

#### New pages

| Path | Access | Purpose |
|---|---|---|
| `/schedule` | Any signed-in user | Month calendar grid. Click a day → event detail + sign-up + add/edit own availability for that day. Rolling duties panel at the bottom. |
| `/admin/schedule` | `admin:calendar.write` | Same calendar, admin view. Click a day → see events + event creation form. Delete any event. |
| `/admin/schedule/jobs` | `admin:calendar.write` | Create, edit and delete jobs (rolling and rostered). |

#### How the calendar works

- Pure server-rendered month grid (no JS calendar library) — navigation via URL params `?month=YYYY-MM`
- Clicking a day appends `&day=YYYY-MM-DD` to the URL and reveals a detail panel below the grid
- All interactions (sign-up, withdraw, save availability, create event, delete event) use Next.js Server Actions with `revalidatePath` so data refreshes without a client-side router
- Week starts Monday (UK convention)
- Each day cell shows up to 2–3 event pills (colour-coded by type) plus a green dot if the user has availability recorded for that day; a ✓ tick on pills where the user is signed up
- `isSameDate()` comparisons are done in UTC throughout to avoid timezone drift

#### Volunteer schedule page features

- **Event sign-up**: "Sign up" / "Withdraw" buttons on each event in the day panel. Server-side capacity check ensures no overbooking.
- **Date availability**: From/until time inputs, checkboxes for every job (rolling and rostered), free-text notes. Saved via upsert so editing is seamless. Can be removed with a "Remove" button.
- **Rolling duties panel**: Shows all rolling jobs at the bottom of the page so volunteers know what duties are always available to volunteer for.

#### Admin schedule features

- Create events with: title, description, type (Event / Roster slot / Help needed), start/end time, linked job, max sign-ups
- Delete any event
- See signup count per event
- Navigate to `/admin/schedule/jobs` to manage jobs

#### Job management (`/admin/schedule/jobs`)

- Create new jobs (title, description, type, colour)
- Eight preset colours (Indigo, Blue, Green, Amber, Red, Pink, Teal, Purple)
- Edit existing jobs (name, type, colour) inline
- Delete jobs

#### Seed data

Six default jobs added to `prisma/seed.ts`:
- **Rolling**: Interior Cleaning, Grass Cutting, Front of House Greeting
- **Rostered**: Aircraft Guide, Shop Staff, Tearoom Helper

#### Updated pages / components

- **Dashboard** (`/dashboard`): Schedule card now links to `/schedule` (was "Coming soon"). Added "Upcoming Events" panel showing the next 5 events in the next 30 days, with the user's sign-up status. Removed "My Tasks" placeholder card.
- **Admin panel** (`/admin`): Added "Schedule" card linking to `/admin/schedule`. Stats row now includes Events count.
- **NavBar**: Added "Schedule" link for all signed-in users. Added "Schedule" entry to Admin dropdown (gated on `admin:calendar.write`). Updated `isAdmin` check to include `admin:calendar.write`.

**Decisions:**

- **No JS calendar library**: The calendar grid is pure server-rendered HTML with Tailwind CSS. Navigation is via `<Link>` components and URL params. This keeps the codebase consistent with the existing pattern of using Server Components + Server Actions, avoids adding a new npm dependency, and ensures the calendar is accessible without JavaScript.
- **PostgreSQL `DATE` type via Prisma `@db.Date`**: Storing just the date (not datetime) avoids timezone confusion. All date comparisons use UTC throughout.
- **Job colours as hex strings**: Stored in the DB, displayed inline. Admin picks from 8 preset colours — enough variety without needing a full colour picker.
- **Unique (userId, date) constraint on `VolunteerDateSlot`**: A user can only have one availability entry per day, which simplifies edits (upsert) and avoids confusion.
- **`admin:calendar.write` covers both read and write**: Since any admin viewing the schedule also needs to be able to create events, a single capability covers both.

**Known limitations at this stage:**

- No recurring/repeating events. Each calendar event is a one-off. Repeating patterns (e.g. "grass cutting every Saturday") would need a separate model.
- No email notifications when a user signs up or when capacity changes.
- The admin cannot currently see a list of who has signed up for an event from the admin schedule page (only the count). A full sign-up list per event could be added.
- Volunteer date slots are per-day only — there is no support for recurring weekly availability patterns (e.g. "I'm always free on Tuesdays").

**Next steps identified:**

- [ ] Send email notifications to users when an event they're signed up for changes or is cancelled
- [ ] Admin view: click an event to see the full list of signed-up volunteers
- [ ] Recurring availability patterns (e.g. "every Tuesday morning")
- [ ] Task management (create, assign, track individual tasks with due dates)
- [ ] System Settings page

---

## 6 March 2026 — Announcements, Audit Log Page, File Library, and Profile Page

**Agent session:** GitHub Copilot Coding Agent

**What was done:**

Implemented four new features that were previously listed as "coming soon" or placeholder links in the dashboard and admin panel:

### 1. Announcements

A new `Announcement` model was added to `prisma/schema.prisma` with fields for `title`, `body`, `pinned`, and `authorId`. A Prisma migration (`20240104000000_add_announcements`) was created.

A new capability `admin:announcements.write` was added to `src/lib/capabilities.ts`.

Three new pages and an actions file were created:

| Path | Who can access | What it does |
|---|---|---|
| `/admin/announcements` | Users with `admin:announcements.write` | Create, pin/unpin, and delete announcements |
| `/announcements` | Any signed-in user | Read all announcements (pinned ones shown first) |

The dashboard (`/dashboard`) was updated to:
- Link the "Announcements" card to `/announcements` (was `#`)
- Show a preview of the three most recent announcements

### 2. Audit Log Page (`/admin/audit`)

A full-page audit log viewer was added at `/admin/audit`. Features:
- Paginated table (50 events per page) showing timestamp, user, action, resource, and details
- Free-text filter by action keyword (e.g. `USER_CREATED`)
- Free-text filter by user email or name
- Accessible to users with the `admin:audit.read` capability

The "Audit Logs" card on the admin panel (`/admin`) was updated to link to `/admin/audit` (it was previously marked "Coming soon").

### 3. File Library Page (`/admin/files`)

A file management page was added at `/admin/files`. Features:
- Table of all uploaded files with original name, MIME type, size, uploader, and upload date
- Download button for each file (served via new API route `GET /api/files/[id]`)
- Delete button (removes the database record and the physical file from disk)
- Accessible to users with the `admin:files.read` capability; delete requires `admin:files.write`

A new API route `GET /api/files/[id]` was created to securely serve file downloads. It:
- Validates the user is authenticated and has `admin:files.read` or `admin:files.write`
- Looks up the `FileAsset` record and resolves the file path via the existing `safeUploadPath` helper (preventing path traversal)
- Sets the correct `Content-Disposition` header so the browser downloads the file with its original name

The "File Assets" card on the admin panel was updated to link to `/admin/files` (was "Coming soon").

### 4. Profile Page (`/profile`)

A self-service profile page was added at `/profile`, accessible to any signed-in user. Features:
- View account details (email, status, account type, join date)
- Edit display name
- Add and remove own telephone numbers (enforced ownership check — users can only remove their own numbers)
- View assigned roles and teams
- View own capabilities/permissions

### NavBar improvements

- Added links to `/announcements` and changed the user name/email in the top-right to a clickable link to `/profile`
- Added Audit Log, Files, and Announcements to the Admin dropdown (each shown only when the user has the relevant capability)
- Updated the `isAdmin` check to include `admin:announcements.write`

### Dashboard improvements

- Added "My Availability" and "My Profile" cards linking to real pages
- "Announcements" card now links to `/announcements`
- "My Tasks" and "Schedule" remain as "Coming soon" placeholders until those features are implemented

**Decisions:**

- The announcements feature was implemented as a simple, flat list (not threaded comments or categories) to match the scale and needs of a small volunteer organisation.
- File downloads are served through a Next.js API route rather than exposing the `uploads/` directory directly, so that access control is always enforced by the application.
- The profile page uses separate server actions from the admin user management actions, so that a volunteer can only update their own profile and cannot elevate their own status or role.

**Known limitations at this stage:**

- Task management and scheduling/shift calendar remain unimplemented — dashboard cards for these are still "Coming soon" placeholders.
- There is no in-app "request access" form for new volunteers; they must still contact an administrator.
- System Settings page is not yet implemented.

**Next steps identified:**

- [ ] Implement task management (create, assign, complete tasks with due dates and priorities)
- [ ] Implement scheduling / shift calendar
- [ ] Add a "request access" form so new volunteers can self-register (pending admin approval)
- [ ] Build System Settings page (e.g. site name, contact details)
- [ ] Set up automated testing

---

## 5 March 2026 — Bug Fix: "auth is not a function" on Home Page

**Agent session:** GitHub Copilot Coding Agent

**Bug reported:**

```
⨯ src\app\page.tsx (6:29) @ auth
⨯ TypeError: (0 , _auth__WEBPACK_IMPORTED_MODULE_3__.auth) is not a function
    at Home (./src/app/page.tsx:15:70)
```

**Root cause:**

`PrismaAdapter` was being used without an explicit session strategy. In NextAuth v5 beta, when a database adapter is present, the session strategy defaults to `"database"`. With database sessions, `auth()` requires the HTTP `Request` object to look up the session token from the cookie — it is not a simple no-argument callable. When called as `await auth()` in a Next.js Server Component (which is the standard pattern for Auth.js v5), the runtime could not resolve the function signature correctly and threw the error.

**Fix applied:**

Two files changed:

1. **`src/auth.ts`** — Added `session: { strategy: 'jwt' }` to the `NextAuth()` configuration. This switches session storage from the database to a signed JWT cookie, making `auth()` a proper no-argument callable in Server Components, API routes, and middleware.

   Also added a `jwt` callback to persist the user's database ID into the JWT token on first sign-in, and updated the `session` callback to read from `token` (the JWT payload) instead of `user` (the database session user object), since the callback signature changes with JWT strategy.

2. **`src/types/next-auth.d.ts`** — Added `declare module 'next-auth/jwt'` block augmenting the `JWT` interface with an `id?: string` field, so TypeScript correctly types `token.id` throughout.

**Impact of the change:**

- `auth()` now works correctly in all Server Components and API routes
- All authentication, authorisation, and capability checks continue to work as before
- User data (users, accounts, verification tokens) is still stored in the database via PrismaAdapter — only active session storage moves from the database to JWT cookies
- The `Session` table in the database is no longer written to for active sessions (it remains in the schema for forward compatibility)
- TypeScript type-check and ESLint both pass with zero errors or warnings
- `npm run build` completes successfully, generating all 12 pages

**Decisions:**

- JWT strategy chosen over the alternative approaches (e.g. passing a Request object to `auth()`, or using middleware) because it is the simplest fix with the least impact on the rest of the codebase, and is the approach recommended in the Auth.js v5 documentation for the "universal auth" pattern.
- The PrismaAdapter is retained so that users, accounts, and magic-link verification tokens continue to be stored in the database.

**Known limitations at this stage:**

- Task management, scheduling, and announcements remain as UI placeholders.
- No user management UI in the admin panel.
- No role management UI.

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

