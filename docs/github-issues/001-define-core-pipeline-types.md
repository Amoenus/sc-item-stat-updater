# Define Core Pipeline Types

## Type

Task

## Labels

`architecture`, `types`, `pipeline`

## Depends On

None

## Problem

The code currently passes provider rows, CSV records, JSON records, patch maps, issue arrays, and update summaries through loosely related shapes. This makes it difficult to separate source acquisition, normalization, planning, and INI application.

## Goal

Create shared pipeline types that describe source datasets, patch plans, patch entries, update issues, channels, provider names, and run metadata.

## Proposed Location

```text
src/pipeline/types.ts
```

or, if we want to keep pipeline orchestration separate from data contracts:

```text
src/application/pipeline-types.ts
```

## Proposed Types

```ts
export type SourceName = 'datacore' | 'scmdb' | 'spviewer';
export type GameChannel = 'live' | 'ptu';

export interface SourceDataset<TRecord> {
  source: SourceName;
  version: string;
  channel: GameChannel;
  records: TRecord[];
}

export interface PatchEntry {
  key: string;
  value: string;
  source: string;
  reason: string;
}

export interface UpdateIssue {
  label: string;
  key: string;
  reason: string;
  type: string;
}

export interface PatchPlan {
  entries: PatchEntry[];
  issues: UpdateIssue[];
}
```

## Implementation Notes

- Start by adding types without forcing every module to adopt them.
- Map the current `IssueRecord` type to `UpdateIssue`.
- Avoid introducing classes unless behavior is needed.
- Keep these types source-neutral.

## Acceptance Criteria

- Core types exist and are exported from one stable module.
- Existing `IssueRecord` usage either reuses or is compatible with `UpdateIssue`.
- No behavior changes.
- `npm run typecheck` passes.

## Test Plan

- Run `npm run typecheck`.
- Run existing tests if any import paths are touched.

## Progress

Implemented on 2026-06-04:

- Added `src/pipeline/types.ts`.
- Added `SourceName`, `GameChannel`, `SourceDataset`, `PatchEntry`, `UpdateIssue`, `PatchPlan`, and `PipelineRunMetadata`.
- Updated existing `IssueRecord` to extend `UpdateIssue`.
- Verified with `npm run typecheck` and `npm test`.

Closure review on 2026-06-04:

- Re-reviewed GitHub #85 acceptance after the later planning/application/source slices stabilized.
- Confirmed core types are still exported from `src/pipeline/types.ts`.
- Confirmed existing `IssueRecord` remains compatible by extending `UpdateIssue`.
- Confirmed DataCore, SCMDB, and SPViewer source dataset types consume `SourceDataset`.
- No behavior changes were needed for closure.

Verification:

- `npm run typecheck`

GitHub #85 is closed.
