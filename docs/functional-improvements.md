# Functional Improvement Inventory

Date: 2026-06-04

This inventory follows the Clean Pipeline Architecture migration. It tracks functional, testing, performance, dependency, and user-experience improvements that remain after the architecture cleanup. It intentionally excludes broad folder reshaping and migration bookkeeping.

## Post-Migration Cleanup Audit

Current cleanup state:

- `src/lib` has no tracked files and the empty local directory was removed.
- Old compatibility exports for `runUpdate` and `buildPatchData` have been removed.
- Active source and CLI imports no longer reference `src/lib`.
- `src/items` remains intentionally scoped to item and mission enrichment rule modules.
- Historical migration docs and issue logs may still mention old paths because they record previous slices.

Current intentional compatibility:

- Patch artifacts keep the ADR 002 JSON shape for backward compatibility.
- Artifact JSON does not serialize localization application metadata such as `existingLineIndex`.
- SPViewer remains a legacy/fallback provider while DataCore coverage continues to improve.

## Tracked Functional Backlog

### #48: Parallel SPViewer CSV Lookup Loading

Priority: Low-Medium

`buildLookupFromCsvFiles` should read independent SPViewer CSV inputs in parallel. The old issue text references the former `src/lib/updates/lookup-utils.ts` path; the implemented path is now `src/enrichment/updates/lookup-utils.ts`.

### #52: OpenTelemetry Audit

Priority: Low

Identify whether OpenTelemetry packages are used for real tracing/export or only local CLI logging. If they are only local logging support, replace or remove them; if tracing is intentional, document the destination and purpose.

### #51: Puppeteer Dependency Review

Priority: Low

Puppeteer is only needed for scraping, especially SPViewer flows. Consider making it optional or isolating scraper dependencies so users who only update from existing data do not download Chromium unnecessarily.

## Newly Created Functional Issues

These were split from the additional candidate inventory on 2026-06-04.

- #105: Add snapshot-style tests for high-value generated strings such as mission descriptions, mining journal entries, component title tags, and location labels.
- #106: Add malformed-artifact and schema-error UX tests with friendlier error messages.
- #107: Add localization duplicate/collision tests beyond key resolution, including plural/gender suffix handling and all-occurrence update paths.
- #108: Add a performance budget around a representative large fixture update to catch slow planning or INI application regressions.
- #109: Add backup/restore tests for write and deploy paths, including repository `global.ini` backups and game-folder deploy backups.
- #110: Add a `--list-categories` or equivalent CLI path that reports categories, supported providers, required source files, and channel/version expectations.
- #111: Add a provider coverage matrix in docs or command output showing which categories support DataCore, SPViewer, SCMDB, or mixed sources.

## Recommended Next Slice

Inspect #105 next. It is a test-quality slice for high-value generated strings and should use stable fixtures/snapshots without changing generated data.

## Completed Functional Issues

- #104: Added a provider-output comparison use case for shared DataCore/SPViewer categories. It compares dry-run patch-plan entries, reports DataCore-only keys, SPViewer-only keys, changed shared values, and compact formatted summaries. Tests use temporary CSV/INI fixtures for a shared `coolers` category and assert the comparison does not write `global.ini`.
- #103: Added source freshness diagnostics for update and pipeline flows. The diagnostics summarize selected SCMDB and item-provider LIVE/PTU versions with source paths, warn when selected versions look like the wrong channel, and warn when prepared source files are missing/incomplete with provider/category/path context. Tests use temporary source directories and fixtures only.
- #102: `apply-artifact --dry-run` now prints a concise preview summary with changed, inserted, skipped, and issue counts plus capped representative key samples. Loader tests cover compact artifact input, inserted keys, skipped/missing keys, issue counts, and sample truncation, while artifact serialization tests continue to prove application-only metadata such as line indexes is not written to JSON.
- #101: Missing-source-data preflight errors now include provider, channel, category slug, config label when useful, expected resolved path, and a relevant `npm run scrape:*` command suggestion. Focused tests cover a missing DataCore item source and a missing SCMDB PTU mission source while preserving the successful preflight path.
- #100: Added `npm run check:no-generated-churn`, backed by a git-status guard for repository `csv/` and root `global.ini`, with tests proving fixture/temp-directory writes are ignored and generated-data changes produce clear path-specific failures.
- #99: Command-level smoke tests now spawn `update-all`, `update-item`, and `pipeline` help paths plus an `apply-artifact --dry-run` temp fixture, asserting exit codes, user-facing output, and no INI fixture writes.
- #112: SCMDB output contract tests now pin `legacy-contracts.csv` column ordering, assert the blueprint marker fields `isBlueprintReward`, `isBlueprintChainPrerequisite`, and `blueprintChainDepth`, and document the downstream contract in `docs/scmdb-output-contracts.md`.
- #50: `descKeyMatch` guardrails now include representative positive/negative samples for every loadable registered item config, structured overlap detection, and dry-run overlap logging in prepared category runs with explicit INI fixtures.
- #54: Fixture-driven pipeline integration coverage now copies `test/fixtures/pipeline-integration` into a temporary directory, loads real `sp-coolers` and `dc-powerplants` configs through the registry, plans updates from CSV fixtures, applies the patch plans to a fixture `global.ini`, asserts exact generated INI output, and verifies unrelated keys stay unchanged.
- #55: Key resolver edge-case coverage now exercises lookup-map hits, reverse-index hits, suffix stripping success and failure, suffix `endsWith` fallback, empty/missing names, no-match unresolved behavior, and debug logging assertions.
