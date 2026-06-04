# Make CLI Scripts Thin Adapters

## Type

Task

## Labels

`architecture`, `cli`, `refactor`

## Depends On

- 002: Introduce Application Use Cases
- 006: Add Deployment Use Case
- 008: Move DataCore Source Modules
- 009: Move SCMDB Source Modules
- 010: Classify SPViewer As Legacy Provider

## Problem

`bin/*.ts` scripts currently contain significant business workflow logic. This makes the CLI the center of the architecture instead of a presentation adapter.

## Goal

Move reusable behavior into application/source/localization modules and leave `bin/*.ts` responsible for CLI parsing, output formatting, and exit codes.

## Implementation Notes

- Do this after the main use cases exist.
- Keep command names and npm scripts stable unless there is a clear migration note.
- Use shared CLI utilities for log flags, help text, and error printing.
- Avoid creating a large CLI framework unless the current scripts become difficult to maintain.

## Acceptance Criteria

- `bin/pipeline.ts` delegates pipeline behavior to `runFullPipeline`.
- `bin/update-all.ts` delegates enrichment behavior to application use cases.
- Scraper scripts delegate acquisition/normalization behavior to source modules.
- No use case calls `parseArgs`, `console.log` for user-facing CLI output, or `process.exit`.
- Existing npm scripts still work.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Smoke test `--help` for each CLI script.
- Run `npm run update -- --dry-run` if local data is available.
