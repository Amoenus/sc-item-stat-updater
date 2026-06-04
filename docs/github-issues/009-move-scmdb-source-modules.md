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

## Progress

2026-06-04:

- Added the first SCMDB source module at `src/sources/scmdb/version-selection.ts`.
- Moved SCMDB LIVE/PTU classification and version selection out of `bin/scrape-scmdb.ts`.
- Kept CLI argument parsing, help output, user-facing messages, and process exits in the scraper script.
- Added focused tests for explicit version selection, PTU selection, default LIVE selection, fallback behavior, and missing-version errors.
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/version-selection.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/version-selection.ts src/sources/scmdb/version-selection.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Remaining:

- Move SCMDB fetch/validate behavior into a source/acquisition boundary.
- Move SCMDB row-output assembly toward source transforms or compatibility adapters.
- Keep mission/mining/commodity enrichment planning separate from source acquisition/normalization.

Continued on 2026-06-04:

- Added `src/sources/scmdb/acquisition.ts`.
- Moved SCMDB data URL construction, JSON fetching, User-Agent handling, HTTP failure reporting, and schema validation into the SCMDB source boundary.
- Updated `bin/scrape-scmdb.ts` to delegate versions fetch/validation, merged-data fetch, companion URL building, and optional companion JSON fetches to the source module.
- Added injected-fetch tests so acquisition behavior is verified without network access.
- Kept scraper CLI output, output writes, argument interpretation, and process exits in `bin/scrape-scmdb.ts`.
- Did not run networked SCMDB scraping or write scraped data.

Verified:

- `node --import tsx/esm --test src/sources/scmdb/acquisition.test.ts src/sources/scmdb/version-selection.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-scmdb.ts src/sources/scmdb/acquisition.ts src/sources/scmdb/acquisition.test.ts`
- `node --import tsx/esm bin/scrape-scmdb.ts --help`

Remaining:

- Move SCMDB row-output assembly toward source transforms or compatibility adapters.
- Keep mission/mining/commodity enrichment planning separate from source acquisition/normalization.
