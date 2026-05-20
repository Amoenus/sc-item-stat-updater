// ---------------------------------------------------------------------------
// versions.json
// ---------------------------------------------------------------------------

export {
  VersionEntrySchema as ScmdbVersionEntrySchema,
  VersionsSchema as ScmdbVersionsSchema,
} from './scmdb/versions.schema.js';

export type {
  VersionEntry as ScmdbVersionEntryDTO,
  Versions as ScmdbVersionsDTO,
} from './scmdb/versions.schema.js';

// ---------------------------------------------------------------------------
// merged-*.json  (quicktype-generated strict schema)
// ---------------------------------------------------------------------------

export {
  MergedSchema as ScmdbMergedSchema,
  ContractSchema as ScmdbContractSchema,
  LegacyContractSchema as ScmdbLegacyContractSchema,
  FactionSchema as ScmdbFactionSchema,
  BlueprintPoolsSchema as ScmdbBlueprintPoolsSchema,
  BlueprintPoolEntrySchema as ScmdbBlueprintPoolEntrySchema,
  FactionRewardsSchema as ScmdbFactionRewardsSchema,
} from './scmdb/merged/index.js';

export type {
  Merged as ScmdbMergedDTO,
  Contract as ScmdbContractDTO,
  LegacyContract as ScmdbLegacyContractDTO,
  Faction as ScmdbFactionDTO,
  FactionRewards as ScmdbFactionRewardsDTO,
  BlueprintPools as ScmdbBlueprintPoolsDTO,
  BlueprintPoolEntry as ScmdbBlueprintPoolEntryDTO,
} from './scmdb/merged/index.js';

// ---------------------------------------------------------------------------
// mining_data-*.json
// ---------------------------------------------------------------------------

export { MiningDataSchema as ScmdbMiningDataSchema } from './scmdb/mining-data.schema.js';

export type {
  MiningData as ScmdbMiningDataDTO,
  LocationOverrideEntry as ScmdbLocationOverrideEntryDTO,
} from './scmdb/mining-data.schema.js';

// ---------------------------------------------------------------------------
// crafting_items-*.json
// ---------------------------------------------------------------------------

export { CraftingItemsSchema as ScmdbCraftingItemsSchema } from './scmdb/crafting-items/index.js';

export type { CraftingItems as ScmdbCraftingItemsDTO } from './scmdb/crafting-items/index.js';

// ---------------------------------------------------------------------------
// crafting_blueprints-*.json
// ---------------------------------------------------------------------------

export { CraftingBlueprintsSchema as ScmdbCraftingBlueprintsSchema } from './scmdb/crafting-blueprints/index.js';

export type { CraftingBlueprints as ScmdbCraftingBlueprintsDTO } from './scmdb/crafting-blueprints/index.js';
