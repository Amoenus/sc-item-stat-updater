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
