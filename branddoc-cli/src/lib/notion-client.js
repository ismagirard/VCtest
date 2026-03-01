/**
 * notion-client.js — Notion API wrapper for branddoc-cli
 *
 * Handles connection, database listing, schema introspection,
 * relation querying, and page creation with batched block uploads.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { markdownToBlocks } = require('@tryfabric/martian');
const config = require('../config');

// ── Settings persistence ──────────────────────────────────────────────────────

const SETTINGS_FILE = path.join(config.CREDENTIALS_DIR, 'notion-settings.json');
const BATCH_SIZE = 100;       // Notion max blocks per request
const RATE_LIMIT_MS = 350;    // 3 req/sec = 333ms, +17ms safety margin

let _client = null;           // Cached Notion Client instance

function _loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) { /* corrupt file — treat as disconnected */ }
  return null;
}

function _saveSettings(settings) {
  config.ensureDir(config.CREDENTIALS_DIR);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Client instance ───────────────────────────────────────────────────────────

function _getClient() {
  if (_client) return _client;
  const settings = _loadSettings();
  if (!settings || !settings.token) {
    throw new Error('Not connected to Notion. Please connect first.');
  }
  _client = new Client({ auth: settings.token });
  return _client;
}

// ── Connection management ─────────────────────────────────────────────────────

/**
 * Save a Notion integration token and verify it works.
 * @param {string} token
 * @returns {Promise<{ok: boolean, workspace: string, user: {name: string, type: string}}>}
 */
async function connect(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  // Test the token
  const client = new Client({ auth: token.trim() });
  let me;
  try {
    me = await client.users.me({});
  } catch (err) {
    throw new Error('Invalid Notion integration token: ' + (err.message || 'authentication failed'));
  }

  // Fetch workspace name from a search call (users.me doesn't return workspace name directly)
  let workspace = 'Notion Workspace';
  try {
    const searchResult = await client.search({ page_size: 1 });
    // The search response doesn't directly give workspace name, but we can try
    // to get it from the bot user info
    if (me.bot && me.bot.workspace_name) {
      workspace = me.bot.workspace_name;
    }
  } catch (e) { /* non-critical */ }

  const settings = {
    token: token.trim(),
    workspace: workspace,
    connectedAt: new Date().toISOString(),
  };
  _saveSettings(settings);
  _client = client; // Cache the verified client

  return {
    ok: true,
    workspace: workspace,
    user: { name: me.name || 'Unknown', type: me.type || 'bot' },
  };
}

/**
 * Exchange an OAuth authorization code for an access token, then save it.
 * Notion OAuth token exchange: POST https://api.notion.com/v1/oauth/token
 * @param {string} code - The authorization code from the OAuth callback
 * @returns {Promise<{ok: boolean, workspace: string}>}
 */
async function connectWithOAuth(code) {
  if (!code) throw new Error('Authorization code is required');

  const clientId = config.NOTION_CLIENT_ID;
  const clientSecret = config.NOTION_CLIENT_SECRET;
  const redirectUri = config.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error('Notion OAuth credentials not configured (NOTION_CLIENT_ID / NOTION_CLIENT_SECRET)');
  }

  // Exchange authorization code for access token
  const basicAuth = Buffer.from(clientId + ':' + clientSecret).toString('base64');

  const https = require('https');
  const tokenData = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    const req = https.request({
      hostname: 'api.notion.com',
      path: '/v1/oauth/token',
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode !== 200) {
            reject(new Error(data.error_description || data.error || 'Token exchange failed'));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(new Error('Failed to parse token response'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  // tokenData contains: { access_token, token_type, bot_id, workspace_id, workspace_name, workspace_icon, ... }
  const token = tokenData.access_token;
  const workspace = tokenData.workspace_name || 'Notion Workspace';

  // Verify the token works
  const client = new Client({ auth: token });
  try {
    await client.users.me({});
  } catch (err) {
    throw new Error('OAuth token verification failed: ' + err.message);
  }

  const settings = {
    token: token,
    workspace: workspace,
    workspaceId: tokenData.workspace_id || null,
    workspaceIcon: tokenData.workspace_icon || null,
    botId: tokenData.bot_id || null,
    connectedAt: new Date().toISOString(),
    authType: 'oauth',
  };
  _saveSettings(settings);
  _client = client;

  return { ok: true, workspace: workspace };
}

/**
 * Get the OAuth authorization URL for the user to visit.
 * @returns {string}
 */
function getOAuthUrl() {
  const clientId = config.NOTION_CLIENT_ID;
  const redirectUri = config.NOTION_REDIRECT_URI;
  if (!clientId) return null;

  return 'https://api.notion.com/v1/oauth/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&response_type=code'
    + '&owner=user'
    + '&redirect_uri=' + encodeURIComponent(redirectUri);
}

/**
 * Remove saved credentials and clear cached client.
 */
function disconnect() {
  _client = null;
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }
  } catch (e) { /* ignore */ }
}

/**
 * Check if connected.
 * @returns {{connected: boolean, workspace?: string, connectedAt?: string}}
 */
function getStatus() {
  const settings = _loadSettings();
  if (settings && settings.token) {
    return {
      connected: true,
      workspace: settings.workspace || 'Unknown',
      connectedAt: settings.connectedAt || null,
    };
  }
  return { connected: false };
}

// ── Database operations ───────────────────────────────────────────────────────

/**
 * List databases the integration has access to.
 * @param {string} [query=''] - Optional search query to filter by title
 * @returns {Promise<Array<{id: string, title: string, icon: string|null}>>}
 */
async function listDatabases(query) {
  const client = _getClient();
  const databases = [];
  let cursor = undefined;

  do {
    const searchParams = {
      filter: { value: 'database', property: 'object' },
      start_cursor: cursor,
      page_size: 100,
    };
    if (query && query.trim()) {
      searchParams.query = query.trim();
    }
    const response = await client.search(searchParams);

    for (const db of response.results) {
      const titleParts = db.title || [];
      const title = titleParts.map(t => t.plain_text || '').join('') || 'Untitled';
      let icon = null;
      if (db.icon) {
        if (db.icon.type === 'emoji') icon = db.icon.emoji;
        else if (db.icon.type === 'external') icon = db.icon.external.url;
      }
      databases.push({ id: db.id, title: title, icon: icon });
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return databases;
}

// Property types that cannot be set via API
const SKIP_PROPERTY_TYPES = new Set([
  'formula', 'rollup', 'created_by', 'created_time',
  'last_edited_by', 'last_edited_time', 'unique_id', 'verification',
  'button',
]);

/**
 * Get the editable property schema for a database.
 * @param {string} databaseId
 * @returns {Promise<Array<{id: string, name: string, type: string, config: object}>>}
 */
async function getDatabaseSchema(databaseId) {
  const client = _getClient();
  const response = await client.databases.retrieve({ database_id: databaseId });
  const properties = [];

  for (const [name, prop] of Object.entries(response.properties)) {
    if (SKIP_PROPERTY_TYPES.has(prop.type)) continue;

    const entry = {
      id: prop.id,
      name: name,
      type: prop.type,
      config: {},
    };

    // Extract type-specific config
    if (prop.type === 'select' && prop.select) {
      entry.config.options = (prop.select.options || []).map(o => ({
        id: o.id, name: o.name, color: o.color,
      }));
    } else if (prop.type === 'multi_select' && prop.multi_select) {
      entry.config.options = (prop.multi_select.options || []).map(o => ({
        id: o.id, name: o.name, color: o.color,
      }));
    } else if (prop.type === 'relation' && prop.relation) {
      entry.config.database_id = prop.relation.database_id;
      entry.config.type = prop.relation.type; // 'single_property' or 'dual_property'
    } else if (prop.type === 'status' && prop.status) {
      entry.config.options = (prop.status.options || []).map(o => ({
        id: o.id, name: o.name, color: o.color,
      }));
      entry.config.groups = (prop.status.groups || []).map(g => ({
        id: g.id, name: g.name, color: g.color,
        option_ids: g.option_ids || [],
      }));
    }

    properties.push(entry);
  }

  // Sort: title first, then relations, then selects, then rest alphabetically
  properties.sort((a, b) => {
    const order = { title: 0, relation: 1, select: 2, multi_select: 3, status: 4 };
    const oa = order[a.type] !== undefined ? order[a.type] : 10;
    const ob = order[b.type] !== undefined ? order[b.type] : 10;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return properties;
}

/**
 * Query pages from a related database for relation field dropdowns.
 * @param {string} relatedDatabaseId
 * @param {string} [searchQuery='']
 * @returns {Promise<Array<{id: string, title: string}>>}
 */
async function getRelationPages(relatedDatabaseId, searchQuery) {
  const client = _getClient();

  const queryParams = {
    database_id: relatedDatabaseId,
    page_size: 50,
  };

  // If search query provided, filter by title
  if (searchQuery && searchQuery.trim()) {
    queryParams.filter = {
      property: 'title',
      title: { contains: searchQuery.trim() },
    };
  }

  const response = await client.databases.query(queryParams);
  const pages = [];

  for (const page of response.results) {
    // Extract title from the title property
    let title = 'Untitled';
    for (const [, prop] of Object.entries(page.properties)) {
      if (prop.type === 'title') {
        title = (prop.title || []).map(t => t.plain_text || '').join('') || 'Untitled';
        break;
      }
    }
    pages.push({ id: page.id, title: title });
  }

  return pages;
}

// ── Markdown cleaning for Notion ──────────────────────────────────────────────

/**
 * Clean markdown before converting to Notion blocks.
 * Notion API rejects links with invalid URLs (anchors, relative paths, etc.).
 * @param {string} md
 * @returns {string}
 */
function _cleanMarkdownForNotion(md) {
  let cleaned = md;

  // 1. Remove HTML anchor tags: <a id="page-1"></a>, <a id="custom-2"></a>
  cleaned = cleaned.replace(/<a\s+id="[^"]*"\s*><\/a>/gi, '');

  // 2. Convert anchor-only links to plain text: [Title](#page-1) → Title
  cleaned = cleaned.replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1');

  // 3. Fix protocol-relative URLs FIRST: [text](//example.com) → [text](https://example.com)
  //    Must run before step 4 since /\/([^)]*)/ would match // paths too
  cleaned = cleaned.replace(/\[([^\]]+)\]\(\/\/([^)]+)\)/g, '[$1](https://$2)');

  // 4. Convert relative URL links to plain text: [text](/path) → text
  //    These have no protocol/host so Notion rejects them
  cleaned = cleaned.replace(/\[([^\]]+)\]\(\/[^)]*\)/g, '$1');

  // 5. Remove links with empty or whitespace-only URLs: [text]() or [text]( )
  cleaned = cleaned.replace(/\[([^\]]+)\]\(\s*\)/g, '$1');

  // 6. Remove links with non-http protocols: [text](javascript:...), [text](data:...) etc.
  //    Keep mailto: and tel: as they're valid user-facing links
  cleaned = cleaned.replace(/\[([^\]]+)\]\((?:javascript|data|ftp)[^)]*\)/gi, '$1');

  // 7. Remove any remaining bare HTML tags that martian might choke on
  cleaned = cleaned.replace(/<\/?[a-z][^>]*>/gi, '');

  // 8. Clean up excessive blank lines
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  return cleaned;
}

// ── Page creation & content upload ────────────────────────────────────────────

let _lastRequestTime = 0;

async function _rateLimitedRequest(fn) {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  _lastRequestTime = Date.now();
  return fn();
}

/**
 * Find the name of the title property in a database schema.
 * @param {Array} schema
 * @returns {string}
 */
function _findTitlePropertyName(schema) {
  const titleProp = schema.find(p => p.type === 'title');
  return titleProp ? titleProp.name : 'Name';
}

/**
 * Create a new page in a database with markdown content,
 * uploading blocks in batches of 100.
 *
 * @param {object} params
 * @param {string} params.databaseId
 * @param {string} params.title
 * @param {object} params.properties - Notion property values (pre-formatted)
 * @param {string} params.markdown
 * @param {function} [params.onProgress]
 * @returns {Promise<{pageId: string, pageUrl: string, blocksAppended: number}>}
 */
async function createPageWithContent({ databaseId, title, properties, markdown, onProgress }) {
  const client = _getClient();

  // 1. Clean markdown for Notion compatibility, then convert to blocks
  const cleanedMarkdown = _cleanMarkdownForNotion(markdown);
  let blocks;
  try {
    blocks = markdownToBlocks(cleanedMarkdown);
  } catch (err) {
    throw new Error('Failed to convert markdown to Notion blocks: ' + err.message);
  }

  // 2. Get schema to find title property name
  const schema = await getDatabaseSchema(databaseId);
  const titlePropName = _findTitlePropertyName(schema);

  // 3. Build properties object
  const pageProperties = {
    [titlePropName]: {
      title: [{ text: { content: title } }],
    },
    ...properties,
  };

  // 4. Split blocks into batches
  const totalBlocks = blocks.length;
  const firstBatch = blocks.slice(0, BATCH_SIZE);
  const remainingBatches = [];
  for (let i = BATCH_SIZE; i < totalBlocks; i += BATCH_SIZE) {
    remainingBatches.push(blocks.slice(i, i + BATCH_SIZE));
  }
  const totalBatches = 1 + remainingBatches.length;

  // 5. Create page with first batch
  const pageResponse = await _rateLimitedRequest(() =>
    client.pages.create({
      parent: { database_id: databaseId },
      properties: pageProperties,
      children: firstBatch,
    })
  );

  const pageId = pageResponse.id;
  const pageUrl = pageResponse.url;
  let blocksAppended = firstBatch.length;

  if (onProgress) {
    onProgress({
      batch: 1,
      totalBatches: totalBatches,
      blocksAppended: blocksAppended,
      totalBlocks: totalBlocks,
    });
  }

  // 6. Append remaining batches
  for (let i = 0; i < remainingBatches.length; i++) {
    const batch = remainingBatches[i];
    try {
      await _rateLimitedRequest(() =>
        client.blocks.children.append({
          block_id: pageId,
          children: batch,
        })
      );
      blocksAppended += batch.length;
    } catch (err) {
      console.error('[notion] Batch ' + (i + 2) + ' failed:', err.message);
      // Continue with remaining batches — partial upload is better than total failure
    }

    if (onProgress) {
      onProgress({
        batch: i + 2,
        totalBatches: totalBatches,
        blocksAppended: blocksAppended,
        totalBlocks: totalBlocks,
      });
    }
  }

  return { pageId, pageUrl, blocksAppended };
}

// ── Database creation ─────────────────────────────────────────────────────────

/**
 * Create a new Notion database inside a parent page.
 * Schema: Page Title (title), URL (url), Page Type (select), Language (select)
 * @param {object} params
 * @param {string} params.parentPageId - The page to create the database inside
 * @param {string} params.title - Database title (e.g., "Techo-Bloc Site Extract")
 * @returns {Promise<{databaseId: string, databaseUrl: string}>}
 */
async function createDatabase({ parentPageId, title }) {
  const client = _getClient();

  const response = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ text: { content: title } }],
    is_inline: true,
    properties: {
      'Page Title': { type: 'title', title: {} },
      'URL': { type: 'url', url: {} },
      'Page Type': {
        type: 'select',
        select: { options: [] }, // auto-populated on first use
      },
      'Language': {
        type: 'select',
        select: { options: [] },
      },
    },
  });

  return {
    databaseId: response.id,
    databaseUrl: response.url,
  };
}

/**
 * Search for pages (not databases) the integration has access to.
 * Used for selecting a parent page when creating a new database.
 * @param {string} [query='']
 * @returns {Promise<Array<{id: string, title: string}>>}
 */
async function listPages(query) {
  const client = _getClient();

  const searchParams = {
    filter: { value: 'page', property: 'object' },
    page_size: 50,
  };
  if (query && query.trim()) {
    searchParams.query = query.trim();
  }

  const response = await client.search(searchParams);
  const pages = [];

  for (const page of response.results) {
    // Skip pages that are inside databases (they are database rows, not standalone pages)
    if (page.parent && page.parent.type === 'database_id') continue;

    let title = 'Untitled';
    for (const [, prop] of Object.entries(page.properties || {})) {
      if (prop.type === 'title') {
        title = (prop.title || []).map(t => t.plain_text || '').join('') || 'Untitled';
        break;
      }
    }
    pages.push({ id: page.id, title: title });
  }

  return pages;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  connect,
  connectWithOAuth,
  getOAuthUrl,
  disconnect,
  getStatus,
  listDatabases,
  listPages,
  getDatabaseSchema,
  getRelationPages,
  createDatabase,
  createPageWithContent,
};
