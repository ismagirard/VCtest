# Claude Handoff (Auto-Updated)

Updated: 2026-02-15T14:28:34.399Z

Rubric status:
- FAIL (3 categories): Correctness, Test Coverage, Security

Paste this whole message into Claude Code:
```
Apply only the following open QA fixes, in order.
For each item: implement the change, explain why, and update/add tests.

Open items:
- [INFO] Plan/contract mismatch: `docs/plan.md` doesn’t mention `/api/parse-file`, the `fileId` temp-store flow, or OCR system dependencies, but they are implemented in `src/server.js` and `src/lib/temp-store.js`. This is a doc gap and a missing deployment step (`pdftoppm`/`tesseract` availability).
  - File: docs/plan.md
  - Why: This issue impacts reliability/maintainability and should be addressed.
  - Done when: Code updated at docs/plan.md, tests updated/added, and QA no longer reports this item as open.
- [INFO] Anti‑bot detection isn’t applied at all tiers: `src/lib/content-extractor.js` only checks `isRealContent` for direct HTTP fetches; Puppeteer/ScrapeOWL HTML is accepted without challenge detection. This contradicts the plan and risks compiling interstitial pages as content.
  - File: src/lib/content-extractor.js
  - Why: This is a structural risk that can reappear in future changes.
  - Done when: Code updated at src/lib/content-extractor.js, tests updated/added, and QA no longer reports this item as open.
- [INFO] Missing tests: No coverage for `/api/parse-file` (PDF + OCR + `fileId` expiry/error paths) or `src/lib/temp-store.js`. No tests for GSC auth/client (`src/lib/gsc-auth.js`, `src/lib/gsc-client.js`) or CLI command flows (`src/commands/*.js`).
  - File: src/lib/temp-store.js
  - Why: Coverage gap can let regressions ship silently.
  - Done when: Code updated at src/lib/temp-store.js, tests updated/added, and QA no longer reports this item as open.

After finishing, return:
- files changed
- tests added/updated
- any remaining risks
```

Source review: docs/review.md
Open checklist: docs/qa-open.md
Rubric report: docs/qa-rubric.md