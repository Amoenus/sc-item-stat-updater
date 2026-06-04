# Clean Up `lib`, `items`, And Folder Layout

## Type

Task

## Labels

`architecture`, `cleanup`, `folder-structure`

## Depends On

- 003: Split Updater Into Planning And Application
- 004: Create Localization Boundary
- 008: Move DataCore Source Modules
- 009: Move SCMDB Source Modules
- 010: Classify SPViewer As Legacy Provider
- 011: Make CLI Scripts Thin Adapters

## Problem

`src/lib` and `src/items` are broad names that hide important distinctions:

- formatting helpers
- localization helpers
- update workflows
- item description enrichment rules
- source-specific provider configs
- logging

Once behavior has clearer homes, these broad folders should be narrowed or removed.

## Goal

Finalize the source layout so folder names match responsibilities.

## Proposed Final Shape

```text
src/
  acquisition/
  application/
  artifacts/
  enrichment/
  infrastructure/
  localization/
  presentation/
  sources/
```

## Implementation Notes

- Use Git moves where possible so history is easier to follow.
- Move tests with their modules.
- Remove compatibility exports only when imports have been updated.
- Update README and architecture docs in the same PR.
- Avoid empty folders.

## Acceptance Criteria

- `src/lib` is removed or reduced to a very small documented compatibility layer.
- `src/items` is renamed or narrowed to enrichment rules.
- `src/io/local` is moved or clearly split between infrastructure and localization.
- README project structure matches the implemented structure.
- No empty architectural folders are left behind.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run check:ci` if formatting/import churn is large.

## Progress

CLI presentation helper slice on 2026-06-04:

- Moved CLI presentation helpers from `src/lib/cli.ts` to `src/presentation/cli.ts`.
- Left `src/lib/cli.ts` as a documented compatibility re-export for older imports.
- Updated `bin/update-item.ts`, `bin/update-all.ts`, and `bin/apply-artifact.ts` to import CLI helpers from `src/presentation/cli`.
- Did not rename `src/items` or move generated/scraped data.

Verification:

- `npm run typecheck`
- `npm test`
- `npx biome lint src/presentation/cli.ts src/lib/cli.ts bin/update-item.ts bin/update-all.ts bin/apply-artifact.ts`
- `node --import tsx/esm bin/update-item.ts --help`
- `node --import tsx/esm bin/update-all.ts --help`
- `node --import tsx/esm bin/apply-artifact.ts --help`

Remaining:

- Continue reducing `src/lib` in small slices, likely infrastructure logging, formatting/stat-builder, updater compatibility, and enrichment extra steps.
- Keep `src/items` renaming/narrowing separate until enrichment boundaries are explicit.
- Update README/project-structure docs once enough folder cleanup has landed.

Logging infrastructure slice on 2026-06-04:

- Moved logger implementation from `src/lib/logger.ts` to `src/infrastructure/logger.ts`.
- Left `src/lib/logger.ts` as a documented compatibility re-export for older imports.
- Updated active CLI, application, artifact, localization, local IO, updater, formatter, and enrichment update imports to use `src/infrastructure/logger`.
- Did not rename `src/items` or move generated/scraped data.

Verification:

- `npm run typecheck`
- `npm test`
- `npx biome lint src/infrastructure/logger.ts src/lib/logger.ts src/presentation/cli.ts src/application/use-cases/enrich-global-ini.ts src/localization/key-resolver.ts src/localization/ini-file.ts src/artifact/loader.ts src/io/local/mapping-store.ts src/lib/updater.ts src/lib/updater.test.ts src/lib/format/stat-builder.ts src/lib/updates/adagio-location-tags.ts src/lib/updates/fps-title-tags.ts src/lib/updates/component-titles.ts src/lib/updates/mining-journal-update.ts src/lib/updates/missile-title-tags.ts src/lib/updates/missing-strings.ts src/lib/updates/raw-commodity-label-fixes.ts bin/update-item.ts bin/update-all.ts bin/apply-artifact.ts`
- `node --import tsx/esm bin/update-item.ts --help`
- `node --import tsx/esm bin/update-all.ts --help`
- `node --import tsx/esm bin/apply-artifact.ts --help`

Remaining:

- Continue reducing `src/lib` in small slices, likely CSV infrastructure helpers, formatting/stat-builder, updater compatibility, and enrichment extra steps.
- Keep `src/items` renaming/narrowing separate until enrichment boundaries are explicit.
- Update README/project-structure docs once enough folder cleanup has landed.

CSV infrastructure slice on 2026-06-04:

- Moved CSV serialization helper from `src/lib/csv.ts` to `src/infrastructure/csv.ts`.
- Left `src/lib/csv.ts` as a documented compatibility re-export for older imports.
- Updated active SCMDB scrape imports to use `src/infrastructure/csv`.
- Did not rename `src/items` or move generated/scraped data.

Verification:

- `npm run typecheck`
- `npm test`
- `npx biome lint src/infrastructure/csv.ts src/lib/csv.ts src/application/use-cases/run-scmdb-scrape.ts src/sources/scmdb/mining-locations.ts`

Remaining:

- Continue reducing `src/lib` in small slices, likely formatting/stat-builder, updater compatibility, and enrichment extra steps.
- Keep `src/items` renaming/narrowing separate until enrichment boundaries are explicit.
- Update README/project-structure docs once enough folder cleanup has landed.
