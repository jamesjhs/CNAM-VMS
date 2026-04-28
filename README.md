# CNAM-VMS

City of Norwich Aviation Museum — Volunteer Management System

A web-based volunteer and task management application built with Next.js, TypeScript, Tailwind CSS, and SQLite.

## Features

- 🔐 **Two-step authentication** — email + password with email OTP verification; password reset flow; mandatory first-login password change
- 👥 **Capability-based access control** with multiple roles per user
- 📅 **Scheduling & calendar** — month-view calendar, event sign-ups, volunteer availability recording, rolling and rostered job management
- 📢 **Announcements** — post, pin, and manage news for all volunteers
- 🏗️ **Team management** — organise volunteers into teams, manage task forms with urgency levels, record work logs and feedback
- 🎓 **Training policies** — compliance matrix showing training requirements per account type
- 👤 **User management** — add users, manage status and roles, send password resets
- 📁 **File library** — upload and share documents and images; secure download via API
- 📊 **Audit logging** for all key actions with paginated viewer and filters
- ✏️ **Site content editor** — manage the privacy policy and other site-wide text
- 📧 **Notification service** (email with stub fallback)
- 🗄️ **SQLite** (via `better-sqlite3`) with optional AES-256 encryption at rest
- 🔄 **Backup & restore** scripts

## Quick Start

See [docs/deployment.md](docs/deployment.md) for full setup instructions.

```bash
# Install dependencies
# (legacy-peer-deps is configured in .npmrc — no extra flag needed)
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your values

# Seed database (creates root user and roles)
# The SQLite database and schema are created automatically on first run
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  app/                 # Next.js App Router pages
    api/               # API routes (auth, upload, file download)
    admin/             # Protected admin panel (users, roles, teams, schedule, training, content…)
    auth/              # Auth pages (signin, verify-otp, change-password, forgot/reset password)
    announcements/     # Announcements list
    dashboard/         # User dashboard
    files/             # File library (all signed-in users)
    profile/           # User profile self-service
    schedule/          # Scheduling calendar
    teams/             # Teams and task overview
    upload/            # File upload page
    volunteer/         # Volunteer availability preferences
  components/          # Shared React components
  lib/                 # Utilities (db, auth helpers, uploads, notifications, calendar)
  types/               # TypeScript type declarations
  auth.ts              # Auth.js configuration
scripts/               # Backup, restore, and seed scripts
docs/                  # Documentation
```

## Documentation

| Document | Audience | Description |
|---|---|---|
| [docs/startup-guide.md](docs/startup-guide.md) | Administrators | Step-by-step guide to installing and starting the system on a server |
| [docs/user-manual.md](docs/user-manual.md) | All users | Plain-English guide to using the system as a volunteer or administrator |
| [docs/deployment.md](docs/deployment.md) | Administrators | Technical deployment reference (Nginx, PM2, backups) |
| [docs/development-log.md](docs/development-log.md) | Developers | Chronological record of what has been built and what is planned next |

## Environment Variables

See `.env.example` for all required variables and documentation.

## License

Private — City of Norwich Aviation Museum.
