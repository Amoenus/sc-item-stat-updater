# Star Citizen Item Stat Updater

Updates item descriptions in `global.ini` with detailed component stats from CSV data files.

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
node update-all.js
```

Runs all 12 category updaters sequentially.

### Update a single category

```sh
node update-item.js <category>
```

Available categories: `coolers`, `weapons`, `shields`, `quantum-drives`, `powerplants`, `missiles`, `bombs`, `emps`, `mining-lasers`, `qeds`, `radars`, `tractor-beams`

## Project structure

```
├── update-all.js            # Runs all category updaters
├── update-item.js           # CLI to run a single category
├── src/
│   ├── lib/
│   │   ├── csv-parser.js    # CSV parsing
│   │   ├── ini-file.js      # global.ini read/write/indexing
│   │   ├── formatter.js     # Number formatting
│   │   ├── text-utils.js    # Key derivation & flavor text extraction
│   │   └── updater.js       # Generic update engine
│   └── items/
│       ├── coolers.js       # Item-specific config & buildValue
│       ├── weapons.js
│       ├── shields.js
│       ├── quantum-drives.js
│       ├── powerplants.js
│       ├── missiles.js
│       ├── bombs.js
│       ├── emps.js
│       ├── mining-lasers.js
│       ├── qeds.js
│       ├── radars.js
│       └── tractor-beams.js
├── csv/                     # Item stat data from erkul.games
│   ├── bombs.csv
│   ├── coolers.csv
│   ├── emps.csv
│   ├── mining_lasers.csv
│   ├── missiles.csv
│   ├── powerplants.csv
│   ├── qeds.csv
│   ├── quantum_drives.csv
│   ├── radars.csv
│   ├── shields.csv
│   ├── tractor_beams.csv
│   └── weapons.csv
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

| CSV | Category |
|-----|----------|
| `quantum_drives.csv` | Quantum Drives |
| `coolers.csv` | Coolers |
| `powerplants.csv` | Power Plants |
| `shields.csv` | Shields |
| `weapons.csv` | Weapons |
| `bombs.csv` | Bombs |
| `emps.csv` | EMPs |
| `mining_lasers.csv` | Mining Lasers |
| `missiles.csv` | Missiles |
| `qeds.csv` | Quantum Enforcement Devices |
| `radars.csv` | Radars |
| `tractor_beams.csv` | Tractor Beams |

## Acknowledgments

The included `global.ini` is based on localization work from:

- [StarMeld](https://github.com/BeltaKoda/StarMeld)
- [StarStrings](https://github.com/MrKraken/StarStrings)

CSV component data is sourced from [erkul.games](https://www.erkul.games/).
