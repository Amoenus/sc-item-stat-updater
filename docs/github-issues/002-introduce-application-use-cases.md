# Introduce Application Use Cases

## Type

Task

## Labels

`architecture`, `application`, `refactor`

## Depends On

- 001: Define Core Pipeline Types

## Problem

Important workflow orchestration currently lives in `bin/*.ts`, especially `bin/pipeline.ts` and `bin/update-all.ts`. That makes core behavior harder to test and reuse because CLI parsing, progress output, subprocess calls, data discovery, update execution, and process exits are mixed together.

## Goal

Introduce application use cases that can be called by CLI scripts without knowing CLI details.

## Proposed Location

```text
src/application/use-cases/
  refresh-global-ini.ts
  scrape-data-sources.ts
  build-patch-plan.ts
  enrich-global-ini.ts
  deploy-global-ini.ts
  run-full-pipeline.ts
```

## Implementation Notes

- Start with use cases that wrap current functions rather than rewriting all internals.
- Keep `bin/*.ts` working during the migration.
- Use dependency injection only where it meaningfully improves tests. Plain function parameters are enough at first.
- Avoid `process.exit` inside use cases. Return structured success/failure results and let CLI adapters decide how to exit.

## Acceptance Criteria

- At least `runFullPipeline` and `enrichGlobalIni` exist as callable use-case functions.
- `bin/pipeline.ts` delegates meaningful work to `runFullPipeline`.
- `bin/update-all.ts` starts delegating meaningful work to `enrichGlobalIni` or a smaller use case.
- Use cases do not parse CLI arguments directly.
- Use cases do not call `process.exit`.
- Existing npm scripts still work.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run update -- --dry-run` if local data files are available.
- Run `npm run pipeline -- --dry-run` only if the local game-file environment is configured.

## Progress

Started on 2026-06-04:

- Added `src/application/use-cases/run-full-pipeline.ts`.
- Added `src/application/use-cases/enrich-global-ini.ts`.
- Added `src/application/use-cases/build-patch-plan.ts`.
- Updated `bin/pipeline.ts` to delegate to `runFullPipeline`.
- Updated `bin/update-all.ts` standard category loop to call `enrichGlobalIni`.
- Use cases return structured results and do not call `process.exit`.
- Verified with `npm run typecheck` and `npm test`.

Updated on 2026-06-04:

- `buildPatchPlan` now returns the actual `PatchPlan` produced by the extracted updater planner.
- This use case is intentionally thin for the migration: it provides a stable application boundary while orchestration is moved out of `src/lib/updater.ts`.

Continued on 2026-06-04:

- `buildPatchPlanResult` now owns source-row loading, INI context reading, SPViewer key resolution, and planner invocation for patch-plan callers.
- Artifact generation now consumes the application planning use case instead of calling the legacy `buildPatchData` bridge.
- `bin/update-all.ts --emit-artifact` now routes through `generateArtifact`, with artifact planning prepared before any non-dry-run INI writes.

Continued on 2026-06-04:

- Added `prepareUpdateCategories` as an application use case for `bin/update-all.ts` category/version preparation.
- The use case now resolves latest SCMDB and provider-specific source directories, loads provider/mission configs, filters skipped mission configs, and returns category/source-directory pairs for both artifact planning and update execution.
- `bin/update-all.ts` now consumes that prepared result while retaining CLI-only responsibilities such as parsing args, progress display, preflight, backups, process exits, and artifact file emission.
- Added tests for LIVE/PTU version directory resolution and missing-channel scraper hints.

Completed on 2026-06-04:

- Added `runPreparedUpdateCategories` as the application use case for executing a prepared batch of category updates.
- `bin/update-all.ts` now delegates the standard category update loop to the use case while keeping progress rendering, logging, preflight, backups, artifact writing, and exit codes in the CLI script.
- Added focused tests proving that prepared source directories are passed through per category and that category failures are collected while later categories continue.
- Acceptance criteria for this issue are met:
  - `runFullPipeline` and `enrichGlobalIni` exist as callable use cases.
  - `bin/pipeline.ts` delegates meaningful work to `runFullPipeline`.
  - `bin/update-all.ts` delegates meaningful preparation and enrichment execution work to application use cases.
  - use cases do not parse CLI arguments or call `process.exit`.
  - existing npm scripts are verified through typecheck and tests.

Follow-up:

- Extract smaller use cases for refresh, scrape, deploy, and batch enrichment once `runUpdate` is split further.
- Continue reducing `runUpdate` compatibility reliance under Issue 003 and CLI thin-adapter work under Issue 011.
