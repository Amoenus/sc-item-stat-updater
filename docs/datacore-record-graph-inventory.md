# DataCore Record Graph Inventory

Date: 2026-06-04

Source artifact:

```text
csv/datacore/4.8.0.11875683-live/record-graph.json
```

Companion inventory:

```text
csv/datacore/4.8.0.11875683-live/record-graph-inventory.json
```

## Graph Summary

The generated graph indexes the full extracted DataForge XML cache:

| Metric | Count |
| --- | ---: |
| Records | 57,719 |
| Root `__ref` GUIDs | 57,704 |
| Paths | 57,719 |
| Root types | 555 |
| Entity classes | 56,407 |
| Referenced localization keys | 15,098 |
| Localization keys present in `global.ini` | 14,482 |
| Localization key coverage | 95.9% |
| Unique `<Reference value="...">` GUIDs | 38,633 |
| Reference GUIDs resolved to root `__ref` records | 2,695 |
| Reference GUID resolution coverage | 7.0% |

The graph now normalizes localization references by stripping the leading `@`
marker and ignores raw attribute labels such as action names in `Name`
attributes. This keeps `byLocalizationKey` usable for direct `global.ini` joins.

## Largest Record Families

| Root type | Records |
| --- | ---: |
| EntityClassDefinition | 27,574 |
| BuildingBlocks_Canvas | 3,631 |
| MissionBrokerEntry | 2,584 |
| TintPaletteTree | 2,128 |
| MissionLocationTemplate | 2,076 |
| StarMapObject | 1,992 |
| CommunicationName | 1,486 |
| SCItemManufacturer | 1,071 |
| CraftingBlueprintRecord | 1,045 |
| BuildingBlocks_Style | 652 |

| Path prefix | Records |
| --- | ---: |
| `libs/foundry/records/entities/scitem` | 22,628 |
| `libs/foundry/records/ui/buildingblocks` | 4,665 |
| `libs/foundry/records/missionbroker/pu_missions` | 2,558 |
| `libs/foundry/records/actor/actors` | 2,264 |
| `libs/foundry/records/missiondata/pu_locations` | 2,076 |
| `libs/foundry/records/tintpalettes/brand` | 2,007 |
| `libs/foundry/records/starmap/pu` | 1,991 |
| `libs/foundry/records/crafting/blueprints` | 1,045 |
| `libs/foundry/records/entities/spaceships` | 872 |
| `libs/foundry/records/scitemmanufacturer/paintcolorlogos` | 865 |

## Priority Source Counts

| Source | Records | Loc keys | Loc coverage | Ref GUIDs | Resolved refs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Space vehicles | 872 | 496 | 97.2% | 628 | 5.6% |
| Ground vehicles | 39 | 56 | 100.0% | 69 | 14.5% |
| Manufacturers | 1,071 | 246 | 80.5% | 0 | 0.0% |
| Commodities | 237 | 452 | 98.9% | 127 | 0.0% |
| Mining globals/elements | 310 | 0 | 0.0% | 0 | 0.0% |
| Mineable entities | 267 | 27 | 92.6% | 25 | 24.0% |
| Harvestable | 890 | 0 | 0.0% | 108 | 0.0% |
| Crafting blueprints | 1,045 | 32 | 3.1% | 0 | 0.0% |
| Reputation | 519 | 144 | 77.8% | 352 | 99.1% |
| Factions | 155 | 96 | 89.6% | 27 | 92.6% |
| Starmap PU | 1,991 | 799 | 96.1% | 22 | 0.0% |
| Mission broker | 2,558 | 961 | 87.2% | 944 | 23.5% |
| Contract templates | 441 | 0 | 0.0% | 190 | 13.7% |
| Contract generator | 104 | 0 | 0.0% | 1,284 | 11.8% |
| Law system | 220 | 40 | 100.0% | 74 | 35.1% |
| Loot generation | 489 | 0 | 0.0% | 181 | 16.6% |
| SC item entities | 22,628 | 11,703 | 97.6% | 2,358 | 13.1% |

## Findings

The graph is immediately useful for localization-backed source inventories.
Vehicles, commodities, starmap records, law records, and SC item entities all
have high `global.ini` key coverage. Mission broker coverage is also strong, but
there are more missing keys, especially older or variant mission strings.

The graph indexes root `__ref` values plus GUIDs found in record attributes,
including explicit `<Reference value="...">` nodes. Some relationships still
point at records not represented as root `__ref` nodes in the XML cache, so
domain-specific resolvers remain necessary where a raw GUID edge needs semantic
meaning. Reputation and faction records resolve well, so they are good early
candidates for graph-following enrichment.

Manufacturer records are straightforward name/description sources, and the
generic graph now exposes vehicle-to-manufacturer GUID edges when they are
stored as attributes. A domain resolver should still decide which edge carries
manufacturer semantics.

Commodity records look like a low-risk next extractor: 237 records, 452
localization keys, and 98.9% key coverage. This is a strong candidate after the
manufacturer resolver.

Mission broker records have enough localization and reference coverage to build
first-party mission facts, but relationship extraction should be staged. The
graph can identify target title/description keys now; reward, cooldown,
location, and reputation joins need domain-specific parsing.

## Recommended Next Steps

1. Add a graph loader API so enrichers can consume `record-graph.json` without
   re-parsing the large artifact ad hoc.
2. Add a manufacturer resolver from `SCItemManufacturer` records keyed by
   manufacturer code, `__ref`, and localization keys.
3. Add source inventory diagnostics that can be regenerated per patch from the
   graph and emitted as a stable report.
4. Build the commodity extractor before vehicles if the goal is fastest safe
   first-party enrichment.
5. Build the vehicle extractor after manufacturer resolution, then extend graph
   indexing or vehicle parsing for GUID-valued fields that are not represented
   by `<Reference>` nodes.
