# Add Deployment Use Case

## Type

Task

## Labels

`architecture`, `deployment`, `filesystem`

## Depends On

- 002: Introduce Application Use Cases
- 003: Split Updater Into Planning And Application

## Problem

The pipeline needs to update the repo copy of `global.ini` and deploy the enriched file back into the game folder. Today this behavior is mixed into scripts and direct filesystem calls.

## Goal

Create explicit deployment use cases for copying an enriched `global.ini` to its target destinations.

## Proposed Location

```text
src/application/use-cases/deploy-global-ini.ts
src/application/use-cases/refresh-global-ini.ts
```

## Implementation Notes

- Keep game install path resolution separate from pure deployment.
- Support dry-run where practical.
- Preserve backup behavior where existing scripts rely on it.
- Avoid direct `process.exit` or console formatting in use cases.
- Return structured results that CLI scripts can print.

## Acceptance Criteria

- There is a `refreshGlobalIni` use case for extracting/copying a fresh source file into the repo.
- There is a `deployGlobalIni` use case for copying the enriched repo file back to the game folder.
- `bin/pipeline.ts` delegates these steps to use cases.
- Error messages clearly distinguish missing game install, extraction failure, and deployment failure.

## Test Plan

- Run `npm run typecheck`.
- Run tests for path resolution and copy behavior with temp directories.
- Manually run the pipeline only when `.env.local` points at a safe game install.

## Progress

2026-06-04:

- Added `src/application/use-cases/refresh-global-ini.ts`.
- Added `src/application/use-cases/deploy-global-ini.ts`.
- Updated `src/application/use-cases/run-full-pipeline.ts` to delegate repo refresh and game deployment steps to those use cases.
- Updated `extractGlobalIni` to accept an optional logger so application use cases can route extraction messages through pipeline logging instead of hard-coded console output.
- Added temp-directory tests for:
  - refreshing the repo `global.ini` from an extracted game file
  - distinguishing missing game install/Data.p4k from repo-copy failure
  - deploying the enriched repo file back to the extracted game path
  - distinguishing missing repo file from deployment-copy failure
- Did not manually run the full pipeline because that requires a safe `.env.local` game install and would touch local game/repo files.

Verification:

- `node --import tsx/esm --test src/application/use-cases/global-ini-deployment.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint src/pipeline/extract.ts src/application/use-cases/refresh-global-ini.ts src/application/use-cases/deploy-global-ini.ts src/application/use-cases/run-full-pipeline.ts src/application/use-cases/global-ini-deployment.test.ts`

Notes:

- GitHub #90 can be closed as completed.
- The remaining #95 pipeline-shellout concern is separate: `runFullPipeline` still shells out for scraper/update steps, but refresh/deploy filesystem mutation now has explicit use-case homes.
