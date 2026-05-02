#!/usr/bin/env node

/**
 * scripts/start.js
 * 
 * Wrapper script for npm start that:
 * 1. Loads the .env file so PORT and other secrets are available
 * 2. Sets APP_ROOT to the project root (where data/ and .env are located)
 * 3. Ensures database paths resolve correctly in standalone mode
 */

const path = require('path');
const { spawn } = require('child_process');
const { config } = require('dotenv');
const { resolve } = require('path');

// Get the directory where this script lives (project root)
const projectRoot = path.dirname(path.dirname(path.resolve(__filename)));

// Load .env file so we can read PORT and other environment variables
config({ path: resolve(projectRoot, '.env'), override: false });

// Prepare environment with .env values loaded
const env = {
  ...process.env,
  APP_ROOT: projectRoot,
  NODE_OPTIONS: '--max-old-space-size=384',
  // PORT is now read from process.env (loaded from .env above)
};

// Spawn the standalone server
const server = spawn('node', ['.next/standalone/server.js'], {
  env,
  cwd: projectRoot,
  stdio: 'inherit',
});

// Exit with the same code as the server
server.on('exit', (code) => {
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
