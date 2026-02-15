/**
 * Temporary file store for large extracted text content.
 *
 * Instead of sending multi-MB text back to the client (only to re-send it
 * during build), the server keeps extracted text in temp files and hands
 * the client a lightweight fileId reference.
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const STORE_DIR = path.join(config.OUTPUT_DIR, '.file-store');

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

/** Save text to a temp file. Returns a unique fileId. */
function save(text) {
  ensureDir();
  const fileId = crypto.randomUUID();
  fs.writeFileSync(path.join(STORE_DIR, fileId + '.txt'), text, 'utf-8');
  return fileId;
}

/** Read text content for a given fileId. Throws if not found. */
function read(fileId) {
  if (!/^[a-z0-9-]+$/i.test(fileId)) throw new Error('Invalid fileId');
  const filePath = path.join(STORE_DIR, fileId + '.txt');
  if (!fs.existsSync(filePath)) throw new Error('File not found: ' + fileId);
  return fs.readFileSync(filePath, 'utf-8');
}

/** Delete a single temp file by fileId. */
function remove(fileId) {
  if (!/^[a-z0-9-]+$/i.test(fileId)) return;
  try { fs.unlinkSync(path.join(STORE_DIR, fileId + '.txt')); } catch (_) {}
}

/** Remove all temp files (cleanup on shutdown). */
function clear() {
  try { fs.rmSync(STORE_DIR, { recursive: true, force: true }); } catch (_) {}
}

module.exports = { save, read, remove, clear, STORE_DIR };
