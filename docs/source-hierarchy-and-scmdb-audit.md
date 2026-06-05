# Source hierarchy and SCMDB dependency audit

## Source hierarchy

DataCore/Data.p4k is the authoritative source for game-derived facts:

- raw item stats and component identities
- localization keys
- manufacturers
- commodities
- vehicles
- factions and reputation metadata
- mining facts
- location labels where available

SCMDB is a temporary derived-data bridge. Keep it only where the pipeline still needs mission, blueprint, crafting, mining aggregation, or generated joins that have not yet been reconstructed from DataCore records.

SPViewer is a legacy fallback and comparison source. It should not be treated as an authoritative source for facts that can be extracted from DataCore.

## Current SCMDB dependencies

Run the live audit from the repository root:

```sh
node --import tsx/esm bin/update-item.ts --scmdb-audit
```

For `update-all --provider datacore`, the same audit is printed at startup before preflight. The `DataCore provider?` column shows which SCMDB dependencies are still active even when DataCore is selected.

## Migration slices

The current high-value replacement targets are:

1. Mission titles/descriptions/chains/rewards.
   Build a first-party mission/contract extractor and reproduce SCMDB contract metadata joins from DataCore records.
2. Blueprint and crafting relationships.
   Recover blueprint reward, chain, pool, and crafting-item joins from game-file records instead of SCMDB merged outputs.
3. Mining location summaries and journal fallback removal.
   Finish replacing SCMDB mining aggregations with DataCore mining provider, quality, composition, density, clustering, setup, and parameter joins. SCMDB remains authoritative for mining journal rarity labels because DataCore rarity inference has not proven equivalent.
4. Commodity joins.
   Remove SCMDB resource-pool fallbacks once DataCore commodity extraction covers every updater target key.

Until a slice is replaced, code and docs should describe that dependency as `SCMDB-only derived/generated` or as a temporary SCMDB bridge, not as a peer provider.

## Mining journal rarity investigation

The DataCore-generated artifacts in `csv/datacore/4.8.0.11875683-live/` do not expose an explicit per-element field named `rarity` for mining journal labels. The record graph and mining CSVs do expose rarity-like bucket names in first-party mining records, including:

- mineable rock entity classes such as `MineableRock_AsteroidCommon_*`, `MineableRock_SurfaceRare_*`, and `MineableRock_AsteroidLegendary_*`
- composition preset classes such as `CommonShipMineables_*`, `UncommonShipMineables_*`, `RareShipMineables_*`, `EpicShipMineables_*`, and `LegendaryShipMineables_*`
- clustering and quality distribution classes such as `CommonShipMineable_Cluster` and `RareShipMineable_QualityDistribution_Default`

Those buckets are useful first-party mining facts, but they are not yet a proven replacement for SCMDB's journal grouping. The current diagnostic command:

```sh
npm run update -- --mining-journal-rarity-report
```

reported 16/26 matching rarity labels, 9 mismatches, 1 SCMDB-only element (`Stileron (Ore)`), and 1 DataCore-only element (`Sileron (Ore)`, likely spelling drift). Because the mismatch rate is too high, do not replace SCMDB mining journal rarity with probability inference. Keep SCMDB `mining-journal.csv` as the journal rarity source until a direct first-party field or equivalent game-file join is proven.
