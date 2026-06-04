# Move SCMDB Source Modules

## Type

Task

## Labels

`architecture`, `scmdb`, `sources`

## Depends On

- 007: Create Source Dataset Contracts

## Problem

SCMDB behavior spans scraper scripts, schemas, mission/mining parsers, and enrichment configs. The code should distinguish SCMDB acquisition/normalization from mission text enrichment.

## Goal

Move SCMDB acquisition and normalization into a source boundary while keeping mission/mining/commodity enrichment as planning logic.

## Proposed Target

```text
src/acquisition/web/
  scrape-scmdb.ts

src/sources/scmdb/
  parser.ts
  schemas.ts
  types.ts
  transforms/

src/enrichment/
  mission-text/
  mining-journal/
  commodity-labels/
```

## Implementation Notes

- Reuse existing Zod schemas.
- Preserve current CSV/JSON outputs during migration.
- Keep SCMDB website/network details out of enrichment planners.
- Keep generated `locationKeyMap.json` ownership explicit.

## Acceptance Criteria

- SCMDB source code has a clear acquisition/normalization home.
- Mission/mining/commodity enrichment modules consume normalized SCMDB records or compatibility adapters.
- `npm run scrape:scmdb` still works.
- Existing SCMDB-related tests pass.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run scrape:scmdb -- --list-versions` if network access is expected for the environment.
