# Generated Data Ownership

This table classifies repository `csv/` paths by ownership and lifecycle. It is intentionally path-pattern based: the
DataCore XML cache alone can contain hundreds of thousands of files, so a literal per-file inventory would hide the
architecture signal under generated noise.

## Ownership Classes

| Class | Meaning | Commit policy |
| --- | --- | --- |
| Committed artifact | Human-reviewable generated data consumed by update commands and expected to be versioned when intentionally refreshed. | Commit only intentional patch/version refreshes. |
| Rebuildable local cache | Large machine-local cache that exists to avoid expensive extraction or download work. | Do not commit by default. |
| Raw source snapshot | Captured upstream payload preserved for reproducible conversion. | Commit only when the source version is intentionally refreshed. |
| Derived source output | CSV/JSON output produced from raw source data and consumed by enrichment/update flows. | Commit only intentional refreshes. |
| Diagnostic-only output | Data emitted to compare, audit, or migrate providers; not required for normal update application. | Commit when it supports an active migration/audit, otherwise prune. |
| Obsolete historical output | Prior-version output no longer selected by default and retained only as history. | Prefer pruning or archiving outside the active repo. |

## Path Ownership Table

| Path pattern | Class | Producer | Primary consumers | Notes |
| --- | --- | --- | --- | --- |
| `csv/datacore/.dcbcache/<version>/Data/Game2.dcb` | Rebuildable local cache | `runDatacoreScrape` via `unp4k` extraction from `Data.p4k` | DataCore XML extraction | Large binary cache. It should be keyed by source `Data.p4k` fingerprint metadata. |
| `csv/datacore/.dcbcache/<version>/.metadata.json` | Rebuildable local cache | `runDatacoreScrape` | DCB cache reuse check | Stores source `Data.p4k` fingerprint for cache invalidation. |
| `csv/datacore/.xmlcache/<version>/**/*.xml` | Rebuildable local cache | `runDatacoreScrape` via `unforge` | Record graph builder and extractors that still reread XML by path | Largest local cache. It is not a reviewable artifact. |
| `csv/datacore/.xmlcache/<version>/.metadata.json` | Rebuildable local cache | `runDatacoreScrape` | XML cache reuse check | Stores game version, DCB fingerprint, and XML cache count fingerprint. |
| `csv/datacore/<version>/record-graph.json` | Derived source output | DataCore record graph builder | DataCore raw fact extractors, mission enrichers, title/tag extra steps | Reviewable but very large. It is a projection/index, not the raw source of truth. |
| `csv/datacore/<version>/record-graph.metadata.json` | Derived source output | DataCore record graph builder | Record graph cache reuse check | Sidecar metadata for graph schema version, generator version, DCB fingerprint, XML cache count, and compact/full fidelity mode. |
| `csv/datacore/<version>/*.datacore.csv` | Derived source output | DataCore raw fact and item-type extractors | Item configs, mission configs, extra update steps, diagnostics | Active DataCore source catalog. Commit only intentional version refreshes. |
| `csv/datacore/<old-version>/record-graph.json` | Obsolete historical output | Older DataCore runs | Usually none unless explicitly pinned | Historical versions should not be selected by default unless the caller pins them. |
| `csv/datacore/<old-version>/*.datacore.csv` | Obsolete historical output | Older DataCore runs | Usually none unless explicitly pinned | Retention should be deliberate; otherwise these create confusing latest-version comparisons. |
| `csv/scmdb/<version>/scmdb-versions.json` | Raw source snapshot | SCMDB scrape | SCMDB scrape/version diagnostics | Upstream version payload. |
| `csv/scmdb/<version>/merged-*.json` | Raw source snapshot | SCMDB scrape | SCMDB output conversion | Raw upstream item/mission payload. |
| `csv/scmdb/<version>/mining-data-*.json` | Raw source snapshot | SCMDB scrape | Mining conversion and mining-journal fallback | Still relevant while mining journal has optional fallback behavior. |
| `csv/scmdb/<version>/crafting_items-*.json` | Raw source snapshot | SCMDB scrape | DataCore item-type class fallback, SCMDB conversion | Current DataCore item scrape still consults same-version SCMDB crafting data for display component class fallback. |
| `csv/scmdb/<version>/mema-cache.json` | Raw source snapshot | SCMDB scrape | MEMA-derived output conversion | Upstream auxiliary cache. |
| `csv/scmdb/<version>/scmdb-*.csv` | Derived source output | SCMDB output conversion | Legacy/bridge mission and mining update paths | Should shrink as SCMDB bridge behavior is retired. |
| `csv/scmdb/<version>/missions/scmdb-missions.csv` | Derived source output | SCMDB mission conversion | Legacy mission categories if enabled | Current category listing shows DataCore-backed mission categories, so this is bridge/historical unless explicitly selected. |
| `csv/scmdb/<version>/mining-journal.csv` | Derived source output | SCMDB mining conversion | Optional mining journal fallback | Keep only while fallback is intentionally supported. |
| `csv/scmdb/<old-version>/**` | Obsolete historical output | Older SCMDB scrapes | Usually none unless explicitly pinned | Independent latest-version selection makes old SCMDB directories especially easy to misread. |

## Verification Decisions

1. Default SCMDB refresh should not remain in `pipeline`/`cache` forever if SCMDB is only optional fallback behavior.
   The recommended target state is `all = datacore` for normal runs, with `--source scmdb` or an explicit
   `--include-scmdb-fallbacks` style flag for bridge regeneration.
2. Do not flip that default silently in the same patch as metadata validation. It changes CLI semantics, task output,
   and tests. Make it a dedicated migration with release-note treatment.
3. Category source contracts should move toward one generated declaration that feeds `--list-categories`, preflight,
   diagnostics, provider matrix, and docs. Today those views infer similar facts from parallel helper code.
4. A clean `check:no-generated-churn` run requires either a clean git baseline or an intentionally staged generated-data
   refresh. Running it against a dirty generated-data tree proves the guard works, but it does not prove the pipeline is
   no-write clean.

## Intentional Refresh Workflow

1. Start from a clean worktree, or inspect any existing generated-data changes before refreshing.
2. Run the explicit source refresh command for the intended provider and version.
3. Review changed `csv/` paths against the ownership table above:
   - Rebuildable local caches under `.dcbcache/` and `.xmlcache/` should be restored, removed, or explicitly exempted.
   - Raw source snapshots and derived source outputs should move together for the same source version.
   - Diagnostic-only outputs should explain the migration or audit they support.
4. Stage only the intentional generated-data refresh paths.
5. Run `npm run check:no-generated-churn`; staged generated-data changes are treated as the baseline, and the guard
   reports any remaining unstaged churn by ownership class.
6. Include the source version, refresh command, ownership classification, and verification commands in the commit or PR
   notes.

## Historical Retention

The active generated source version is the latest version directory selected by the provider-specific version resolver.
Older DataCore and SCMDB version directories are classified as obsolete historical output unless a caller explicitly pins
that version. Keep historical directories only when they support comparison, rollback, or an active migration. Otherwise,
prefer pruning them in a dedicated generated-data cleanup so normal refresh reviews focus on the current source version.
