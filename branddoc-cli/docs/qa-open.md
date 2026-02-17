# QA Open Issues

Updated: 2026-02-16T15:15:39.014Z

Open count: 5

- [ ] [INFO] The rename from “brand doc” to “brand knowledge” is only partially reflected: implementation changed, but the plan and tests still target the old command/endpoint.
- [ ] [INFO] The new Brand Guidelines UI flow is wired to a missing backend endpoint, so it will fail at runtime.
- [ ] [INFO] Test coverage no longer matches the code paths after the rename and the new mode.
- [ ] [INFO] `test/doc-builder.test.js`, `test/server.test.js`, `src/lib/doc-builder.js`: tests still import `buildBrandDoc` and expect `# Brand Documentation`, but the module exports `buildBrandKnowledge` and writes `# Brand Knowledge`. These tests will fail and no longer validate the current behavior. (src/lib/doc-builder.js)
- [ ] [INFO] Update tests to the new function/endpoint names and add coverage for the guidelines flow (SSE contract + output).