# Create Localization Boundary

## Type

Task

## Labels

`architecture`, `localization`, `refactor`

## Depends On

- 003: Split Updater Into Planning And Application

## Problem

Localization-aware behavior is currently spread across `src/io/local/ini-file.ts`, `src/lib/ini-tags.ts`, `src/lib/key-resolver.ts`, `src/lib/format/text-utils.ts`, and `src/lib/updater.ts`. Generic filesystem helpers and INI/domain behavior are easy to confuse.

## Goal

Create `src/localization` as the home for `global.ini` parsing, key resolution, INI tag handling, flavor text handling, patch application, and localization-specific formatting behavior.

## Proposed Moves

```text
src/io/local/ini-file.ts        -> src/localization/ini-file.ts
src/lib/ini-tags.ts            -> src/localization/ini-tags.ts
src/lib/key-resolver.ts        -> src/localization/key-resolver.ts
src/lib/format/text-utils.ts   -> src/localization/text-utils.ts
```

Move gradually and keep compatibility re-exports if needed.

## Implementation Notes

- Do not move generic CSV/JSON/path helpers into localization.
- Keep tests next to moved modules.
- Update import paths in small batches.
- Preserve behavior around BOM, duplicate keys, variants, and insertion order.

## Acceptance Criteria

- Localization-aware modules live under `src/localization`.
- Compatibility re-exports are documented or removed before the issue closes.
- Existing localization-related tests pass from their new locations.
- No source acquisition module imports localization mutation functions.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Add or update tests for variant key preservation and BOM handling if coverage is missing.

## Progress

INI file boundary slice on 2026-06-04:

- Moved localization-aware INI parsing/writing from `src/io/local/ini-file.ts` to `src/localization/ini-file.ts`.
- Moved the `findIniKey` test from `src/io/local/ini-file.test.ts` to `src/localization/ini-file.test.ts`.
- Left `src/io/local/ini-file.ts` as a documented compatibility re-export for older imports.
- Updated active application, artifact, updater, and extra-step imports to use `src/localization/ini-file`.
- Confirmed source acquisition modules do not import localization INI or patch-application modules.

Verification:

- `node --import tsx/esm --test src/localization/ini-file.test.ts`
- `npm run typecheck`
- `npm test`
- `npx biome lint src/localization/ini-file.ts src/localization/ini-file.test.ts src/io/local/ini-file.ts src/application/use-cases/build-patch-plan.ts src/application/use-cases/enrich-global-ini.ts src/application/use-cases/run-batch-update.ts src/artifact/loader.ts src/lib/updater.ts src/lib/updates/adagio-location-tags.ts src/lib/updates/component-titles.ts src/lib/updates/fps-title-tags.ts src/lib/updates/mining-journal-update.ts src/lib/updates/missile-title-tags.ts src/lib/updates/missing-strings.ts src/lib/updates/raw-commodity-label-fixes.ts`

Remaining:

- Move or facade `ini-tags`, `key-resolver`, and localization text utilities under `src/localization`.
- Document or remove remaining compatibility re-exports before closing GitHub #88.

INI tags boundary slice on 2026-06-04:

- Moved localization tag descriptors and key suffix constants from `src/lib/ini-tags.ts` to `src/localization/ini-tags.ts`.
- Left `src/lib/ini-tags.ts` as a documented compatibility re-export for older imports.
- Updated active localization, mission item, mission extractor, and extra-step imports to use `src/localization/ini-tags`.

Verification:

- `npm run typecheck`
- `npm test`
- `npx biome lint src/localization/ini-tags.ts src/lib/ini-tags.ts src/localization/ini-file.ts src/items/missions/scmdb-titles.ts src/items/missions/commodities.ts src/extractor/mission/row-builder.ts src/lib/updates/adagio-location-tags.ts`

Remaining:

- Move or facade `key-resolver` and localization text utilities under `src/localization`.
- Document or remove remaining compatibility re-exports before closing GitHub #88.
