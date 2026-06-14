# Next Data Source Normalization Goal

Date: 2026-06-05

## Overall Goal

Move first-party facts from SCMDB into DataCore-backed extraction
wherever the game files expose the same data directly. Keep SCMDB for
relationship resolution, readable rollups, and derived insight until equivalent
first-party parsing exists.

This continues the direction established by the DataCore record graph:

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

The graph and source normalization layers must not mutate localization. They
should expose records and resolvers. Enrichment modules decide what is useful
enough to append to `global.ini`.

## Source-Of-Truth Policy

Use DataCore/game-file data as the authority for first-party facts when present:

- raw item/component stats
- item identity and localization
- manufacturer identity
- commodity entity metadata
- mining raw facts
- crafting item/product identity
- vehicle metadata
- starmap/location labels
- law definitions
- reputation/faction names and standing records

Use SCMDB as a relationship and insight layer where first-party parsing is not
yet implemented:

- mission/contract graph relationships
- blueprint reward pools and prerequisite chains
- hauling/resource relationship resolution
- mining location and refinery rollups
- readable encounter summaries
- derived player-facing recommendations
- stale-data and coverage diagnostics

## Current Evidence

The SCMDB/DataCore overlap assessment found:

- Mining elements, compositions, and cluster presets overlap by GUID at 100%.
- Manufacturer GUID overlap is 100%.
- Crafting item/product GUID overlap is about 97%.
- DataCore commodity localization coverage is strong, but SCMDB `resourcePools`
  span commodities, harvestables, salvage pseudo-resources, and placeholders.
- Generic mission graph overlap with SCMDB is low, so mission replacement needs
  dedicated first-party mission parsing.

Reference docs:

```text
docs/datacore-record-graph-inventory.md
docs/scmdb-datacore-overlap-assessment.md
docs/game-data-enrichment-catalog.md
```

Generated local artifacts are intentionally ignored and should be regenerated
locally as needed:

```text
csv/datacore/<version>/record-graph.json
csv/datacore/<version>/record-graph-inventory.json
docs/scmdb-datacore-overlap-assessment.json
```

## Recommended Implementation Order

### 1. DataCore Graph Loader API

Add a typed loader/resolver layer for `record-graph.json`.

Required capabilities:

- load graph from the selected DataCore version directory
- lookup by root `__ref`
- lookup by `__path`
- lookup by root type
- lookup by entity class
- lookup by localization key
- lookup by referenced GUID
- filter records by path prefix
- lookup by dynamic XML attribute name or value
- list localization and GUID references by source attribute name

The graph is large, so callers should not parse it ad hoc. The graph remains a
generic XML attribute graph: semantic relationship names such as manufacturer,
faction, reward, prerequisite, and location belong in domain resolvers built on
top of these raw attribute and reference lookups.

### 2. Manufacturer Resolver

Build first-party manufacturer resolution from `SCItemManufacturer` records.

Resolve by:

- GUID / `__ref`
- manufacturer code / entity class
- name localization key
- description localization key

This should become the authoritative manufacturer source. SCMDB can remain a
temporary alias/check source.

### 3. Commodity Extractor

Build a DataCore commodity extractor for real commodity entities.

Extract:

- display name key
- description key
- display type
- type/subtype GUIDs where present
- cargo occupancy / unit metadata where present
- boxable/refined/raw flags where present

Keep SCMDB resource pools for hauling/resource relationship joins until
harvestables, salvage pseudo-resources, and other resource families are parsed.

### 4. Mining Raw Facts From DataCore

Move mining raw facts from SCMDB to DataCore:

- mineable elements
- mineable compositions
- clustering presets
- resistance/instability/window/explosion fields
- scan signatures where linked from mineable entities

Keep SCMDB for mining locations and refinery summaries until equivalent
first-party extraction exists.

### 5. Vehicle Extractor

After manufacturer resolution, build vehicle extraction:

- vehicle name/description keys
- manufacturer
- role/career
- crew size
- claim/expedite data
- hull/armor fields
- default loadout references

Vehicle enrichment should wait until joins are stable enough to avoid brittle
filename-derived guesses.

### 6. Mission Extractor Later

Do not replace SCMDB mission enrichment yet. Build first-party mission parsing
incrementally:

- MissionBrokerEntry base fields
- ContractTemplate and ContractGenerator fields
- reward/cooldown/shareability/prison/reaccept fields
- token substitutions
- location-pool joins
- comparison diagnostics against SCMDB

SCMDB remains the practical mission relationship source until this is complete.

## Guardrails

- Do not commit generated graph artifacts.
- Do not mutate `global.ini` from graph/source normalization code.
- Keep source datasets and enrichment planners separate.
- Prefer DataCore for first-party facts, SCMDB for relationships and insight.
- Add tests around resolver contracts before using them in enrichment modules.
- Keep reports lightweight and commit human-readable findings, not large
  generated JSON blobs.
