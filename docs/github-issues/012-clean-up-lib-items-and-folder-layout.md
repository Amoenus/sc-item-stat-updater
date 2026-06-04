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
