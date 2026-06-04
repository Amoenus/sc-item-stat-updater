# Classify SPViewer As Legacy Provider

## Type

Task

## Labels

`architecture`, `spviewer`, `legacy`

## Depends On

- 007: Create Source Dataset Contracts
- 008: Move DataCore Source Modules

## Problem

SPViewer was the original item-stat provider, but DataCore is expected to become the preferred source for fresher game-file data. The code and docs should make SPViewer's role explicit so it does not keep shaping the architecture by accident.

## Goal

Treat SPViewer as a legacy, comparison, or fallback source while keeping it functional.

## Proposed Target

```text
src/acquisition/web/
  scrape-spviewer.ts

src/sources/spviewer/
  parser.ts
  schemas.ts
  types.ts
  transforms/

src/enrichment/item-descriptions/spviewer/
```

## Implementation Notes

- Do not delete SPViewer support.
- Document provider precedence between DataCore and SPViewer.
- Keep mapping-store behavior available for SPViewer key resolution.
- Consider naming modules `legacy-spviewer` only if that improves clarity without making imports ugly.

## Acceptance Criteria

- README and architecture docs describe SPViewer as legacy/fallback.
- SPViewer source modules are separated from enrichment planning.
- Current `npm run scrape:spviewer` still works.
- Existing SPViewer tests pass.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run scrape:spviewer -- --list` or equivalent lightweight command if available.

## Progress

2026-06-04:

- Added `src/sources/spviewer/html-parser.ts` as a legacy/fallback SPViewer source-boundary facade for the existing HTML parser helpers.
- Updated `bin/scrape-spviewer.ts` to import version extraction, pagination detection, dropdown detection, and table parsing through `src/sources/spviewer`.
- Kept `src/extractor/spviewer-html-parser.ts` in place as a compatibility module until later folder cleanup.
- Added facade coverage for version extraction, paginator detection, "All" option detection, and table parsing.
- Updated README usage and project structure docs to describe SPViewer as the default legacy/fallback item provider during migration and DataCore as the preferred provider where coverage exists.
- Updated architecture docs to point at the implemented `src/sources/spviewer` facade/types while preserving compatibility cleanup as later work.
- Smoke-tested `npm run scrape:spviewer -- --list`.
- Did not run browser scraping or write generated SPViewer CSV/JSON data.

Verification:

- `node --import tsx/esm --test src/sources/spviewer/html-parser.test.ts src/extractor/spviewer-html-parser.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint bin/scrape-spviewer.ts src/sources/spviewer/html-parser.ts src/sources/spviewer/html-parser.test.ts`
- `npm run scrape:spviewer -- --list`

Notes:

- GitHub #94 can be closed as completed.
- Physical relocation of `src/extractor/spviewer-html-parser.ts` should wait for folder cleanup / compatibility cleanup.
