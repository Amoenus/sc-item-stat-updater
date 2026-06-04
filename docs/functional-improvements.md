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

- #99: Add command-level no-write smoke tests for `update-all`, `update-item`, `apply-artifact`, and pipeline help/dry-run paths.
- #100: Add a generated-data churn guard that detects accidental changes under `csv/` or `global.ini` after verification commands that should not write.
- #101: Improve missing-source-data errors so they name the exact provider, channel, category, expected path, and suggested scrape/extract command.
- #102: Add an artifact apply preview summary that reports counts, changed keys, inserted keys, skipped keys, and issues before writes.
- #103: Add source freshness diagnostics that show detected LIVE/PTU versions and warn when selected source data looks stale or incomplete.
- #104: Add output comparison reports for categories supported by both DataCore and SPViewer, highlighting coverage and value differences.
- #105: Add snapshot-style tests for high-value generated strings such as mission descriptions, mining journal entries, component title tags, and location labels.
- #106: Add malformed-artifact and schema-error UX tests with friendlier error messages.
- #107: Add localization duplicate/collision tests beyond key resolution, including plural/gender suffix handling and all-occurrence update paths.
- #108: Add a performance budget around a representative large fixture update to catch slow planning or INI application regressions.
- #109: Add backup/restore tests for write and deploy paths, including repository `global.ini` backups and game-folder deploy backups.
- #110: Add a `--list-categories` or equivalent CLI path that reports categories, supported providers, required source files, and channel/version expectations.
- #111: Add a provider coverage matrix in docs or command output showing which categories support DataCore, SPViewer, SCMDB, or mixed sources.

## Recommended Next Slice

Inspect #99 next. It is behavior-preserving command smoke coverage for no-write/help paths and should be implemented with fixtures or temporary directories.

## Completed Functional Issues

- #112: SCMDB output contract tests now pin `legacy-contracts.csv` column ordering, assert the blueprint marker fields `isBlueprintReward`, `isBlueprintChainPrerequisite`, and `blueprintChainDepth`, and document the downstream contract in `docs/scmdb-output-contracts.md`.
- #50: `descKeyMatch` guardrails now include representative positive/negative samples for every loadable registered item config, structured overlap detection, and dry-run overlap logging in prepared category runs with explicit INI fixtures.
- #54: Fixture-driven pipeline integration coverage now copies `test/fixtures/pipeline-integration` into a temporary directory, loads real `sp-coolers` and `dc-powerplants` configs through the registry, plans updates from CSV fixtures, applies the patch plans to a fixture `global.ini`, asserts exact generated INI output, and verifies unrelated keys stay unchanged.
- #55: Key resolver edge-case coverage now exercises lookup-map hits, reverse-index hits, suffix stripping success and failure, suffix `endsWith` fallback, empty/missing names, no-match unresolved behavior, and debug logging assertions.
