# Star Citizen Item Stat Updater

Updates item descriptions in `global.ini` with detailed component stats from CSV data files.

## Requirements

- Node.js

## Usage

### Update all categories

```sh
node update_all.js
```

Runs all 12 category scripts sequentially.

### Update a single category

```sh
node update_quantum_drives.js
node update_coolers.js
node update_powerplants.js
node update_shields_csv.js
node update_weapons.js
node update_bombs.js
node update_emps.js
node update_mining_lasers.js
node update_missiles.js
node update_qeds.js
node update_radars.js
node update_tractor_beams.js
```

## How it works

Each script:

1. Reads its corresponding CSV file (e.g. `powerplants.csv`)
2. Reads `global.ini`
3. For each CSV row, finds the matching description key(s) in `global.ini`
4. Replaces the value with a formatted stat block while preserving any existing flavor text
5. Writes the updated `global.ini` back (UTF-8 with BOM)

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
