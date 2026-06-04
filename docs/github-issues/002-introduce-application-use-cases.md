# Introduce Application Use Cases

## Type

Task

## Labels

`architecture`, `application`, `refactor`

## Depends On

- 001: Define Core Pipeline Types

## Problem

Important workflow orchestration currently lives in `bin/*.ts`, especially `bin/pipeline.ts` and `bin/update-all.ts`. That makes core behavior harder to test and reuse because CLI parsing, progress output, subprocess calls, data discovery, update execution, and process exits are mixed together.

## Goal

Introduce application use cases that can be called by CLI scripts without knowing CLI details.

## Proposed Location

```text
src/application/use-cases/
  refresh-global-ini.ts
  scrape-data-sources.ts
  build-patch-plan.ts
  enrich-global-ini.ts
  deploy-global-ini.ts
  run-full-pipeline.ts
```

## Implementation Notes

- Start with use cases that wrap current functions rather than rewriting all internals.
- Keep `bin/*.ts` working during the migration.
- Use dependency injection only where it meaningfully improves tests. Plain function parameters are enough at first.
- Avoid `process.exit` inside use cases. Return structured success/failure results and let CLI adapters decide how to exit.

## Acceptance Criteria

- At least `runFullPipeline` and `enrichGlobalIni` exist as callable use-case functions.
- `bin/pipeline.ts` delegates meaningful work to `runFullPipeline`.
- `bin/update-all.ts` starts delegating meaningful work to `enrichGlobalIni` or a smaller use case.
- Use cases do not parse CLI arguments directly.
- Use cases do not call `process.exit`.
- Existing npm scripts still work.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run update -- --dry-run` if local data files are available.
- Run `npm run pipeline -- --dry-run` only if the local game-file environment is configured.
