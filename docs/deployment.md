# CNAM-VMS Deployment Guide

## Requirements

- Node.js 20+
- PostgreSQL 15+
- SMTP server or mail service
- Linux VPS (Ubuntu 22.04 recommended)

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/cnam_vms` |
| `AUTH_SECRET` | NextAuth secret (generate with `openssl rand -base64 32`) | — |
| `AUTH_URL` | Public URL of the app | `https://vms.example.com` |
| `EMAIL_SERVER_HOST` | SMTP hostname | `smtp.example.com` |
| `EMAIL_SERVER_PORT` | SMTP port | `587` |
| `EMAIL_SERVER_USER` | SMTP username | `noreply@example.com` |
| `EMAIL_SERVER_PASSWORD` | SMTP password | — |
| `EMAIL_FROM` | Sender address | `CNAM VMS <noreply@example.com>` |
| `ROOT_USER_EMAIL` | Bootstrap admin email | `admin@example.com` |
| `ROOT_USER_NAME` | Bootstrap admin name | `Root Admin` |
| `UPLOAD_DIR` | File upload directory | `/var/uploads/cnam-vms` |
| `UPLOAD_MAX_SIZE_MB` | Max upload size (MB) | `10` |

## First-time Setup

```bash
# 1. Clone the repository
git clone https://github.com/jamesjhs/CNAM-VMS.git
cd CNAM-VMS

# 2. Install dependencies
# (legacy-peer-deps is configured in .npmrc — no extra flag needed)
npm ci

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Run database migrations
npx prisma migrate deploy

# 5. Seed initial data (creates root user and roles)
npm run db:seed

# 6. Build for production
npm run build

# 7. Start the server
npm start
```

## Running with PM2

```bash
npm install -g pm2
pm2 start npm --name cnam-vms -- start
pm2 save
pm2 startup
```

## Backup & Restore

### Backup

```bash
# Set environment variables
export DATABASE_URL="postgresql://..."
export BACKUP_DIR="/var/backups/cnam-vms"
export UPLOAD_DIR="/var/uploads/cnam-vms"

# Run backup
chmod +x scripts/backup.sh
./scripts/backup.sh
```

### Schedule automatic backups (cron)

```bash
# Daily backup at 2am
0 2 * * * cd /opt/cnam-vms && DATABASE_URL="postgresql://..." ./scripts/backup.sh >> /var/log/cnam-vms-backup.log 2>&1
```

### Restore

```bash
export DATABASE_URL="postgresql://..."

# Restore database only
./scripts/restore.sh --db /var/backups/cnam-vms/db_20260101_020000.dump

# Restore database and uploads
./scripts/restore.sh --db /var/backups/cnam-vms/db_20260101_020000.dump \
  --uploads /var/backups/cnam-vms/uploads_20260101_020000.tar.gz
```

## Nginx Configuration (example)

```nginx
server {
    listen 80;
    server_name vms.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name vms.example.com;

    ssl_certificate /etc/letsencrypt/live/vms.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vms.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
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

## Upload Directory Permissions

```bash
# Create upload directory
sudo mkdir -p /var/uploads/cnam-vms
sudo chown www-data:www-data /var/uploads/cnam-vms
sudo chmod 750 /var/uploads/cnam-vms
```
