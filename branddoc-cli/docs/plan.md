# branddoc-cli — Project Plan

## Overview
CLI + web UI tool for extracting brand documentation from websites. Crawls a domain, extracts page content, and compiles it into a structured markdown brand document.

## Architecture

```
src/
  index.js              CLI entry (Commander) — commands: sitemap, gsc, extract, build-doc, serve
  server.js             Express server — REST + SSE endpoints, serves web UI
  config.js             Centralized config, env loading
  public/
    index.html          Single-page web UI (vanilla JS)
  lib/
    sitemap-parser.js   Parse XML sitemaps
    domain-crawler.js   Discover URLs via sitemap + robots.txt
    content-extractor.js Tiered HTML fetcher (browser UA → Googlebot → Puppeteer → ScrapeOWL)
    browser-fetcher.js  Puppeteer + stealth plugin for JS-rendered pages
    doc-builder.js      Concurrent page extraction → markdown assembly
    url-categorizer.js  Regex/slug-based URL categorization
    ai-categorizer.js   Claude API URL categorization (falls back to regex)
    url-store.js        URL persistence helpers
    gsc-auth.js         Google Search Console OAuth
    gsc-client.js       GSC data fetching
    scrapeowl-client.js ScrapeOWL API wrapper
```

## Milestones

### M1: Core CLI (Complete)
- [x] Sitemap parsing and URL discovery
- [x] Content extraction (Readability + Turndown)
- [x] Brand doc assembly with ToC
- [x] GSC integration (auth + data)
- [x] CLI commands: sitemap, gsc, extract, build-doc

### M2: Web UI (Complete)
- [x] Express server with static file serving
- [x] 3 modes: Build Brand Doc, Extract Content, Export URLs
- [x] Domain crawl → URL list with toggle selection
- [x] Slug-based URL categorization + filter/search UI
- [x] Custom document upload (paste or file)
- [x] CSV export for URLs
- [x] Markdown output with rendered/raw toggle + download

### M3: Tough-Site Extraction (Complete)
- [x] Googlebot UA fallback for sites that block crawlers
- [x] Puppeteer + stealth plugin for JS-rendered pages
- [x] Anti-bot page detection (Vercel, Cloudflare, DDoS-Guard)
- [x] Soft 404 detection for SPA-rendered "not found" pages
- [x] 4-tier fetch pipeline: Browser UA → Googlebot → Puppeteer → ScrapeOWL

### M4: Streaming & Reliability (Complete)
- [x] SSE (Server-Sent Events) for real-time build progress
- [x] Backpressure handling on SSE writes
- [x] Markdown saved to file, fetched separately (not in SSE payload)
- [x] Worker pool concurrency (replaces Promise.race)
- [x] Client disconnect tracking
- [x] Browser cleanup on SIGINT/SIGTERM

### M5: AI Categorization (Complete)
- [x] Claude API integration for intelligent URL categorization
- [x] Graceful fallback to regex when no API key or API error

### M6: Quality & Testing (Complete)
- [x] Real test runner — Jest (`npm test`)
- [x] Unit tests for pure functions (isRealContent, isSoft404, categorizers, AI categorizer)
- [x] Integration tests for all API endpoints (crawl, sitemap, extract, build-doc, doc)
- [x] Remove stale smoke scripts (test-build.js, test-build-large.js)
- [x] Consistent error contract on /api/build-doc (always SSE, including malformed JSON)
- [x] Browser lifecycle hardening (timeout guards, cleanup)
- [x] Server bootstrap decoupled: `createApp()` (testable) + `createServer()` (lifecycle)
- [x] Clean test shutdown (no `--forceExit` needed)

### M7: Future
- [ ] AI-assisted URL selection (pick important pages automatically)
- [ ] Manual URL input in Build Brand Doc mode
- [ ] Full web UI (standalone, no CLI dependency)

## Acceptance Criteria

### Per-endpoint contracts
| Endpoint | Method | Success | Error |
|---|---|---|---|
| `/api/crawl` | POST | `200 {urls, source, count, aiCategorized}` | `400/500 {error}` |
| `/api/sitemap` | POST | `200 {urls, count}` | `400/500 {error}` |
| `/api/extract` | POST | `200 {url, title, markdown, error}` | `400/500 {error}` |
| `/api/build-doc` | POST | SSE stream: `progress*` → `done` | SSE stream: `error` event (incl. malformed body) |
| `/api/doc/:file` | GET | `200 text/markdown` | `400/404 {error}` |

### Content extraction pipeline
1. Browser UA direct fetch (< 1s)
2. Googlebot UA fetch (< 1s)
3. Puppeteer stealth headless (3-7s)
4. ScrapeOWL API (5-15s)
5. Each tier short-circuits on success; soft 404 / anti-bot detection at every tier

### Module ↔ Test mapping
| Module | Test file | Coverage |
|---|---|---|
| `content-extractor.js` (isRealContent, isSoft404) | `test/content-extractor.test.js` | Unit |
| `url-categorizer.js` (categorizeUrls) | `test/url-categorizer.test.js` | Unit |
| `ai-categorizer.js` (aiCategorizeUrls) | `test/ai-categorizer.test.js` | Unit (mocked API) |
| `doc-builder.js` (processWithConcurrency) | `test/doc-builder.test.js` | Unit |
| `browser-fetcher.js` (lifecycle) | `test/browser-fetcher.test.js` | Unit |
| `sitemap-parser.js` (parseSitemapXml, parseSitemap) | `test/sitemap-parser.test.js` | Unit + mocked async |
| `domain-crawler.js` (normalizeDomain, looksLikeXml, crawlDomain) | `test/domain-crawler.test.js` | Unit (pure) + mocked async |
| `scrapeowl-client.js` (fetchViaScrapeOwl) | `test/scrapeowl-client.test.js` | Unit (mocked API) |
| `server.js` (endpoints, SSE ordering) | `test/server.test.js` | Integration |
