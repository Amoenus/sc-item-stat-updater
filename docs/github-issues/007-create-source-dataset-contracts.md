# Create Source Dataset Contracts

## Type

Task

## Labels

`architecture`, `sources`, `types`

## Depends On

- 001: Define Core Pipeline Types

## Problem

DataCore, SCMDB, and SPViewer currently expose different row shapes and live in different parts of the codebase. Enrichment logic has to know too much about source-specific formats.

## Goal

Define source dataset contracts and normalized record shapes for each provider family.

## Proposed Location

```text
src/sources/
  datacore/types.ts
  scmdb/types.ts
  spviewer/types.ts
```

## Implementation Notes

- Do not try to normalize all providers into one universal item shape too early.
- Prefer provider-family records that are stable enough for planners.
- Keep raw input schemas separate from normalized output types.
- Include source name, version, and channel in dataset-level metadata.

## Acceptance Criteria

- DataCore, SCMDB, and SPViewer each have documented normalized dataset types.
- Enrichment/planning code has a target shape to consume.
- Raw source schemas remain validated at source boundaries.
- No behavior changes are required in this issue.

## Test Plan

- Run `npm run typecheck`.
- Add compile-time usage examples or small tests if useful.

## Progress

2026-06-04:

- Added provider-family normalized dataset contracts:
  - `src/sources/datacore/types.ts`
  - `src/sources/scmdb/types.ts`
  - `src/sources/spviewer/types.ts`
- Kept raw source schemas separate from these normalized target contracts.
- Reused the core `SourceDataset<TRecord>` metadata contract for source name, version, channel, and records.
- Added compile-time usage examples in `src/sources/types.test.ts`.
- No behavior changes were included.

Verified:

- `node --import tsx/esm --test src/sources/types.test.ts`
- `npm run typecheck`

Decision:

- Acceptance criteria are met.
- GitHub #91 can be closed as completed after final verification.
