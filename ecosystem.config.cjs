module.exports = {
  apps: [
    {
      name: 'cnam-vms',
      script: 'node',
      // Standalone output places the production server at this path.
      args: '.next/standalone/server.js',
      env: {
        PORT: '3001',
        AUTH_URL: 'https://cnam.jahosi.co.uk',
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
