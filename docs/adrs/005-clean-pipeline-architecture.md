# ADR 005: Clean Pipeline Architecture

## Status

Accepted

## Context

The repository previously contained planning documents for a broad Domain-Driven Design rewrite. That direction produced empty `src/domain`, `src/application`, `src/infrastructure`, and `src/presentation` folders, but the live code continued to evolve as a practical enrichment pipeline.

The actual product goal is to enrich `global.ini`:

1. Extract a fresh `global.ini` from the game files.
2. Extract additional data from game files.
3. Extract enriched relationship/rollup data from SCMDB while those joins are still needed.
4. Treat retired provider data as historical audit evidence only, not as an active pipeline input.
5. Plan localization updates.
6. Update the repo copy of `global.ini`.
7. Deploy the enriched `global.ini` back into the game folder.

The main complexity is source acquisition, source normalization, localization patch planning, safe INI application, and deployment. A full DDD model with aggregates, repositories, and domain events would add vocabulary and ceremony that do not match the current problem.

## Decision

We will use a Clean Pipeline Architecture.

The primary architectural boundaries are:

- Acquisition
- Normalization
- Planning
- Application
- Deployment

Extraction code produces source datasets. Enrichment/planning code produces patch plans. Application code applies patch plans to INI text. Deployment code moves the resulting file to the repo and game install locations.

We will remove the stale DDD planning documents and avoid empty architectural folders until real code is moved into them.

## Consequences

### Positive

- The architecture matches the product workflow.
- Source-specific complexity stays near source-specific code.
- `global.ini` mutation is isolated and easier to test.
- CLI scripts can become thin adapters over reusable use cases.
- The migration can proceed incrementally without a risky big-bang rewrite.

### Negative

- Some current files will move or be renamed, causing temporary churn.
- The boundary between normalization and planning must be maintained deliberately.
- Existing docs and older comments may need cleanup as modules move.

## Follow-Up Work

1. Move orchestration from `bin/*.ts` into `src/application/use-cases`.
2. Split `src/lib/updater.ts` into patch planning and patch application modules.
3. Move INI-aware behavior into `src/localization`.
4. Move source-specific parsing and transformation into `src/sources`.
5. Keep filesystem and logging helpers under `src/infrastructure`.
6. Rename `src/items` once its role is narrowed to enrichment rules or item description planners.
