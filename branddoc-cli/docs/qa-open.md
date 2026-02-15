# QA Open Issues

Updated: 2026-02-15T14:28:34.397Z

Open count: 3

- [ ] [INFO] Plan/contract mismatch: `docs/plan.md` doesn’t mention `/api/parse-file`, the `fileId` temp-store flow, or OCR system dependencies, but they are implemented in `src/server.js` and `src/lib/temp-store.js`. This is a doc gap and a missing deployment step (`pdftoppm`/`tesseract` availability). (docs/plan.md)
- [ ] [INFO] Anti‑bot detection isn’t applied at all tiers: `src/lib/content-extractor.js` only checks `isRealContent` for direct HTTP fetches; Puppeteer/ScrapeOWL HTML is accepted without challenge detection. This contradicts the plan and risks compiling interstitial pages as content. (src/lib/content-extractor.js)
- [ ] [INFO] Missing tests: No coverage for `/api/parse-file` (PDF + OCR + `fileId` expiry/error paths) or `src/lib/temp-store.js`. No tests for GSC auth/client (`src/lib/gsc-auth.js`, `src/lib/gsc-client.js`) or CLI command flows (`src/commands/*.js`). (src/lib/temp-store.js)