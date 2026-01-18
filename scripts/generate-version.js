#!/usr/bin/env node
/**
 * Generates a version.json file for PWA cache invalidation.
 * Run this before each build to ensure service worker updates.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get git commit hash if available
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  // Not in a git repo or git not available
}

const version = {
  timestamp: Date.now(),
  buildDate: new Date().toISOString(),
  hash: gitHash,
};

const outputPath = path.join(__dirname, '..', 'public', 'version.json');

fs.writeFileSync(outputPath, JSON.stringify(version, null, 2));

console.log(`Generated version.json: ${version.hash} @ ${version.buildDate}`);
