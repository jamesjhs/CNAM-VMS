const APP_ROOT = '/var/node/cnamvms.jahosi.co.uk-3001';
const CURRENT_PATH = `${APP_ROOT}/current`;
const LOG_PATH = `${APP_ROOT}/shared/logs`;

module.exports = {
  apps: [
    {
      name: 'cnam-vms',
      cwd: CURRENT_PATH,
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
        APP_ROOT: CURRENT_PATH,
      },
      out_file: `${LOG_PATH}/pm2-out.log`,
      error_file: `${LOG_PATH}/pm2-error.log`,
      merge_logs: true,
      time: true,
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
