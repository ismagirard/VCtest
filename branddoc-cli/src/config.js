const path = require('path');
const fs = require('fs');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || ROOT_DIR;
const OUTPUT_DIR = path.join(DATA_DIR, 'output');
const CREDENTIALS_DIR = path.join(DATA_DIR, 'credentials');

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

// Notion OAuth (public integration)
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || '';
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || '';
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI || 'http://localhost:3000/';

module.exports = {
  ROOT_DIR,
  OUTPUT_DIR,
  CREDENTIALS_DIR,
  DEFAULTS,
  SCRAPEOWL_API_KEY,
  ANTHROPIC_API_KEY,
  NOTION_CLIENT_ID,
  NOTION_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  ensureDir,
};
