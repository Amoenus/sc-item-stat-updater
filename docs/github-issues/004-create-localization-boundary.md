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
