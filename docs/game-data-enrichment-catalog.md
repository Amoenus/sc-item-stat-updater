# Game Data Enrichment Catalog

Date: 2026-06-04

This catalog captures what we can extract from Star Citizen game-shipped data and
SCMDB outputs to enrich `global.ini`. It is intentionally ordered from the most
valuable and actionable sources to nice-to-have sources.

The ideal long-term direction is:

1. Use game-shipped data as the authority for first-party facts.
2. Use external sources such as SCMDB for relationship resolution, derived
   summaries, historical comparison, and user-facing insight that is difficult
   to reconstruct directly from game files.
3. Keep SPViewer as a legacy comparison/audit source while DataCore coverage
   matures.

## Current Extraction Surface

The current game-data pipeline does not parse `Data.p4k` by hand. It relies on
external tools, which is the right boundary:

- `unp4k` extracts files such as `Data/Localization/english/global.ini`.
- `unp4k` extracts `Data/Game2.dcb` from `Data.p4k` into the repo-owned DCB cache.
- `unforge` expands the cached `Game2.dcb` into DataForge XML records.
- The repo parses the resulting XML cache with source-specific extractors.

Current DataCore item scraping uses only a narrow slice of the XML cache:

```text
libs/foundry/records/entities/scitem
```

That slice already powers 22 component/item CSVs, but the same cache also
contains mission, crafting, mining, starmap, vehicle, reputation, law, commodity,
manufacturer, UI, and loot records. Many of those records directly reference
localization keys from `global.ini`, which makes them safe enrichment targets.

## Priority 0: Build The Record Graph

Before adding many one-off enrichers, build a generic first-party record index.
This is the key unlock.

Index every extracted DataForge XML record by:

- `__ref` GUID
- `__path`
- root `__type`
- entity class name
- localization keys referenced by attributes such as `Name`, `Description`,
  `displayName`, `displayDescription`, `title`, `description`,
  `vehicleName`, and `vehicleDescription`
- referenced GUIDs in `<Reference value="...">` nodes

Why this matters:

- It turns game data into a graph rather than isolated CSVs.
- It lets enrichment modules follow the same references the game uses.
- It reduces brittle key derivation from filenames.
- It enables joins such as vehicle -> manufacturer -> default loadout ->
  component stats -> localized item names.

This should live as source normalization, not localization mutation.

## Juiciest Sources

### 1. Vehicles And Ships

Path:

```text
libs/foundry/records/entities/spaceships
libs/foundry/records/entities/groundvehicles
```

Observed fields:

- `vehicleName`
- `vehicleDescription`
- `vehicleCareer`
- `vehicleRole`
- `crewSize`
- manufacturer GUID
- insurance claim time
- mandatory wait time
- expediting fee
- hull damage normalization
- armor modifiers by component type
- default loadout entries
- item port names
- component entity classes
- cargo and inventory container references
- object container references

Target keys:

- `vehicle_Name*`
- `vehicle_Desc*`
- related role/career keys where present

Possible enrichment:

```text
** Ship Intel **
Role: Interceptor
Career: Combat
Crew: 1
Claim Time: 4.9 min
Expedite Fee: 2,658 aUEC

** Stock Loadout **
Power Plant: PowerBolt
Coolers: Bracer x2
Shields: Shimmer x2
Quantum Drive: Expedition
Radar: Ecouter
```

Derived insights:

- stock loadout quality score
- component bottleneck detection
- survivability profile from shield, armor, and hull fields
- claim-cost ranking
- solo-friendly vs crew-dependent classification
- combat/cargo/utility role mismatch detection
- manufacturer tendencies across their fleet

Risk:

- High value, moderate parser complexity.
- Requires GUID/entity-class resolution and careful formatting so vehicle
  descriptions do not become walls of stats.

### 2. Mission Broker And Contract Records

Paths:

```text
libs/foundry/records/missionbroker/pu_missions
libs/foundry/records/contracts/contracttemplates
libs/foundry/records/contracts/contractgenerator
```

Observed fields:

- title key
- HUD title key
- description key
- mission giver key
- mission type GUID
- reward
- currency type
- lawful mission flag
- buy-in
- can be shared
- max players per instance
- once-only flag
- prison/criminal failure flags
- cooldowns
- abandoned/failure reaccept rules
- rep prerequisites
- wanted-level prerequisites
- property tokens and runtime substitution fields
- location tag searches
- objective token structure
- mission module path
- communication tags

Target keys:

- mission title keys
- mission description keys
- mission giver strings where useful

Possible enrichment:

```text
** Contract Intel **
Reward: 70,750 aUEC
Time Limit: 16 min
Efficiency: 4,422 aUEC/min
Cooldown: 1 h
Can Share: No
Max Players: 1
Requires CrimeStat: 0-2
```

Derived insights:

- reward per minute
- net reward after buy-in
- repeatability and cooldown quality
- solo vs group suitability
- lawful/criminal risk profile
- intro/unlock chain detection
- location token safety checks against SCMDB
- mission availability comparison between game files and SCMDB

Risk:

- Very high value, high complexity.
- Must preserve runtime tags such as `~mission(Location)` and avoid replacing
  game-resolved values with static guesses.

Best use of SCMDB:

- SCMDB already resolves mission relationships, blueprint rewards, item rewards,
  hauling orders, encounter summaries, and readable pools. Game files should
  validate first-party fields; SCMDB should add relationship-level insight.

### 3. Commodities

Path:

```text
libs/foundry/records/entities/commodities
```

Observed fields:

- commodity display name
- commodity description
- display type
- type GUID
- subtype GUID
- `IsUnrefinedElement`
- boxable flag
- cargo occupancy
- thumbnail/icon
- purchasable display metadata

Target keys:

- `items_commodities_*`
- `items_commodities_*_desc`
- `items_commodities_type_*`

Possible enrichment:

```text
** Commodity Data **
Type: Agricultural Supply
Cargo Unit: 1 cSCU
Boxable: Yes
Unrefined: No
```

Derived insights:

- refined vs raw vs ore safety classification
- cargo footprint grouping
- legal/illegal overlay when joined with law/economy data
- commodity family/type rollups
- icon/type consistency checks

Risk:

- High value, low to moderate complexity.
- Very useful because the current commodity updater mostly adds illegal marking
  and names from SCMDB.

### 4. Mining And Mineables

Paths:

```text
libs/foundry/records/mining
libs/foundry/records/entities/mineable
libs/foundry/records/harvestable
```

Observed fields:

- mineable element GUID
- resource type GUID
- instability
- resistance
- optimal window midpoint
- optimal window randomness
- optimal window thinness
- explosion multiplier
- cluster factor
- composition parts
- composition probabilities
- min/max percentages
- quality scaling
- scan signatures from mineable entities
- carryable/localization keys for hand mineables

Target keys:

- `items_commodities_*_ore_desc`
- `items_commodities_*_raw_desc`
- mineable item description keys
- mining journal keys
- location description keys when joined with location data

Possible enrichment:

```text
** Scanner Data **
Rarity: Rare
Scan Signature: 3540
Resistance: 0.65
Instability: 350

** Mining Behavior **
Difficulty: Difficult
Optimal Charge: 50%
Window Width: Narrow
Volatility: High explosion risk
Cluster Tendency: Occasional clusters
```

Derived insights:

- mining difficulty score
- volatility score
- best laser/modifier match
- safest extraction strategy
- cluster tendency
- expected yield by composition probability
- location-specific mining value when joined with SCMDB location distributions
- refinery recommendation when joined with SCMDB refinery profiles

Risk:

- Very high value, moderate complexity.
- Existing SCMDB mining enrichment already implements part of this. The next
  step is to source first-party facts from game data where possible and keep
  SCMDB for rollups and refinery/location summaries.

### 5. Crafting Blueprints

Path:

```text
libs/foundry/records/crafting/blueprints
libs/foundry/records/crafting/blueprintrewards
libs/foundry/records/crafting/craftedproperties
```

Observed fields:

- product entity class
- blueprint category
- blueprint display name
- craft time
- required resources
- resource quantities
- selectable recipe slots
- quality requirements
- gameplay property modifiers
- tier structure

Target keys:

- crafted item descriptions
- blueprint reward related strings
- crafting UI slot/property strings

Possible enrichment:

```text
** Crafting **
Craft Time: 10 sec
Requires: Magazine material x0.03 SCU, Core material x0.03 SCU
Output: BEHR LMG Magazine
```

Derived insights:

- total resource cost
- bottleneck resource detection
- craft-time ranking
- quality-gated recipes
- blueprint reward value when joined with SCMDB mission reward chains
- property tradeoff summaries

Risk:

- High value, high relationship complexity.
- Needs resource and product entity class resolution before output is readable.

### 6. Reputation

Path:

```text
libs/foundry/records/reputation
libs/foundry/records/factions
libs/foundry/records/factions/legacy
```

Observed fields:

- standing display name
- min reputation
- drift reputation
- drift time
- gated flag
- perk description
- reputation scopes
- reputation rewards
- faction reputation metadata

Target keys:

- reputation standing names
- reputation descriptions
- mission descriptions through required standing summaries

Possible enrichment:

```text
** Reputation **
Threshold: 2,500
Gated: No
Perk: None
```

Derived insights:

- standing ladder summaries
- mission unlock requirements
- reputation grind distance
- faction reward value
- failure penalty severity

Risk:

- High value, moderate complexity.
- Needs GUID resolution to avoid exposing raw scope/faction IDs.

### 7. Starmap And Locations

Path:

```text
libs/foundry/records/starmap/pu
libs/foundry/records/missiondata/pu_locations
libs/foundry/records/megamap
```

Observed fields:

- location name key
- description key
- callout keys
- nav icon
- starmap type
- scannable flag
- hidden flags
- size
- QT arrival radius
- adoption radius
- obstruction radius
- world/starmap visibility flags
- location matching and mission exposure flags

Target keys:

- area/location names
- area/location descriptions
- callout strings

Possible enrichment:

```text
** Navigation **
Type: Outpost
Nav Icon: Outpost
QT Arrival Radius: 20 km
Scannable: No
Mission Exposed: Yes
```

Derived insights:

- location accessibility classification
- mission-relevant location detection
- hidden/scannable POI list
- QT travel convenience
- location type normalization across systems

Risk:

- High value, moderate complexity.
- Formatting must stay terse because location descriptions are player-facing
  flavor text.

## Strong Second-Tier Sources

### 8. Manufacturers And Brands

Path:

```text
libs/foundry/records/scitemmanufacturer
libs/foundry/records/tintpalettes/brand
```

Observed fields:

- manufacturer code
- name key
- short name key
- description key
- history/callout keys
- logo paths
- audio manufacturer tag
- UI style references
- paint/color/logo records

Target keys:

- `manufacturer_Name*`
- `manufacturer_Desc*`
- manufacturer callout/history strings

Derived insights:

- manufacturer code lookup for all item stats
- product family coverage
- brand styling/color metadata
- manufacturer stat tendencies

Special note:

- This should be done early because current DataCore item rows still struggle
  with manufacturer resolution.

### 9. Law And Security

Path:

```text
libs/foundry/records/lawsystem
```

Observed fields:

- infraction names
- infraction descriptions
- felony flag
- grace allowance
- grace period
- early payment period
- faction/security ownership
- trespass/access settings
- criminal hostility flags
- jurisdiction data

Target keys:

- law infraction names/descriptions
- location descriptions when joined with jurisdiction/security network data
- mission risk notes

Derived insights:

- crime severity labels
- trespass risk notes
- fine/payment grace summaries
- security-network risk by location
- lawful vs criminal mission risk cross-checks

Risk:

- Medium to high value, moderate complexity.
- Needs careful wording to avoid adding clutter or duplicating obvious mission
  legality.

### 10. Loot Tables

Path:

```text
libs/foundry/records/lootgeneration
```

Observed fields:

- loot table names
- archetype weights
- result constraints
- tags
- min/max entries
- spawn probabilities
- duplicate limits

Target keys:

- mission descriptions
- item/container descriptions if keys exist
- journal/help text if appropriate

Derived insights:

- expected loot categories
- weighted reward summaries
- loot rarity
- mission/container value expectations

Risk:

- Medium value, high relationship complexity.
- Many records have no direct localization key, so this is better as joined
  context than standalone text.

### 11. Item, Ammo, Weapon, And Attachment Internals

Paths:

```text
libs/foundry/records/ammoparams
libs/foundry/records/weapon*
libs/foundry/records/entities/scitem
```

Already extracted in part:

- damage alpha
- rate of fire
- projectile speed
- ammo range
- ammo count
- heat per shot
- missile lock data
- shield pool/regen
- quantum speed/fuel
- mining laser modifiers

Additional possible extraction:

- detailed damage channels
- dropoff curves
- fire mode sequences
- magazine pools
- recoil and handling
- signatures and emissions
- resistances
- overheat and misfire behavior
- attachment tradeoffs

Derived insights:

- DPS and sustained DPS
- time to empty
- heat-limited firing time
- effective range
- damage-type profile
- stealth/noise profile
- best-in-slot by size/grade/class
- upgrade deltas compared with stock vehicle loadouts

Risk:

- High value for item nerds, but many descriptions already have stat blocks.
  Best next step is quality and derived insight, not dumping more raw fields.

## Nice-To-Have Sources

### UI Building Blocks, Map, Mobiglas, Vehicle Entrance

Paths:

```text
libs/foundry/records/ui
libs/foundry/records/megamap
```

Possible use:

- label fixes
- UI taxonomy
- icon/style metadata
- map marker clarity

Risk:

- Useful for polish, but lower value than gameplay facts.

### Dialogue, Comms, Hints, Journal Entries

Paths:

```text
libs/foundry/records/dialogue*
libs/foundry/records/commsnotifications
libs/foundry/records/hints
libs/foundry/records/journalentry
```

Possible use:

- identify unused or missing localized text
- add speaker/context tags
- repair inconsistent titles
- connect journal entries to systems, factions, or missions

Risk:

- Can become noisy fast. Better suited for diagnostics and missing-string
  reports than broad `global.ini` enrichment.

### Actors, Characters, Loadouts, AI, Tactical Queries

Paths:

```text
libs/foundry/records/actor
libs/foundry/records/character
libs/foundry/records/loadoutkits
libs/foundry/records/aiprofile
libs/foundry/records/tacticalquery
```

Possible use:

- NPC/faction loadout summaries
- encounter difficulty estimates
- mission combat shape when joined with contracts

Risk:

- Interesting, but indirect. Use only after mission/encounter enrichment has a
  stable model.

## SCMDB Catalog

SCMDB should remain a relationship and insight source, not the authority for
first-party facts when the game files expose the same information.

### Most Valuable SCMDB Data

- merged mission contract graph
- blueprint reward pools
- blueprint prerequisite chains
- item reward groups
- faction/resource/location readable mappings
- hauling orders
- ship encounter summaries
- mining location distributions
- refinery profiles
- quality distributions
- crafting item summaries

### Best SCMDB Enrichments

- `[BP]`, `[BP Chain]`, and `[Intro]` mission title tags
- contract intel blocks
- reward/time efficiency
- buy-in and net reward
- faction reputation requirements and rewards
- prerequisite/intro chain notes
- readable hauling requirements
- readable encounter summaries
- blueprint reward odds and `1 of N` pool summaries
- best refinery hints
- mining location quality notes
- mining journal global insights

### SCMDB Guardrails

- Preserve runtime mission tags.
- Do not replace dynamic locations or rewards with static values.
- Do not add plain legal/illegal lines when the UI already separates them.
- Keep raw/ore/refined commodity targeting strict.
- Use SCMDB to enrich relationships, not to overwrite game-file authority.

## Derived Insight Layer

The highest-value future work is not only extracting more fields. It is turning
raw fields into compact player-facing judgments.

### Comparison Insights

- best component by size and class
- worst stock vehicle bottlenecks
- upgrade deltas from stock loadouts
- component performance per grade
- manufacturer design tendencies
- ship claim cost/time rankings
- mission payout per minute
- mining location yield rankings
- refinery best-match tables

### Difficulty And Risk Insights

- mining difficulty
- mining volatility
- mission combat risk
- mission legal/security risk
- reputation-gated progression difficulty
- cargo/hauling complexity
- trespass/security risk by location

### Availability And Freshness Insights

- records present in game files but missing from SCMDB
- SCMDB mission records stale relative to game files
- localization keys present but unused by current enrichers
- new item families in a patch
- changed stats across game versions
- removed or deprecated item/mission/location records

### Consistency Diagnostics

- missing localization keys referenced by game records
- localization keys with no referencing game record
- entity classes with unresolved display names
- manufacturer UUIDs without readable code/name mapping
- SCMDB IDs that no longer match game-file refs
- vehicle stock loadout components missing from item stat CSVs

### Player-Facing Summaries

- "Best stock quantum drive in class"
- "Most volatile mineables"
- "Best refinery for each material"
- "Highest payout contracts per minute"
- "Fastest claim ships"
- "Most expensive expedite fees"
- "Locations with hidden/scannable flags"
- "Cargo commodities by footprint"

## Suggested Implementation Order

1. Generic DataCore record index.
2. Manufacturer resolver.
3. Vehicle extractor and vehicle description enrichment.
4. Commodity extractor and commodity description enrichment.
5. Missionbroker extractor for first-party mission facts.
6. SCMDB/game-file mission comparison diagnostics.
7. Reputation extractor.
8. Starmap/location extractor.
9. Crafting blueprint extractor.
10. Law/security extractor.
11. Loot table relationship extractor.
12. Derived comparison reports and global insight summaries.

## Architectural Shape

Keep the pipeline staged:

```text
Data.p4k / Game2.dcb
  -> external extraction tools
  -> XML/file cache
  -> source record graph
  -> normalized domain datasets
  -> enrichment planners
  -> patch plans
  -> global.ini application
```

The record graph should not write `global.ini`. It should expose stable records
and resolvers. Enrichment modules should decide which facts are useful enough to
append to localization strings.

## Definition Of Full Understanding

For each source family, we should eventually know:

- where it lives in extracted game data
- which root record types it contains
- which localization keys it references
- which GUIDs it references
- which records resolve those GUIDs
- what first-party facts it exposes
- what SCMDB can add on top
- which `global.ini` keys it can safely target
- which derived insights are useful to players
- which fields are too noisy for in-game text but useful for diagnostics

This document is the first catalog pass. The next step is to turn the catalog
into source inventories generated from the actual extracted cache so new game
patches can reveal new domains and changed fields automatically.
