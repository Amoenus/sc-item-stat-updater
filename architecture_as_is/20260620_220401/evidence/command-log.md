# Command Log

Generated: 2026-06-20 22:04:01 Europe/Riga

| Command | Purpose | Result |
| --- | --- | --- |
| `git status --short` | Capture pre-run workspace state. | Existing dirty files: `csv/scmdb/4.8.1-live.11952564/mema-cache.json`, `csv/scmdb/4.8.1-live.11952564/scmdb-mema.csv`, `global.ini`. |
| `rg --files` | Inventory repository files. | Identified TypeScript source, CLI bins, docs, mappings, generated `csv/` data, fixtures, and local data folders. |
| `Get-ChildItem -Force` | Inspect top-level folders, including untracked/ignored local data. | Observed `.env.local`, `node_modules`, `dist`, `Data`, `Engine`, and generated/local backup files in addition to source. |
| `Get-Content -Raw package.json` | Identify scripts, runtime, dependencies, package type. | Node ESM TypeScript CLI package with Node >=24, tsx execution, Biome, TypeScript, Node test runner, zod, listr2, csv tooling, piscina, cheerio. |
| `Get-Content -Raw README.md` | Compare docs with implementation shape. | README describes local enrichment pipeline and commands matching package scripts. |
| `Get-Content -Raw docs/architecture-overview.md` | Read documented architecture direction. | Documents clean pipeline stages and boundary rules. |
| `Get-Content -Raw scripts/check-architecture.ts` | Inspect automated boundary checks. | Guard checks source/localization import separation and Listr2 presentation-layer use. |
| `npm run check:architecture` | Verify automated architecture guardrails. | Passed: `Architecture guardrails passed.` |
| `npm run typecheck` | Verify TypeScript static validity. | Passed with no reported errors. |
| `npm test` | Run existing architecture/behavior evidence. | Passed: 549 tests, 547 pass, 0 fail, 2 skipped, duration about 22.6s. |
| `rg -n ... package.json` | Gather line-level command/runtime evidence. | Found script and runtime lines in `package.json`. |
| `rg -n ... src/application/use-cases/run-full-pipeline.ts` | Gather pipeline orchestration evidence. | Found orchestration imports and default dependency wiring lines. |
| `rg -n ... src/application/use-cases/enrich-global-ini.ts` | Gather patch planning/application evidence. | Found build, apply, integrity validation, and write lines. |
| `rg -n ... src/items/registry.ts` | Gather dynamic category registry evidence. | Found directory-based dynamic imports and category listing. |
| `rg -n ... scripts/check-architecture.ts` | Gather guardrail evidence. | Found forbidden import rules and success output. |
| `rg -n "Source Dataset|Patch Plan|Patch Artifact|Boundary Rules|System Flow|Source Layout|npm run check:architecture" docs/architecture-overview.md` | Gather documentation line evidence. | Found system flow, source layout, contracts, and maintenance command lines. |
| `rg -n "Source Dataset|Patch Plan|Patch Artifact|Boundary Rules|Run `npm run check:architecture`|System Flow|Source Layout" docs/architecture-overview.md` | Attempted broader docs search. | Failed because PowerShell/backtick quoting produced a regex with a literal newline; no repository files changed. |
| `Get-Date -Format yyyyMMdd_HHmmss` | Create run timestamp. | Produced `20260620_220401`. |
| `New-Item -ItemType Directory -Force ...` | Create architecture artifact folders. | Created `architecture_as_is/20260620_220401/evidence` and `diagrams`. |
