# Split Updater Into Planning And Application

## Type

Task

## Labels

`architecture`, `localization`, `refactor`

## Depends On

- 001: Define Core Pipeline Types
- 002: Introduce Application Use Cases

## Problem

`src/lib/updater.ts` currently mixes source loading, row validation, key resolution, stat value construction, INI indexing, line mutation, new-line insertion, issue collection, and result summaries. This is the highest-value file to split because it is where the pipeline boundaries blur most.

## Goal

Separate patch planning from INI application.

## Proposed New Modules

```text
src/localization/patch-plan.ts
src/localization/patch-application.ts
src/localization/update-issues.ts
src/application/use-cases/build-patch-plan.ts
src/application/use-cases/enrich-global-ini.ts
```

## Implementation Notes

- Preserve public behavior of `runUpdate` while extracting internals.
- First extract pure helpers that do not perform filesystem writes.
- Represent planned changes as `PatchPlan` / `PatchEntry`.
- Keep compatibility exports temporarily if many imports depend on `src/lib/updater.ts`.
- Add tests around extracted modules before deleting old code paths.

## Acceptance Criteria

- There is a function that builds a patch plan without writing `global.ini`.
- There is a separate function that applies a patch plan to INI text or lines.
- Existing `runUpdate` can be implemented as composition of planning plus application.
- Existing updater tests pass.
- New tests cover patch planning and patch application separately.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Compare dry-run output before and after the refactor for at least one SPViewer/DataCore category and one SCMDB mission category.

## Progress

Started on 2026-06-04:

- Added `src/localization/patch-plan.ts`.
- Added `src/localization/patch-application.ts`.
- Added `src/localization/update-issues.ts`.
- Added `applyPatchPlanToIniLines`, `applyLocalizationLinePatch`, and `insertLocalizationEntries`.
- Added in-memory tests for patch application.
- Updated `src/lib/updater.ts` to delegate line mutation and insertion helpers to localization application code while preserving `runUpdate`.
- Added `buildPatchPlan` as an in-memory use case backed by existing `buildPatchData`.
- Verified with `npm run typecheck` and `npm test`.

Remaining:

- Extract a true planner from `src/lib/updater.ts` that creates `PatchPlan` entries without mutating INI lines.
- Recompose `runUpdate` from planning plus patch application.
- Add planner tests that use small row and INI fixtures.
