# Star Citizen Item Stat Updater

Enriches Star Citizen's `global.ini` with additional quality-of-life information for in-game text.

The long-term architecture is a local enrichment pipeline:

1. Extract a fresh `global.ini` from the game files.
2. Extract additional game-file data, primarily DataCore where possible.
3. Extract enriched web data from SCMDB.
4. Optionally use SPViewer as a legacy or fallback source.
5. Build localization patch plans.
6. Apply those patches to the repo copy of `global.ini`.
7. Deploy the enriched `global.ini` back into the game folder.

See [docs/architecture-overview.md](docs/architecture-overview.md) for the current architecture direction.

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

Runs all categories using the selected item-stat provider plus SCMDB missions. SPViewer remains the default legacy/fallback item provider during the migration; use `--provider datacore` when DataCore coverage is preferred for supported categories. It automatically detects the latest versioned directories for LIVE data.

Options:
- `--ptu` to use latest scraped PTU data instead of LIVE.
- `--dry-run` to preview changes without modifying `global.ini`.
- `--provider spviewer|datacore` to choose the item-stat source.

> Note: `npm run update` only updates `global.ini` from existing CSV files. It does not fetch or scrape new data.

### Scrape SPViewer data

```sh
node --import tsx/esm bin/scrape-spviewer.ts --all
```

This legacy/fallback provider command scrapes SPViewer item tables and saves CSV files into versioned directories based on the channel, e.g., `csv/spviewer/<version>-live/` or `csv/spviewer/<version>-ptu/`.

To scrape only specific item types:

```sh
node --import tsx/esm bin/scrape-spviewer.ts Radar Shield
```

To list supported SPViewer item types:

```sh
node --import tsx/esm bin/scrape-spviewer.ts --list
```

Options:
- `--ptu` extracts and uses the PTU version label.
- `--live` uses the LIVE version label (default).
- `--json` saves outputs as JSON instead of CSV.

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
node --import tsx/esm bin/update-item.ts -c ./csv/scmdb/<version> mission-scmdb
```

To list available SCMDB versions:

```sh
npm run scrape:scmdb -- --list-versions
```

By default, the scraper fetches the latest live SCMDB version. Use `--ptu` to fetch the latest PTU version instead.

To fetch a specific version by its full version string:

```sh
npm run scrape:scmdb -- --version 4.8.0-ptu.11759767
```

To fetch only the raw SCMDB JSON file:

```sh
npm run scrape:scmdb -- --raw
```

### Update a single category

```sh
node --import tsx/esm bin/update-item.ts -c <csv-directory> <category>
```

Since the CSVs are in versioned directories, you must provide the `-c` or `--csv-dir` flag to point to the correct directory containing the files (e.g. `-c ./csv/spviewer/<version>-live`). Available categories include SPViewer and mission sources. SPViewer categories are prefixed with `sp-`, for example `sp-weapon-guns`, while mission categories use the `mission-` prefix, for example `mission-scmdb`.

### Type checking

```sh
npm run typecheck
```

Runs `tsc --noEmit` to validate TypeScript types without emitting any output files.

## Project structure

The code is organized around a Clean Pipeline Architecture built around acquisition, normalization, patch planning, INI application, and deployment. Active code uses the responsibility-specific folders below; `src/lib` currently contains only updater compatibility glue and its regression tests.

```
bin/
  update-all.ts           # Runs full and batch update workflows
  update-item.ts          # CLI to run a single category
  scrape-datacore.ts      # DataCore acquisition CLI
  scrape-scmdb.ts         # SCMDB acquisition CLI
  scrape-spviewer.ts      # Legacy/fallback SPViewer acquisition CLI
src/
  application/            # Use cases and workflow orchestration
  artifact/               # Patch artifact generation/loading/application
  enrichment/             # Item config contracts, stat formatting, and extra update steps
  extractor/              # SCMDB mission/mining parser internals
  infrastructure/         # Logging and CSV serialization infrastructure
  io/local/               # Local filesystem IO helpers and path conventions
  items/                  # Item and mission enrichment rule modules
  lib/                    # Updater compatibility glue and regression tests
  localization/           # INI parsing/application, key resolution, and localization text helpers
  pipeline/               # Core pipeline data contracts
  presentation/           # CLI argument and presentation helpers
  schema/                 # Runtime schemas
  sources/                # DataCore, SCMDB, and SPViewer source acquisition/normalization
csv/
  datacore/               # DataCore cache/output data
  scmdb/                  # SCMDB mission/mining output data
  spviewer/               # SPViewer source CSVs
global.ini                # Star Citizen localization file
```

## How it works

The update flow is split into two clearer steps:

1. Build a patch plan from normalized source data.
2. Apply that patch plan to INI text safely.

`src/lib/updater.ts` remains as compatibility glue for older `runUpdate` and `buildPatchData` imports while active callers move through application use cases.

Each item rule module (`src/items/datacore/*.ts`, `src/items/spviewer/*.ts`, or `src/items/missions/*.ts`) provides:
- `csvFile` or `jsonFile` - which source file to read
- `buildValue(row, flavorText)` - formats the replacement value
- `descKeyMatch(key)` - identifies existing keys for insertion point
- Optional overrides for key derivation or alternate key lookup

Scripts are idempotent - running them multiple times produces no duplicates.

## CSV files

| CSV | Category | Source |
|-----|----------|--------|
| `spviewer/<version>-[live\|ptu]/bomb.spviewer.csv` | Bombs | SPViewer |
| `spviewer/<version>-[live\|ptu]/cooler.spviewer.csv` | Coolers | SPViewer |
| `spviewer/<version>-[live\|ptu]/emp.spviewer.csv` | EMPs | SPViewer |
| `spviewer/<version>-[live\|ptu]/jumpdrive.spviewer.csv` | Jump Drives | SPViewer |
| `spviewer/<version>-[live\|ptu]/miningmodifier.spviewer.csv` | Mining Modifiers | SPViewer |
| `spviewer/<version>-[live\|ptu]/missile.spviewer.csv` | Missiles | SPViewer |
| `spviewer/<version>-[live\|ptu]/missilelauncher.spviewer.csv` | Missile Launchers | SPViewer |
| `spviewer/<version>-[live\|ptu]/powerplant.spviewer.csv` | Power Plants | SPViewer |
| `spviewer/<version>-[live\|ptu]/qed.spviewer.csv` | QEDs | SPViewer |
| `spviewer/<version>-[live\|ptu]/quantumdrive.spviewer.csv` | Quantum Drives | SPViewer |
| `spviewer/<version>-[live\|ptu]/quantuminterdictiongenerator.spviewer.csv` | Quantum Interdiction Generator | SPViewer |
| `spviewer/<version>-[live\|ptu]/radar.spviewer.csv` | Radars | SPViewer |
| `spviewer/<version>-[live\|ptu]/salvagemodifier.spviewer.csv` | Salvage Modifiers | SPViewer |
| `spviewer/<version>-[live\|ptu]/selfdestruct.spviewer.csv` | Self Destruct | SPViewer |
| `spviewer/<version>-[live\|ptu]/shield.spviewer.csv` | Shields | SPViewer |
| `spviewer/<version>-[live\|ptu]/shieldcontroller.spviewer.csv` | Shield Controller | SPViewer |
| `spviewer/<version>-[live\|ptu]/throwable.spviewer.csv` | Throwables | SPViewer |
| `spviewer/<version>-[live\|ptu]/tractorbeam.spviewer.csv` | Tractor Beams | SPViewer |
| `spviewer/<version>-[live\|ptu]/turret.spviewer.csv` | Turrets | SPViewer |
| `spviewer/<version>-[live\|ptu]/weaponattachment.spviewer.csv` | Weapon Attachments | SPViewer |
| `spviewer/<version>-[live\|ptu]/weapondefensive.spviewer.csv` | Weapon Defensive | SPViewer |
| `spviewer/<version>-[live\|ptu]/weapongun.spviewer.csv` | Weapon Guns | SPViewer |
| `spviewer/<version>-[live\|ptu]/weaponmining.spviewer.csv` | Weapon Mining | SPViewer |
| `spviewer/<version>-[live\|ptu]/weaponpersonal.spviewer.csv` | Weapon Personal | SPViewer |
| `scmdb/<version>/contracts.csv` | SCMDB mission contracts | SCMDB |
| `scmdb/<version>/legacy-contracts.csv` | SCMDB legacy mission contracts | SCMDB |
| `scmdb/<version>/missions/scmdb-missions.csv` | Mission descriptions | SCMDB |

## Acknowledgments

The included `global.ini` is based on localization work from:

- [StarMeld](https://github.com/BeltaKoda/StarMeld)
- [StarStrings](https://github.com/MrKraken/StarStrings)

CSV component data is sourced from:

- DataCore extracted from local Star Citizen game files
- SPViewer: [spviewer.eu](https://www.spviewer.eu/)
- SCMDB: [scmdb.net](https://www.scmdb.net/)

## Disclaimer

This is an independent, community-created open-source project and is not affiliated with, endorsed by, or sponsored by Cloud Imperium Games Corporation, Cloud Imperium Rights LLC, Cloud Imperium Rights Ltd., or Roberts Space Industries Corp.

Star Citizen and Squadron 42 are trademarks of Cloud Imperium Rights LLC. All game content, assets, and related intellectual property are the property of their respective owners.

This project also has no affiliation with the third-party data services it relies on:

- [SPViewer](https://www.spviewer.eu/) — an independent community tool for browsing Star Citizen item stats
- [SCMDB](https://www.scmdb.net/) — an independent community database for Star Citizen mission and crafting data
- [StarMeld](https://github.com/BeltaKoda/StarMeld) and [StarStrings](https://github.com/MrKraken/StarStrings) — independent community localization projects

Use of this project is at your own risk. The authors provide no warranties and accept no liability for any issues arising from its use. Star Citizen is still in active development; game data and localization keys may change at any time.
