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
