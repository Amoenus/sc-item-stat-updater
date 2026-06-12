# Star Citizen Item Stat Updater

Enriches Star Citizen's `global.ini` with additional quality-of-life information for in-game text.

If you want to install the enriched file or understand the tags and data added in game, start with the [User Manual](docs/user-manual.md).

The long-term architecture is a local enrichment pipeline:

1. Extract a fresh `global.ini` from the game files.
2. Extract additional game-file data from DataCore/Data.p4k as the authoritative source for raw facts.
3. Use SCMDB only as a temporary derived-data bridge for mission, blueprint, crafting, mining aggregation, or generated joins not yet reconstructed from DataCore.
4. Build localization patch plans.
5. Apply those patches to the repo copy of `global.ini`.
6. Deploy the enriched `global.ini` back into the game folder.

See [docs/architecture-overview.md](docs/architecture-overview.md) for the current architecture direction.
See [docs/source-hierarchy-and-scmdb-audit.md](docs/source-hierarchy-and-scmdb-audit.md) for the DataCore-first source hierarchy and current SCMDB migration checklist.

## Requirements

- [Volta](https://volta.sh/) (recommended) - automatically uses the correct Node.js version
- Or Node.js 24+

## Setup

```sh
npm install
```

## Usage

### Which command should I run?

| Goal | Command | What it does |
|---|---|---|
| Full normal run | `npm run pipeline` | Refreshes source caches, extracts a fresh baseline `global.ini`, updates the repo copy, and deploys to the game folder. |
| Full run with rebuilt DataCore cache | `npm run pipeline:force` | Runs the full pipeline and rebuilds the expensive DataCore DCB/XML cache instead of reusing it. |
| Re-run after mapping/formatting changes | `npm run pipeline:cached` | Extracts a fresh baseline `global.ini`, uses existing source caches, updates the repo copy, and deploys. |
| Refresh all source caches only | `npm run cache` | Refreshes DataCore and SCMDB outputs without touching `global.ini`. |
| Rebuild source caches only | `npm run cache:force` | Refreshes source outputs without touching `global.ini` and rebuilds the expensive DataCore DCB/XML cache. |
| Refresh one source cache | `npm run cache:datacore` or `npm run cache:scmdb` | Refreshes only that source's outputs. |
| Update repo copy but do not deploy | `npm run pipeline -- --repo-only` or `npm run pipeline:cached -- --repo-only` | Runs the selected pipeline mode and leaves the game folder untouched. |
| Deploy the current repo file | `npm run deploy` | Copies repo `global.ini` to the resolved game localization path with a backup. |
| Extract original game localization | `npm run extract` | Extracts the game's original `global.ini` as a utility command. |
| Advanced update from existing outputs | `npm run update` | Runs active update categories without source refresh, baseline extraction, or deployment. |

### Run the full pipeline

```sh
npm run pipeline
```

This is the main command. It refreshes source outputs, extracts a fresh baseline `global.ini`, applies all active updates, and deploys the enriched file back to the game directory.

Options:

- `--cached` uses existing source outputs instead of refreshing SCMDB/DataCore.
- `--repo-only` updates the repository `global.ini` but skips deployment back to the game directory.
- `--rebuild-cache` rebuilds expensive DataCore DCB/XML caches during source refresh.
- `--ptu` uses PTU source data instead of LIVE.
- `--dry-run` previews updates without writing `global.ini`.

Use `npm run pipeline:force` for the common rebuild-cache case. When passing less common options through `npm run`, use the npm separator form, for example `npm run pipeline -- --repo-only`. The separator keeps npm from interpreting app options as npm options.

### Run from cached source outputs

```sh
npm run pipeline:cached
```

Use this while iterating on mapping or formatting logic. It still refreshes the baseline game `global.ini`, but it does not refresh SCMDB/DataCore source outputs.

### Refresh source caches

```sh
npm run cache
npm run cache:force
npm run cache:datacore
npm run cache:scmdb
```

These commands refresh versioned source outputs under `csv/datacore/<version>-live|ptu>/` and `csv/scmdb/<version>/` without touching `global.ini`.

DataCore cache refreshes first-party game-file facts from the local Star Citizen DataForge database. It reuses valid DCB/XML caches by default and writes derived CSV outputs plus `record-graph.json`. Use `npm run cache:force` to rebuild the expensive DCB/XML cache without updating `global.ini`.

SCMDB cache refresh downloads the latest SCMDB merged data and companion files, then writes derived mission/mining outputs.

Legacy `npm run scrape:datacore` and `npm run scrape:scmdb` remain as compatibility aliases for the corresponding cache commands. Prefer the cache commands in docs, scripts, and day-to-day use.

### Deploy or extract global.ini

```sh
npm run deploy
npm run extract
```

`deploy` copies the repository `global.ini` into the resolved game localization path, creating a backup of the existing target first. `extract` is a utility command that extracts the original game `global.ini` without running the full update flow.

### Advanced: update from existing outputs

```sh
npm run update
```

Runs all active update categories using existing DataCore and SCMDB outputs. It does not refresh source data, extract a fresh baseline, or deploy back to the game directory.

To update a single category:

```sh
node --import tsx/esm bin/update-item.ts -c <csv-directory> <category>
```

Since the CSVs are in versioned directories, provide `-c` or `--csv-dir` when running a category directly. Active update categories include DataCore (`dc-*`) and mission (`mission-*`) sources.

To list categories with source-file metadata:

```sh
node --import tsx/esm bin/update-item.ts --list-categories
```

To print the provider coverage matrix:

```sh
node --import tsx/esm bin/update-item.ts --provider-matrix
```

To print the dynamic coverage audit:

```sh
node --import tsx/esm bin/update-item.ts --dynamic-audit
```

The dynamic audit flags static mappings, ambiguous joins, and known source gaps. It should stay at zero review/source-gap rows unless a documented migration slice is actively in progress.

To print the remaining SCMDB dependency audit:

```sh
node --import tsx/esm bin/update-item.ts --scmdb-audit
```

When `update` runs, it also prints this audit before preflight so SCMDB-backed outputs remain visible as a shrinking checklist.

### Type checking

```sh
npm run typecheck
```

Runs `tsc --noEmit` to validate TypeScript types without emitting any output files.

### Generated-data churn guard

```sh
npm run check:no-generated-churn
```

Run this after dry-run, help, smoke, or other no-write verification commands. It fails if the repository `csv/` data or root `global.ini` changed, while fixture and temporary-directory writes remain outside the guard scope.

## Project structure

The code is organized around a Clean Pipeline Architecture built around acquisition, normalization, patch planning, INI application, and deployment. Active code uses the responsibility-specific folders below.

```
bin/
  cache.ts                # Executable shim for source cache refresh
  deploy.ts               # Executable shim for deployment
  pipeline.ts             # Executable shim for the main full-flow CLI
  update-all.ts           # Executable shim for advanced update workflows
  update-item.ts          # Executable shim for single-category utilities
  scrape-datacore.ts      # Compatibility shim for advanced DataCore acquisition
  scrape-scmdb.ts         # Compatibility shim for advanced SCMDB acquisition
src/
  application/            # Use cases and workflow orchestration
  artifact/               # Patch artifact generation/loading/application
  enrichment/             # Item config contracts, stat formatting, and extra update steps
  extractor/              # SCMDB mission/mining parser internals
  infrastructure/         # Logging and CSV serialization infrastructure
  io/local/               # Local filesystem IO helpers and path conventions
  items/                  # Item and mission enrichment rule modules
  localization/           # INI parsing/application, key resolution, and localization text helpers
  pipeline/               # Core pipeline data contracts
  presentation/           # CLI commands, argument handling, and terminal rendering
  schema/                 # Runtime schemas
  sources/                # DataCore, SCMDB source acquisition/normalization
csv/
  datacore/               # DataCore cache/output data
  scmdb/                  # SCMDB mission/mining output data
global.ini                # Star Citizen localization file
```

## How it works

The update flow is split into two clearer steps:

1. Build a patch plan from normalized source data.
2. Apply that patch plan to INI text safely.

Planning, preflight, and integrity helpers live in `src/application/update/update-planning.ts`; `enrichGlobalIni` applies the resulting patch plan through localization application helpers.

Each active item rule module (`src/items/datacore/*.ts` or `src/items/missions/*.ts`) provides:

- `csvFile` or `jsonFile` - which source file to read
- `buildValue(row, flavorText)` - formats the replacement value
- `descKeyMatch(key)` - identifies existing keys for insertion point
- Optional overrides for key derivation or alternate key lookup

Scripts are idempotent - running them multiple times produces no duplicates.

## CSV files

Active game-derived item facts should come from DataCore CSVs.

| CSV | Category | Source |
|-----|----------|--------|
| `datacore/<version>-[live\|ptu]/commodities.datacore.csv` | Raw commodity identity and trade flags | DataCore |
| `datacore/<version>-[live\|ptu]/vehicles.datacore.csv` | Raw vehicle metadata | DataCore |
| `datacore/<version>-[live\|ptu]/manufacturers.datacore.csv` | Raw manufacturer metadata | DataCore |
| `datacore/<version>-[live\|ptu]/factions.datacore.csv` | Raw faction and reputation metadata | DataCore |
| `datacore/<version>-[live\|ptu]/location-labels.datacore.csv` | Raw law and location labels | DataCore |
| `datacore/<version>-[live\|ptu]/mining-location-labels.datacore.csv` | Raw mining location labels | DataCore |
| `datacore/<version>-[live\|ptu]/contract-generators.datacore.csv` | Generated contract variants, title/description overrides, timing, and location tags | DataCore |
| `datacore/<version>-[live\|ptu]/contract-generator-intel.datacore.csv` | DataCore-derived generated-contract time limit and buy-in text | DataCore |
| `datacore/<version>-[live\|ptu]/contract-templates.datacore.csv` | Contract template display settings, objective keys, and location tags | DataCore |
| `datacore/<version>-[live\|ptu]/contract-template-hauling.datacore.csv` | Contract template hauling orders and cargo resource refs | DataCore |
| `datacore/<version>-[live\|ptu]/mission-brokers.datacore.csv` | Mission broker rewards, timing, flags, and localization keys | DataCore |
| `datacore/<version>-[live\|ptu]/mission-contract-intel.datacore.csv` | DataCore-derived mission reward, time limit, efficiency, and cooldown text | DataCore |
| `datacore/<version>-[live\|ptu]/mission-localization.datacore.csv` | Mission and contract localization references | DataCore |
| `scmdb/<version>/contracts.csv` | SCMDB mission contracts | SCMDB |
| `scmdb/<version>/legacy-contracts.csv` | SCMDB legacy mission contracts | SCMDB |
| `scmdb/<version>/missions/scmdb-missions.csv` | Mission descriptions | SCMDB |

## Acknowledgments

The included `global.ini` is based on localization work from:

- [StarMeld](https://github.com/BeltaKoda/StarMeld)
- [StarStrings](https://github.com/MrKraken/StarStrings)

CSV component data is sourced from:

- DataCore extracted from local Star Citizen game files
- SCMDB: [scmdb.net](https://www.scmdb.net/)

## Disclaimer

This is an independent, community-created open-source project and is not affiliated with, endorsed by, or sponsored by Cloud Imperium Games Corporation, Cloud Imperium Rights LLC, Cloud Imperium Rights Ltd., or Roberts Space Industries Corp.

Star Citizen and Squadron 42 are trademarks of Cloud Imperium Rights LLC. All game content, assets, and related intellectual property are the property of their respective owners.

This project also has no affiliation with the third-party data services it relies on:

- [SCMDB](https://www.scmdb.net/) - an independent community database for Star Citizen mission and crafting data
- [StarMeld](https://github.com/BeltaKoda/StarMeld) and [StarStrings](https://github.com/MrKraken/StarStrings) - independent community localization projects

Use of this project is at your own risk. The authors provide no warranties and accept no liability for any issues arising from its use. Star Citizen is still in active development; game data and localization keys may change at any time.
