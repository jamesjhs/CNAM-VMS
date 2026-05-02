# Deployment Commands for CNAM-VMS Security Update

**Target:** Production server with Node.js v24.15.0
**Branch:** `security-update`
**Status:** Ready for deployment

---

## Quick Start (Copy & Paste)

### 1. Stop Current Application
```bash
pm2 stop cnam-vms
```

### 2. Backup Current Database
```bash
# Back up the database before proceeding
cp data/cnam.db data/cnam.db.backup.$(date +%Y-%m-%d-%H:%M:%S)
```

### 3. Pull Latest Code
```bash
cd /var/node/cnamvms.jahosi.co.uk-3001 || cd /path/to/your/repo
git fetch origin
git checkout security-update
git pull origin security-update
```

### 4. Install Dependencies
```bash
npm ci
```
**Note:** Use `npm ci` (clean install) for production, not `npm install`

### 5. Build Project
```bash
npm run build
```

### 6. Run Database Seed (If New DB or Schema Changes)
```bash
# OPTIONAL: Only if you have a fresh database or need to reinitialize
# npm run db:seed
```

### 7. Restart Application with PM2
```bash
pm2 restart cnam-vms --update-env
```

### 8. Verify Deployment
```bash
pm2 status cnam-vms
pm2 logs cnam-vms --lines 50
```

---

## Detailed Step-by-Step Deployment

### Step 1: SSH into Server
```bash
ssh root@cnamvms.jahosi.co.uk
# or use your IP address
```

### Step 2: Navigate to Application Directory
```bash
# Find your application directory (commonly one of these):
cd /var/node/cnamvms.jahosi.co.uk-3001
# OR
cd /opt/cnamvms
# OR check PM2 status first
pm2 show cnam-vms
```

### Step 3: Check Current Git Status
```bash
git status
git branch -a
```

### Step 4: Backup Database
```bash
# Critical: Always backup before deploying
cp data/cnam.db data/cnam.db.backup.$(date +%Y-%m-%d-%H:%M:%S)
ls -lah data/cnam.db*  # Verify backup created
```

### Step 5: Stop Application Gracefully
```bash
pm2 stop cnam-vms
# Wait for graceful shutdown (5-10 seconds)
sleep 5
pm2 status cnam-vms
```

### Step 6: Pull New Code
```bash
git checkout security-update
git pull origin security-update
# Verify code updated
git log --oneline -5
```

### Step 7: Verify Environment Variables
```bash
# Check that .env file exists and has required vars
cat .env | grep -E "DATABASE_URL|AUTH_SECRET|DB_ENCRYPTION_KEY"

# If any are missing, add them:
# nano .env
```

### Step 8: Clean Install Dependencies
```bash
npm ci
# This uses package-lock.json for exact versions
# Wait for installation to complete (~2-3 minutes)
```

### Step 9: Build Production Bundle
```bash
npm run build
# Watch for: "✓ Compiled successfully"
# This takes ~3-5 minutes
```

### Step 10: Restart Application
```bash
# Use --update-env to reload .env changes
pm2 restart cnam-vms --update-env

# Wait a few seconds for startup
sleep 3

# Check status
pm2 status cnam-vms
```

### Step 11: Monitor Logs
```bash
# Watch real-time logs for any errors
pm2 logs cnam-vms

# Or view last 100 lines
pm2 logs cnam-vms --lines 100
```

### Step 12: Verify Application is Running
```bash
# Test the application
curl http://localhost:3001/

# Or if behind a proxy:
curl http://cnamvms.jahosi.co.uk/

# Check PM2 is monitoring it
pm2 monit
```

---

## Full Deployment Script (Automated)

Save this as `deploy.sh` and run with `bash deploy.sh`:

```bash
#!/bin/bash

set -e  # Exit on any error

echo "================================"
echo "CNAM-VMS Security Update Deploy"
echo "================================"
echo ""

# Config
APP_DIR="/var/node/cnamvms.jahosi.co.uk-3001"
BRANCH="security-update"
DB_BACKUP_DIR="data"

# Step 1: Navigate to app directory
echo "[1/10] Navigating to application directory..."
cd "$APP_DIR" || { echo "ERROR: Cannot find app directory"; exit 1; }

# Step 2: Check git status
echo "[2/10] Checking git status..."
git status

# Step 3: Backup database
echo "[3/10] Backing up database..."
if [ -f "$DB_BACKUP_DIR/cnam.db" ]; then
    cp "$DB_BACKUP_DIR/cnam.db" "$DB_BACKUP_DIR/cnam.db.backup.$(date +%Y-%m-%d-%H:%M:%S)"
    echo "Database backed up successfully"
else
    echo "WARNING: Database file not found at $DB_BACKUP_DIR/cnam.db"
fi

# Step 4: Stop application
echo "[4/10] Stopping PM2 application..."
pm2 stop cnam-vms
sleep 3

# Step 5: Pull latest code
echo "[5/10] Pulling latest code from $BRANCH branch..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Step 6: Install dependencies
echo "[6/10] Installing dependencies with npm ci..."
npm ci

# Step 7: Build project
echo "[7/10] Building Next.js project..."
npm run build

# Step 8: Restart application
echo "[8/10] Restarting PM2 application..."
pm2 restart cnam-vms --update-env
sleep 3

# Step 9: Check status
echo "[9/10] Checking application status..."
pm2 status cnam-vms

# Step 10: Tail logs
echo "[10/10] Application deployed successfully!"
echo ""
echo "Last 20 log lines:"
pm2 logs cnam-vms --lines 20 --nostream

echo ""
echo "✅ Deployment complete!"
echo "📊 Monitor with: pm2 logs cnam-vms"
echo "🔄 Restart with: pm2 restart cnam-vms"
echo "🛑 Stop with: pm2 stop cnam-vms"
```

Run it with:
```bash
bash deploy.sh
```

---

## Verification Steps

### After Deployment, Verify:

```bash
# 1. Check PM2 status
pm2 status cnam-vms

# 2. Check application is responding
curl -I http://localhost:3001/
# Should see: HTTP/1.1 200 OK

# 3. Check database is accessible
# Look for no database errors in logs
pm2 logs cnam-vms --lines 50 | grep -i "error\|sqlite"

# 4. Check memory usage (should be < 450MB)
pm2 monit

# 5. Verify version
curl -s http://localhost:3001/api/health 2>/dev/null || echo "Health check endpoint not available"

# 6. Check for any crashes in logs
pm2 logs cnam-vms --err
```

---

## Rollback (If Something Goes Wrong)

```bash
# Stop application
pm2 stop cnam-vms

# Go back to previous branch
git checkout main  # or previous branch
git pull origin main

# Restore database backup (if needed)
cp data/cnam.db.backup.LATEST data/cnam.db

# Rebuild and restart
npm ci
npm run build
pm2 restart cnam-vms --update-env

# Monitor
pm2 logs cnam-vms
```

---

## Environment Variables to Verify

Before starting, ensure these are in `.env`:

```bash
# Required
DATABASE_URL="file:data/cnam.db"
AUTH_SECRET="your-secret-key"
DB_ENCRYPTION_KEY="your-encryption-key"
AUTH_URL="http://cnamvms.jahosi.co.uk"

# Optional but recommended
PORT=3001
NODE_ENV="production"

# Email (if configured)
EMAIL_SERVER_HOST=...
EMAIL_SERVER_PORT=...
EMAIL_SERVER_USER=...
EMAIL_SERVER_PASSWORD=...
EMAIL_FROM=...
```

---

## Performance Monitoring

After deployment, monitor these metrics:

```bash
# Real-time monitoring
pm2 monit

# Memory usage
ps aux | grep "cnam-vms\|node"

# Database status
sqlite3 data/cnam.db "SELECT COUNT(*) as user_count FROM users;"

# Check logs for errors
tail -f ~/.pm2/logs/cnam-vms-*.log

# Check permission cache TTL is working
# Should see faster permission updates (1 min vs 5 min)
pm2 logs cnam-vms | grep "capabilit"
```

---

## What Changed in This Release

**Security & Stability Improvements:**
- ✅ Fixed form submission retry logic (promise rejection bug)
- ✅ Consistent password complexity enforcement (all 3 flows)
- ✅ Phone number validation added
- ✅ File upload MIME type validation (magic numbers)
- ✅ Email error reporting
- ✅ Permission cache optimized (1 min vs 5 min)
- ✅ Critical bug fixes and security hardening

**No Database Migration Required** - Existing database fully compatible

---

## Support & Troubleshooting

### Build Fails with Memory Error
```bash
# Increase Node memory temporarily
NODE_OPTIONS=--max-old-space-size=1024 npm run build
```

### PM2 Won't Start
```bash
# Check for port conflicts
lsof -i :3001

# Or kill and restart
pm2 kill
pm2 start ecosystem.config.cjs
```

### Database Lock Error
```bash
# Delete lock file if exists
rm -f data/cnam.db-wal data/cnam.db-shm

# Restart
pm2 restart cnam-vms
```

### Need to See What Changed
```bash
git diff main..security-update --stat
git log main..security-update --oneline
```

---

## Command Reference

```bash
# Deployment
git checkout security-update && git pull origin security-update
npm ci && npm run build
pm2 restart cnam-vms --update-env

# Monitoring
pm2 status
pm2 logs cnam-vms
pm2 monit

# Database
npm run db:seed                    # Initialize database
npm run db:set-initial-password    # Reset admin password
npm run db:reset-password [email]  # Reset specific user password

# Development (local testing)
npm run dev      # Start dev server on :3001
npm run typecheck
npm run lint
```

---

## Estimated Deployment Time

- Pull & install: 2-3 min
- Build: 3-5 min
- Restart & verify: 1 min
- **Total: 6-9 minutes**

---

## Success Indicators ✅

After deployment, you should see:
- ✅ PM2 shows "online" status
- ✅ No errors in logs (first 50 lines)
- ✅ Port 3001 responding (curl works)
- ✅ Users can log in
- ✅ Memory usage stable < 450MB

---

**Questions?** Check logs with: `pm2 logs cnam-vms`
