// Integration tests for server endpoints.
// We mock the heavy dependencies (crawlDomain, buildBrandDoc, etc.) so these
// tests run fast and offline — they verify the HTTP contract, not the crawling.

jest.mock('../src/lib/domain-crawler', () => ({
  crawlDomain: jest.fn(),
}));
jest.mock('../src/lib/doc-builder', () => ({
  buildBrandDoc: jest.fn(),
}));
jest.mock('../src/lib/content-extractor', () => ({
  extractContent: jest.fn(),
  isRealContent: jest.requireActual('../src/lib/content-extractor').isRealContent,
  isSoft404: jest.requireActual('../src/lib/content-extractor').isSoft404,
}));
jest.mock('../src/lib/sitemap-parser', () => ({
  parseSitemap: jest.fn(),
}));
jest.mock('../src/lib/ai-categorizer', () => ({
  aiCategorizeUrls: jest.fn().mockResolvedValue(null), // fall back to regex
}));
jest.mock('../src/lib/browser-fetcher', () => ({
  fetchWithBrowser: jest.fn(),
  closeBrowser: jest.fn(),
}));

const http = require('http');
const { crawlDomain } = require('../src/lib/domain-crawler');
const { buildBrandDoc } = require('../src/lib/doc-builder');
const { extractContent } = require('../src/lib/content-extractor');
const { parseSitemap } = require('../src/lib/sitemap-parser');

let httpServer;
let testPort;

/**
 * Make an HTTP request to the test server.
 * body=null sends no body; body=undefined sends no body; anything else is JSON-stringified.
 * rawBody can be used to send a pre-formed string (e.g. malformed JSON).
 */
function request(method, path, body, { rawBody } = {}) {
  return new Promise((resolve, reject) => {
    let bodyStr = '';
    if (rawBody !== undefined) {
      bodyStr = rawBody;
    } else if (body !== null && body !== undefined) {
      bodyStr = JSON.stringify(body);
    }
    const req = http.request({
      hostname: 'localhost',
      port: testPort,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function parseSseEvents(raw) {
  return raw
    .split('\n\n')
    .filter((frame) => frame.trim())
    .map((frame) => {
      const dataLines = frame.split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.substring(5).trim());
      if (!dataLines.length) return null;
      try { return JSON.parse(dataLines.join('\n')); } catch { return null; }
    })
    .filter(Boolean);
}

beforeAll((done) => {
  // Use createApp() so we control the http.Server lifecycle ourselves.
  const { createApp } = require('../src/server');
  const app = createApp();
  httpServer = http.createServer(app);
  httpServer.listen(0, () => {
    testPort = httpServer.address().port;
    done();
  });
}, 10000);

afterAll((done) => {
  if (httpServer) {
    httpServer.close(done);
  } else {
    done();
  }
});

// ─── /api/crawl ──────────────────────────────────────────────────────
describe('POST /api/crawl', () => {
  test('returns 400 when domain is missing', async () => {
    const res = await request('POST', '/api/crawl', {});
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Domain is required');
  });

  test('returns categorized URLs on success', async () => {
    crawlDomain.mockResolvedValue({
      urls: ['https://example.com/', 'https://example.com/about'],
      source: 'sitemap',
    });

    const res = await request('POST', '/api/crawl', { domain: 'example.com' });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.count).toBe(2);
    expect(data.source).toBe('sitemap');
    expect(data.urls).toHaveLength(2);
    expect(data.urls[0]).toHaveProperty('pageType');
  });

  test('returns 500 on crawl error', async () => {
    crawlDomain.mockRejectedValue(new Error('DNS resolution failed'));
    const res = await request('POST', '/api/crawl', { domain: 'bad.example' });
    expect(res.status).toBe(500);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('DNS resolution failed');
  });
});

// ─── /api/sitemap ────────────────────────────────────────────────────
describe('POST /api/sitemap', () => {
  test('returns 400 when url is missing', async () => {
    const res = await request('POST', '/api/sitemap', {});
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('URL is required');
  });

  test('returns parsed URLs on success', async () => {
    parseSitemap.mockResolvedValue([
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/blog',
    ]);

    const res = await request('POST', '/api/sitemap', { url: 'https://example.com/sitemap.xml' });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.count).toBe(3);
    expect(data.urls).toHaveLength(3);
    expect(data.urls).toContain('https://example.com/about');
  });

  test('returns 500 on parse error', async () => {
    parseSitemap.mockRejectedValue(new Error('Invalid XML'));
    const res = await request('POST', '/api/sitemap', { url: 'https://bad.example/sitemap.xml' });
    expect(res.status).toBe(500);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Invalid XML');
  });
});

// ─── /api/extract ────────────────────────────────────────────────────
describe('POST /api/extract', () => {
  test('returns 400 when url is missing', async () => {
    const res = await request('POST', '/api/extract', {});
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('URL is required');
  });

  test('returns extracted content on success', async () => {
    extractContent.mockResolvedValue({
      url: 'https://example.com/about',
      title: 'About Us',
      markdown: '# About Us\nWe are a company.',
      error: null,
    });

    const res = await request('POST', '/api/extract', { url: 'https://example.com/about' });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.title).toBe('About Us');
    expect(data.markdown).toContain('About Us');
    expect(data.error).toBeNull();
  });

  test('returns 500 on extraction error', async () => {
    extractContent.mockRejectedValue(new Error('Timeout'));
    const res = await request('POST', '/api/extract', { url: 'https://bad.example/' });
    expect(res.status).toBe(500);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Timeout');
  });
});

// ─── /api/build-doc ──────────────────────────────────────────────────
describe('POST /api/build-doc', () => {
  test('returns SSE error event when no URLs provided (empty body)', async () => {
    const res = await request('POST', '/api/build-doc', {});
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSseEvents(res.body);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error).toContain('URLs or custom documents are required');
  });

  test('returns SSE error event when urls is empty array', async () => {
    const res = await request('POST', '/api/build-doc', { urls: [] });
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSseEvents(res.body);
    expect(events[0].type).toBe('error');
  });

  test('returns SSE error for malformed JSON body', async () => {
    const res = await request('POST', '/api/build-doc', null, {
      rawBody: '{this is not valid json!!',
    });
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSseEvents(res.body);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error).toContain('Invalid JSON');
  });

  test('returns SSE error for oversized body', async () => {
    // express.json limit is 50mb — send ~51mb of valid JSON to trigger entity.too.large
    const bigPayload = JSON.stringify({ urls: ['x'.repeat(51 * 1024 * 1024)] });
    const res = await request('POST', '/api/build-doc', null, {
      rawBody: bigPayload,
    });
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSseEvents(res.body);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('error');
    // Should NOT be a JSON error response — must be SSE
    expect(events[0].error).toBeDefined();
  }, 15000);

  test('streams progress and done events on success', async () => {
    const fs = require('fs');
    const config = require('../src/config');
    config.ensureDir(config.OUTPUT_DIR);

    buildBrandDoc.mockImplementation(async (urls, opts) => {
      if (opts.onProgress) {
        opts.onProgress({ current: 1, total: 1, url: urls[0], ok: true, title: 'Test', error: null });
      }
      return {
        markdown: '# Test Doc\nContent here',
        results: [{ url: urls[0], title: 'Test', markdown: 'Content', error: null }],
      };
    });

    const res = await request('POST', '/api/build-doc', {
      urls: ['https://example.com/'],
    });

    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSseEvents(res.body);

    const progressEvents = events.filter((e) => e.type === 'progress');
    const doneEvents = events.filter((e) => e.type === 'done');

    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].succeeded).toBe(1);
    expect(doneEvents[0].failed).toBe(0);
    expect(doneEvents[0].docUrl).toMatch(/\/api\/doc\//);
    // Verify done event does NOT contain markdown (it's fetched separately)
    expect(doneEvents[0].markdown).toBeUndefined();
  });

  test('streams error event on build failure', async () => {
    buildBrandDoc.mockRejectedValue(new Error('Build exploded'));

    const res = await request('POST', '/api/build-doc', {
      urls: ['https://example.com/'],
    });

    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSseEvents(res.body);
    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].error).toBe('Build exploded');
  });

  test('SSE events arrive in order: progress* then done', async () => {
    const fs = require('fs');
    const config = require('../src/config');
    config.ensureDir(config.OUTPUT_DIR);

    buildBrandDoc.mockImplementation(async (urls, opts) => {
      // Emit 3 progress events
      for (let i = 0; i < urls.length; i++) {
        opts.onProgress({ current: i + 1, total: urls.length, url: urls[i], ok: true, title: `P${i + 1}`, error: null });
      }
      return {
        markdown: '# Doc',
        results: urls.map((u) => ({ url: u, title: 'T', markdown: 'M', error: null })),
      };
    });

    const res = await request('POST', '/api/build-doc', {
      urls: ['https://a.com/', 'https://b.com/', 'https://c.com/'],
    });

    const events = parseSseEvents(res.body);
    const types = events.map((e) => e.type);

    // All progress events must come before done
    const lastProgressIdx = types.lastIndexOf('progress');
    const doneIdx = types.indexOf('done');
    expect(lastProgressIdx).toBeLessThan(doneIdx);
    // No error events in a successful build
    expect(types).not.toContain('error');
    // Exactly 3 progress + 1 done
    expect(types.filter((t) => t === 'progress')).toHaveLength(3);
    expect(types.filter((t) => t === 'done')).toHaveLength(1);
  });
});

// ─── /api/doc/:filename ──────────────────────────────────────────────
describe('GET /api/doc/:filename', () => {
  test('rejects non-.md filenames', async () => {
    const res = await request('GET', '/api/doc/test.txt', null);
    expect(res.status).toBe(400);
  });

  test('returns 404 for missing files', async () => {
    const res = await request('GET', '/api/doc/nonexistent-file.md', null);
    expect(res.status).toBe(404);
  });

  test('serves markdown file on success', async () => {
    const fs = require('fs');
    const config = require('../src/config');
    config.ensureDir(config.OUTPUT_DIR);

    // Write a temp file to serve
    const testFile = require('path').join(config.OUTPUT_DIR, 'test-serve.md');
    fs.writeFileSync(testFile, '# Test\nHello from test');

    try {
      const res = await request('GET', '/api/doc/test-serve.md', null);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.body).toContain('# Test');
      expect(res.body).toContain('Hello from test');
    } finally {
      // Clean up
      try { fs.unlinkSync(testFile); } catch {}
    }
  });
});
