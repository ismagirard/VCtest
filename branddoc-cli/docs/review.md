**Summary**
- The only uncommitted changes are new untracked directories (notably `branddoc-cli/`), so this review is of new files only.
- Core CLI/server functionality mostly matches `docs/plan.md`, but the plan and acceptance criteria lag behind newly implemented endpoints and behaviors.
- There are architecture risks around cancellation, anti‑bot handling, and blocking OCR work in the request path.
- I did not run tests in this review.

**Issues**
- Plan/contract mismatch: `docs/plan.md` doesn’t mention `/api/parse-file`, the `fileId` temp-store flow, or OCR system dependencies, but they are implemented in `src/server.js` and `src/lib/temp-store.js`. This is a doc gap and a missing deployment step (`pdftoppm`/`tesseract` availability).
- Plan mismatch on concurrency: `docs/plan.md` claims Promise.race was replaced by a worker pool, but `src/commands/extract.js` still uses Promise.race-based limiting.
- Anti‑bot detection isn’t applied at all tiers: `src/lib/content-extractor.js` only checks `isRealContent` for direct HTTP fetches; Puppeteer/ScrapeOWL HTML is accepted without challenge detection. This contradicts the plan and risks compiling interstitial pages as content.
- Timeouts don’t cancel work: `src/lib/doc-builder.js` races `extractContent` with a timeout but lets the underlying extraction continue; `src/server.js` continues builds after client disconnect. Under load this can exceed intended concurrency and waste resources.
- Sitemap recursion depth mismatch: `src/lib/domain-crawler.js` only parses one level of sitemap indexes via `parseSitemapXml` and doesn’t use `parseSitemap`’s recursive `maxDepth` flow described in `docs/plan.md`.
- Blocking OCR in request handler: `src/server.js` uses `execSync` for `pdftoppm`/`tesseract` inside `/api/parse-file`, which can block the event loop and stall SSE/other requests.
- Missing tests: No coverage for `/api/parse-file` (PDF + OCR + `fileId` expiry/error paths) or `src/lib/temp-store.js`. No tests for GSC auth/client (`src/lib/gsc-auth.js`, `src/lib/gsc-client.js`) or CLI command flows (`src/commands/*.js`).

**Suggested next steps**
- Update `docs/plan.md` to include `/api/parse-file`, temp‑store `fileId` lifecycle, and required OCR dependencies, or remove those features if they’re not intended.
- Add anti‑bot detection for Puppeteer/ScrapeOWL outputs in `src/lib/content-extractor.js` and reject challenge pages before returning HTML.
- Introduce cancellation (AbortController or cooperative checks) so `doc-builder` can stop in‑flight extractions on timeout or client disconnect.
- Add tests for `/api/parse-file`, `temp-store`, and basic GSC/CLI flows to cover the currently untested paths.
