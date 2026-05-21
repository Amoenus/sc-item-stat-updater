// ---------------------------------------------------------------------------
// versions.json
// ---------------------------------------------------------------------------

export type {
  VersionEntry as ScmdbVersionEntryDTO,
  Versions as ScmdbVersionsDTO,
} from './scmdb/versions.schema.js';
export {
  VersionEntrySchema as ScmdbVersionEntrySchema,
  VersionsSchema as ScmdbVersionsSchema,
} from './scmdb/versions.schema.js';

// ---------------------------------------------------------------------------
// merged-*.json  (quicktype-generated strict schema)
// ---------------------------------------------------------------------------

export type {
  BlueprintPoolEntry as ScmdbBlueprintPoolEntryDTO,
  BlueprintPools as ScmdbBlueprintPoolsDTO,
  Contract as ScmdbContractDTO,
  Faction as ScmdbFactionDTO,
  FactionRewards as ScmdbFactionRewardsDTO,
  LegacyContract as ScmdbLegacyContractDTO,
  Merged as ScmdbMergedDTO,
} from './scmdb/merged/index.js';
export {
  BlueprintPoolEntrySchema as ScmdbBlueprintPoolEntrySchema,
  BlueprintPoolsSchema as ScmdbBlueprintPoolsSchema,
  ContractSchema as ScmdbContractSchema,
  FactionRewardsSchema as ScmdbFactionRewardsSchema,
  FactionSchema as ScmdbFactionSchema,
  LegacyContractSchema as ScmdbLegacyContractSchema,
  MergedSchema as ScmdbMergedSchema,
} from './scmdb/merged/index.js';

// ---------------------------------------------------------------------------
// mining_data-*.json
// ---------------------------------------------------------------------------

export type {
  LocationOverrideEntry as ScmdbLocationOverrideEntryDTO,
  MiningData as ScmdbMiningDataDTO,
  MiningElementRowDTO as ScmdbMiningElementRowDTO,
  MiningJournalRowDTO as ScmdbMiningJournalRowDTO,
  MiningLocationRowDTO as ScmdbMiningLocationRowDTO,
} from './scmdb/mining-data.schema.js';
export {
  MiningDataSchema as ScmdbMiningDataSchema,
  MiningElementRowSchema as ScmdbMiningElementRowSchema,
  MiningJournalRowSchema as ScmdbMiningJournalRowSchema,
  MiningLocationRowSchema as ScmdbMiningLocationRowSchema,
} from './scmdb/mining-data.schema.js';

// ---------------------------------------------------------------------------
// crafting_items-*.json
// ---------------------------------------------------------------------------

export type { CraftingItems as ScmdbCraftingItemsDTO } from './scmdb/crafting-items/index.js';
export { CraftingItemsSchema as ScmdbCraftingItemsSchema } from './scmdb/crafting-items/index.js';

// ---------------------------------------------------------------------------
// crafting_blueprints-*.json
// ---------------------------------------------------------------------------

export type { CraftingBlueprints as ScmdbCraftingBlueprintsDTO } from './scmdb/crafting-blueprints/index.js';
export { CraftingBlueprintsSchema as ScmdbCraftingBlueprintsSchema } from './scmdb/crafting-blueprints/index.js';
