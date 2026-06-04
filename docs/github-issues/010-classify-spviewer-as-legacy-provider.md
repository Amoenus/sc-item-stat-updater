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
