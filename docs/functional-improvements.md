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

- #110: Add a `--list-categories` or equivalent CLI path that reports categories, supported providers, required source files, and channel/version expectations.
- #111: Add a provider coverage matrix in docs or command output showing which categories support DataCore, SPViewer, SCMDB, or mixed sources.

## Recommended Next Slice

Inspect #110 next. It is a CLI discoverability slice for category/provider/source metadata; preserve existing CLI behavior while adding the new listing path.

## Completed Functional Issues

- #109: Added backup coverage for write and deploy paths. `enrichGlobalIni` now has a temp-fixture test proving repository `global.ini.backup.1` is created before writes, and `deployGlobalIni` backs up an existing game target before copying; deployment failure coverage now proves the original fixture target stays intact.
- #108: Added a large generated-in-test INI update performance budget. The test builds a controlled 2,500-row fixture with 5,000 base/plural INI updates, reports planning and application timings separately, keeps loose CI-friendly budgets, and uses only in-memory fixtures rather than real `global.ini` or generated source data.
- #107: Added focused localization duplicate/collision coverage. Planner tests now pin duplicate base keys plus plural/gender suffix occurrences with explicit line indexes; patch-application tests prove all occurrence updates preserve actual suffixed line keys; artifact serialization tests prove duplicate occurrence line-index metadata still stays out of persisted artifact entries.
- #106: Improved malformed artifact UX in `readArtifactFile`. Invalid JSON now reports the path, `JSON` field context, and parse problem; schema failures report the artifact path, high-level field, concise problem, and detailed schema path while preserving the Zod error as `cause`. Tests cover malformed JSON, missing `entries`, invalid `entries`, invalid issue payloads, and valid artifact readback.
- #105: Added snapshot-style exact-string tests for high-value generated localization output: SCMDB mission descriptions, mining journal entries, component title tags, SCMDB mission title tag ordering, and Adagio location labels. The tests pin whitespace/tag ordering and use temp files or in-memory builders only.
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
