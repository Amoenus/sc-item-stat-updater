# Restore Compact DataCore Graph Extractor Fidelity

GitHub: #127

## Problem

Compact DataCore record graph generation reduces memory pressure, but the current test suite shows extractor
regressions where compact graph data no longer supplies fields that existing extraction behavior expects.

## Evidence

`npm test` reported 546 passing and 5 failing tests, all in
`src/application/use-cases/run-datacore-scrape.test.ts`.

## Acceptance Criteria

- `npm test` passes.
- Extractor behavior remains correct under compact graph mode.
- Any required full-fidelity graph data is restored through a targeted projection, explicit XML reread, or documented
  fidelity requirement.
- `npm run typecheck` passes.

## Related Docs

- `docs/adrs/007-datacore-record-graph-fidelity-and-cache-metadata.md`
- `docs/prds/001-source-cache-and-generated-data-architecture.md`

