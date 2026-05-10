# CNAM-VMS Deployment Guide

This project now uses an **artifact-based deployment** flow built in GitHub Actions. The VPS no longer needs a local Git checkout or build toolchain for routine releases.

## Production Host Details

- Public URL: `https://cnamvms.jahosi.co.uk`
- Linux user: `nodeapp`
- App root: `/var/node/cnamvms.jahosi.co.uk-3001`
- Runtime: PM2 + Node.js 24
- Reverse proxy: Nginx
- Ingress/TLS: Cloudflare Tunnel

## VPS Directory Layout

```text
/var/node/cnamvms.jahosi.co.uk-3001/
  releases/                       # immutable extracted build artifacts
  shared/
    .env                          # production runtime secrets/config
    data/                         # persistent SQLite database location
    uploads/                      # persistent uploaded files
    logs/                         # shared PM2 logs
  current -> releases/<release-id>
```

## Required Production `.env`

Store this file at:

`/var/node/cnamvms.jahosi.co.uk-3001/shared/.env`

Example:

```dotenv
NODE_ENV=production
PORT=3001
AUTH_URL=https://cnamvms.jahosi.co.uk
DATABASE_URL=file:/var/node/cnamvms.jahosi.co.uk-3001/shared/data/cnam-vms.db
UPLOAD_DIR=/var/node/cnamvms.jahosi.co.uk-3001/shared/uploads
DB_ENCRYPTION_KEY=<secure-random-value>
AUTH_SECRET=<secure-random-value>
EMAIL_SERVER_HOST=<smtp-host>
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=<smtp-user>
EMAIL_SERVER_PASSWORD=<smtp-password>
EMAIL_FROM=CNAM VMS <noreply@example.com>
ROOT_USER_EMAIL=<admin@example.com>
ROOT_USER_NAME=<Root Admin>
UPLOAD_MAX_SIZE_MB=10
```

> Keep mutable state and secrets in `shared/`. Do **not** store database files, uploads, or secrets inside release artifacts.

## GitHub Actions Deployment Workflow

Workflow file: `.github/workflows/deploy.yml`

### Trigger

- Push to `main`
- Manual `workflow_dispatch`

### Build job

1. Uses Node.js 24
2. Runs `npm ci`
3. Runs `npm run lint` and `npm run typecheck` if scripts exist
4. Runs `npm run build`
5. Packages deployment artifact containing:
   - `.next/standalone`
   - `.next/static`
   - `public`
   - `package.json`
   - `ecosystem.config.cjs`
   - `REVISION` metadata
6. Uploads artifact with GitHub Actions artifact storage

### Deploy job

1. Downloads artifact
2. Uploads artifact plus `ops/deploy.sh` and `ops/rollback.sh` to VPS over SSH
3. Runs remote deploy script (`/tmp/cnam-vms-deploy/deploy.sh <artifact>`) on VPS

## Required GitHub Secrets

Set these repository secrets before enabling production deploys:

- `DEPLOY_HOST` — VPS host/IP
- `DEPLOY_PORT` — SSH port (usually `22`)
- `DEPLOY_USER` — SSH username (`nodeapp`)
- `DEPLOY_SSH_KEY` — private key for the deploy user (PEM/OpenSSH format)
- `DEPLOY_KNOWN_HOSTS` — strict host key entry from `ssh-keyscan -H <host>`

## First-time Server Bootstrap

Run these once on the VPS as `nodeapp`:

```bash
APP_ROOT=/var/node/cnamvms.jahosi.co.uk-3001

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/uploads" "$APP_ROOT/shared/logs"
chmod 750 "$APP_ROOT/shared" "$APP_ROOT/shared/data" "$APP_ROOT/shared/uploads" "$APP_ROOT/shared/logs"

# Create production env file
nano "$APP_ROOT/shared/.env"
chmod 600 "$APP_ROOT/shared/.env"

# Install runtime tools
npm install -g pm2
```

After the first successful GitHub Actions deployment:

```bash
pm2 status cnam-vms
pm2 startup
pm2 save
```

## Deploy Script Behavior

`ops/deploy.sh`:

- Accepts artifact path argument
- Creates timestamped release in `releases/`
- Extracts artifact into the new release
- Ensures `shared/data`, `shared/uploads`, and `shared/logs` exist
- Requires `shared/.env`
- Symlinks `.env` and `uploads` into the new release
- Atomically repoints `current`
- Starts/reloads PM2 using `ecosystem.config.cjs`
- Runs localhost health check on `http://127.0.0.1:3001/`
- Keeps only a small number of recent releases (default: 5)

## Rollback

Use `ops/rollback.sh` on the VPS:

```bash
# Auto-select previous release
/tmp/cnam-vms-deploy/rollback.sh

# Roll back to a specific release ID
/tmp/cnam-vms-deploy/rollback.sh 20260510123456
```

> `/tmp/cnam-vms-deploy` is a temporary path used by the workflow. Keep a persistent copy of `ops/rollback.sh` (for example in `/var/node/cnamvms.jahosi.co.uk-3001/shared/bin/`) if you want manual rollback available after reboots.

Rollback steps:

1. Repoint `current` to a previous release
2. Reload PM2
3. Run localhost health check

## Nginx Example (upstream to PM2 on 3001)

```nginx
server {
    listen 80;
    server_name cnamvms.jahosi.co.uk;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Cloudflare Tunnel should continue forwarding to the Nginx listener as currently configured.
