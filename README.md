# Star Citizen Item Stat Updater

Updates item descriptions in `global.ini` with detailed component stats from CSV data files. The tool supports both Erkul CSV data and SPViewer-derived stats, with SPViewer preferred by default.

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

Runs all categories using the default source. By default, the tool prefers SPViewer data when available, with Erkul data used as the fallback source.

### Update a single category

```sh
node bin/update-item.js <category>
```

Available categories include both Erkul and SPViewer sources. SPViewer categories are prefixed with `sp-`, for example `sp-weapon-guns`.

### Scrape SCMDB blueprint mission data

```sh
node bin/scrape-scmdb.js
```

This fetches the current SCMDB merged payload, caches it locally, and exports CSV tables for contracts, blueprint pools, factions, locations, resources, and ship pools.

Additional options:

```sh
node bin/scrape-scmdb.js --delay-ms 2000
```

- `--delay-ms <ms>` slows SCMDB requests by the specified number of milliseconds.

### Data source options

```sh
node bin/update-all.js --source spviewer
node bin/update-all.js --source erkul
node bin/update-all.js --source all
```

- `spviewer` (default) uses SPViewer-derived stats where available
- `erkul` uses raw Erkul CSV data
- `all` processes both sources

## Project structure

```
├── bin/
│   ├── update-all.js        # Runs all category updaters
│   ├── update-item.js       # CLI to run a single category
│   ├── scrape-spviewer.js   # SPViewer scraping helper
│   └── scrape-scmdb.js      # SCMDB blueprint mission scraper
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
│       ├── erkul/              # Erkul item configs
│       └── spviewer/           # SPViewer item configs
├── csv/
│   ├── erkul/                 # Erkul source CSVs
│   └── spviewer/              # SPViewer source CSVs
└── global.ini               # Star Citizen localization file
```

## How it works

The update engine (`src/lib/updater.js`):

1. Reads the item's CSV file
2. Reads `global.ini`
3. For each CSV row, finds the matching description key(s) in `global.ini`
4. Replaces the value with a formatted stat block while preserving any existing flavor text
5. Writes the updated `global.ini` back (UTF-8 with BOM)

Each item module (`src/items/*.js`) provides:
- `csvFile` — which CSV to read
- `buildValue(row, flavorText)` — formats the stat block
- `descKeyMatch(key)` — identifies existing keys for insertion point
- Optional overrides for key derivation or alternate key lookup

Scripts are idempotent — running them multiple times produces no duplicates.

## CSV files

The project now separates source data into `csv/erkul/` and `csv/spviewer/`.

| CSV | Category | Source |
|-----|----------|--------|
| `erkul/quantum_drives.csv` | Quantum Drives | Erkul |
| `erkul/coolers.csv` | Coolers | Erkul |
| `erkul/powerplants.csv` | Power Plants | Erkul |
| `erkul/shields.csv` | Shields | Erkul |
| `erkul/weapons.csv` | Weapons | Erkul |
| `erkul/bombs.csv` | Bombs | Erkul |
| `erkul/emps.csv` | EMPs | Erkul |
| `erkul/mining_lasers.csv` | Mining Lasers | Erkul |
| `erkul/missiles.csv` | Missiles | Erkul |
| `erkul/qeds.csv` | Quantum Enforcement Devices | Erkul |
| `erkul/radars.csv` | Radars | Erkul |
| `erkul/tractor_beams.csv` | Tractor Beams | Erkul |
| `spviewer/bomb.spviewer.csv` | Bombs | SPViewer |
| `spviewer/cooler.spviewer.csv` | Coolers | SPViewer |
| `spviewer/emp.spviewer.csv` | EMPs | SPViewer |
| `spviewer/jumpdrive.spviewer.csv` | Jump Drives | SPViewer |
| `spviewer/miningmodifier.spviewer.csv` | Mining Modifiers | SPViewer |
| `spviewer/missile.spviewer.csv` | Missiles | SPViewer |
| `spviewer/missilelauncher.spviewer.csv` | Missile Launchers | SPViewer |
| `spviewer/powerplant.spviewer.csv` | Power Plants | SPViewer |
| `spviewer/qed.spviewer.csv` | QEDs | SPViewer |
| `spviewer/quantumdrive.spviewer.csv` | Quantum Drives | SPViewer |
| `spviewer/quantuminterdictiongenerator.spviewer.csv` | Quantum Interdiction Generator | SPViewer |
| `spviewer/radar.spviewer.csv` | Radars | SPViewer |
| `spviewer/salvagemodifier.spviewer.csv` | Salvage Modifiers | SPViewer |
| `spviewer/selfdestruct.spviewer.csv` | Self Destruct | SPViewer |
| `spviewer/shield.spviewer.csv` | Shields | SPViewer |
| `spviewer/shieldcontroller.spviewer.csv` | Shield Controller | SPViewer |
| `spviewer/throwable.spviewer.csv` | Throwables | SPViewer |
| `spviewer/tractorbeam.spviewer.csv` | Tractor Beams | SPViewer |
| `spviewer/turret.spviewer.csv` | Turrets | SPViewer |
| `spviewer/weaponattachment.spviewer.csv` | Weapon Attachments | SPViewer |
| `spviewer/weapondefensive.spviewer.csv` | Weapon Defensive | SPViewer |
| `spviewer/weapongun.spviewer.csv` | Weapon Guns | SPViewer |
| `spviewer/weaponmining.spviewer.csv` | Weapon Mining | SPViewer |
| `spviewer/weaponpersonal.spviewer.csv` | Weapon Personal | SPViewer |
| `scmdb/contracts-<version>.csv` | Blueprint missions | SCMDB |
| `scmdb/blueprint-pools-<version>.csv` | Blueprint pool contents | SCMDB |

## Acknowledgments

The included `global.ini` is based on localization work from:

- [StarMeld](https://github.com/BeltaKoda/StarMeld)
- [StarStrings](https://github.com/MrKraken/StarStrings)

CSV component data is sourced from:

- Erkul: [erkul.games](https://www.erkul.games/)
- SPViewer: [spviewer.eu](https://www.spviewer.eu/)
