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

DataCore parser facade progress on 2026-06-04:

- Added `src/sources/datacore/xml-parser.ts` as a source-boundary facade over the existing DataCore XML parser/common normalization helpers.
- Updated `bin/scrape-datacore.ts` to import parser helpers through `src/sources/datacore`.
- Kept the legacy parser module in place for compatibility and later cleanup.
- Smoke-tested `node --import tsx/esm bin/scrape-datacore.ts --help`.

Verification:

- `node --import tsx/esm --test src/sources/datacore/xml-parser.test.ts src/sources/datacore/xml-files.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/xml-parser.ts src/sources/datacore/xml-parser.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`

Remaining for #95:

- Review DataCore extraction/acquisition orchestration before treating the scraper boundary as settled.
- Move/classify SPViewer scraper responsibilities as legacy source behavior.
- Smoke test CLI help/commands as source boundaries settle.

DataCore source closure on 2026-06-04:

- Added `src/sources/datacore/acquisition.ts`.
- Moved DataCore XML cache extraction mechanics out of `bin/scrape-datacore.ts`:
  - optional forced cache clearing
  - DCB copy into the XML cache
  - injected unforge execution
  - temporary DCB and monolithic XML cleanup
  - post-extraction XML count
- Kept CLI parse args, help text, user-facing status output, tool-install output, extraction status messages, CSV writes, and process exits in the script.
- Smoke-tested both direct script help and `npm run scrape:datacore -- --help`.
- Closed GitHub #92 after verifying the DataCore source boundary.

Verification:

- `node --import tsx/esm --test src/sources/datacore/acquisition.test.ts src/sources/datacore/xml-files.test.ts src/sources/datacore/xml-parser.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/acquisition.ts src/sources/datacore/acquisition.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`
- `npm run scrape:datacore -- --help`

Remaining for #95:

- Move/classify SPViewer scraper responsibilities as legacy source behavior.
- Smoke test CLI help/commands as source boundaries settle.

SPViewer legacy-source progress on 2026-06-04:

- Added `src/sources/spviewer/html-parser.ts` as the legacy/fallback source-boundary facade for SPViewer HTML parser helpers.
- Updated `bin/scrape-spviewer.ts` to import parser helpers through `src/sources/spviewer`.
- Updated README and architecture docs to describe SPViewer as legacy/fallback while DataCore is preferred where coverage exists.
- Smoke-tested `npm run scrape:spviewer -- --list`.
- Did not run browser scraping or write generated SPViewer CSV/JSON data.

Verification:

- `node --import tsx/esm --test src/sources/spviewer/html-parser.test.ts src/extractor/spviewer-html-parser.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-spviewer.ts src/sources/spviewer/html-parser.ts src/sources/spviewer/html-parser.test.ts`
- `npm run scrape:spviewer -- --list`

Remaining for #95:

- Run final CLI help/list smoke coverage across the settled scripts.
- Decide whether #95 can close or if folder cleanup/compatibility exports should remain tracked separately.

Closure review on 2026-06-04:

- Re-reviewed #95 acceptance and recent comments after DataCore and SPViewer source-boundary work closed.
- Confirmed direct CLI help/list smoke passes for:
  - `node --import tsx/esm bin/update-all.ts --help`
  - `node --import tsx/esm bin/update-item.ts --help`
  - `node --import tsx/esm bin/pipeline.ts --help`
  - `node --import tsx/esm bin/apply-artifact.ts --help`
  - `node --import tsx/esm bin/scrape-scmdb.ts --help`
  - `node --import tsx/esm bin/scrape-datacore.ts --help`
  - `node --import tsx/esm bin/scrape-spviewer.ts --help`
  - `node --import tsx/esm bin/regen-mining-locations.ts --help`
- Confirmed npm-script smoke passes for:
  - `npm run update -- --help`
  - `npm run pipeline -- --help`
  - `npm run scrape:scmdb -- --help`
  - `npm run scrape:datacore -- --help`
  - `npm run scrape:spviewer -- --list`
- Confirmed `parseArgs`, user-facing `console.*`, and `process.exit` calls are in `bin/*.ts` rather than application/source modules.
- Did not run update dry-runs or real scraper commands because those may touch local/generated data.

Verification:

- `npm run typecheck`
- `npm test`
- CLI smoke commands listed above

Remaining for #95:

- Do not close #95 yet: older issue context explicitly calls out that `runFullPipeline` still shells out through `spawnSync` for scraper/update steps.
- Add callable application/source entry points for pipeline orchestration so `runFullPipeline` can call in-process functions and return structured errors, while `bin/*.ts` remain CLI adapters.
- Keep broad folder cleanup and compatibility export removal for their separate issues unless this narrow pipeline orchestration work requires a small compatibility note.
