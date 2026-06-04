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

## Progress

2026-06-04:

- Added `src/sources/datacore/xml-files.ts`.
- Moved DataCore DCB discovery, recursive XML cache discovery, path-filtered XML selection, and XML cache counting out of `bin/scrape-datacore.ts`.
- Updated `bin/scrape-datacore.ts` to delegate those source file concerns while keeping CLI parsing, help text, user-facing output, extraction orchestration, CSV writes, and exits in the script.
- Added temp-directory tests for DCB discovery errors, recursive XML collection, and normalized path filtering.
- Smoke-tested `node --import tsx/esm bin/scrape-datacore.ts --help`.
- Did not run DataCore extraction or write generated XML/CSV data.

Verification:

- `node --import tsx/esm --test src/sources/datacore/xml-files.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/xml-files.ts src/sources/datacore/xml-files.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`

Remaining:

- Move or facade the DataCore parser/normalizer under `src/sources/datacore`.
- Clarify the DataCore acquisition boundary around DCB extraction/unforge without moving CLI output, progress, file writes, or exits out of the script prematurely.
- Keep current `npm run scrape:datacore` behavior stable and avoid generated XML/CSV churn.

Continued on 2026-06-04:

- Added `src/sources/datacore/xml-parser.ts` as a DataCore source-boundary facade for the existing XML parser and common normalization helpers.
- Updated `bin/scrape-datacore.ts` to import `extractAttachDef`, `extractEntityClass`, `extractHealth`, `loadXml`, and `xmlVal` through the DataCore source boundary.
- Kept `src/extractor/datacore-xml-parser.ts` in place as a compatibility module until later folder cleanup.
- Added facade coverage for XML value/attribute helpers plus common attach, health, and entity-class normalization.
- Smoke-tested `node --import tsx/esm bin/scrape-datacore.ts --help`.
- Did not run DataCore extraction or write generated XML/CSV data.

Verification:

- `node --import tsx/esm --test src/sources/datacore/xml-parser.test.ts src/sources/datacore/xml-files.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-datacore.ts src/sources/datacore/xml-parser.ts src/sources/datacore/xml-parser.test.ts`
- `node --import tsx/esm bin/scrape-datacore.ts --help`

Remaining:

- Review whether the DCB extraction/unforge orchestration needs a source/acquisition helper before closing #92.
- Keep CLI parse args, help text, user-facing output, progress, CSV writes, and exits in `bin/scrape-datacore.ts`.
- Keep current `npm run scrape:datacore` behavior stable and avoid generated XML/CSV churn.
