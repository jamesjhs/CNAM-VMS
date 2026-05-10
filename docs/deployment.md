# CNAM-VMS Deployment Guide

This project now uses an **artifact-based deployment** flow built in GitHub Actions. The VPS no longer needs a local Git checkout or build toolchain for routine releases.

## Production Host Details

- Public URL: `https://cnamvms.jahosi.co.uk`
- Linux user: `nodeapp`
- App root: `/var/node/cnamvms.jahosi.co.uk-3001`
- Runtime: PM2 + Node.js 24
- Reverse proxy: Nginx
- Ingress/TLS: Cloudflare Tunnel

## Step-by-step Migration Manual (from `git pull` deploys to artifact deploys)

This section is written as a plain-English migration checklist.  
It assumes you are moving away from this old pattern on the VPS:

```bash
git pull && npm install && npm run build && pm2 restart
```

### What key terms mean (abbreviations expanded)

- **VPS** = **Virtual Private Server** (your rented Linux server)
- **CI** = **Continuous Integration** (GitHub Actions builds/testing in the cloud)
- **CD** = **Continuous Deployment/Delivery** (automated release from CI to server)
- **SSH** = **Secure Shell** (encrypted remote terminal/file transfer protocol)
- **PM2** = **Process Manager 2** (keeps your Node.js app running and restartable)
- **URL** = **Uniform Resource Locator** (web address, e.g. `https://cnamvms.jahosi.co.uk`)

### Why this migration is safer and better

With artifact deploys, your server becomes a runtime host only. It no longer needs to compile/build app source code every deploy.  
Consequences:

- Deploys are faster and more repeatable (same artifact every time)
- Server CPU/RAM is not wasted building
- Rollback is easier (switch symlink to previous release)
- Server does not need Git checkout credentials for routine deploys

### Migration checklist

Run these steps in order.

#### 1) Connect to the VPS as the runtime user

```bash
ssh nodeapp@<your-server-host>
```

Why: opens a secure terminal session on the production server as `nodeapp`.  
Consequence: all following commands affect production directories, so type carefully.

#### 2) Define one reusable path variable for this session

```bash
APP_ROOT=/var/node/cnamvms.jahosi.co.uk-3001
```

Why: avoids repeating long paths and reduces typing mistakes.  
Consequence: later commands that use `$APP_ROOT` will point to the correct application root.

#### 3) Create required release/shared directory structure

```bash
mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/uploads" "$APP_ROOT/shared/logs"
chmod 750 "$APP_ROOT/shared" "$APP_ROOT/shared/data" "$APP_ROOT/shared/uploads" "$APP_ROOT/shared/logs"
```

Why:

- `mkdir -p` creates the folder layout needed by deploy/rollback scripts
- `chmod 750` sets owner/group access and prevents world access

Consequence:

- Releases can be unpacked into `releases/`
- Database/uploads/logs persist in `shared/` when code releases change

#### 4) Create production environment file (secrets/config)

```bash
nano "$APP_ROOT/shared/.env"
chmod 600 "$APP_ROOT/shared/.env"
```

Why:

- `.env` stores runtime config and secrets outside release artifacts
- `chmod 600` restricts file access to owner only

Consequence:

- Deploy script can symlink this `.env` into each release
- Secrets are not baked into CI artifacts

Minimum recommended values (example):

```dotenv
NODE_ENV=production
PORT=3001
AUTH_URL=https://cnamvms.jahosi.co.uk
DATABASE_URL=file:/var/node/cnamvms.jahosi.co.uk-3001/shared/data/cnam-vms.db
UPLOAD_DIR=/var/node/cnamvms.jahosi.co.uk-3001/shared/uploads
```

#### 5) Install PM2 globally if not already installed

```bash
npm install -g pm2
```

Why: PM2 is the runtime process manager used by deploy scripts to start/reload app safely.  
Consequence: `pm2` command becomes available for `nodeapp`.

#### 6) Configure GitHub repository secrets (in GitHub web UI)

Go to: **Repository → Settings → Secrets and variables → Actions → New repository secret**  
Create:

- `DEPLOY_HOST` (server DNS name/IP)
- `DEPLOY_PORT` (SSH port, usually `22`)
- `DEPLOY_USER` (`nodeapp`)
- `DEPLOY_SSH_KEY` (private SSH key text)
- `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -H <host>`)

Why: workflow must authenticate to VPS without hardcoded credentials.  
Consequence: deploy workflow can securely SCP (Secure Copy) and SSH to server.

#### 7) Trigger first artifact deployment

Option A: push commit to `main`  
Option B: run workflow manually from **Actions → Build and Deploy → Run workflow**

Why: this creates a CI-built artifact and runs remote `ops/deploy.sh`.  
Consequence:

- New release folder appears under `releases/<release-id>`
- `current` symlink points to new release
- PM2 starts/reloads `cnam-vms`

#### 8) Verify service health on the server

```bash
pm2 status cnam-vms
curl -I http://127.0.0.1:3001/
```

Why:

- `pm2 status` checks process state (online/restarting/errored)
- `curl -I` checks local HTTP response headers quickly

Consequence: confirms app is serving before checking external URL.

#### 9) Persist PM2 startup configuration (one-time)

```bash
pm2 startup
pm2 save
```

Why:

- `pm2 startup` generates boot-time service setup instructions
- `pm2 save` saves current process list

Consequence: app auto-recovers on VPS reboot (after completing printed `sudo` command, if prompted).

#### 10) Confirm public endpoint

Open in browser:

`https://cnamvms.jahosi.co.uk`

Why: validates end-to-end path (Cloudflare Tunnel → Nginx → PM2/Node app).  
Consequence: confirms users can reach production over public URL.

### How normal deployments work after migration

1. You merge/push to `main`
2. GitHub Actions builds artifact in CI
3. Workflow copies artifact to VPS
4. `ops/deploy.sh` creates new release, switches `current`, reloads PM2, health-checks

No server-side `git pull` and no server-side build required.

### How rollback works (if a bad release goes live)

On VPS:

```bash
/tmp/cnam-vms-deploy/rollback.sh
```

or target a specific release:

```bash
/tmp/cnam-vms-deploy/rollback.sh <release-id>
```

Why: quickly repoints `current` to an older known-good release and reloads PM2.  
Consequence: service returns to older code without rebuilding from source.

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
