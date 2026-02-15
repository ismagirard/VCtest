const path = require('path');
const fs = require('fs');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const CREDENTIALS_DIR = path.join(ROOT_DIR, 'credentials');

const DEFAULTS = {
  concurrency: 3,
  requestDelay: 500,
  requestTimeout: 15000,
  gscLookbackDays: 90,
  sitemapMaxDepth: 3,
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const SCRAPEOWL_API_KEY = process.env.SCRAPEOWL_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

module.exports = {
  ROOT_DIR,
  OUTPUT_DIR,
  CREDENTIALS_DIR,
  DEFAULTS,
  SCRAPEOWL_API_KEY,
  ANTHROPIC_API_KEY,
  ensureDir,
};
