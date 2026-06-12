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

SPViewer is retired from active support. Historical audit notes remain in this repository to explain the retirement decision, but the application should not require SPViewer data for cache refresh, pipeline runs, or enrichment planning.

## SPViewer retirement status

The historical active-provider retirement audit can still be run from the repository root when investigating old data:

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

For `update`, the same audit is printed at startup before preflight. The `DataCore provider?` column shows which SCMDB dependencies are still active while DataCore is selected.

`update` no longer refreshes SCMDB-generated `mining-locations.csv`, and the SCMDB cache refresh no longer writes that retired CSV. DataCore-first mining-location updates do not read it.

Mining location rendering no longer imports arbitrary SCMDB-only location rows or SCMDB quality-note fallback text. DataCore rows are authoritative for normal locations and now reconstruct the special-site pools for `Breaker Stations Interior`, `Breaker Stations Large Geode`, and `Hathor Caves`. The mining-location SCMDB bridge is retired; the optional mining journal extra step still uses `mining-journal.csv` for journal rarity labels.

## Migration slices

The current high-value replacement targets are:

1. Mission titles/descriptions/chains/rewards.
   Build a first-party mission/contract extractor and reproduce SCMDB contract metadata joins from DataCore records. DataCore now emits `contract-generators.datacore.csv` with 496 generated contract variant rows, `contract-generator-intel.datacore.csv` with 394 generated-contract time/buy-in rows across 240 description keys, `contract-templates.datacore.csv` with 459 ContractTemplate rows and 169 unique objective/detail keys, `contract-template-hauling.datacore.csv` with 363 first-party hauling order rows across 167 templates, all 363 carrying resolved resource classes and 361 carrying first-party resource name keys, `mission-brokers.datacore.csv` with 2,584 first-party MissionBrokerEntry rows, `mission-contract-intel.datacore.csv` with 2,330 DataCore-derived reward/time/cooldown rows across 493 description keys, and `mission-localization.datacore.csv` with 5,087 mission/contract localization-reference rows and 1,027 unique keys. With checked-in DataCore `4.8.0.11875683-live` and SCMDB `4.8.1-live.11875683`, combined generator/template/broker/localization keys overlap 476 of 1,430 SCMDB mission rows: 238/694 title rows and 227/720 description rows. Contract-generator intel overlaps 143 SCMDB ContractIntel rows and is contained in 140 of those rendered rows; mission contract-intel keys overlap 26 SCMDB description rows and exactly match 8 cooldown strings; hauling templates map through generators to 21/208 SCMDB hauling rows. Treat these files as diagnostic/reconstruction inputs, not active replacements for `missions/scmdb-missions.csv`.
2. Blueprint and crafting relationships.
   Recover blueprint reward, chain, pool, and crafting-item joins from game-file records instead of SCMDB merged outputs.
3. Mining location summaries and journal fallback removal.
   Finish replacing SCMDB mining aggregations with DataCore mining provider, quality, composition, density, clustering, setup, and parameter joins. SCMDB remains the optional mining journal rarity source because DataCore rarity inference has not proven equivalent; DataCore journal output is limited to separately rendered insight summaries.
4. Mining element residue (refinery hints).
   DataCore now supplies material name, rarity, asteroid/surface/ground/FPS scan signatures from `mining-rock-signatures.datacore.csv`, and quality bands from `mining-quality-quantizations.datacore.csv`. SCMDB cannot create active mining-element target rows and no longer backfills mining behavior, rarity, density, scan signatures, or quality bands. With the checked-in DataCore/SCMDB data, the active merged rows are now `DataCore` or `DataCore+SCMDB`, never `SCMDB` only. The remaining SCMDB bridge field on targetable merged element rows is the optional derived best-refinery hint; missing `mining-elements.csv` no longer blocks DataCore mining-element updates. Replace the hint with a first-party join if a station/material bonus source is found before retiring the SCMDB mining-elements bridge entirely.
   Density investigation so far: SCMDB density is not the physical `Mass` on generated carryable cargo entities and is not `Mass / SCU`; commodity entity records expose cargo occupancy and resource type/subtype GUIDs, but not the rendered density scalar. SCMDB density is intentionally omitted from active mining-element output until a DataCore source is proven.
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
