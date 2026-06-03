# SCMDB Missions and Mining Enrichment Plan

This note captures the planned SCMDB-focused enrichment work for `global.ini`.
The goal is to add useful, glanceable information that is difficult or awkward to
derive from Data.p4k alone, while preserving game-resolved localization tags and
avoiding noisy duplication.

## Scope

- Mission descriptions and titles sourced from SCMDB `merged-*.json`.
- Mining element, mining journal, and mining location descriptions sourced from
  SCMDB `mining_data*.json`.
- SCMDB-organized data such as blueprint reward pools, faction reputation,
  refinery profiles, quality overrides, encounter summaries, and mining
  behavior stats.

Out of scope for this plan:

- General DataCore component stat extraction.
- Refined commodity economy descriptions, except where explicitly separated
  from mineable/raw/ore entries.
- Replacing runtime mission tags with static text.

## Guardrails

### Mining Key Safety

Mineable data must not bleed into refined commodity descriptions.

- `items_commodities_*_ore_desc` is the mined ore form.
- `items_commodities_*_raw_desc` is the raw mineable form.
- Bare commodity keys such as `items_commodities_gold` or generic
  `items_commodities_*_desc` should not receive mining scanner/rock behavior
  stats unless a separate refined commodity updater explicitly owns that use
  case.

Targeting rules:

- If SCMDB element name is `Name (Ore)`, update only the matching `_ore_desc`
  key.
- If SCMDB element name is `Name (Raw)`, update only the matching `_raw_desc`
  key.
- If the SCMDB element has no suffix, update only when the mapping is
  unambiguous and the existing key is a mineable/raw/ore description.
- Avoid broad fallback behavior that tries both `_raw_desc` and `_ore_desc`
  without verifying the element category.

### Mission Runtime Tag Safety

Preserve runtime tags such as:

- `~mission(Location)`
- `~mission(Location|Address)`
- `~mission(Destination|Address)`
- `~mission(System)`
- `~mission(target)`
- `~mission(reward)`
- `~missions(...)`

Do not replace these with static SCMDB-resolved values. These tags are resolved
by the game for the accepted contract instance and are often more accurate than a
static scrape.

Mission enrichment should add information that the game text does not already
communicate clearly. Avoid duplicating:

- Plain legal/illegal status, since the game already separates legal and
  illegal mission views.
- Static location names when the description already uses a runtime location or
  destination tag.
- Reward/location text when the original string already carries the runtime
  mission token.

It is still acceptable to add concise summaries when the information is broader
than the runtime tag, such as multiple available systems, reward efficiency,
blueprint chains, prerequisites, or encounter shape.

## Mining Improvements

### 1. Safer Mineable Key Mapping

First, tighten `mining-elements` target derivation so enriched mining stats are
only applied to the correct mineable entry.

Implementation notes:

- Parse the suffix from `Element Name`.
- Treat `(Ore)` and `(Raw)` as authoritative.
- For suffixless FPS mineables, require an explicit mapping or verified existing
  key.
- Add tests for ore/raw/refined separation.

### 2. Expand Element Stats

Current mining element descriptions use rarity, scan signatures, resistance, and
instability. SCMDB also exposes useful per-element fields:

- Density
- FPS scan signature
- Optimal window midpoint
- Optimal window randomness
- Optimal window thinness
- Explosion multiplier
- Cluster factor
- Quality bands
- Material name

Suggested section:

```text
** Scanner Data **
Rarity: Rare
Scan Signature: 3540
Ground Scan Signature: 4000
Resistance: 0.65
Instability: 350

** Mining Behavior **
Optimal Charge: 30%
Window Variance: 25%
Window Width: Narrow
Volatility: High
Cluster Tendency: Moderate
Quality Bands: 32.4% / 54.7%
```

Formatting should be compact. Do not add every raw number if a friendly label is
clearer.

### 3. Derived Mining Difficulty

Add a derived difficulty label from resistance, instability, window thinness,
window randomness, and explosion multiplier.

Candidate labels:

- Easy
- Moderate
- Difficult
- Volatile
- Extreme

Keep the formula documented and testable. Initial formula can be conservative
and refined after looking at generated output.

### 4. Volatility and Safety Notes

Use `explosionMultiplier` and instability to produce short notes:

- Low volatility
- Unstable charge behavior
- High explosion risk
- Extreme fracture risk

This is useful at a glance and is not equivalent to the raw instability number.

### 5. Cluster and Yield Notes

Use `clusterFactor` to describe whether an element tends to appear isolated or
clustered.

Example labels:

- Isolated
- Occasional clusters
- Cluster-prone

### 6. Refinery Hints

Use `refineryProfiles` and `refineries` to find the best refinery bonus for each
mineable/refined material.

Potential output:

```text
Best Refinery: MIC-L5 Modern Icarus Station (+13)
```

Rules:

- Prefer a single best bonus line.
- If multiple refineries share the best profile, join them compactly or show the
  profile name if a readable profile label exists.
- Do not apply refinery hints to generic refined commodity descriptions unless a
  dedicated commodity updater is added.

### 7. Mining Location Quality Notes

Current code reads elevated ship-mining quality floors. Expand this carefully to
other SCMDB quality distributions:

- `fpsmineables`
- `groundmineables`
- `harvestables`
- `shipmineables`

Location descriptions should stay location-level:

```text
Quality Notes:
FPS mineables: Pyro quality mean slightly elevated
Legendary ship rocks: quality floor 65.1% at Breaker Stations
```

### 8. Mining Journal Summary

The mining journal currently groups elements by rarity. Add compact global
insights:

- Hardest mineables
- Most volatile mineables
- Best refinery standouts
- FPS mineables vs ship mineables

Keep this summary short enough that the journal remains readable.

## Mission Improvements

### 1. Title Tags

Add title-level tags for special mission categories.

Existing:

- `[BP]` for direct blueprint reward missions.
- `[BP Chain]` for missions that lead into blueprint reward missions.

Add:

- `[Intro]` for intro/unlock missions.

Rules:

- Use the existing emphasis style, likely `IniTag.EM4`, consistent with current
  `[BP]` title tagging.
- Only tag titles when the source field indicates an intro/unlock mission, such
  as `isIntro`, `requiredIntros`, `linkedIntros`, or a clearly identified intro
  chain.
- Avoid stacking too many tags. If a mission is both intro and blueprint-related,
  use a deterministic order such as `[Intro] [BP]`.

### 2. Contract Intel Block

Add a compact optional block for mission descriptions. The block should include
only non-duplicative, high-value lines.

Candidate marker:

```text
** Contract Intel **
```

Potential lines:

- `Reward: 70,750 aUEC`
- `Time Limit: 16 min`
- `Efficiency: 4,422 aUEC/min`
- `Cooldown: 1 h`
- `Buy-in: 10,000 aUEC`
- `Net Reward: 81,000 aUEC`
- `Requires: Jr. Contractor`
- `Faction Rep: Head Hunters +500`
- `Available Systems: Stanton, Pyro, Nyx`
- `Max Players: 10`

Do not include:

- Plain `Illegal: Yes/No`.
- Static `Location` or `Destination` when the mission body already has runtime
  location tags.
- Reward or time lines if the mission string already presents the same value via
  a runtime tag in a clear way.

### 3. Reward Efficiency

Calculate `rewardUEC / timeToComplete` when both are present.

Rules:

- Use only for missions where `timeToComplete` is meaningful.
- Round to a readable whole number.
- If `buyIn` exists, also show net reward.

### 4. Reputation Requirements and Rewards

Use SCMDB `minStanding`, `maxStanding`, `factions`, and faction reward pools.

Potential lines:

- `Requires: Contractor`
- `Available Until: Elite Contractor`
- `Faction: Head Hunters`
- `Rep Reward: Head Hunters +500`
- `Failure Rep: Head Hunters -250`

Avoid dumping GUIDs or raw scope names. Show readable names only.

### 5. Blueprint Rewards

Keep and improve current blueprint reward output.

Enhancements:

- Show chance.
- Show `1 of N`.
- Deduplicate repeated item names where duplicates are not meaningful.
- Preserve duplicate entries if SCMDB weights imply duplicates increase odds.
- Consider showing weighted odds if pool weights are available and reliable.
- Keep direct `[BP Reward]` and `[BP Chain]` description notes.

### 6. Item Rewards

Improve current item reward formatting.

Potential details:

- Quantity.
- Chance group.
- Mission owner only.
- Sent to home location.

Keep it compact:

```text
[Item Reward]
- Council Scrip x5
```

Only add transport/ownership notes when they matter.

### 7. Encounter Summary

Use `shipEncounters.spawnConfig` to summarize combat/salvage shape.

Potential lines:

- `Encounter: 2-4 hostile ships`
- `Includes reinforcements`
- `Allied ships present`
- `Target cargo: medium-value illegal cargo`
- `Salvage target: 1 unmanned ship`

Rules:

- Do not overfit every role name from raw data.
- Collapse roles into readable categories: target, defenders, reinforcements,
  allies, salvage target.
- Include cargo only when it is meaningful and not too raw-looking.

### 8. Hauling and Resource Orders

Use `haulingOrders`, `resourcePools`, and `propertyValues` to clarify required
delivery or mining requests.

Potential lines:

- `Order: 15 Hadanite OR 20 Dolivine OR 5 Aphorite`
- `Cargo: 12-24 SCU Medical Supplies`
- `Containers: max 8 SCU`

Rules:

- Resolve resource IDs to readable resource names.
- Preserve `or` vs grouped options.
- Do not duplicate prose if the mission text already lists the exact same
  requirements clearly.

### 9. Prerequisite Notes

Use prerequisites and intro chain fields to surface unlock requirements.

Potential lines:

- `Requires Intro: A Chance to Impress`
- `Requires Previous Completion`
- `Unavailable after completion`
- `CrimeStat Allowed: 0-2`

This is more useful than a generic legal/illegal label.

### 10. Systems and Regions

Use system/region summary only when it adds broader context than runtime tags.

Good:

- `Available Systems: Stanton, Pyro, Nyx`
- `Pyro Regions: A, B`
- `Locality Locked: Pyro Region B`

Avoid:

- Replacing `~mission(Location|Address)`.
- Listing dozens of possible locations inline.

## Data and Schema Work

### Mining

Expand `src/schema/scmdb/mining-data.schema.ts` to include currently omitted
fields:

- `density`
- `resourceType`
- `optimalWindowMidpoint`
- `optimalWindowRandomness`
- `optimalWindowThinness`
- `explosionMultiplier`
- `clusterFactor`
- `fpsScanSignature`
- `qualityBands`
- `materialName`
- `refineryProfiles`
- `refineries`
- richer `qualityDistribution` entries
- composition part percentages and probabilities

Expand generated rows:

- `mining-elements.csv`
- potentially a new `mining-refinery-hints.csv`, if keeping element rows smaller
  is cleaner
- possibly richer `mining-journal.csv`

### Missions

Mission schema already captures many fields. The main work is transformation,
not raw schema modeling.

Likely additions:

- helper to resolve faction GUIDs
- helper to resolve location pool IDs to readable names
- helper to resolve resource pool IDs to readable names
- helper to summarize ship encounters
- helper to summarize hauling orders
- helper to build a non-duplicative contract intel block
- `[Intro]` title tag support

## Tests

Add or update tests for:

- Ore/raw/refined key separation.
- Existing mining stats remain idempotent.
- Mining behavior labels from representative elements.
- Refinery best-bonus selection.
- Mission runtime tags are preserved.
- Contract intel stripping/rebuilding is idempotent.
- No plain legal/illegal line is added.
- `[Intro]` title tag is added only to intro missions.
- Blueprint and intro tags have stable ordering.
- Encounter summaries collapse raw roles into readable text.
- Hauling order summaries preserve `or` semantics.

## Suggested Implementation Order

1. Add `[Intro]` title tags.
2. Tighten mining raw/ore/refined key targeting.
3. Expand mining element schema and CSV rows.
4. Add mining behavior stats and labels to mineable entries.
5. Add refinery hints.
6. Add contract intel block with reward/time/cooldown/buy-in/rep only.
7. Add faction/resource/location resolution helpers.
8. Add encounter and hauling summaries.
9. Expand mining location quality notes.
10. Add mining journal global insight summary.

This order starts with high-confidence, low-noise improvements, then moves into
richer summaries once the formatting and idempotency rules are established.
