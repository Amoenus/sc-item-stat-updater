# Make CLI Scripts Thin Adapters

## Type

Task

## Labels

`architecture`, `cli`, `refactor`

## Depends On

- 002: Introduce Application Use Cases
- 006: Add Deployment Use Case
- 008: Move DataCore Source Modules
- 009: Move SCMDB Source Modules
- 010: Classify SPViewer As Legacy Provider

## Problem

`bin/*.ts` scripts currently contain significant business workflow logic. This makes the CLI the center of the architecture instead of a presentation adapter.

## Goal

Move reusable behavior into application/source/localization modules and leave `bin/*.ts` responsible for CLI parsing, output formatting, and exit codes.

## Implementation Notes

- Do this after the main use cases exist.
- Keep command names and npm scripts stable unless there is a clear migration note.
- Use shared CLI utilities for log flags, help text, and error printing.
- Avoid creating a large CLI framework unless the current scripts become difficult to maintain.

## Acceptance Criteria

- `bin/pipeline.ts` delegates pipeline behavior to `runFullPipeline`.
- `bin/update-all.ts` delegates enrichment behavior to application use cases.
- Scraper scripts delegate acquisition/normalization behavior to source modules.
- No use case calls `parseArgs`, `console.log` for user-facing CLI output, or `process.exit`.
- Existing npm scripts still work.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Smoke test `--help` for each CLI script.
- Run `npm run update -- --dry-run` if local data is available.

## Progress

2026-06-04:

- `bin/pipeline.ts` already delegates pipeline behavior to `runFullPipeline`.
- `bin/update-all.ts` delegates standard category updates to `enrichGlobalIni`.
- `bin/update-all.ts --emit-artifact` delegates patch artifact planning to `generateArtifact`.
- Added `prepareUpdateCategories` and updated `bin/update-all.ts` to delegate provider/source-directory discovery and category assembly to the application layer.
- The script still owns CLI parsing, progress output, preflight, mining regeneration, backups, extra update steps, artifact file writing, and exit codes.

Continued on 2026-06-04:

- Added `runPreparedUpdateCategories` and updated `bin/update-all.ts` to delegate the prepared category execution loop to the application layer.
- The CLI observes the use case through callbacks for progress rendering and category error logging, but the use case owns per-category option composition, `csvDir` selection, failure collection, and continue-on-error behavior.
- The script still owns CLI parsing, progress output, preflight, mining regeneration, backups, extra update steps, artifact file writing, and exit codes.

Updated on 2026-06-04:

- Updated `bin/update-item.ts` to delegate single-category enrichment to `enrichGlobalIni` instead of importing the legacy `runUpdate` compatibility helper.
- `enrichGlobalIni` now owns patch-plan application and conditional INI writing, so CLI callers can depend on an application use case for the standard enrichment path.

Remaining:

- Extract or classify the remaining `update-all` extra update steps once their result/error reporting can be represented without CLI concerns.
- Move scraper acquisition/normalization behavior behind source modules before doing broad folder cleanup.

Continued on 2026-06-04:

- Added `runUpdateExtraSteps` under `src/application/use-cases`.
- Added `getUpdateExtraStepLabels` so `bin/update-all.ts` can keep progress totals/order without owning step classification.
- Moved the remaining `update-all` extra-step execution loop into the use case:
  - Component Titles
  - FPS title tags
  - Missile title tags
  - optional Mining journal
  - Raw commodity labels
  - Adagio location tags (experimental)
- Kept `bin/update-all.ts` responsible for CLI concerns: parse args, progress rendering, logger callbacks, preflight, mining-regeneration orchestration, backups, artifact writing, summaries, shutdown, and exit codes.
- Added injected-runner coverage for step ordering, optional mining journal inclusion, skipped/null step results, and continue-on-error behavior.

Verification:

- `node --import tsx/esm --test src/application/use-cases/run-update-extra-steps.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/update-all.ts src/application/use-cases/run-update-extra-steps.ts src/application/use-cases/run-update-extra-steps.test.ts`

Remaining:

- Move scraper acquisition/normalization behavior behind source modules.
- Smoke test CLI help/commands as the script boundary settles.

Continued on 2026-06-04:

- Added `src/sources/scmdb/version-selection.ts`.
- Moved SCMDB LIVE/PTU classification and version selection out of `bin/scrape-scmdb.ts`.
- Kept CLI argument parsing, help output, user-facing messages, and process exits in the scraper script.
- Added focused source-module tests for explicit version selection, PTU selection, default LIVE selection, fallback behavior, and missing-version errors.
- Smoke-tested `node --import tsx/esm bin/scrape-scmdb.ts --help`.

Verification:

- `node --import tsx/esm --test src/sources/scmdb/version-selection.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/version-selection.ts src/sources/scmdb/version-selection.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Remaining:

- Continue moving SCMDB scraper acquisition/normalization behavior behind `src/sources/scmdb`.
- Move DataCore/SPViewer scraper responsibilities behind source/acquisition modules.

Continued on 2026-06-04:

- Added `src/sources/scmdb/acquisition.ts`.
- Moved SCMDB data URL construction, JSON fetching, User-Agent handling, HTTP failure reporting, and schema validation out of `bin/scrape-scmdb.ts`.
- Updated the scraper script to delegate versions fetch/validation, merged-data fetch, companion URL building, and optional companion JSON fetches to the source module.
- Kept CLI help output, user-facing status messages, output writes, argument interpretation, and process exits in the scraper script.
- Smoke-tested `node --import tsx/esm bin/scrape-scmdb.ts --help`.

Verification:

- `node --import tsx/esm --test src/sources/scmdb/acquisition.test.ts src/sources/scmdb/version-selection.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/acquisition.ts src/sources/scmdb/acquisition.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Remaining:

- Continue moving SCMDB row assembly/output planning behind source modules.
- Move DataCore/SPViewer scraper responsibilities behind source/acquisition modules.

Continued on 2026-06-04:

- Added `src/sources/scmdb/outputs.ts`.
- Moved SCMDB CSV header contracts and pure row-group assembly out of `bin/scrape-scmdb.ts`.
- Updated the scraper script to delegate source row assembly to `buildScmdbOutputRows` while keeping output writing, user-facing messages, args, and exits in the script.
- Smoke-tested `node --import tsx/esm bin/scrape-scmdb.ts --help`.

Verification:

- `node --import tsx/esm --test src/sources/scmdb/outputs.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/outputs.ts src/sources/scmdb/outputs.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Remaining:

- Continue moving SCMDB output planning behind source modules.
- Move DataCore/SPViewer scraper responsibilities behind source/acquisition modules.

Continued on 2026-06-04:

- Added `src/sources/scmdb/output-files.ts`.
- Added `planScmdbOutputFiles` so `bin/scrape-scmdb.ts` no longer owns the output row-group decision ladder.
- Updated the scraper script to loop over planned output descriptors while keeping filesystem writes, user-facing messages, args, and exits in the script.
- Smoke-tested `node --import tsx/esm bin/scrape-scmdb.ts --help`.

Verification:

- `node --import tsx/esm --test src/sources/scmdb/output-files.test.ts src/sources/scmdb/outputs.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/output-files.ts src/sources/scmdb/output-files.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Remaining:

- Move DataCore/SPViewer scraper responsibilities behind source/acquisition modules.
- Reassess #95 once SCMDB source-module boundaries are stable.

Related SCMDB closure on 2026-06-04:

- Added SCMDB parser source facades under `src/sources/scmdb`.
- Updated SCMDB output assembly to consume those facades.
- Closed GitHub #93 after verifying SCMDB source behavior now has a stable source boundary while `bin/scrape-scmdb.ts` keeps CLI-specific output/writes/exits.

Remaining for #95:

- Move DataCore scraper responsibilities behind source/acquisition modules.
- Move/classify SPViewer scraper responsibilities as legacy source behavior.
- Smoke test CLI help/commands as source boundaries settle.

DataCore progress on 2026-06-04:

- Added `src/sources/datacore/xml-files.ts`.
- Moved DataCore DCB discovery, XML cache discovery, XML path filtering, and XML cache counting out of `bin/scrape-datacore.ts`.
- Kept CLI parsing, help text, extraction orchestration, CSV writes, user-facing output, and process exits in the scraper script.
- Smoke-tested `node --import tsx/esm bin/scrape-datacore.ts --help`.

Verification:

- `node --import tsx/esm --test src/sources/datacore/xml-files.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/xml-files.ts src/sources/datacore/xml-files.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`

Remaining for #95:

- Continue moving DataCore parser/acquisition responsibilities behind source modules.
- Move/classify SPViewer scraper responsibilities as legacy source behavior.
- Smoke test CLI help/commands as source boundaries settle.
