module.exports = {
  apps: [
    {
      name: 'cnam-vms',
      cwd: '/var/node/cnamvms.jahosi.co.uk-3001/current',
      script: '.next/standalone/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        APP_ROOT: '/var/node/cnamvms.jahosi.co.uk-3001/current',
      },
      out_file: '/var/node/cnamvms.jahosi.co.uk-3001/shared/logs/pm2-out.log',
      error_file: '/var/node/cnamvms.jahosi.co.uk-3001/shared/logs/pm2-error.log',
      merge_logs: true,
      time: true,
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
