# Star Citizen Item Stat Updater

Updates item descriptions in `global.ini` with detailed component stats from CSV data files sourced from SPViewer and SCMDB.

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
node bin/update-all.js
```

Runs all categories (SPViewer + SCMDB missions) using both data sources. It automatically detects the latest versioned directories for LIVE data.

Options:
- `--ptu` to use latest scraped PTU data instead of LIVE.
- `--dry-run` to preview changes without modifying `global.ini`.

> Note: `bin/update-all.js` only updates `global.ini` from existing CSV files. It does not fetch or scrape new data.

### Scrape SPViewer data

```sh
node bin/scrape-spviewer.js --all
```

This command scrapes SPViewer item tables and saves CSV files into versioned directories based on the channel, e.g., `csv/spviewer/<version>-live/` or `csv/spviewer/<version>-ptu/`.

To scrape only specific item types:

```sh
node bin/scrape-spviewer.js Radar Shield
```

To list supported SPViewer item types:

```sh
node bin/scrape-spviewer.js --list
```

Options:
- `--ptu` extracts and uses the PTU version label.
- `--live` uses the LIVE version label (default).
- `--json` saves outputs as JSON instead of CSV.

### Scrape SCMDB mission data

```sh
node bin/scrape-scmdb.js
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
node bin/update-item.js -c ./csv/scmdb/<version> mission-scmdb
```

To list available SCMDB versions:

```sh
node bin/scrape-scmdb.js --list-versions
```

By default, the scraper fetches the latest live SCMDB version. Use `--ptu` to fetch the latest PTU version instead.

To fetch a specific version by its full version string:

```sh
node bin/scrape-scmdb.js --version 4.8.0-ptu.11759767
```

To fetch only the raw SCMDB JSON file:

```sh
node bin/scrape-scmdb.js --raw
```

### Update a single category

```sh
node bin/update-item.js -c <csv-directory> <category>
```

Since the CSVs are in versioned directories, you must provide the `-c` or `--csv-dir` flag to point to the correct directory containing the files (e.g. `-c ./csv/spviewer/<version>-live`). Available categories include SPViewer and mission sources. SPViewer categories are prefixed with `sp-`, for example `sp-weapon-guns`, while mission categories use the `mission-` prefix, for example `mission-scmdb`.

## Project structure

```
├── bin/
│   ├── update-all.js        # Runs all category updaters
│   ├── update-item.js       # CLI to run a single category
│   └── scrape-spviewer.js   # SPViewer scraping helper
├── src/
│   ├── lib/
│   │   ├── io/
│   │   │   ├── csv-parser.js    # CSV parsing
│   │   │   ├── ini-file.js      # global.ini read/write/indexing
│   │   │   └── mapping-store.js # SPViewer mapping persistence
│   │   ├── format/
│   │   │   ├── formatter.js     # Number formatting
│   │   │   ├── stat-builder.js  # Stat block construction
│   │   │   └── text-utils.js    # Key derivation & flavor text extraction
│   │   └── updater.js           # Generic update engine
│   └── items/
│       ├── missions/           # Mission update configs
│       └── spviewer/           # SPViewer item configs
├── csv/
│   ├── scmdb/                 # SCMDB mission data output
│   │   └── <version>/         # Versioned directory
│   └── spviewer/              # SPViewer source CSVs
│       └── <version>-[live|ptu]/ # Versioned directory
└── global.ini               # Star Citizen localization file
```

## How it works

The update engine (`src/lib/updater.js`):

1. Reads the item's CSV file
2. Reads `global.ini`
3. For each CSV row, finds the matching description key(s) in `global.ini`
4. Replaces the value with a formatted stat block while preserving any existing flavor text
5. Writes the updated `global.ini` back (UTF-8 with BOM)

Each item module (`src/items/spviewer/*.js` or `src/items/missions/*.js`) provides:
- `csvFile` — which CSV to read
- `buildValue(row, flavorText)` — formats the stat block
- `descKeyMatch(key)` — identifies existing keys for insertion point
- Optional overrides for key derivation or alternate key lookup

Scripts are idempotent — running them multiple times produces no duplicates.

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

- SPViewer: [spviewer.eu](https://www.spviewer.eu/)
- SCMDB: [scmdb.net](https://www.scmdb.net/)
