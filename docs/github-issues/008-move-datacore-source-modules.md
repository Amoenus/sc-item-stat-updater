# Move DataCore Source Modules

## Type

Task

## Labels

`architecture`, `datacore`, `sources`

## Depends On

- 007: Create Source Dataset Contracts

## Problem

DataCore behavior currently spans `bin/scrape-datacore.ts`, `src/extractor/datacore-xml-parser.ts`, `src/io/local/unp4k-tool.ts`, and `src/items/datacore`. Some files are acquisition/extraction, some are parsing/normalization, and some are enrichment config.

## Goal

Move DataCore-specific acquisition and normalization into `src/sources/datacore` or `src/acquisition/game-files` while keeping enrichment rules separate.

## Proposed Target

```text
src/acquisition/game-files/
  extract-datacore.ts

src/sources/datacore/
  parser.ts
  schemas.ts
  types.ts
  transforms/

src/enrichment/item-descriptions/datacore/
```

## Implementation Notes

- Keep `unp4k-tool.ts` as infrastructure/game-file acquisition support, not enrichment.
- Keep per-type stat description rules out of the source parser.
- Preserve current CSV output during migration unless a separate issue removes intermediary CSVs.
- Use compatibility exports so existing scripts keep working.

## Acceptance Criteria

- DataCore parser/normalizer lives under the DataCore source boundary.
- DataCore acquisition tooling is clearly separated from localization enrichment.
- Current `npm run scrape:datacore` still works.
- DataCore tests pass from their new locations.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run scrape:datacore -- --dry-run shields` if `.env.local` is configured.
