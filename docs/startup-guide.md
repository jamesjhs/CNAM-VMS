# CNAM-VMS Startup Guide

**City of Norwich Aviation Museum — Volunteer Management System**

This guide explains how to install, configure, and start the Volunteer Management System (VMS) for the first time, and how to run it day to day. It is intended for whoever looks after the server — you do not need to be a software developer, but you will need access to the server computer and a basic ability to type commands into a terminal window.

---

## What You Will Need Before You Start

Before following any steps below, make sure you have the following:

| What you need | Why |
|---|---|
| A server or computer running **Ubuntu 22.04** (or similar Linux) | The application runs on Linux |
| **Node.js version 20 or newer** | The application is built with Node.js |
| An **SMTP email account** (e.g. a Gmail/Outlook app password, or a transactional mail service such as Mailgun or Postmark) | The system sends sign-in links by email |
| The **CNAM-VMS source code** — either downloaded from GitHub or provided to you | The application itself |

> **No separate database server needed.** The application uses an embedded SQLite database that is created automatically in the `data/` folder when the application first starts.

### Checking whether Node.js is installed

Open a terminal and type:

```bash
node --version
```

You should see something like `v20.x.x` or higher. If you see a lower version number or an error, you will need to install or upgrade Node.js. Instructions can be found at [nodejs.org](https://nodejs.org/en/download).

---

## Step 1 — Get the Source Code

If you have not already downloaded the code, run:

```bash
git clone https://github.com/jamesjhs/CNAM-VMS.git
cd CNAM-VMS
```

If you received the code as a zip file, unzip it and open a terminal window in the resulting folder.

---

## Step 2 — Install the Application's Dependencies

The application relies on a number of open-source packages. Install them with this single command (this may take a minute or two):

```bash
npm ci
```

---

## Step 3 — Create the Configuration File

The application needs to know things like your database address, your email settings, and a security key. These are stored in a file called `.env`.

Copy the example configuration file to create your own:

```bash
cp .env.example .env
```

Now open the `.env` file in a text editor (e.g. `nano .env`) and fill in the values. Here is what each line means:

### Database

```
DATABASE_URL="file:./data/cnam-vms.db"
```

This sets the location of the SQLite database file. The path is relative to the project root. The file and its parent folder are created automatically — you do not need to set up a database server.

#### Optional: Database encryption

```
DB_ENCRYPTION_KEY="paste-a-long-random-string-here"
```

If set, the database is encrypted at rest using AES-256 (SQLCipher). Generate a key with:

```bash
openssl rand -base64 32
```

**Important:** Back up this key securely. If you lose it, you lose access to the database. You can leave this variable unset for unencrypted operation, which is fine for development or low-risk environments.

### Security Secret

```
AUTH_SECRET="paste-a-long-random-string-here"
```

Generate a suitable secret by running:

```bash
openssl rand -base64 32
```

Copy the output and paste it as the value. This is used to secure user sessions — keep it private and do not share it.

### Application URL

```
AUTH_URL="https://vms.yourcnam.org"
```

Set this to the web address where the application will be accessed. If you are just testing on your own computer, use `http://localhost:3000`.

### Email Settings

These tell the system how to send sign-in links to volunteers.

```
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="noreply@yourcnam.org"
EMAIL_SERVER_PASSWORD="your-smtp-password"
EMAIL_FROM="CNAM VMS <noreply@yourcnam.org>"
```

Fill in the details provided by your email provider. Common examples:

- **Gmail:** Host `smtp.gmail.com`, port `587`, use an [App Password](https://support.google.com/accounts/answer/185833)
- **Outlook/Office 365:** Host `smtp.office365.com`, port `587`
- **Mailgun, Postmark, SendGrid:** See your provider's SMTP documentation

### First Administrator Account

```
ROOT_USER_EMAIL="your-email@example.com"
ROOT_USER_NAME="Your Name"
```

Enter the email address of the first administrator. This person will automatically be given full access when you run the seeding step below, **or on their very first sign-in** if the seeding step is skipped.

### File Uploads

```
UPLOAD_DIR="/var/uploads/cnam-vms"
UPLOAD_MAX_SIZE_MB="10"
```

This sets where uploaded files are stored and how large a single file is allowed to be. The folder will be created automatically if it does not exist.

---

## Step 4 — Set Up the Database Tables

The SQLite database file and all required tables are created **automatically** the first time the application (or the seed script in Step 5) starts. You do not need to run any migration commands.

If you need to verify the database was created after the next step, you will find it at the path specified in `DATABASE_URL` (default: `data/cnam-vms.db` inside the project folder).

---

## Step 5 — Seed the Initial Data

This step creates the built-in roles, permissions, and your first administrator account:

```bash
npm run db:seed
```

You should see output like:

```
🌱 Seeding database...
✅ Created 10 capabilities
✅ Root role configured with 10 capabilities
✅ Volunteer role configured
✅ Root user created/updated: your-email@example.com
🎉 Seeding complete!
```

---

## Step 6 — Build the Application

For a production installation, you need to build the application first:

```bash
npm run build
```

This compiles and optimises the application. It typically takes 30–60 seconds.

---

## Step 7 — Start the Application

### Starting for production use

```bash
npm start
```

The application will start and listen on port 3000. Open a browser and go to `http://localhost:3000` (or the address you set in `AUTH_URL`) to confirm it is working.

### Keeping it running in the background (recommended for production)

To keep the application running even after you close the terminal, use **PM2**:

```bash
# Install PM2 (only needed once)
npm install -g pm2

# Start the application
pm2 start npm --name cnam-vms -- start

# Save the process list so it restarts on reboot
pm2 save

# Set up PM2 to start automatically when the server reboots
pm2 startup
```

Follow the instructions PM2 prints after `pm2 startup` (it will ask you to run one more command as administrator).

### Starting in development mode

If you are a developer working on the code, use the development mode, which shows more detailed error messages and reloads automatically when you make changes:

```bash
npm run dev
```

---

## Stopping the Application

### If started with `npm start` (in the foreground)

Press **Ctrl + C** in the terminal window.

### If started with PM2

```bash
pm2 stop cnam-vms
```

To start it again:

```bash
pm2 start cnam-vms
```

---

## Day-to-Day Operation

Once the application is installed, you do not normally need to repeat the setup steps. The day-to-day summary is:

| Task | Command |
|---|---|
| Start the application | `pm2 start cnam-vms` |
| Stop the application | `pm2 stop cnam-vms` |
| Restart the application | `pm2 restart cnam-vms` |
| View the application log | `pm2 logs cnam-vms` |
| Check the status | `pm2 status` |

---

## Making It Accessible on the Internet

If the VMS needs to be accessed by volunteers over the internet (rather than just on your local network), you will need:

1. A **domain name** pointing to your server's IP address
2. A **web server** (such as Nginx) to pass requests through to the application
3. An **SSL certificate** (free from Let's Encrypt) to secure the connection

A sample Nginx configuration is provided in [`docs/deployment.md`](deployment.md).

---

## Backing Up Your Data

The system includes backup scripts. To take a manual backup:

```bash
export DATABASE_URL="file:./data/cnam-vms.db"
export BACKUP_DIR="/var/backups/cnam-vms"
./scripts/backup.sh
```

The backup script creates a `.sqlite3` snapshot of the database and a `.tar.gz` archive of the upload directory. To schedule automatic daily backups, see [`docs/deployment.md`](deployment.md).

---

## Something Has Gone Wrong — Where to Look

| Symptom | What to check |
|---|---|
| "Cannot open database" or database errors on start | Check `DATABASE_URL` in `.env` points to a writable path; ensure the `data/` directory exists or is creatable |
| Sign-in emails not arriving | Check your SMTP settings in `.env`; look in the application log (`pm2 logs cnam-vms`) for errors |
| "Application crashed" | Check `pm2 logs cnam-vms` for the error message |
| Port 3000 already in use | Another process is using that port; run `pm2 stop cnam-vms` and try again, or restart the server |

---

*This guide will be updated as the application develops. Last updated: March 2026.*
