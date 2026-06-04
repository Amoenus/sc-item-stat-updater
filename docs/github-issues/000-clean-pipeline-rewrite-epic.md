# Clean Pipeline Rewrite Epic

## Type

Epic

## Labels

`architecture`, `refactor`, `long-term-maintenance`

## Problem

The current repository works, but responsibilities are distributed unevenly across `bin`, `src/lib`, `src/items`, `src/io/local`, `src/extractor`, and `src/artifact`. The codebase also had stale DDD planning docs and empty scaffold folders that implied a different architecture than the one we actually want.

We need the repo to express the product workflow clearly:

1. Acquire raw inputs.
2. Normalize source-specific data.
3. Plan localization patches.
4. Apply patches to `global.ini`.
5. Deploy the enriched file.

## Goal

Incrementally migrate the project to the Clean Pipeline Architecture accepted in ADR 005.

## Scope

- Introduce core pipeline types.
- Move orchestration into application use cases.
- Split patch planning from INI mutation.
- Create explicit localization, source, artifact, deployment, and CLI boundaries.
- Clean up broad folders once behavior has stable homes.

## Non-Goals

- No full DDD aggregate/repository/domain-event model.
- No big-bang folder reshuffle without behavioral seams and tests.
- No change to generated `global.ini` output unless covered by a dedicated issue.

## Child Issues

- 001: Define Core Pipeline Types
- 002: Introduce Application Use Cases
- 003: Split Updater Into Planning And Application
- 004: Create Localization Boundary
- 005: Align Artifacts With Patch Plans
- 006: Add Deployment Use Case
- 007: Create Source Dataset Contracts
- 008: Move DataCore Source Modules
- 009: Move SCMDB Source Modules
- 010: Classify SPViewer As Legacy Provider
- 011: Make CLI Scripts Thin Adapters
- 012: Clean Up `lib`, `items`, And Folder Layout
- 013: Add Architecture Guardrails

## Acceptance Criteria

- All child issues are completed.
- README and architecture docs match the final folder structure.
- `npm run typecheck` passes.
- `npm test` passes.
- The full local pipeline still supports extracting fresh `global.ini`, enriching it, updating the repo copy, and deploying it back to the game folder.

## Closure Review

Closed on 2026-06-04 after completing child issues 001-013 / GitHub #85-#97.

Implemented:

- Core pipeline contracts, source dataset contracts, patch plans, and update issue types.
- Application use cases for full pipeline orchestration, batch updates, prepared category execution, patch planning, enrichment, source scraping, extraction, and deployment.
- Localization boundary for INI parsing/application, key resolution, text helpers, and application-only line-index metadata.
- Artifact alignment with patch-plan projection and no serialized localization application metadata.
- Source boundaries for DataCore, SCMDB, and legacy/fallback SPViewer.
- CLI thinning, folder cleanup, compatibility-layer documentation, and architecture guardrails.

Verification:

- `npm run check:architecture`
- `npm run typecheck`
- `npm test`
- Touched-file `npx biome lint` per slice

Notes:

- No generated/scraped data changes were committed during closure.
- `src/lib/updater.ts` remains intentional compatibility glue for older `runUpdate` and `buildPatchData` imports.
- Follow-up issues #54, #55, #50, #52, #51, and #48 remain valid non-epic work.

## Progress

2026-06-04:

- Milestone 1 foundation is in place:
  - core pipeline types
  - initial application use cases
  - localization patch planning/application helpers
  - `runUpdate` composed as load, plan, apply, validate, conditional write
- Artifact alignment has started:
  - artifacts are documented as a compact serialized projection of `PatchPlan.entries`
  - `existingLineIndex` is treated as in-memory metadata only
  - `generateArtifact` consumes `buildPatchPlanResult`
  - `bin/update-all.ts --emit-artifact` routes through `generateArtifact`
- CLI thinning has continued:
  - `prepareUpdateCategories` now owns `update-all` source-directory discovery and category assembly
  - `bin/update-all.ts` consumes prepared category context instead of loading provider/mission configs directly
  - `runPreparedUpdateCategories` now owns the prepared category execution loop and returns structured category results/errors
  - `bin/update-all.ts` observes category execution for progress and logs while keeping process exits and user-facing output in the CLI layer
- Artifact loader coverage now includes compact artifact JSON applied to temp INI fixtures.
- Verified current migration slice with:
  - `npm run typecheck`
  - `npm test`
  - touched-file Biome lint
  - targeted use-case and artifact-loader tests
