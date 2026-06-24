# Command Log

Run folder: `architecture_as_is/20260624_160217`

| Command | Purpose | Result |
| --- | --- | --- |
| `Get-Date -Format yyyyMMdd_HHmmss` | Establish local timestamp for this as-built run. | `20260624_160217`. |
| `git status --short` | Capture pre-run dirty state. | Existing dirty state included `.env.example`, generated `csv/` data, `global.ini`, package/tool changes, DataCore graph code changes, and untracked `architecture_as_is/`, `csv/datacore/4.8.2-live.12061511/`, `csv/scmdb/4.8.2-live.12061511/`. |
| `Get-Content package.json` | Identify scripts, runtime, dependencies, and command surfaces. | Node 24 ESM TypeScript CLI app with pipeline/cache/update/deploy/extract scripts and Biome/TypeScript checks. |
| `rg --files \| Measure-Object` | Count repository files visible to ripgrep. | 628 tracked/unignored visible files. |
| `Get-Content README.md -TotalCount 260` | Compare documented workflow against code. | README describes clean pipeline and DataCore-first source hierarchy. |
| `Get-Content docs/architecture-overview.md -TotalCount 260` | Capture intended boundary model. | Docs describe acquisition, normalization, planning, application, deployment, and small architecture guardrails. |
| `Get-Content docs/source-hierarchy-and-scmdb-audit.md -TotalCount 260` | Capture migration narrative and SCMDB bridge status. | Docs state DataCore is authoritative, SCMDB is temporary bridge, and several migration slices remain. |
| `Get-ChildItem -Recurse -File csv ...` | Rough generated-data inventory. | First broad attempt grouped poorly but showed about 398k files and about 15 GB under generated/cache data. |
| `rg -n "runFullPipeline\|refreshSourceCache\|runDatacoreScrape..."` | Locate orchestration entrypoints. | Found full pipeline, cache refresh, DataCore scrape, SCMDB scrape, enrichment, deployment use cases and presentation wrappers. |
| `Get-Content src/application/use-cases/run-full-pipeline.ts` | Trace full pipeline sequence. | Confirms extract baseline, refresh sources by default, apply DataCore-provider updates, then deploy. |
| `Get-Content src/application/use-cases/refresh-source-cache.ts` | Trace source cache coordination. | Confirms SCMDB/DataCore selected together for `all`, run through source-specific use cases with bounded concurrency. |
| `Get-Content src/application/use-cases/run-datacore-scrape.ts` | Trace DataCore cache, graph, raw facts, item CSVs. | Confirms DCB/XML cache paths, graph reuse/write, raw fact stage fan-out, final CSV catalog, and item CSV generation in one large plan. |
| `Get-Content src/application/use-cases/run-scmdb-scrape.ts` | Trace SCMDB raw/derived outputs. | Confirms raw JSON download/write and derived CSV outputs from validated schemas. |
| `Get-Content src/application/update/update-planning.ts` | Inspect source loading, mapping, preflight, patch planning. | Found CSV/JSON loading, DataCore manufacturer enrichment, legacy SPViewer mapping resolver, source-file preflight, and patch planning. |
| `Get-Content src/application/use-cases/run-batch-update.ts` | Trace update orchestration. | Confirms category preparation, preflight, backup, category runs, extra steps, source diagnostics, and SCMDB audit. |
| `Get-Content src/application/use-cases/prepare-update-categories.ts` | Inspect version/source directory selection. | Confirms latest matching SCMDB and DataCore directories are selected independently and wired into categories via `sourceDirs`. |
| `Get-Content src/application/use-cases/run-update-extra-steps.ts` | Inspect extra-step source coupling. | Confirms fixed extra steps plus optional mining journal, with DataCore and SCMDB directories passed separately. |
| `Get-Content src/items/registry.ts` | Inspect dynamic category discovery. | Confirms categories are dynamically loaded from `src/items/datacore` and `src/items/missions` by filename conventions. |
| `Get-Content src/io/local/mapping-store.ts` | Inspect saved mapping behavior. | Confirms legacy mapping JSON load/save and lookup CSV mapping. |
| `npm run check:architecture` | Run automated architecture guard. | Passed. Guard is intentionally narrow. |
| `node --import tsx/esm bin/update-item.ts --list-categories` | Inspect category/source inventory from app command. | Lists 22 DataCore item categories, DataCore-backed mission categories, raw fact datasets, and mixed-source batch mode. |
| `node --import tsx/esm bin/update-item.ts --scmdb-audit` | Inspect current SCMDB dependency classification. | Shows DataCore-first status plus remaining mining-journal SCMDB fallback. |
| `node --import tsx/esm bin/update-item.ts --provider-matrix` | Inspect provider coverage matrix. | Claims all listed categories are DataCore primary, while mixed-source batch mode still says DataCore + SCMDB. |
| `Get-ChildItem ... csv/datacore/.xmlcache ...` | Refine generated/cache size inventory. | `.xmlcache`: 398,002 files / 12,762.6 MB; `.dcbcache`: 7 files / 1,225.2 MB; latest DataCore output: 53 files / 358.2 MB; latest SCMDB output: 12 files / 23.4 MB. |
| `Get-ChildItem mappings -File` | Inspect mapping artifacts. | 23 SPViewer-named mapping JSON files remain. |
| `rg -n "sourceFiles\|loadSourceData\|..." src/items src/enrichment` | Inventory category-level source declarations and custom loaders. | Shows many configs with custom `sourceFiles`, `loadSourceData`, `getTargetKeys`, alternates, and source-specific logic. |
| `Get-Content src/sources/datacore/acquisition.ts` | Inspect XML cache extraction ownership. | Confirms optional cache deletion, DCB copy into XML cache, unforge run, polling count, and cleanup of transient DCB/XML. |
| `Get-Content src/io/local/unp4k-tool.ts` | Inspect external tool/version handling. | Confirms GitHub latest-release lookup, download/extract into game `unp4k` folder, Windows/WSL path conversion, and version fallbacks. |
| `Get-Content src/sources/datacore/record-graph.ts` | Inspect graph construction and persisted graph. | Confirms worker parsing, graph indexes, compact options, and streaming JSON writer. |
| `Get-Content src/sources/scmdb/output-files.ts; Get-Content src/sources/scmdb/outputs.ts` | Inspect SCMDB conversion outputs. | Confirms SCMDB raw merged/mining/MEMA data becomes mission, contract, mining, journal, and MEMA CSVs. |
| `Get-Content src/presentation/commands/pipeline.ts` | Inspect CLI task topology. | Confirms presentation layer owns nested workflow task graph and source refresh child tasks. |
| `Get-Content src/presentation/datacore-task.ts` | Inspect DataCore visible stage grouping and concurrency. | Confirms raw fact group topology and item type groups live in presentation. |
| `Get-Content scripts/check-architecture.ts` | Inspect guardrail coverage. | Confirms guard checks source imports, Listr location, and forbidden progress packages only. |
| `(rg --files src \| Select-String '\.test\.ts$' \| Measure-Object).Count` | Count test files. | 109 test files. |
| `rg -n "test\('|describe\(|it\(" ...` | Sample tests as architecture evidence. | Found tests for pipeline, cache/deploy presentation, preflight, record graph, and many DataCore scrape behaviors. |
| `npm run typecheck` | Lightweight verification after inspection. | Passed. |
| `git status --short` | Capture pre-report status. | Same existing dirty state; report artifacts not yet added at that point. |
