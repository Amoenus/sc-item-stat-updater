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
