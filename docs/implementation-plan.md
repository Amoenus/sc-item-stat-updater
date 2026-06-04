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
