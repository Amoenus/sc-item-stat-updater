# Clean Pipeline Rewrite Implementation Plan

This plan converts ADR 005 into an implementation backlog. The issue files in `docs/github-issues/` are written so they can be copied into GitHub issues with minimal editing.

## Guiding Principles

- Move behavior behind tested use cases before renaming large folders.
- Keep every step runnable through existing npm scripts while migration is in progress.
- Preserve current output unless an issue explicitly changes behavior.
- Prefer small module moves with compatibility exports over one large folder reshuffle.
- Keep `global.ini` mutation isolated from source acquisition and source parsing.

## Proposed Milestones

### Milestone 1: Pipeline Foundation

Goal: introduce the core pipeline types and application use cases without disrupting existing commands.

- [Issue 000](github-issues/000-clean-pipeline-rewrite-epic.md): Clean Pipeline Rewrite Epic
- [Issue 001](github-issues/001-define-core-pipeline-types.md): Define Core Pipeline Types
- [Issue 002](github-issues/002-introduce-application-use-cases.md): Introduce Application Use Cases
- [Issue 003](github-issues/003-split-updater-into-planning-and-application.md): Split Updater Into Planning And Application

### Milestone 2: Localization Boundary

Goal: make INI/localization behavior explicit and testable.

- [Issue 004](github-issues/004-create-localization-boundary.md): Create Localization Boundary
- [Issue 005](github-issues/005-align-artifacts-with-patch-plans.md): Align Artifacts With Patch Plans
- [Issue 006](github-issues/006-add-deployment-use-case.md): Add Deployment Use Case

### Milestone 3: Source Boundaries

Goal: move source-specific acquisition and normalization behind clear modules.

- [Issue 007](github-issues/007-create-source-dataset-contracts.md): Create Source Dataset Contracts
- [Issue 008](github-issues/008-move-datacore-source-modules.md): Move DataCore Source Modules
- [Issue 009](github-issues/009-move-scmdb-source-modules.md): Move SCMDB Source Modules
- [Issue 010](github-issues/010-classify-spviewer-as-legacy-provider.md): Classify SPViewer As Legacy Provider

### Milestone 4: CLI And Folder Cleanup

Goal: finish the visible structure after behavior has stable homes.

- [Issue 011](github-issues/011-make-cli-scripts-thin-adapters.md): Make CLI Scripts Thin Adapters
- [Issue 012](github-issues/012-clean-up-lib-items-and-folder-layout.md): Clean Up `lib`, `items`, And Folder Layout
- [Issue 013](github-issues/013-add-architecture-guardrails.md): Add Architecture Guardrails

## Suggested Order

1. 001
2. 002
3. 003
4. 004
5. 005
6. 006
7. 007
8. 008 and 009 in either order
9. 010
10. 011
11. 012
12. 013

## Progress Checkpoints

### 2026-06-04: Milestone 1 foundation started

Implemented:

- Issue 001 core contracts in `src/pipeline/types.ts`.
- Initial Issue 002 use cases in `src/application/use-cases/`:
  - `runFullPipeline`
  - `enrichGlobalIni`
  - `buildPatchPlan`
- Initial Issue 003 localization boundary files:
  - `src/localization/patch-plan.ts`
  - `src/localization/patch-application.ts`
  - `src/localization/update-issues.ts`
- `bin/pipeline.ts` now delegates orchestration to `runFullPipeline`.
- `bin/update-all.ts` now routes standard category updates through `enrichGlobalIni`.
- `src/lib/updater.ts` still preserves `runUpdate`, but delegates line patching and insertion to localization application helpers.
- `npm test` was adjusted so the Node test runner discovers tests correctly in PowerShell.

Verified:

- `npm run typecheck`
- `npm test`

Next agent instructions:

1. Continue Issue 003 by turning `runUpdate` into clearer composition of planning plus application.
2. Extract a real in-memory planning function from `src/lib/updater.ts` that reads rows and INI context, returns `PatchPlan` plus summary counters, and does not write files.
3. Teach `runUpdate` to call that planner, apply the resulting plan to INI lines, validate integrity, and write only in the application step.
4. Preserve compatibility exports from `src/lib/updater.ts` until CLI and artifact callers move fully to use cases.
5. Add focused tests for planning separately from application. Use small INI/row fixtures; do not require scraped CSV directories.
6. Keep `npm run pipeline:scrape:datacore` and `npm run update -- --dry-run --provider datacore` behavior stable.

### 2026-06-04: Issue 003 planner extraction

Implemented:

- Extracted `buildUpdatePlan` from `src/lib/updater.ts`.
- `buildUpdatePlan` accepts item config, resolved rows, and an in-memory INI context, then returns:
  - `PatchPlan` entries
  - update issues
  - existing summary counters needed by `runUpdate`
- Reworked `runUpdate` as composition:
  - load source data
  - read INI context
  - resolve SPViewer localization keys when needed
  - build an in-memory update plan
  - apply the plan with localization application helpers
  - validate integrity
  - write only when requested by non-dry-run options
- Extended `PatchEntry` with optional `existingLineIndex` as an in-memory migration hint so duplicate/suffixed INI entries keep current behavior.
- Updated `buildPatchPlan` to return the planner's actual `PatchPlan`.
- Kept `buildPatchData` and `runUpdate` compatibility result fields for artifact and CLI callers.
- Added focused planner tests using tiny in-memory fixtures.
- Added application tests for explicit line-index patch application.

Verified:

- `npm run typecheck`
- `npm test`
- `npm run update -- --dry-run --provider datacore`
- `npx biome lint` on the touched files

Notes:

- Full `npm run lint` is still blocked by pre-existing unrelated issues, including `.fallowrc.json` parse errors, the Biome schema version mismatch, and older lint findings outside this change.
- `src/application/use-cases/build-patch-plan.ts` is intentionally thin during this migration. It should either grow into the orchestration owner for loading rows/INI context and calling `buildUpdatePlan`, or be removed once callers can depend on a stable planner API directly.

Next agent instructions:

1. Continue Issue 003/005 by deciding how `PatchPlan` should map to artifact JSON.
2. Avoid leaking `existingLineIndex` into persisted artifacts unless ADR/docs are updated to make that part of the contract.
3. Move more orchestration from `src/lib/updater.ts` into `src/application/use-cases/build-patch-plan.ts` so the use case stops being a thin pass-through.
4. Keep `runUpdate` as compatibility glue until CLI/artifact callers are fully moved.
5. Add tests for artifact generation once it consumes `PatchPlan` directly or formally documents the legacy `patches` map bridge.
6. Do not rename `src/lib` or `src/items` yet.

### 2026-06-04: Issue 005 artifact alignment started

Implemented:

- `src/application/use-cases/build-patch-plan.ts` now owns the source-row loading, INI context reading, SPViewer key resolution, and planner invocation for patch planning callers.
- Added `buildPatchPlanResult` for callers that need the planner stats alongside the `PatchPlan`.
- Artifact generation now consumes `buildPatchPlanResult` and serializes from the resulting `PatchPlan`.
- `bin/update-all.ts --emit-artifact` now prepares artifacts through `generateArtifact` before applying updates, so non-dry-run artifact emission is based on the original planning context instead of the already-mutated INI.
- Added artifact conversion helpers:
  - `patchPlanToArtifactEntries`
  - `artifactToPatchPlan`
- Kept artifact JSON as the existing compact `entries: Record<string, string>` shape for compatibility.
- Documented that `PatchEntry.existingLineIndex` is an in-memory application hint and is not serialized to artifact JSON.
- Added fixture-driven coverage for `generateArtifact`.

Verified:

- `npm run typecheck`
- `npm test`
- `npx biome lint` on the touched source files
- `npm run update -- --dry-run --provider datacore`
- `npm run update -- --dry-run --provider datacore --emit-artifact <temp path>`

Next agent instructions:

1. Continue moving compatibility callers away from `buildPatchData` where they can consume `PatchPlan` or artifact conversion helpers directly.
2. Keep `runUpdate` as compatibility glue until CLI callers are moved onto use cases.
3. Decide whether `existingLineIndex` should move out of the core `PatchEntry` type once localization variants have a cleaner model.
4. Consider extracting the `update-all` category/version resolution into an application use case so CLI artifact emission and update execution share less script-local orchestration.

### 2026-06-04: Update category preparation use case

Implemented:

- Added `src/application/use-cases/prepare-update-categories.ts`.
- Moved `bin/update-all.ts` category/version preparation into the application layer:
  - latest SCMDB directory resolution
  - latest SPViewer/DataCore directory resolution
  - provider-specific item config loading
  - mission config loading and skip filtering
  - category-to-source-directory pairing
  - `spviewerVersionDir` compatibility output for SPViewer-only extra steps
- Kept `bin/update-all.ts` responsible for CLI parsing, logging/progress output, preflight, mining regeneration, backups, extra update steps, artifact writing, and exit codes.
- Added focused temp-directory tests for LIVE/PTU version directory selection and missing-channel scraper-hint errors.
- Did not rename `src/lib` or `src/items`.
- Did not include generated/scraped data changes.

Verified:

- `npm run typecheck`
- `npm test`
- `npx biome lint bin/update-all.ts src/application/use-cases/prepare-update-categories.ts src/application/use-cases/prepare-update-categories.test.ts`
- `node --import tsx/esm --test src/application/use-cases/prepare-update-categories.test.ts`

Notes:

- Optional update dry-runs were intentionally skipped for this slice because `bin/update-all.ts` still regenerates mining data before update execution, even in dry-run mode.

Next agent instructions:

1. Continue reducing `bin/update-all.ts` by extracting the actual batch update execution into an application use case that can consume prepared categories.
2. Keep preflight, progress rendering, process exits, and CLI output in the script until the application result shape is explicit.
3. Add artifact-loader fixture tests that generate or load a compact artifact and apply it to an INI fixture.
4. Continue moving callers away from `buildPatchData`; leave it as compatibility glue until no old callers depend on it.
5. Keep `runUpdate` compatibility until CLI callers can depend fully on application use cases.
6. Do not broadly rename `src/lib` or `src/items` yet.

### 2026-06-04: Prepared category execution use case

Primary issue:

- Issue 002 / GitHub #86: Introduce Application Use Cases

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters
- Issue 005 / GitHub #89: Align Artifacts With Patch Plans

Implemented:

- Added `src/application/use-cases/run-prepared-update-categories.ts`.
- Moved the standard `bin/update-all.ts` category execution loop into the application layer:
  - consumes prepared category/source-directory pairs
  - applies shared update options while preserving each category's prepared `csvDir`
  - collects successful category results
  - collects category errors and continues to later categories
  - exposes callbacks for CLI progress/error observation without using CLI output or exits
- Updated `bin/update-all.ts` to call `runPreparedUpdateCategories` while keeping CLI parsing, progress rendering, preflight, mining regeneration, backups, extra update steps, artifact writing, summary printing, logger shutdown, and exit codes in the script.
- Added `runPreparedUpdateCategories` tests for per-category `csvDir` propagation and continue-on-error behavior.
- Added artifact-loader fixture tests that read compact artifact JSON and apply it to temp INI fixtures.
- Did not rename `src/lib` or `src/items`.
- Did not include generated/scraped data changes.

Verified:

- `npm run typecheck`
- `npm test`
- `node --import tsx/esm --test src/application/use-cases/run-prepared-update-categories.test.ts`
- `npx biome lint bin/update-all.ts src/application/use-cases/run-prepared-update-categories.ts src/application/use-cases/run-prepared-update-categories.test.ts src/artifact/loader.test.ts`

Notes:

- Issue 002 / GitHub #86 acceptance criteria are now met and can be closed after syncing the GitHub issue.
- Issue 011 / GitHub #95 remains open because scraper scripts and remaining `update-all` extra steps still need clearer application/source boundaries.
- Issue 005 / GitHub #89 remains open until artifact alignment acceptance is fully reviewed and any remaining schema/docs expectations are satisfied.
- Optional update dry-runs were intentionally skipped for this slice because `bin/update-all.ts` still regenerates mining data before update execution, even in dry-run mode.

Next agent instructions:

1. Start from the committed slice named `Extract prepared category execution`.
2. Continue Issue 003 / GitHub #87 by reducing compatibility reliance on `runUpdate` and `buildPatchData`, or continue Issue 011 / GitHub #95 by classifying/extracting the remaining `update-all` extra update steps.
3. Keep preflight, progress rendering, process exits, and user-facing CLI output in scripts unless a use-case result shape makes the boundary explicit.
4. Keep `runUpdate` compatibility until CLI callers can depend fully on application use cases.
5. Do not broadly rename `src/lib` or `src/items` yet.
6. Do not include local scraped/generated data unless explicitly requested.
7. Verification to run:
   - `npm run typecheck`
   - `npm test`
   - touched-file `npx biome lint`
   - Optional only if generated data changes are acceptable: `npm run update -- --dry-run --provider datacore`
   - Optional only if generated data changes are acceptable: `npm run update -- --dry-run --provider datacore --emit-artifact <temp path>`

### 2026-06-04: Enrichment application use case

Primary issue:

- Issue 003 / GitHub #87: Split Updater Into Planning And Application

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Reworked `src/application/use-cases/enrich-global-ini.ts` from a direct `runUpdate` wrapper into the application use case for standard enrichment application.
- `enrichGlobalIni` now consumes `buildPatchPlanResult`, applies the resulting `PatchPlan` with localization application helpers, validates INI integrity, conditionally writes the updated INI, and returns the CLI-compatible summary/stat/issue shape.
- Extended `buildPatchPlanResult` to return the INI lines and index it already loads so application callers can apply the patch plan without rereading the INI or relying on `runUpdate`.
- Updated `bin/update-item.ts` to call `enrichGlobalIni` directly instead of importing `runUpdate`.
- Added `enrichGlobalIni` fixture tests for non-dry-run writes and dry-run non-writing behavior.
- Did not rename `src/lib` or `src/items`.
- Did not include generated/scraped data changes.

Verified:

- `node --import tsx/esm --test src/application/use-cases/enrich-global-ini.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/update-item.ts src/application/use-cases/build-patch-plan.ts src/application/use-cases/enrich-global-ini.ts src/application/use-cases/enrich-global-ini.test.ts`

Notes:

- `runUpdate` remains compatibility glue and still contains its legacy orchestration for old callers.
- `buildPatchData` remains for old callers and still delegates through `runUpdate`.
- Optional update dry-runs were intentionally skipped because they can touch generated/local data through the wider update flow.

### 2026-06-04: Patch-data compatibility no longer routes through runUpdate

Primary issue:

- Issue 003 / GitHub #87: Split Updater Into Planning And Application

Implemented:

- Extracted shared in-memory planning/application orchestration inside `src/lib/updater.ts`.
- Kept `runUpdate` as compatibility glue for old imports, with its write decision and CLI-compatible result shape unchanged.
- Reworked `buildPatchData` so it no longer delegates through `runUpdate`; it now plans and applies in memory, validates integrity, and returns the legacy dry-run patch-data shape without writing.
- Updated the `buildPatchData` comment to describe it as a compatibility API now that artifact generation consumes patch-plan use cases directly.
- Added fixture coverage showing `buildPatchData` returns patches and leaves `global.ini` unchanged.

Verified:

- `node --import tsx/esm --test src/lib/updater.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint src/lib/updater.ts src/lib/updater.test.ts`

Notes:

- `runUpdate` remains a compatibility export for old imports.
- `buildPatchData` remains a compatibility export for old imports, but no longer depends on `runUpdate`.
- No scraped/generated data changes were included.

Next agent instructions:

1. Start from the committed slice named `Stop patch-data compatibility from routing through runUpdate`.
2. Continue Issue 003 / GitHub #87 by deciding the long-term home of `PatchEntry.existingLineIndex`, or by continuing to shrink `runUpdate` once remaining old imports are known.
3. Keep `runUpdate` compatibility until no CLI or artifact callers depend on it.
4. Continue Issue 011 / GitHub #95 only as a separate explicit slice, likely by classifying/extracting remaining `update-all` extra update steps.
5. Keep preflight, progress rendering, process exits, and user-facing CLI output in scripts unless a use-case result shape is explicit.
6. Do not broadly rename `src/lib` or `src/items` yet.
7. Do not include local scraped/generated data unless explicitly requested.
8. Verification to run:
   - `npm run typecheck`
   - `npm test`
   - touched-file `npx biome lint`
   - Optional only if generated data changes are acceptable: `npm run update -- --dry-run --provider datacore`
   - Optional only if generated data changes are acceptable: `npm run update -- --dry-run --provider datacore --emit-artifact <temp path>`

### 2026-06-04: Localization application owns line-index metadata

Primary issue:

- Issue 003 / GitHub #87: Split Updater Into Planning And Application

Secondary impact:

- Issue 005 / GitHub #89: Align Artifacts With Patch Plans

Implemented:

- Removed `existingLineIndex` from the core `PatchEntry` type in `src/pipeline/types.ts`.
- Added `LocalizationPatchEntry` and `LocalizationPatchPlan` in `src/localization/patch-application.ts` as the application-only type home for duplicate/suffixed-key line-index metadata.
- Kept `buildPatchPlan` returning the clean core `PatchPlan` for new planning flows.
- Kept `buildPatchPlanResult`, `runUpdate`, and `buildPatchData` able to carry localization application metadata internally so current INI duplicate and suffix behavior is unchanged.
- Updated artifact comments, schema comments, architecture docs, and local issue notes to describe `existingLineIndex` as localization application metadata rather than core patch-plan or artifact data.
- Did not rename `src/lib` or `src/items`.
- Did not include generated/scraped data changes.

Verified:

- `npm run typecheck`
- `node --import tsx/esm --test src/localization/patch-application.test.ts src/lib/updater.test.ts src/artifact/artifact.test.ts`
- `npm test`
- `npx biome lint src/pipeline/types.ts src/localization/patch-application.ts src/localization/patch-application.test.ts src/lib/updater.ts src/artifact/artifact.ts src/artifact/artifact.test.ts src/schema/artifact.schema.ts`

Notes:

- `runUpdate` remains a compatibility export for old imports.
- `buildPatchData` remains a compatibility export for old imports, but new planning flows should prefer `buildPatchPlan` / `buildPatchPlanResult`.
- Issue #87 may be close to completion, but full issue closure should first review whether the requested dry-run comparison coverage has been satisfied for DataCore/SPViewer and SCMDB mission categories.

Next agent instructions:

1. Start from the committed slice named `Move line-index metadata to localization application`.
2. Inspect GitHub #87 and decide whether the next slice can close it or should only add final verification/cleanup.
3. If closing #87, run full verification and compare at least one DataCore/SPViewer dry run and one SCMDB mission dry run if generated/local data changes are acceptable.
4. Otherwise, continue shrinking compatibility around `runUpdate` only after confirming remaining old imports.
5. Keep Issue #95 separate unless explicitly choosing that slice; classify/extract update-all extra steps only under that scope.
6. Keep preflight, progress rendering, process exits, and user-facing CLI output in scripts unless a use-case result shape is explicit.
7. Do not broadly rename `src/lib` or `src/items` yet.
8. Do not include local scraped/generated data unless explicitly requested.
9. Verification to run:
   - `npm run typecheck`
   - `npm test`
   - touched-file `npx biome lint`
   - Optional only if generated data changes are acceptable: `npm run update -- --dry-run --provider datacore`
   - Optional only if generated data changes are acceptable: SCMDB mission-category dry-run comparison

### 2026-06-04: Issue 003 closure verification

Primary issue:

- Issue 003 / GitHub #87: Split Updater Into Planning And Application

Implemented:

- Reviewed Issue 003/#87 acceptance after the line-index metadata slice.
- Confirmed patch planning is available without writing through `buildUpdatePlan`, `buildPatchPlan`, and `buildPatchPlanResult`.
- Confirmed INI application is separate through `applyPatchPlanToIniLines`.
- Confirmed `runUpdate` remains compatibility composition over planning, application, integrity validation, and conditional writing.
- Confirmed separate planner/application tests exist and existing updater tests pass.
- Compared dry-run outputs from legacy compatibility `runUpdate` and application use case `enrichGlobalIni` on temp INI copies for:
  - SPViewer category `sp-weapon-guns`
  - SCMDB mission category `mission-scmdb-descriptions`
- No scraped/generated data changes were included.

Verified:

- `npm run typecheck`
- `npm test`
- Dry-run comparison: `runUpdate` vs `enrichGlobalIni` matched for `sp-weapon-guns`.
- Dry-run comparison: `runUpdate` vs `enrichGlobalIni` matched for `mission-scmdb-descriptions`.

Notes:

- GitHub #87 can be closed as completed.
- `runUpdate` and `buildPatchData` remain documented compatibility exports for old imports; their removal should happen only after remaining old callers are known and migrated.
- Issue 005 / GitHub #89 and Issue 011 / GitHub #95 remain separate next slices.

Next agent instructions:

1. Start from the committed slice named `Close updater planning/application split`.
2. Prefer reviewing Issue 005 / GitHub #89 next because its acceptance criteria may already be met after artifact conversion and loader fixture coverage.
3. If #89 is complete, update local docs/GitHub and close it with verification rather than changing code.
4. Otherwise continue Issue 011 / GitHub #95 by extracting or explicitly classifying the remaining `update-all` extra steps.
5. Do not broadly rename `src/lib` or `src/items` yet.
6. Do not include local scraped/generated data unless explicitly requested.
7. Continue to verify each slice with `npm run typecheck`, `npm test` unless docs-only, and touched-file Biome lint for changed source/test files.

### 2026-06-04: Issue 005 closure verification

Primary issue:

- Issue 005 / GitHub #89: Align Artifacts With Patch Plans

Implemented:

- Reviewed Issue 005/#89 acceptance after closing the planning/application split.
- Confirmed artifact docs/schema explain artifact `entries` as the persisted, backward-compatible projection of `PatchPlan.entries`.
- Confirmed `patchPlanToArtifactEntries` converts in-memory patch plans to artifact entries.
- Confirmed `artifactToPatchPlan` converts artifact entries back into the in-memory pipeline contract with artifact-level default metadata.
- Confirmed `generateArtifact` consumes `buildPatchPlanResult` and serializes from `PatchPlan` entries rather than legacy patch-data strings.
- Confirmed `readArtifactFile` validates artifact JSON with `ArtifactSchema`.
- Confirmed `bin/apply-artifact.ts` still reads artifacts and applies them through the loader.
- Confirmed artifact conversion, artifact generation, and artifact-loader fixture tests cover the expected compact shape.

Verified:

- `npm run typecheck`
- `npm test`
- Existing touched-file Biome lint from artifact slices covered `src/artifact/artifact.ts`, `src/artifact/artifact.test.ts`, `src/artifact/loader.test.ts`, and `src/schema/artifact.schema.ts`.

Notes:

- GitHub #89 can be closed as completed.
- `src/artifact` remains singular until the later folder cleanup issue; the issue explicitly allowed the current folder during migration.
- Artifact JSON continues to omit localization application metadata such as `existingLineIndex`.

Next agent instructions:

1. Start from the committed slice named `Close artifact patch-plan alignment`.
2. Continue with Issue 011 / GitHub #95 as the next primary slice.
3. For #95, first classify the remaining `bin/update-all.ts` extra steps and decide whether a small use case can own extra-step execution without moving CLI progress/output/exit behavior.
4. Keep scraper/source-module boundary work separate unless choosing that as the explicit #95 slice.
5. Do not broadly rename `src/lib`, `src/items`, or `src/artifact` yet.
6. Do not include local scraped/generated data unless explicitly requested.

### 2026-06-04: Extra update step execution use case

Primary issue:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/application/use-cases/run-update-extra-steps.ts`.
- Moved the remaining `bin/update-all.ts` extra-step execution loop into the application layer:
  - component title updates
  - FPS title tags
  - missile title tags
  - optional mining journal update
  - raw commodity label fixes
  - Adagio location tags
- Added `getUpdateExtraStepLabels` so the CLI can keep progress totals/order without owning step classification.
- Kept `bin/update-all.ts` responsible for CLI parsing, progress rendering, logging callbacks, preflight, mining-regeneration orchestration, backups, artifact writing, summaries, logger shutdown, and exit codes.
- Preserved continue-on-error behavior and result/error collection for extra steps.
- Added injected-runner tests for extra-step ordering, optional mining journal inclusion, skipped/null steps, and continue-on-error behavior.
- Did not move scraper acquisition/normalization behavior yet.
- Did not rename `src/lib`, `src/items`, or `src/artifact`.
- Did not include generated/scraped data changes.

Verified:

- `node --import tsx/esm --test src/application/use-cases/run-update-extra-steps.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/update-all.ts src/application/use-cases/run-update-extra-steps.ts src/application/use-cases/run-update-extra-steps.test.ts`

Notes:

- Issue 011 / GitHub #95 remains open.
- `bin/update-all.ts` now delegates standard category preparation, standard category execution, artifact planning, and extra-step execution to application/artifact use cases.
- Remaining #95 work is primarily scraper/acquisition normalization and final CLI smoke testing.

Next agent instructions:

1. Start from the committed slice named `Extract update extra step execution`.
2. Continue Issue 011 / GitHub #95 by inspecting scraper scripts and choosing one small acquisition/source-boundary slice.
3. Keep command names and npm scripts stable.
4. Keep user-facing CLI output, progress bars, parse args, and process exits in `bin/*.ts`.
5. Do not broadly rename folders until source/acquisition behavior has stable homes.
6. Do not include scraped/generated data unless explicitly requested.

### 2026-06-04: SCMDB version selection source module

Primary issue:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Secondary impact:

- Issue 009 / GitHub #93: Move SCMDB Source Modules

Implemented:

- Added `src/sources/scmdb/version-selection.ts`.
- Moved SCMDB version/channel classification and selection out of `bin/scrape-scmdb.ts`.
- Kept CLI argument parsing, help output, user-facing messages, and process exits in `bin/scrape-scmdb.ts`.
- Added focused tests for:
  - LIVE/PTU version classification
  - explicit `--version` selection
  - PTU selection
  - default LIVE selection
  - default fallback when no LIVE entry exists
  - clear missing-version/no-version errors
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/version-selection.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/version-selection.ts src/sources/scmdb/version-selection.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Notes:

- Issue 011 / GitHub #95 remains open.
- Issue 009 / GitHub #93 remains open; this is only the first SCMDB source-boundary slice.
- Existing scraper command names and output locations are unchanged.

Next agent instructions:

1. Start from the committed slice named `Move SCMDB version selection to source module`.
2. Continue Issue 009 / GitHub #93 or Issue 011 / GitHub #95 by moving another small SCMDB scraper responsibility behind `src/sources/scmdb`.
3. Good next candidates: SCMDB fetch/validate helpers, raw output planning, or pure row-output assembly helpers.
4. Avoid running networked scrapes or committing generated CSV/JSON unless explicitly requested.
5. Keep CLI parse args, console output, and process exits in `bin/scrape-scmdb.ts`.

### 2026-06-04: SCMDB acquisition helper source module

Primary issue:

- Issue 009 / GitHub #93: Move SCMDB Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/scmdb/acquisition.ts`.
- Moved SCMDB data URL construction, JSON fetching, User-Agent handling, HTTP failure reporting, and schema validation into the SCMDB source boundary.
- Updated `bin/scrape-scmdb.ts` to delegate versions fetch/validation, merged-data fetch, companion URL building, and optional companion JSON fetches to the source module.
- Kept CLI help output, user-facing status messages, output writes, argument interpretation, and process exits in the scraper script.
- Added injected-fetch tests so acquisition behavior is verified without network access.
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/acquisition.test.ts src/sources/scmdb/version-selection.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/acquisition.ts src/sources/scmdb/acquisition.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Notes:

- Issue 009 / GitHub #93 remains open.
- Issue 011 / GitHub #95 remains open.
- Existing scraper command names and output locations are unchanged.

Next agent instructions:

1. Start from the committed slice named `Move SCMDB acquisition helpers to source module`.
2. Continue Issue 009 / GitHub #93 by moving another SCMDB scraper responsibility behind `src/sources/scmdb`.
3. Good next candidates: pure row-output assembly helpers, output file planning, or schema re-export/compatibility adapters.
4. Avoid running networked scrapes or committing generated CSV/JSON unless explicitly requested.
5. Keep CLI parse args, console output, file writes, and process exits in `bin/scrape-scmdb.ts` until a stronger application/acquisition result shape exists.

### 2026-06-04: SCMDB output row source transform

Primary issue:

- Issue 009 / GitHub #93: Move SCMDB Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/scmdb/outputs.ts`.
- Moved SCMDB CSV header contracts and pure row-group assembly out of `bin/scrape-scmdb.ts`.
- Added `buildScmdbOutputRows` to assemble mission, contract, legacy contract, blueprint pool, contract blueprint, mining element, mining journal, and mining location row groups from parsed SCMDB data.
- Updated `bin/scrape-scmdb.ts` to delegate source row assembly to `buildScmdbOutputRows` and keep only output writing decisions.
- Added tests for empty SCMDB row groups, mining output groups, and exported CSV header contracts.
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/outputs.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/outputs.ts src/sources/scmdb/outputs.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Notes:

- Issue 009 / GitHub #93 remains open.
- Issue 011 / GitHub #95 remains open.
- Existing scraper command names and output locations are unchanged.

Next agent instructions:

1. Start from the committed slice named `Move SCMDB output rows to source module`.
2. Continue Issue 009 / GitHub #93 by moving SCMDB output file planning or schema re-export/compatibility adapters behind `src/sources/scmdb`.
3. Consider whether `src/extractor/mining-parser.ts` and `src/extractor/mission-parser.ts` should move under `src/sources/scmdb` after enough compatibility adapters exist.
4. Avoid running networked scrapes or committing generated CSV/JSON unless explicitly requested.
5. Keep CLI parse args, console output, file writes, and process exits in `bin/scrape-scmdb.ts` until a stronger use-case result shape exists.

### 2026-06-04: SCMDB output file planning

Primary issue:

- Issue 009 / GitHub #93: Move SCMDB Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/scmdb/output-files.ts`.
- Added `planScmdbOutputFiles` to convert SCMDB row groups into ordered output descriptors with filename, output section, rows, and headers.
- Updated `bin/scrape-scmdb.ts` to loop over planned output descriptors and keep only filesystem writes plus user-facing messages.
- Added tests for empty output omission, scraper write order, mission/root output sections, and header pairing.
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/output-files.test.ts src/sources/scmdb/outputs.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/output-files.ts src/sources/scmdb/output-files.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Notes:

- Issue 009 / GitHub #93 remains open.
- Issue 011 / GitHub #95 remains open.
- Existing scraper command names and output locations are unchanged.

Next agent instructions:

1. Start from the committed slice named `Move SCMDB output planning to source module`.
2. Review Issue 009 / GitHub #93 acceptance again.
3. Consider whether the next #93 slice should be a compatibility relocation of SCMDB mining/mission parser exports into `src/sources/scmdb`, or whether #91 Source Dataset Contracts should be completed before more moves.
4. Avoid running networked scrapes or committing generated CSV/JSON unless explicitly requested.
5. Keep CLI parse args, console output, file writes, and process exits in `bin/scrape-scmdb.ts` until a stronger use-case result shape exists.

### 2026-06-04: Source dataset contracts

Primary issue:

- Issue 007 / GitHub #91: Create Source Dataset Contracts

Implemented:

- Added provider-family normalized dataset contracts:
  - `src/sources/datacore/types.ts`
  - `src/sources/scmdb/types.ts`
  - `src/sources/spviewer/types.ts`
- Kept raw source schemas separate from normalized target contracts.
- Reused the core `SourceDataset<TRecord>` metadata shape for source name, version, channel, and records.
- Added compile-time usage examples in `src/sources/types.test.ts`.
- Did not change runtime behavior.
- Did not include generated/scraped data changes.

Verified:

- `node --import tsx/esm --test src/sources/types.test.ts`
- `npm run typecheck`

Notes:

- GitHub #91 can be closed as completed after final verification.
- These contracts are intentionally provider-family shapes, not one universal item-stat schema.
- The contracts give Issue 009/#93, Issue 008/#92, and Issue 010/#94 stable targets for later normalization slices.

Next agent instructions:

1. Start from the committed slice named `Add source dataset contracts`.
2. Reassess Issue 009 / GitHub #93 now that source dataset contracts exist.
3. Continue #93 with compatibility exports or relocation for SCMDB mining/mission parser modules only if it stays scoped and verified.
4. Avoid running networked scrapes or committing generated CSV/JSON unless explicitly requested.

### 2026-06-04: SCMDB parser source facades and Issue 009 closure

Primary issue:

- Issue 009 / GitHub #93: Move SCMDB Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added SCMDB source-boundary parser facades:
  - `src/sources/scmdb/mining-parser.ts`
  - `src/sources/scmdb/mission-parser.ts`
- Updated `src/sources/scmdb/outputs.ts` to consume the SCMDB parser facades instead of importing directly from `src/extractor`.
- Kept existing `src/extractor/*` modules in place as compatibility exports for old imports and tests until broad folder cleanup.
- Added facade coverage in `src/sources/scmdb/parser-facades.test.ts`.
- Reviewed Issue 009/#93 acceptance:
  - SCMDB acquisition, version selection, output rows, output planning, parser facades, and dataset contracts now have a clear `src/sources/scmdb` home.
  - Mission/mining/commodity enrichment can consume normalized SCMDB rows or compatibility adapters.
  - `bin/scrape-scmdb.ts` delegates SCMDB source behavior while retaining CLI output/writes/exits.
  - Existing SCMDB-related tests pass.
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/parser-facades.test.ts src/sources/scmdb/outputs.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint src/sources/scmdb/mining-parser.ts src/sources/scmdb/mission-parser.ts src/sources/scmdb/parser-facades.test.ts src/sources/scmdb/outputs.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Notes:

- GitHub #93 can be closed as completed.
- Physical relocation of legacy `src/extractor` files should wait for folder cleanup / compatibility cleanup, not happen inside this issue.
- Issue 011 / GitHub #95 remains open for DataCore/SPViewer scraper boundaries and final CLI smoke testing.

Next agent instructions:

1. Start from the committed slice named `Add SCMDB parser source facades`.
2. Continue with Issue 008 / GitHub #92: Move DataCore Source Modules, or Issue 010 / GitHub #94: Classify SPViewer As Legacy Provider.
3. Prefer DataCore next because source dataset contracts now exist and DataCore scraper code still lives mostly in `bin/scrape-datacore.ts`.
4. Avoid running scraper commands that write generated CSV/XML unless explicitly requested.
5. Keep CLI parse args, console output, file writes, progress bars, and process exits in scripts until a stronger use-case result shape exists.

### 2026-06-04: DataCore XML discovery source module

Primary issue:

- Issue 008 / GitHub #92: Move DataCore Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/datacore/xml-files.ts`.
- Moved DataCore DCB discovery, XML cache discovery, XML path filtering, and XML cache counting out of `bin/scrape-datacore.ts`.
- Updated `bin/scrape-datacore.ts` to delegate those source file concerns while keeping CLI parsing, help text, user-facing output, extraction orchestration, CSV writes, and process exits in the script.
- Added temp-directory tests for DCB discovery errors, recursive XML collection, and normalized path filtering.
- Did not run DataCore extraction or write generated XML/CSV data.

Verified:

- `node --import tsx/esm --test src/sources/datacore/xml-files.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/xml-files.ts src/sources/datacore/xml-files.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`

Notes:

- Issue 008 / GitHub #92 remains open because the DataCore parser/normalizer still needs a source-boundary home or facade, and the extraction/acquisition boundary still needs review.
- Issue 011 / GitHub #95 remains open for remaining DataCore/SPViewer scraper responsibilities and final CLI smoke testing.
- Generated XML/CSV data was intentionally left untouched.

Next agent instructions:

1. Start from the committed slice named `Move DataCore XML discovery to source module`.
2. Continue Issue 008 / GitHub #92 with a small parser/normalizer source-boundary slice, likely by adding a DataCore parser facade under `src/sources/datacore` before any physical relocation.
3. Keep `bin/scrape-datacore.ts` responsible for CLI parse args, help output, user-facing status messages, extraction orchestration, CSV writes, and process exits.
4. Avoid running DataCore extraction commands that write generated XML/CSV unless explicitly requested.
5. Keep `npm run scrape:datacore` behavior stable.

### 2026-06-04: DataCore XML parser source facade

Primary issue:

- Issue 008 / GitHub #92: Move DataCore Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/datacore/xml-parser.ts` as a DataCore source-boundary facade for the existing XML parser and common normalization helpers.
- Updated `bin/scrape-datacore.ts` to import `extractAttachDef`, `extractEntityClass`, `extractHealth`, `loadXml`, and `xmlVal` through the DataCore source boundary.
- Kept `src/extractor/datacore-xml-parser.ts` in place as a compatibility module until later folder cleanup.
- Added facade coverage for XML value/attribute helpers plus common attach, health, and entity-class normalization.
- Did not run DataCore extraction or write generated XML/CSV data.

Verified:

- `node --import tsx/esm --test src/sources/datacore/xml-parser.test.ts src/sources/datacore/xml-files.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/xml-parser.ts src/sources/datacore/xml-parser.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`

Notes:

- Issue 008 / GitHub #92 remains open pending one more DataCore extraction/acquisition boundary review.
- Issue 011 / GitHub #95 remains open for DataCore acquisition follow-up, SPViewer legacy-source classification, and final CLI smoke testing.
- The facade mirrors the SCMDB source facade pattern; physical relocation of the legacy extractor should wait for folder cleanup.

Next agent instructions:

1. Start from the committed slice named `Add DataCore XML parser source facade`.
2. Continue Issue 008 / GitHub #92 by reviewing DCB extraction/unforge orchestration in `bin/scrape-datacore.ts` and deciding whether a small source/acquisition helper can own command planning without moving CLI output, progress, file writes, or exits.
3. If #92 acceptance is met after that review, run final verification, update local docs/GitHub, and close #92.
4. Avoid running DataCore extraction commands that write generated XML/CSV unless explicitly requested.
5. Keep current `npm run scrape:datacore` behavior stable.

### 2026-06-04: DataCore acquisition boundary and Issue 008 closure

Primary issue:

- Issue 008 / GitHub #92: Move DataCore Source Modules

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/datacore/acquisition.ts`.
- Moved DataCore XML cache extraction mechanics out of `bin/scrape-datacore.ts`:
  - optional forced cache clearing
  - DCB copy into the XML cache
  - injected unforge execution
  - temporary DCB and monolithic XML cleanup
  - post-extraction XML count
- Kept `bin/scrape-datacore.ts` responsible for CLI parse args, help text, user-facing output, tool-install output, extraction status messages, CSV writes, and process exits.
- Added tests for cache extraction, cleanup, XML counting, and forced cache clearing.
- Reviewed Issue 008/#92 acceptance:
  - DataCore parser/common normalizer helpers are available through `src/sources/datacore/xml-parser.ts`.
  - DataCore DCB/XML discovery and extraction cache mechanics are under `src/sources/datacore`.
  - Current `npm run scrape:datacore` command remains in place and its help smoke passes.
  - DataCore source tests pass from their new locations.
- Did not run real DataCore extraction or write generated XML/CSV data.

Verified:

- `node --import tsx/esm --test src/sources/datacore/acquisition.test.ts src/sources/datacore/xml-files.test.ts src/sources/datacore/xml-parser.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/acquisition.ts src/sources/datacore/acquisition.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`
- `npm run scrape:datacore -- --help`

Notes:

- GitHub #92 can be closed as completed.
- Issue 011 / GitHub #95 remains open, with DataCore no longer the primary blocker.
- Physical relocation of `src/extractor/datacore-xml-parser.ts` should wait for folder cleanup / compatibility cleanup.

Next agent instructions:

1. Start from the committed slice named `Move DataCore acquisition cache extraction`.
2. Continue with Issue 010 / GitHub #94: Classify SPViewer As Legacy Provider, or continue Issue 011 / GitHub #95 through the SPViewer scraper boundary.
3. For SPViewer, first inspect #94 acceptance criteria and decide whether it can be closed by classification/facades or needs source-module extraction.
4. Keep CLI parse args, user-facing output, progress, file writes, and process exits in scripts.
5. Avoid generated/scraped data churn unless explicitly requested.

### 2026-06-04: SPViewer legacy source classification and Issue 010 closure

Primary issue:

- Issue 010 / GitHub #94: Classify SPViewer As Legacy Provider

Secondary impact:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Added `src/sources/spviewer/html-parser.ts` as a legacy/fallback SPViewer source-boundary facade for the existing HTML parser helpers.
- Updated `bin/scrape-spviewer.ts` to import version extraction, pagination detection, dropdown detection, and table parsing through `src/sources/spviewer`.
- Kept `src/extractor/spviewer-html-parser.ts` in place as a compatibility module until later folder cleanup.
- Added facade coverage for version extraction, paginator detection, "All" option detection, and table parsing.
- Updated README usage and project structure docs to describe SPViewer as the default legacy/fallback item provider during migration and DataCore as the preferred provider where coverage exists.
- Updated architecture docs to point at the implemented `src/sources/spviewer` facade/types while preserving compatibility cleanup as later work.
- Did not run browser scraping or write generated SPViewer CSV/JSON data.

Verified:

- `node --import tsx/esm --test src/sources/spviewer/html-parser.test.ts src/extractor/spviewer-html-parser.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-spviewer.ts src/sources/spviewer/html-parser.ts src/sources/spviewer/html-parser.test.ts`
- `npm run scrape:spviewer -- --list`

Notes:

- GitHub #94 can be closed as completed.
- Issue 011 / GitHub #95 remains open for final CLI help/list smoke testing and closure review.
- Physical relocation of `src/extractor/spviewer-html-parser.ts` should wait for folder cleanup / compatibility cleanup.

Next agent instructions:

1. Start from the committed slice named `Classify SPViewer as legacy source`.
2. Continue Issue 011 / GitHub #95 by inspecting acceptance criteria and running final CLI help/list smoke coverage across settled scripts.
3. If #95 acceptance is met, update local docs/GitHub and close #95.
4. Keep compatibility exports and broad folder cleanup for later explicit issues unless #95 acceptance requires a narrow note.
5. Avoid generated/scraped data churn unless explicitly requested.

### 2026-06-04: Issue 011 closure review and CLI smoke

Primary issue:

- Issue 011 / GitHub #95: Make CLI Scripts Thin Adapters

Implemented:

- Re-reviewed #95 acceptance and issue comments after SCMDB, DataCore, and SPViewer source-boundary issues closed.
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

Verified:

- `npm run typecheck`
- `npm test`
- CLI smoke commands listed above

Notes:

- GitHub #95 should remain open for now because older issue context explicitly calls out that `runFullPipeline` still shells out through `spawnSync` for scraper/update steps.
- The next #95 slice should add callable application/source entry points for pipeline orchestration so `runFullPipeline` can call in-process functions and return structured errors, while `bin/*.ts` remain CLI adapters.
- Broad folder cleanup and compatibility export removal remain separate later issues unless the narrow pipeline orchestration work requires a small compatibility note.

Next agent instructions:

1. Start from the committed slice named `Review CLI adapter closure status`.
2. Continue Issue 011 / GitHub #95 by designing the smallest in-process pipeline orchestration slice.
3. Prefer introducing callable application functions around update execution first if that avoids making scraper CLIs importable while they still have top-level side effects.
4. Keep user-facing CLI output, parse args, progress, file writes, and process exits in scripts unless a use-case result shape is explicit.
5. Avoid generated/scraped data churn unless explicitly requested.

## Definition Of Done For The Rewrite

- Existing npm scripts still work or have documented replacements.
- `npm run typecheck` passes.
- `npm test` passes.
- `src/lib` is no longer a catch-all for unrelated responsibilities.
- `src/items` has either been renamed or narrowed to a clearly documented role.
- Extraction/acquisition modules do not directly write `global.ini`.
- Patch planning can be tested without filesystem writes.
- INI application can be tested with in-memory text fixtures.
- README and architecture docs match the implemented folder structure.
