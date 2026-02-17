# Claude Handoff (Auto-Updated)

Updated: 2026-02-16T15:15:39.015Z

Rubric status:
- FAIL (1 categories): Test Coverage

Paste this whole message into Claude Code:
```
Apply only the following open QA fixes, in order.
For each item: implement the change, explain why, and update/add tests.

Open items:
- [INFO] The rename from “brand doc” to “brand knowledge” is only partially reflected: implementation changed, but the plan and tests still target the old command/endpoint.
  - File: (not specified)
  - Why: Coverage gap can let regressions ship silently.
  - Done when: Code updated, tests updated/added, and QA no longer reports this item as open.
- [INFO] The new Brand Guidelines UI flow is wired to a missing backend endpoint, so it will fail at runtime.
  - File: (not specified)
  - Why: This issue impacts reliability/maintainability and should be addressed.
  - Done when: Code updated, tests updated/added, and QA no longer reports this item as open.
- [INFO] Test coverage no longer matches the code paths after the rename and the new mode.
  - File: (not specified)
  - Why: Coverage gap can let regressions ship silently.
  - Done when: Code updated, tests updated/added, and QA no longer reports this item as open.
- [INFO] `test/doc-builder.test.js`, `test/server.test.js`, `src/lib/doc-builder.js`: tests still import `buildBrandDoc` and expect `# Brand Documentation`, but the module exports `buildBrandKnowledge` and writes `# Brand Knowledge`. These tests will fail and no longer validate the current behavior.
  - File: src/lib/doc-builder.js
  - Why: Coverage gap can let regressions ship silently.
  - Done when: Code updated at src/lib/doc-builder.js, tests updated/added, and QA no longer reports this item as open.
- [INFO] Update tests to the new function/endpoint names and add coverage for the guidelines flow (SSE contract + output).
  - File: (not specified)
  - Why: Coverage gap can let regressions ship silently.
  - Done when: Code updated, tests updated/added, and QA no longer reports this item as open.

After finishing, return:
- files changed
- tests added/updated
- any remaining risks
```

Source review: docs/review.md
Open checklist: docs/qa-open.md
Rubric report: docs/qa-rubric.md