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
- Verified current migration slice with:
  - `npm run typecheck`
  - `npm test`
  - touched-file Biome lint
  - `npm run update -- --dry-run --provider datacore`
  - `npm run update -- --dry-run --provider datacore --emit-artifact <temp path>`
