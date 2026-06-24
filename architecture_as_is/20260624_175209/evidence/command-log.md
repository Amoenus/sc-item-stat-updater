# Command Log

Working directory: `C:\Git\sc-item-stat-updater`

## Baseline

```text
git status --short
```

Observed: no output; worktree was clean before the report artifacts were added.

```text
npm run typecheck
```

Observed: passed.

```text
npm run check:architecture
```

Observed: `Architecture guardrails passed.`

```text
npm run check:no-generated-churn
```

Observed: `Generated-data churn guard passed: no unstaged changes under csv/ or root global.ini.`

## Generated Data and Mapping Inventory

```text
Get-ChildItem csv\datacore -Directory | ForEach-Object Name
Get-ChildItem csv\scmdb -Directory | ForEach-Object Name
(Get-ChildItem mappings -Filter *.spviewer.json | Measure-Object).Count
```

Observed DataCore directories:

- `.dcbcache`
- `.xmlcache`
- `4.8.0-live.11875683`
- `4.8.1-live.11875683`
- `4.8.1-live.11952564`
- `4.8.2-live.12061511`

Observed SCMDB directories:

- `4.8.1-live.11875683`
- `4.8.1-live.11952564`
- `4.8.2-live.12061511`

Observed SPViewer mapping files: `22`.

## Large File Scan

```text
Get-ChildItem -Recurse -File src -Filter *.ts | ... | Sort-Object Lines -Descending | Select-Object -First 20
```

Largest files observed:

- `src/application/use-cases/run-datacore-scrape.test.ts` - 4563 lines
- `src/application/use-cases/run-datacore-scrape.ts` - 3937 lines
- `src/items/missions/mining-locations.ts` - 1191 lines
- `src/sources/datacore/types.ts` - 819 lines
- `src/items/missions/datacore-descriptions.ts` - 772 lines
- `src/presentation/commands/pipeline-cache-deploy.test.ts` - 663 lines
- `src/application/update/update-planning.ts` - 643 lines
- `src/extractor/mission/row-builder.ts` - 528 lines
- `src/sources/datacore/record-graph.ts` - 434 lines
- `src/presentation/commands/pipeline.ts` - 425 lines

## Focused Source Reads

Files inspected:

- `package.json`
- `scripts/check-architecture.ts`
- `scripts/check-generated-data-churn.ts`
- `docs/generated-data-ownership.md`
- `docs/source-hierarchy-and-scmdb-audit.md`
- `src/application/source-contracts/category-source-contracts.ts`
- `src/application/use-cases/refresh-source-cache.ts`
- `src/application/use-cases/build-patch-plan.ts`
- `src/application/update/update-planning.ts`
- `src/application/use-cases/run-datacore-scrape.ts`
- `src/application/use-cases/run-full-pipeline.ts`
- `src/presentation/commands/pipeline.ts`
- `src/presentation/datacore-task.ts`

Representative observations:

- `DEFAULT_SOURCE_CACHE_TARGET` is `datacore`; `selectSourceCacheSources('datacore')` returns only DataCore.
- `scripts/check-architecture.ts` enforces DataCore-only defaults, generated-data ownership coverage, presentation-only Listr boundaries, and active category source contracts.
- `category-source-contracts.ts` centralizes source file listing and provider inference.
- `build-patch-plan.ts` rejects `nameColumn` legacy SPViewer key resolution unless `legacyKeyResolution` is passed.
- `docs/generated-data-ownership.md` classifies `mappings/*.spviewer.json` as historical legacy mappings.
- `docs/source-hierarchy-and-scmdb-audit.md` states SPViewer is retired from active support and mapping files are not active workflow state.
