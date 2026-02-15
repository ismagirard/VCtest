# What to tell Claude

Use this exact prompt:

```
Please apply these QA fixes from Codex, in priority order.
For each item: implement the code change, add/adjust tests, and summarize what changed.

Tell Claude:
1. [INFO] Fix in docs/plan.md: Plan/contract mismatch: `docs/plan.md` doesn’t mention `/api/parse-file`, the `fileId` temp-store flow, or OCR system dependencies, but they are implemented in `src/server.js` and `src/lib/temp-store.js`. This is a doc gap and a missing deployment step (`pdftoppm`/`tesseract` availability).
2. [INFO] Fix in src/lib/content-extractor.js: Anti‑bot detection isn’t applied at all tiers: `src/lib/content-extractor.js` only checks `isRealContent` for direct HTTP fetches; Puppeteer/ScrapeOWL HTML is accepted without challenge detection. This contradicts the plan and risks compiling interstitial pages as content.
3. [INFO] Fix in src/lib/temp-store.js: Missing tests: No coverage for `/api/parse-file` (PDF + OCR + `fileId` expiry/error paths) or `src/lib/temp-store.js`. No tests for GSC auth/client (`src/lib/gsc-auth.js`, `src/lib/gsc-client.js`) or CLI command flows (`src/commands/*.js`).

After fixing, provide:
- changed files
- why each fix was needed
- what tests were added/updated
```

Source review: docs/review.md
Open checklist: docs/qa-open.md