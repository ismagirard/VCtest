const express = require('express');
const path = require('path');
const { parseSitemap } = require('./lib/sitemap-parser');
const { extractContent } = require('./lib/content-extractor');
const { buildBrandKnowledge, buildBrandGuidelines } = require('./lib/doc-builder');
const { crawlDomain } = require('./lib/domain-crawler');
const { categorizeUrls } = require('./lib/url-categorizer');
const { aiCategorizeUrls } = require('./lib/ai-categorizer');
const { closeBrowser } = require('./lib/browser-fetcher');
const { deriveDocSlug } = require('./lib/output-filename');
const config = require('./config');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const tempStore = require('./lib/temp-store');

const os = require('os');
const upload = multer({
  dest: path.join(os.tmpdir(), 'branddoc-uploads'),
});

/**
 * Build the Express app with all routes (no listening, no signal handlers).
 * This is the unit-testable core — tests import this and wrap it with httpServer.
 */
function createApp() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));

  // Disable caching for HTML so the browser always gets the latest UI
  app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  // Crawl a domain for URLs
  app.post('/api/crawl', async (req, res) => {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    try {
      console.time('  crawl-discovery');
      const { urls, source } = await crawlDomain(domain);
      console.timeEnd('  crawl-discovery');
      console.log(`  Found ${urls.length} URLs via ${source}`);

      console.time('  categorize');
      // Try AI categorization first, fall back to regex
      let categorized = await aiCategorizeUrls(urls);
      const aiPowered = categorized !== null;
      if (!categorized) {
        categorized = categorizeUrls(urls);
      }
      console.timeEnd('  categorize');

      res.json({ urls: categorized, source, count: urls.length, aiCategorized: aiPowered });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Extract URLs from sitemap
  app.post('/api/sitemap', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    try {
      const urls = await parseSitemap(url);
      res.json({ urls, count: urls.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Extract content from a single URL
  app.post('/api/extract', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    try {
      const result = await extractContent(url);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve a generated doc file
  app.get('/api/doc/:filename', (req, res) => {
    const filename = req.params.filename;
    // Sanitize — only allow .md files in output dir
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(config.OUTPUT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  });

  // Parse uploaded file (PDF → text extraction, with OCR fallback for scanned PDFs)
  // Uses disk storage so large files don't blow up memory
  app.post('/api/parse-file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { originalname, mimetype, path: tmpPath } = req.file;
      const ext = path.extname(originalname).toLowerCase();

      try {
        if (ext === '.pdf' || mimetype === 'application/pdf') {
          // Step 1: Try direct text extraction (fast, works for text-based PDFs)
          const fileBuffer = fs.readFileSync(tmpPath);
          const data = await pdfParse(fileBuffer);
          const directText = (data.text || '').trim();

          if (directText && directText.length > 50) {
            const fileId = tempStore.save(directText);
            return res.json({ text: directText, pages: data.numpages, fileId });
          }

          // Step 2: OCR fallback for scanned/image-based PDFs
          console.log('  PDF has no text layer, attempting OCR via pdftoppm + tesseract...');
          const { execSync } = require('child_process');

          // Create temp dir for page images
          const ocrDir = path.join(os.tmpdir(), 'branddoc-ocr-' + Date.now());
          fs.mkdirSync(ocrDir, { recursive: true });

          try {
            // Convert PDF pages to PNG images (150 DPI for speed + quality balance)
            execSync(`pdftoppm -png -r 150 "${tmpPath}" "${path.join(ocrDir, 'page')}"`, {
              timeout: 300000, // 5 min max for conversion
            });

            // OCR each page image
            const pageFiles = fs.readdirSync(ocrDir)
              .filter(f => f.endsWith('.png'))
              .sort();

            if (pageFiles.length === 0) {
              return res.status(422).json({ error: 'Could not convert PDF to images for OCR.' });
            }

            console.log(`  Converting ${pageFiles.length} pages via OCR...`);
            const pageTexts = [];
            for (const pageFile of pageFiles) {
              const imgPath = path.join(ocrDir, pageFile);
              try {
                const ocrText = execSync(`tesseract "${imgPath}" stdout -l eng+fra 2>/dev/null`, {
                  timeout: 60000, // 60s per page max
                  maxBuffer: 10 * 1024 * 1024,
                }).toString().trim();
                pageTexts.push(ocrText);
              } catch (e) {
                // Skip pages that fail OCR
                console.warn(`  OCR failed for ${pageFile}: ${e.message}`);
              }
            }

            const ocrText = pageTexts.join('\n\n---\n\n').trim();
            if (!ocrText) {
              return res.status(422).json({ error: 'OCR could not extract any text from this PDF.' });
            }

            const fileId = tempStore.save(ocrText);
            return res.json({ text: ocrText, pages: pageFiles.length, ocr: true, fileId });
          } finally {
            // Clean up OCR temp dir
            try { fs.rmSync(ocrDir, { recursive: true, force: true }); } catch (e) {}
          }
        }

        // Non-PDF: decode as UTF-8 text
        const fileBuffer = fs.readFileSync(tmpPath);
        const textContent = fileBuffer.toString('utf-8');
        const fileId = tempStore.save(textContent);
        return res.json({ text: textContent, fileId });
      } finally {
        // Clean up uploaded temp file
        try { fs.unlinkSync(tmpPath); } catch (e) {}
      }
    } catch (err) {
      console.error('File parse error:', err.message);
      res.status(500).json({ error: 'Failed to extract text: ' + err.message });
    }
  });

  // Build brand knowledge with real-time progress via Server-Sent Events
  // IMPORTANT: This endpoint ALWAYS returns SSE, even for validation errors.
  // The client reads the response as an SSE stream — returning JSON would break parsing.
  app.post('/api/build-knowledge', async (req, res) => {
    // Set up SSE headers FIRST so every response is a valid SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Disable request timeout for long builds
    req.setTimeout(0);
    res.setTimeout(0);

    // Track if client disconnected
    let clientGone = false;
    req.on('aborted', () => { clientGone = true; });
    res.on('close', () => { clientGone = true; });

    // Keep SSE connection alive during slow extraction phases.
    // Without this, idle gaps (e.g. 90s URL timeouts) can cause the browser
    // or OS TCP stack to close the connection.
    const heartbeat = setInterval(() => {
      if (clientGone || res.writableEnded || res.destroyed) return;
      try { res.write(': keepalive\n\n'); } catch (e) { clientGone = true; }
    }, 15000);

    const { urls, customDocs } = req.body || {};
    if ((!urls || !urls.length) && (!customDocs || !customDocs.length)) {
      clearInterval(heartbeat);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'URLs or custom documents are required' })}\n\n`);
      return res.end();
    }

    // Resolve customDocs: replace fileId references with actual content from temp store
    let resolvedDocs;
    try {
      resolvedDocs = (customDocs || []).map(doc => {
        if (doc.fileId) {
          return { title: doc.title, content: tempStore.read(doc.fileId) };
        }
        return doc; // already has inline content (e.g. small text files)
      });
    } catch (err) {
      clearInterval(heartbeat);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Document reference expired \u2014 please re-upload your files and try again. (' + err.message + ')' })}\n\n`);
      return res.end();
    }

    // Safe SSE write with backpressure handling
    async function sendProgress(data) {
      if (clientGone || res.writableEnded || res.destroyed) return;
      const payload = `data: ${JSON.stringify(data)}\n\n`;
      try {
        const ok = res.write(payload);
        if (!ok) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      } catch (e) {
        clientGone = true;
      }
    }

    try {
      const { markdown, results } = await buildBrandKnowledge(urls || [], {
        concurrency: 3,
        customDocs: resolvedDocs,
        onProgress: (progress) => {
          void sendProgress({ type: 'progress', ...progress });
        },
      });

      // Save to file
      const slug = deriveDocSlug({ urls: urls || [], customDocs: resolvedDocs });
      config.ensureDir(config.OUTPUT_DIR);
      const filename = `brand-knowledge-${slug}.md`;
      const outPath = path.join(config.OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, markdown);

      const succeeded = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;

      // Send final result — DON'T include markdown in SSE (too large, blocks stream).
      // Client will fetch it via /api/doc/:filename
      console.log(`  Build complete: ${succeeded} ok, ${failed} failed. Sending done event...`);
      await sendProgress({
        type: 'done',
        succeeded,
        failed,
        savedTo: outPath,
        docUrl: '/api/doc/' + encodeURIComponent(filename),
      });
      console.log('  Done event sent.');
    } catch (err) {
      console.error('  Build error:', err.message);
      await sendProgress({ type: 'error', error: err.message });
    }

    clearInterval(heartbeat);
    console.log('  Closing SSE stream...');
    if (!clientGone) {
      try { res.end(); } catch (e) {}
    }
    console.log('  SSE stream closed.');
  });

  // Build brand guidelines from uploaded documents only (no URL crawling).
  // Uses SSE for consistency with build-knowledge, even though it's faster.
  app.post('/api/build-guidelines', async (req, res) => {
    // Set up SSE headers FIRST so every response is a valid SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let clientGone = false;
    req.on('aborted', () => { clientGone = true; });
    res.on('close', () => { clientGone = true; });

    const { customDocs } = req.body || {};
    if (!customDocs || !customDocs.length) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Documents are required' })}\n\n`);
      return res.end();
    }

    // Resolve customDocs: replace fileId references with actual content from temp store
    let resolvedDocs;
    try {
      resolvedDocs = customDocs.map(doc => {
        if (doc.fileId) {
          return { title: doc.title, content: tempStore.read(doc.fileId) };
        }
        return doc;
      });
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Document reference expired \u2014 please re-upload your files and try again. (' + err.message + ')' })}\n\n`);
      return res.end();
    }

    try {
      const { markdown } = await buildBrandGuidelines(resolvedDocs);

      // Save to file
      const slug = deriveDocSlug({ customDocs: resolvedDocs });
      config.ensureDir(config.OUTPUT_DIR);
      const filename = `brand-guidelines-${slug}.md`;
      const outPath = path.join(config.OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, markdown);

      console.log(`  Guidelines build complete. Sending done event...`);
      const payload = `data: ${JSON.stringify({
        type: 'done',
        succeeded: resolvedDocs.length,
        failed: 0,
        savedTo: outPath,
        docUrl: '/api/doc/' + encodeURIComponent(filename),
      })}\n\n`;

      if (!clientGone && !res.writableEnded && !res.destroyed) {
        res.write(payload);
      }
    } catch (err) {
      console.error('  Guidelines build error:', err.message);
      if (!clientGone && !res.writableEnded && !res.destroyed) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      }
    }

    if (!clientGone) {
      try { res.end(); } catch (e) {}
    }
  });

  // Error-handling middleware: catch ALL pre-route errors on the SSE endpoint.
  // express.json() can reject with several error types before routes run:
  //   entity.parse.failed  — malformed JSON
  //   entity.too.large     — body exceeds limit
  //   encoding.unsupported — bad Content-Encoding
  //   request.aborted      — client hung up during body read
  // All of these must become SSE error events, not JSON, because the client
  // always reads SSE endpoint responses as an SSE stream.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (['/api/build-knowledge', '/api/build-guidelines'].includes(req.path)) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      const msg = err.type === 'entity.parse.failed'
        ? 'Invalid JSON in request body'
        : err.message || 'Request error';
      res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      return res.end();
    }
    // For all other endpoints, use default Express error handling
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

/**
 * Start the server: bind to a port, set timeouts, install signal handlers.
 * Returns the http.Server instance so callers can close it cleanly.
 */
function createServer(port = 3000) {
  const app = createApp();

  const server = app.listen(port, () => {
    console.log(`\n  branddoc UI running at http://localhost:${port}\n`);
  });

  // Disable socket-level timeouts — SSE builds can run indefinitely.
  // Per-request timeouts (req.setTimeout(0), res.setTimeout(0)) handle SSE streams.
  server.timeout = 0;
  server.keepAliveTimeout = 0;

  // Safety net: catch stray promise rejections so the server doesn't crash mid-build
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  // Safety net: catch synchronous exceptions (e.g. from Chromium) so the server stays alive
  process.on('uncaughtException', (err) => {
    console.error('FATAL uncaughtException (server staying alive):', err);
  });

  // Clean up browser on shutdown (temp files in /tmp are left for OS cleanup,
  // so fileId references survive server restarts)
  process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await closeBrowser();
    process.exit(0);
  });

  return server;
}

module.exports = { createApp, createServer };
