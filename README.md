# Star Citizen Item Stat Updater

Enriches Star Citizen's `global.ini` with additional quality-of-life information for in-game text.

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

- [Volta](https://volta.sh/) (recommended) — automatically uses the correct Node.js version
- Or Node.js 24+

## Setup

```sh
npm install
```

## Usage

### Update all categories

```sh
npm run update
```

Runs all active categories using DataCore item stats plus the remaining SCMDB-derived mission bridges. It automatically detects the latest versioned directories for LIVE data.

Options:

- `--ptu` to use latest scraped PTU data instead of LIVE.
- `--dry-run` to preview changes without modifying `global.ini`.
- `--provider datacore` is accepted for compatibility; DataCore is the only active batch item-stat provider.

> Note: `npm run update` only updates `global.ini` from existing CSV files. It does not fetch or scrape new data.

### Scrape DataCore game-file data

```sh
npm run scrape:datacore
```

DataCore extracts first-party game-file facts from the local Star Citizen DataForge database and writes versioned CSV outputs under `csv/datacore/<version>-live/` or `csv/datacore/<version>-ptu/`. It is the authoritative source for raw facts that are exposed directly in game files.

The scraper emits component item-stat CSVs plus standalone raw fact datasets for:

- item identity and component stats
- commodity identity and cargo/trade flags
- vehicle labels, manufacturer refs, roles, and vehicle metadata
- manufacturer identity, localization, logo, and style refs
- faction flags, reputation UI keys, and relationship refs
- StarMap law/location labels and mining-scoped location labels
- contract generator variants, mission broker records, and mission/contract localization references from the record graph
- mining behavior, composition, scan-signature, and quality-quantization facts

To list supported DataCore item-stat types:

```sh
npm run scrape:datacore -- --list
```

Options:

- `--ptu` tags output as PTU data.
- `--live` tags output as LIVE data (default).
- `--dry-run` parses cached XML records without writing CSV files.
- `--force-extract` rebuilds the XML cache before writing outputs.

### Scrape SCMDB mission data

```sh
npm run scrape:scmdb
```

This command downloads the latest SCMDB merged data file and writes outputs into `csv/scmdb/<version>/`, including:

- `merged-*.json`
- `contracts.csv` — now includes blueprint metadata and chain marker fields:
  - `isBlueprintReward`
  - `isBlueprintChainPrerequisite`
  - `blueprintChainDepth`
- `legacy-contracts.csv` — also includes the same blueprint marker fields
- `blueprint-pools.csv`
- `contract-blueprint-rewards.csv`

It also generates the mission updater source CSV at `csv/scmdb/<version>/missions/scmdb-missions.csv`.
That CSV includes `Note`, `TitleNote`, and `RewardList` columns so blueprint chain/reward metadata and reward item lists can be appended without replacing existing mission text.

After scraping, run:

```sh
node --import tsx/esm bin/update-item.ts -c ./csv/scmdb/<version> mission-scmdb-descriptions
node --import tsx/esm bin/update-item.ts -c ./csv/scmdb/<version> mission-scmdb-titles
```

To list available SCMDB versions:

```sh
npm run scrape:scmdb -- --list-versions
```

By default, the scraper fetches the latest live SCMDB version. Use `--ptu` to fetch the latest PTU version instead.

To fetch a specific version by its full version string:

```sh
npm run scrape:scmdb -- --version 4.8.1-live.11875683
```

To fetch only the raw SCMDB JSON file:

```sh
npm run scrape:scmdb -- --raw
```

### Update a single category

```sh
node --import tsx/esm bin/update-item.ts -c <csv-directory> <category>
```

Since the CSVs are in versioned directories, you must provide the `-c` or `--csv-dir` flag to point to the correct directory containing the files (e.g. `-c ./csv/datacore/<version>-live` for `dc-*` categories, or `-c ./csv/scmdb/<version>-live` for `mission-*` categories). Active update categories include DataCore (`dc-*`) and mission (`mission-*`) sources.

Active updates accept DataCore (`dc-*`) and mission (`mission-*`) categories.

To list categories with source-file metadata:

```sh
node --import tsx/esm bin/update-item.ts --list-categories
```

To print the provider coverage matrix:

```sh
node --import tsx/esm bin/update-item.ts --provider-matrix
```

To print the remaining SCMDB dependency audit:

```sh
node --import tsx/esm bin/update-item.ts --scmdb-audit
```

When `update-all` runs, it also prints this audit before preflight so SCMDB-backed outputs remain visible as a shrinking checklist.

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
  update-all.ts           # Runs DataCore-first batch update workflows
  update-item.ts          # CLI to run a single category
  scrape-datacore.ts      # DataCore acquisition CLI
  scrape-scmdb.ts         # SCMDB acquisition CLI
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
  presentation/           # CLI argument and presentation helpers
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

Planning, preflight, and integrity helpers live in `src/application/use-cases/update-planning.ts`; `enrichGlobalIni` applies the resulting patch plan through localization application helpers.

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

- [SCMDB](https://www.scmdb.net/) — an independent community database for Star Citizen mission and crafting data
- [StarMeld](https://github.com/BeltaKoda/StarMeld) and [StarStrings](https://github.com/MrKraken/StarStrings) — independent community localization projects

Use of this project is at your own risk. The authors provide no warranties and accept no liability for any issues arising from its use. Star Citizen is still in active development; game data and localization keys may change at any time.
