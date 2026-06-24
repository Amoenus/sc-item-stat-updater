# User Manual

This project enriches Star Citizen's `global.ini` so in-game text shows more practical information: mission blueprint hints, mission intel, item stats, mining notes, commodity labels, and compact title tags.

There are two normal ways to use it:

1. Use a ready-made enriched `global.ini` and place it in the game folder.
2. Run the updater locally so it extracts fresh game data, rebuilds the enriched file, and deploys it for you.

The second path is better after a new patch because it uses your local game data and catches changed localization keys, changed contract records, and changed item stats.

## Quick Start

### Use a ready-made global.ini

Use this when you only want the finished localization file and do not care about rebuilding it yourself.

1. Close Star Citizen.
2. Back up your current game localization file if it exists.
3. Copy the enriched `global.ini` into:

```text
<Star Citizen install>/LIVE/Data/Localization/english/global.ini
```

For PTU, replace `LIVE` with the relevant PTU channel folder.

If the `Data/Localization/english` folder does not exist, create it. This is the same community-localization override location used by other Star Citizen localization packs.

### Run the updater locally

Use this when you want a fresh file for the current patch.

1. Install Node.js 24+ or Volta.
2. Run:

```sh
npm install
```

3. Copy `.env.example` to `.env.local` and set `SC_LIVE_DIR` to the folder that contains `Data.p4k`, for example:

```text
SC_LIVE_DIR=C:/games/Roberts Space Industries/StarCitizen/LIVE
```

4. Run:

```sh
npm run pipeline
```

This refreshes source data, extracts a fresh base `global.ini`, applies all enrichments, and deploys the enriched file into the game folder.

For faster iteration when source data is already current:

```sh
npm run pipeline:cached
```

To build the repo copy without touching the game folder:

```sh
npm run pipeline -- --repo-only
```

To deploy the current repo `global.ini` only:

```sh
npm run deploy
```

## After A Game Patch

After every Star Citizen patch or hotfix, treat the DataCore cache as stale because it was created from the previous game files. Run the force pipeline so the cache is rebuilt from the current install:

```sh
npm run pipeline:force
```

Use the normal pipeline only when the game files have not changed and you are refreshing DataCore outputs from already-current caches:

```sh
npm run pipeline
```

Avoid using an old enriched `global.ini` on a new build unless you are intentionally testing. New patches can add, remove, or rename localization keys, and stale strings can hide new text or miss new game data.

## What The Tool Adds

### Mission titles

Mission titles may receive a compact tag at the end.

| Tag | Meaning |
|---|---|
| `[BP]` | This mission title group directly awards a blueprint. |
| `[BP]*` | This mission title group can award a blueprint, but there is a caveat. Usually the title text is shared and only some variants award the blueprint. Check the description. |
| `[BP Chain]` | This mission does not award a blueprint itself, but completing it is part of a prerequisite chain that opens a later blueprint mission. |
| `[BP Chain]*` | Same as `[BP Chain]`, but only some shared-text variants or conditions apply. Check the description. |
| `[Intro]` | Intro or unlock mission. This is reserved for missions that do not directly yield blueprints and are not classified as a blueprint-chain prerequisite. |

Important: these tags are intentionally derived from DataCore contract relationships where possible. They are not meant to be hand-maintained labels.

### Mission descriptions

Mission descriptions may gain several blocks near the end.

`Reputation Awarded`

Shows reputation values extracted from DataCore contract generator intel. This belongs in the description, not the title, because title strings are often shared and can become misleading.

`** Contract Intel **`

Shows non-runtime mission facts such as time limit, cooldown, buy-in, MEMA community estimates, average completion time, difficulty, and satisfaction when available.

`<EM4>Potential Blueprints</EM4>`

Lists possible blueprint rewards for the mission. When the game data exposes rank or standing gates, the description may include lines like:

```text
Awarded from Jr. Contractor level variants
```

If only some shared variants apply, the description may say which variants or debug-name tokens were used to identify the scope. Treat this as the explanation for title tags ending in `*`.

`<EM4>Multiple Blueprint Pools (Repeat Only)</EM4>`

Some contracts have multiple regional or repeat-only pools. This is expected for some Pyro and rank-based variants. The tool keeps separate pools visible instead of flattening them into one misleading list.

`** Encounter **`

Summarizes encounter information when available, such as ship or combat composition.

`** Hauling **`

Summarizes hauling requirements when available, such as cargo order details or route shape.

`[Item Reward]`

Lists guaranteed or notable item rewards when the source data exposes them.

### Ship and FPS item titles

Some titles get short tags so items are easier to scan in shops, inventory, and loadout screens.

Examples include:

- weapon or attachment class tags
- size/class/grade component tags
- missile signal tags
- raw commodity label fixes

These are meant to make lists scannable. Detailed stats usually live in the description.

### Component and item descriptions

Descriptions for ship components, weapons, missiles, bombs, EMPs, QEDs, tractor beams, mining gear, throwables, and related items receive stat blocks.

Common fields include:

- Item Type
- Manufacturer
- Size
- Grade
- Class
- Damage
- Rate of Fire
- Range
- Power Output
- Cooling Rate
- Shield HP and regeneration
- Quantum speed, spool, cooldown, and fuel data
- Signal, distortion, durability, and health fields

The exact sections depend on item type. For example:

- power plants show power, signatures, distortion, and durability
- coolers show cooling, signatures, distortion, and durability
- shields show shield stats, reserve behavior, resistances, absorption, distortion, and durability
- quantum drives show drive speed, spool/cooldown, fuel, and durability
- missiles and bombs show damage, flight/lock/explosion, and health-related fields
- mining lasers and modifiers show laser power and rock modifiers

### Commodities

Commodity strings may be cleaned up or tagged so raw, refined, illegal, or crafting-relevant materials are easier to recognize. The exact output depends on what DataCore exposes for the current patch.

### Mining journal and mining data

The mining journal can receive grouped rarity notes and mining insights.

Look for:

- rarity groupings such as Common, Uncommon, Rare, Epic, and Legendary
- hardest mineables
- most volatile mineables
- quality floor summaries

Mining element descriptions and mining location strings may also receive compact stat or source-derived notes where the game data exposes them.

## Where To Look In Game

### Contract Manager

Look at mission titles first:

- `[BP]` and `[BP]*` tell you which mission entries are worth opening for blueprint rewards.
- `[BP Chain]` tells you a mission is useful for unlock progression.
- `[Intro]` tells you it is an introductory unlock, not a direct blueprint reward.

Then open the mission description:

- check `Reputation Awarded`
- check `Potential Blueprints`
- read rank or variant caveats
- check time limit, cooldown, MEMA, hauling, and encounter sections

### Shops, kiosks, inventory, and loadout screens

Look at item titles for compact scan tags, then open the item description for full stats.

This is most useful for:

- ship components
- FPS weapons and attachments
- missiles, torpedoes, bombs, and launchers
- mining lasers and mining modules
- tractor beams and salvage modifiers

### Journal

Look at mining journal entries for rarity and behavior summaries. This is where broad mining insights belong because individual item or commodity descriptions are too small for large tables.

## How To Read Blueprint Caveats

Star Citizen often reuses the same title or description string across many contract variants. That is the main reason `*` exists.

Use this rule:

- no asterisk: the current title or description group is cleanly classified
- asterisk: the text is shared or conditional, so open the description and read the caveat

Examples of caveats:

- only certain rank variants award blueprints
- only certain regional variants award blueprints
- a repeat version uses a different pool
- multiple pools exist and should not be merged
- a shared title appears on both rewarding and non-rewarding contracts

When in doubt, trust the description block over the title badge. The title is a pointer; the description is where the details live.

## Known Limitations

This is an enrichment layer over a live game that changes often.

- The game can reuse localization keys across unrelated or semi-related mission variants.
- Some mission data is dynamic at runtime and cannot be safely replaced with static text.
- Some source records reference localization keys that are not present in the shipped `global.ini`.
- Some third-party relationship data is still used where first-party DataCore relationships are not fully reconstructed yet.
- PTU builds can change late and often; use fresh outputs for each build.

The project prefers DataCore when first-party game data exposes the needed relationship. SCMDB remains useful for derived mission, crafting, mining, and relationship summaries until the DataCore path fully covers them.

## Troubleshooting

### The game does not show enriched text

Check that `global.ini` is in the override folder:

```text
<Star Citizen install>/LIVE/Data/Localization/english/global.ini
```

Also make sure you launched the same channel you updated. LIVE and PTU use separate folders.

### The updater cannot find the game

Set `SC_LIVE_DIR` in `.env.local` to the folder that contains `Data.p4k`.

```text
SC_LIVE_DIR=C:/games/Roberts Space Industries/StarCitizen/LIVE
```

### A patch made the output look wrong

Run:

```sh
npm run pipeline:force
```

This rebuilds DataCore caches from the current game files and regenerates the enriched `global.ini`.

SCMDB bridge outputs are no longer part of normal cache or pipeline runs. Refresh them only when you are intentionally
regenerating fallback data:

```bash
npm run cache:scmdb
npm run cache -- --source all
```

### I want to inspect what changed before deploying

Run:

```sh
npm run pipeline -- --repo-only
```

Then inspect the repo `global.ini` diff. Deploy later with:

```sh
npm run deploy
```

### I only want to use a ready-made file

That is fine. Back up the existing override file, copy the enriched `global.ini` into the game localization override folder, and update it again after patches.

## Safety Notes

The tool changes localization text only. It does not modify game binaries, assets, or server data.

Always keep backups if you manually replace files. The updater's deploy command backs up the target `global.ini` before copying over it.

Use at your own risk. Star Citizen is in active development, and localization keys and game data can change at any time.
