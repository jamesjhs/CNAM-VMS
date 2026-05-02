#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyFileSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⊘ Skipping (not found): ${src}`);
    return false;
  }

  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  return true;
}

try {
  console.log('Copying .next/static to .next/standalone...');
  copyDirSync('.next/static', '.next/standalone/.next/static');

  console.log('Copying public to .next/standalone...');
  copyDirSync('public', '.next/standalone/public');

  console.log('Copying database file (if it exists)...');
  if (copyFileSync('data/cnam-vms.db', '.next/standalone/data/cnam-vms.db')) {
    console.log('✓ Database file copied');
  }

  console.log('✓ Postbuild completed successfully');
} catch (error) {
  console.error('✗ Postbuild failed:', error.message);
  process.exit(1);
}
