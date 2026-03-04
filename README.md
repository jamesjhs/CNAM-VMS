# CNAM-VMS

City of Norwich Aviation Museum — Volunteer Management System

A web-based volunteer and task management application built with Next.js, TypeScript, Tailwind CSS, and PostgreSQL.

## Features

- 🔒 **Passwordless authentication** via email magic links (Auth.js)
- 👥 **Capability-based access control** with multiple roles per user
- 📊 **Audit logging** for all key actions
- 📁 **Local file uploads** with metadata storage
- 📧 **Notification service** (email with stub fallback)
- 🗄️ **PostgreSQL + Prisma ORM**
- 🔄 **Backup & restore** scripts

## Quick Start

See [docs/deployment.md](docs/deployment.md) for full setup instructions.

```bash
# Install dependencies
# Note: --legacy-peer-deps is required due to peer dependency constraints in Auth.js beta
npm ci --legacy-peer-deps

# Configure environment
cp .env.example .env
# Edit .env with your values

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Seed database (creates root user and roles)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  app/                 # Next.js App Router pages
    api/               # API routes (auth, upload)
    admin/             # Protected admin panel
    auth/              # Auth pages (signin, verify, error)
    dashboard/         # User dashboard
    upload/            # File upload page
  components/          # Shared React components
  lib/                 # Utilities (prisma, auth helpers, uploads, notifications)
  types/               # TypeScript type declarations
  auth.ts              # Auth.js configuration
prisma/
  schema.prisma        # Database schema
  seed.ts              # Seed script
scripts/               # Backup and restore scripts
docs/                  # Documentation
```

## Environment Variables

See `.env.example` for all required variables and documentation.

## License

Private — City of Norwich Aviation Museum.
