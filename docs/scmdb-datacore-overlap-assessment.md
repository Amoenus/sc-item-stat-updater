# SCMDB And DataCore Overlap Assessment

Date: 2026-06-04

Compared local artifacts:

```text
DataCore graph: csv/datacore/4.8.0.11875683-live/record-graph.json
SCMDB merged:   csv/scmdb/4.8.1-live.11875683/merged-4.8.1-live.11875683.json
```

The version labels differ (`4.8.0` vs `4.8.1`), but both local artifacts use
build/changelist `11875683`. Treat this assessment as a same-build comparison
unless future source freshness checks prove otherwise.

Optional local companion generated during this assessment:

```text
docs/scmdb-datacore-overlap-assessment.json
```

That JSON is generated analysis output and is intentionally not a source file to
commit.

## Executive Summary

SCMDB heavily overlaps with game-file data for item GUIDs, manufacturer GUIDs,
mining definitions, blueprint products, and many localization keys. For these
domains, first-party DataForge XML should become the authority and SCMDB should
move toward relationship resolution, derived summaries, and stale-data
diagnostics.

The clearest direct-replacement candidates are:

1. Mining element/composition/clustering facts.
2. Manufacturer identity and localization.
3. Crafting item/product identity.
4. Commodity localization and first-party commodity entity metadata.
5. Base item/component stats already extracted from DataCore CSVs.

SCMDB remains valuable where it has already resolved relationships that are not
yet first-party parsed here:

1. Mission/contract graph relationships and readable mission summaries.
2. Blueprint reward pools and prerequisite chains.
3. Mining location/refinery rollups.
4. Hauling order and location-pool readability.
5. Encounter summaries and user-facing derived insights.

## High-Level Counts

| Metric | Count |
| --- | ---: |
| DataCore graph records | 57,719 |
| DataCore localization keys | 15,098 |
| SCMDB contracts | 1,437 |
| SCMDB legacy contracts | 291 |
| SCMDB resource pools | 241 |
| SCMDB crafting items | 1,551 |
| SCMDB crafting blueprints | 1,553 |
| SCMDB mining elements | 39 |

## Overlap By Domain

| Domain | Match key | SCMDB items | DataCore overlap | Assessment |
| --- | --- | ---: | ---: | --- |
| Mining elements | GUID | 39 | 39 / 100.0% | First-party DataCore should be authoritative. |
| Mining compositions | GUID | 63 | 63 / 100.0% | First-party DataCore should be authoritative. |
| Mining cluster presets | GUID | 23 | 23 / 100.0% | First-party DataCore should be authoritative. |
| Manufacturers | GUID | 64 | 64 / 100.0% | First-party DataCore should be authoritative. |
| Manufacturers | code | 64 | 56 / 87.5% | Use GUID as authority; codes have aliases/mismatches. |
| Crafting items | entity GUID in `entities/scitem` | 1,551 | 1,502 / 96.8% | First-party identity and stats should come from DataCore. |
| Blueprint products | product GUID in `entities/scitem` | 1,536 | 1,486 / 96.7% | First-party product identity should come from DataCore. |
| Crafting blueprints | blueprint GUID | 1,553 | 1,040 / 67.0% | Partial direct overlap; investigate missing blueprint classes. |
| Factions | localization key | 36 | 35 / 97.2% | DataCore is strong for names; SCMDB useful for resolved relationships. |
| Factions | GUID | 79 | 36 / 45.6% | SCMDB contains broader/resolved faction set than current parsed DataCore paths. |
| Commodity/resource names | DataCore commodity path localization key | 125 | 62 / 49.6% | Path-specific commodity overlap is partial. |
| Commodity/resource names | any DataCore localization key | 125 | 102 / 81.6% | SCMDB resource pools span commodities, harvestables, salvage, and placeholders. |
| Missions/contracts | localization key | 1,538 | 99 / 6.4% | Current DataCore mission-key extraction does not cover most SCMDB contract keys. |
| Missions/contracts | debug name/entity class | 4,007 | 407 / 10.2% | SCMDB contract graph remains the practical relationship source for now. |
| Contract item rewards | item reward entity GUID | 48 | 8 / 16.7% | SCMDB reward references often point outside current `scitem` coverage or need additional source paths. |

## Domain Findings

### Mining

SCMDB mining facts are effectively mirrored in first-party game files:

- `mineableElements`: 39 / 39 GUIDs overlap.
- `compositions`: 63 / 63 GUIDs overlap.
- `clusteringPresets`: 23 / 23 GUIDs overlap.

Recommendation: make DataCore the authority for raw mining element stats,
composition probabilities, clustering, and scan/difficulty fields. Keep SCMDB
for location distribution, refinery profiles, rollups, and player-facing derived
recommendations until those are reconstructed from game files.

### Manufacturers

SCMDB crafting item manufacturers overlap perfectly by GUID:

- 64 / 64 SCMDB manufacturer GUIDs are present in DataCore manufacturer records.
- Code overlap is lower at 56 / 64 because SCMDB codes and DataCore entity-class
  codes are not always the same spelling or alias.

Recommendation: resolve manufacturers by GUID first, then expose code/name
aliases. Do not use SCMDB as the authority for manufacturer identity once the
DataCore resolver exists.

### Items And Crafting Products

SCMDB crafting item GUIDs mostly exist as DataCore `entities/scitem` root refs:

- Crafting items: 1,502 / 1,551 overlap.
- Blueprint product GUIDs: 1,486 / 1,536 overlap.

Recommendation: use DataCore for first-party item identity, attach metadata,
component stats, manufacturer refs, and localized item names. SCMDB remains
useful for resolved crafting relationships, loot sources, and product/resource
summaries.

### Crafting Blueprints

Blueprint GUID overlap is only partial:

- Crafting blueprints: 1,040 / 1,553 overlap.

This likely means SCMDB includes blueprint records from paths or generated
structures not covered by the simple `libs/foundry/records/crafting/blueprints`
prefix check, or SCMDB has additional relationship-level blueprint objects.

Recommendation: before replacing SCMDB blueprint facts, add a first-party
blueprint extractor that reads all crafting blueprint roots and validates
missing SCMDB blueprint GUIDs against the XML cache. Use SCMDB for blueprint
reward pools and chain resolution until that is done.

### Commodities And Resource Pools

SCMDB `resourcePools` are not equivalent to DataCore commodity entities, but
commodity-key extraction now combines commodity entities with adjacent
first-party DataCore records:

- DataCore commodity rows cover commodity entity localization keys.
- Carryable and harvestable base records cover explicit harvestable and
  commodity aliases.
- `Hauling_EntityClasses` records cover salvage component order labels via root
  `orderDisplayName` attributes.

With the checked-in DataCore/SCMDB data, all non-placeholder SCMDB
resource-pool localization keys are covered by DataCore commodity extraction.
The remaining SCMDB-only resource-pool key is generic placeholder noise and is
filtered out of commodity loading:

```text
LOC_PLACEHOLDER
```

Recommendation: keep DataCore as the commodity-key source. Do not read SCMDB
resource pools for active commodity loading unless a new first-party gap is
proven and documented as a temporary bridge.

### Missions And Contracts

SCMDB mission/contract overlap remains partial after exporting dedicated
DataCore contract-generator, mission-broker, and mission-localization fact CSVs:

- `csv/datacore/4.8.0.11875683-live/contract-generators.datacore.csv`
  contains 496 generated contract variant rows with title/description overrides,
  string-hash variants, timing, difficulty, and location-tag fields.
- `csv/datacore/4.8.0.11875683-live/mission-brokers.datacore.csv`
  contains 2,584 first-party MissionBrokerEntry rows with reward, timing,
  cooldown, mission type, giver, location, flag, and localization-key fields.
- `csv/datacore/4.8.0.11875683-live/mission-localization.datacore.csv`
  contains 5,087 mission/contract localization-reference rows and 1,027 unique
  keys.
- 476 / 1,449 SCMDB mission updater rows overlap the combined DataCore
  generator/broker/localization keys.
- Title overlap is 238 / 694 rows.
- Description overlap is 228 / 721 rows.
- 407 / 4,007 SCMDB debug names overlap DataCore mission/contract entity class
  names.

This does not mean game files lack mission data. It means the current
localization-reference extractor does not yet normalize the same
contract/template surfaces SCMDB resolves. SCMDB is already merging mission
broker records, contract generators, location pools, token substitutions,
rewards, prerequisite chains, hauling orders, and blueprint reward relationships
into readable rows.

Recommendation: keep SCMDB as the mission relationship and insight source for
now. Build a first-party mission extractor incrementally:

1. MissionBrokerEntry title/description/reward/cooldown fields.
2. ContractTemplate and ContractGenerator fields.
3. Token substitutions and location-pool joins.
4. Comparison diagnostics against SCMDB, not immediate replacement.

### Factions And Reputation

Faction name-key overlap is strong, but GUID overlap is partial:

- Faction localization keys: 35 / 36 overlap.
- Faction GUIDs: 36 / 79 overlap.

Recommendation: use DataCore for first-party faction/reputation names and
standing records where available. Keep SCMDB for mission-facing faction
relationships until the first-party mission and reputation resolvers are joined.

### Vehicles, Starmap, Law, And Other DataCore-Only Signals

These domains have substantial DataCore coverage but little or no equivalent
SCMDB output in the current local artifacts:

| DataCore signal | Count |
| --- | ---: |
| Vehicle records | 911 |
| Vehicle localization keys | 552 |
| Starmap/locality localization keys | 803 |
| Law localization keys | 40 |
| SC item localization keys | 11,703 |
| Manufacturer records | 1,071 |

Recommendation: these should be treated as first-party-only opportunities.
SCMDB can still help with derived insight or relationship context, but it should
not be the primary source for vehicle metadata, starmap labels, law definitions,
or item-localization existence.

## Source-Of-Truth Recommendations

| Data type | Recommended authority | SCMDB role |
| --- | --- | --- |
| Raw item/component stats | DataCore | Comparison and gap diagnostics. |
| Item identity and localization | DataCore | Supplemental relationship context. |
| Manufacturer identity | DataCore | Temporary alias/check source. |
| Mining raw element/composition facts | DataCore | Derived location/refinery insight. |
| Commodity entity metadata | DataCore | Hauling/resource relationship resolution. |
| Crafting item/product identity | DataCore | Crafting relationship summaries. |
| Crafting blueprint definitions | Mixed until extractor improves | Blueprint pools/chains. |
| Mission base records | DataCore target, not ready | Current relationship source. |
| Mission rewards/chains/locations | SCMDB for now | Validate against DataCore later. |
| Reputation/faction names | DataCore | Mission-facing joins and summaries. |
| Starmap/location labels | DataCore | External readability only if needed. |
| Law definitions | DataCore | External cross-check only. |

## Implementation Implications

1. Add a graph loader API before more one-off enrichers. The 137 MB graph should
   not be ad hoc parsed in every module.
2. Build manufacturer resolution from DataCore first. GUID overlap with SCMDB is
   complete and will improve item/vehicle joins.
3. Build commodity extraction from DataCore next, but classify SCMDB
   `resourcePools` into commodity, harvestable, salvage, and placeholder groups
   before comparing counts.
4. Move mining raw facts from SCMDB to DataCore. Keep SCMDB mining outputs for
   location/refinery rollups until equivalent first-party extraction exists.
5. Keep SCMDB mission enrichment in place for now. The overlap numbers show that
   replacing mission enrichment requires dedicated first-party mission parsing,
   not just the generic graph.
6. Add recurring overlap diagnostics so each patch reports:
   - SCMDB records resolved by DataCore GUID.
   - SCMDB localization keys present in DataCore.
   - SCMDB-only GUIDs/keys that may indicate stale SCMDB data, missing DataCore
     parsing, or generated records outside the XML cache.

## Caveats

This assessment uses the DataCore record graph, not a full domain-specific
DataCore parser for every source family. Low overlap in missions and some
blueprints should be read as "not covered by current normalization" rather than
"absent from game files."

The generic graph indexes root `__ref`, root path/type/entity class,
localization references, and explicit `<Reference value="...">` edges. It does
not yet index arbitrary GUID-valued attributes. Some first-party relationships
will remain invisible until domain extractors parse those fields.
