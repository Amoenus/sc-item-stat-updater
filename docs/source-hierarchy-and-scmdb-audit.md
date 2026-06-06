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

`Game2.dcb` is an extracted intermediate, not an install-directory source of truth. The scraper extracts `Data/Game2.dcb` from `Data.p4k` into `csv/datacore/.dcbcache/<version>/`, then expands that cached DCB into `csv/datacore/.xmlcache/<version>/`. Loose files under the game install must not be used as authoritative inputs.

SCMDB is a temporary derived-data bridge. Keep it only where the pipeline still needs mission, blueprint, crafting, mining aggregation, or generated joins that have not yet been reconstructed from DataCore records.

SPViewer is a legacy comparison source. It is no longer part of active batch provider selection and should not be treated as an authoritative source for facts that can be extracted from DataCore.

## SPViewer retirement audit

Run the active-provider retirement audit from the repository root:

```sh
npm run audit:spviewer-retirement
```

Current checked-in LIVE data status:

- DataCore has a matching item-stat category for every legacy SPViewer category.
- SPViewer is retired from active provider selection.
- Remaining SPViewer-only generated keys are classified non-blocking in `docs/spviewer-retirement-turret-triage.md` and `docs/spviewer-retirement-remaining-triage.md`.
- Changed generated values are non-blocking review evidence because DataCore is the current game-file authority and SPViewer can lag or miss patches.
- The checked-in DataCore directory is generated from packed `Data.p4k`; use that as the active game-file authority.

## Current SCMDB dependencies

Run the live audit from the repository root:

```sh
node --import tsx/esm bin/update-item.ts --scmdb-audit
```

For `update-all`, the same audit is printed at startup before preflight. The `DataCore provider?` column shows which SCMDB dependencies are still active while DataCore is selected.

`update-all` does not refresh SCMDB-generated `mining-locations.csv` by default. Pass `--refresh-scmdb-mining-locations` only when you intentionally want to rebuild that legacy file from cached SCMDB `mining_data` for manual comparison; DataCore-first mining-location updates no longer read it.

Mining location rendering no longer imports arbitrary SCMDB-only location rows or SCMDB quality-note fallback text. DataCore rows are authoritative for normal locations and now reconstruct the special-site pools for `Breaker Stations Interior`, `Breaker Stations Large Geode`, and `Hathor Caves`. The mining-location SCMDB bridge is retired; `mining-journal.csv` remains a separate SCMDB dependency for journal rarity labels.

## Migration slices

The current high-value replacement targets are:

1. Mission titles/descriptions/chains/rewards.
   Build a first-party mission/contract extractor and reproduce SCMDB contract metadata joins from DataCore records.
2. Blueprint and crafting relationships.
   Recover blueprint reward, chain, pool, and crafting-item joins from game-file records instead of SCMDB merged outputs.
3. Mining location summaries and journal fallback removal.
   Finish replacing SCMDB mining aggregations with DataCore mining provider, quality, composition, density, clustering, setup, and parameter joins. SCMDB remains authoritative for mining journal rarity labels because DataCore rarity inference has not proven equivalent; DataCore journal output is limited to separately rendered insight summaries.
4. Mining element residue (density, ground scan, refinery hints).
   DataCore now supplies material name, rarity and asteroid/surface scan signatures from `mining-rock-signatures.datacore.csv`, and quality bands from `mining-quality-quantizations.datacore.csv`. SCMDB cannot create active mining-element target rows; it only joins bridge fields onto DataCore rows. With the checked-in DataCore/SCMDB data, the active merged rows are now `DataCore` or `DataCore+SCMDB`, never `SCMDB` only. The remaining SCMDB bridge fields on targetable merged element rows are density, unreconstructed ground scan fallbacks, and best-refinery hints. Replace them with first-party joins (likely via resource-type, mineable ground-vehicle records, or commodity refining records) before retiring the SCMDB mining-elements bridge entirely.
   Density investigation so far: SCMDB density is not the physical `Mass` on generated carryable cargo entities and is not `Mass / SCU`; commodity entity records expose cargo occupancy and resource type/subtype GUIDs, but not the rendered density scalar. Continue from the mineable element `resourceType` GUIDs and resource/refinery records rather than deriving density from cargo-box physics.
   Best-refinery investigation so far: SCMDB `mining_data.json` stores synthetic refinery profile IDs with per-material percentage bonuses, plus station-to-profile assignments. The generated DataCore cache contains starmap/location records for refinery stations and `libs/foundry/records/refiningprocess/*.xml` records for global processing methods, but those `RefiningProcess` records only define process speed/quality labels such as `Fast/Careful` and `Normal/Normal`; they do not expose station/material bonus profiles. Do not infer SCMDB refinery profiles from station names alone. Keep `Best Refinery` as an SCMDB bridge field until a first-party station/material bonus source is found.
5. Retired commodity joins.
   DataCore commodity extraction now covers commodity entity localization keys, explicit `items_commodities_*` localization keys on carryable harvestable/commodity records, first-party harvestable base aliases such as `harvestable_Armillaria` and `harvestable_MolinaMold`, and first-party hauling entity class labels for salvage component orders. The active commodity loader no longer reads SCMDB resource pools; generic `LOC_PLACEHOLDER` resource-pool entries are ignored as placeholder noise. Keep SCMDB resource pools out of active commodity loading unless a first-party gap is proven and documented as a temporary bridge.

Until a slice is replaced, code and docs should describe that dependency as `SCMDB-only derived/generated` or as a temporary SCMDB bridge, not as a peer provider.

## Mining journal rarity investigation

The DataCore-generated artifacts in `csv/datacore/4.8.0.11875683-live/` do not expose an explicit per-element field named `rarity` for mining journal labels. Element descriptions now use DataCore mineable-rock variant rarity where present, but journal grouping is a different derived rollup. The record graph and mining CSVs expose rarity-like bucket names in first-party mining records, including:

- mineable rock entity classes such as `MineableRock_AsteroidCommon_*`, `MineableRock_SurfaceRare_*`, and `MineableRock_AsteroidLegendary_*`
- composition preset classes such as `CommonShipMineables_*`, `UncommonShipMineables_*`, `RareShipMineables_*`, `EpicShipMineables_*`, and `LegendaryShipMineables_*`
- clustering and quality distribution classes such as `CommonShipMineable_Cluster` and `RareShipMineable_QualityDistribution_Default`

Those buckets are useful first-party mining facts, but they are not yet a proven replacement for SCMDB's journal grouping. The current diagnostic command:

```sh
npm run update -- --mining-journal-rarity-report
```

reported 16/26 matching rarity labels, 10 mismatches, 0 SCMDB-only elements, and 0 DataCore-only elements. `Sileron_Ore` is normalized to `Stileron (Ore)` in DataCore mining-element output because other first-party DataCore records use Stileron naming. Because the mismatch rate is too high, do not replace SCMDB mining journal rarity with probability inference. Keep SCMDB `mining-journal.csv` as the journal rarity source until a direct first-party field or equivalent game-file join is proven. DataCore-derived journal output is limited to insight summaries such as difficulty, volatility, and quality floors.
