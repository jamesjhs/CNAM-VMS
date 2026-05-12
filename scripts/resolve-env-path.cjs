const { existsSync } = require('fs');
const { resolve } = require('path');

function resolveEnvPath(baseDir, appRoot = process.env.APP_ROOT, explicitEnvFile = process.env.ENV_FILE) {
  const envCandidates = [
    explicitEnvFile,
    appRoot ? resolve(appRoot, 'shared/.env') : null,
    resolve(baseDir, '../shared/.env'),
    resolve(baseDir, 'shared/.env'),
    resolve(baseDir, '.env'),
  ].filter(Boolean);

  return envCandidates.find((candidate) => existsSync(candidate));
}

module.exports = { resolveEnvPath };
