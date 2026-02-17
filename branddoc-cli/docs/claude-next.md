# What to tell Claude

Use this exact prompt:

```
Please apply these QA fixes from Codex, in priority order.
For each item: implement the code change, add/adjust tests, and summarize what changed.

Tell Claude:
1. [INFO] Fix: The rename from “brand doc” to “brand knowledge” is only partially reflected: implementation changed, but the plan and tests still target the old command/endpoint.
2. [INFO] Fix: The new Brand Guidelines UI flow is wired to a missing backend endpoint, so it will fail at runtime.
3. [INFO] Fix: Test coverage no longer matches the code paths after the rename and the new mode.
4. [INFO] Fix in src/lib/doc-builder.js: `test/doc-builder.test.js`, `test/server.test.js`, `src/lib/doc-builder.js`: tests still import `buildBrandDoc` and expect `# Brand Documentation`, but the module exports `buildBrandKnowledge` and writes `# Brand Knowledge`. These tests will fail and no longer validate the current behavior.
5. [INFO] Fix: Update tests to the new function/endpoint names and add coverage for the guidelines flow (SSE contract + output).

After fixing, provide:
- changed files
- why each fix was needed
- what tests were added/updated
```

Source review: docs/review.md
Open checklist: docs/qa-open.md