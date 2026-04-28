module.exports = {
  apps: [
    {
      name: 'cnam-vms',
      script: 'node',
      // Load the project-root .env file before the server module runs so that
      // DB_ENCRYPTION_KEY, AUTH_SECRET, and all other runtime secrets are
      // available even if they were added/changed after the last `npm run build`
      // (the standalone .next/standalone/.env is only updated on rebuild).
      // --env-file requires Node.js >= 20.6.  If the file is absent Node.js
      // logs a warning and continues — it will not crash.
      args: '--env-file=.env .next/standalone/server.js',
      // Always run from the project root so that relative paths (DATABASE_URL,
      // UPLOAD_DIR, .env loading) resolve correctly regardless of where PM2
      // was invoked from.
      cwd: __dirname,
      env: {
        // Read from the environment so the port can be changed in .env.
        // Falls back to 3001 if PORT is not exported in the shell.
        PORT: process.env.PORT || '3001',
        // APP_ROOT is the absolute path to the project root directory.  db.ts
        // uses it to resolve relative DATABASE_URL paths so that the database
        // file is always found even if the standalone server.js changes
        // process.cwd() internally.
        APP_ROOT: __dirname,
        // AUTH_URL is intentionally not hard-coded here.
        // Set AUTH_URL in .env to the public address of the application
        // (e.g. http://your-subdomain.trycloudflare.com or your domain name).
        // The server listens on plain HTTP; TLS termination (if any) is
        // handled upstream (e.g. by a reverse proxy or Cloudflare tunnel).
        // Cap Node's heap so the process does not silently eat all available
        // RAM.  Adjust upward if you add heavier workloads.
        NODE_OPTIONS: '--max-old-space-size=384',
      },
      // PM2 will restart the process if it exceeds this RSS limit, acting as
      // a last-resort safety net against memory leaks.
      max_memory_restart: '450M',
      // A brief back-off between automatic restarts prevents a rapid restart
      // loop from starving other services on the VPS.
      min_uptime: '10s',
      max_restarts: 10,
    },
  ],
};
