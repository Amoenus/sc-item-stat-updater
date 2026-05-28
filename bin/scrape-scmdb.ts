import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildMiningElementRows,
  buildMiningJournalRows,
  buildMiningLocationRows,
} from '../src/extractor/mining-parser';

import {
  buildBlueprintPoolRows,
  buildContractBlueprintRows,
  buildContractRow,
  buildFactionRewardsContext,
  buildMissionRows,
  collectBlueprintChainData,
  toContractRowSource,
  toLegacyContractRowSource,
} from '../src/extractor/mission-parser';
import { toCsv } from '../src/lib/csv';
import {
  ScmdbCraftingBlueprintsSchema,
  ScmdbCraftingItemsSchema,
  ScmdbMergedSchema,
  ScmdbMiningDataSchema,
  ScmdbVersionsSchema,
} from '../src/schema/scmdb.schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// outDir and missionsOutDir are set inside main() after the version is resolved.
let outDir: string;
let missionsOutDir: string;

function usage() {
  console.log(`Usage: node scrape-scmdb.js [options]

Options:
  --version <version>    Use a specific SCMDB merged version file
  --ptu                  Fetch the latest PTU SCMDB version instead of latest live
  --list-versions        List available SCMDB merged versions
  --raw                  Save only raw SCMDB JSON output
  --help                 Show this help message

Examples:
  node scrape-scmdb.js
  node scrape-scmdb.js --ptu
  node scrape-scmdb.js --version 4.8.0-ptu.11759767
  node scrape-scmdb.js --list-versions
`);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': 'SCMDB Scraper' } });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchAndValidate<T>(url: string, schema: import('zod').ZodType<T>): Promise<T> {
  const raw = await fetchJson(url);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Schema validation failed for ${url}:\n${result.error.toString()}`);
  }
  return result.data;
}

function writeOutput(fileName: string, content: string): void {
  const path = join(outDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved ${fileName}`);
}

function writeMissionOutput(fileName: string, content: string): void {
  const path = join(missionsOutDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved missions/${fileName}`);
}

export function isLiveVersion(version: string): boolean {
  return /\blive\b/i.test(version) || /-live\./i.test(version);
}

export function isPtuVersion(version: string): boolean {
  return /\bptu\b/i.test(version) || /-ptu\./i.test(version);
}

type VersionEntry = { version: string; file: string };

function selectVersion(args: string[], versions: VersionEntry[]): VersionEntry {
  const versionArgIndex = args.indexOf('--version');
  const ptu = args.includes('--ptu');

  if (versionArgIndex !== -1) {
    const requested = args[versionArgIndex + 1];
    if (!requested) throw new Error('--version requires a value');
    const found = versions.find((entry) => entry.version === requested);
    if (!found) throw new Error(`Version not found: ${requested}`);
    return found;
  }

  if (ptu) {
    const found = versions.find((entry) => isPtuVersion(entry.version));
    if (!found) throw new Error('No PTU SCMDB version available');
    return found;
  }

  const liveVersion = versions.find((entry) => isLiveVersion(entry.version)) ?? versions[0];
  if (!liveVersion) throw new Error('No SCMDB versions available');
  return liveVersion;
}

function writeMiningData(miningData: ReturnType<typeof ScmdbMiningDataSchema.parse>): void {
  const elements = buildMiningElementRows(miningData);
  if (elements.length) {
    writeOutput(
      'mining-elements.csv',
      toCsv(elements, [
        'Element Name',
        'Rarity',
        'Ground Scan Signature',
        'Scan Signature',
        'Resistance',
        'Instability',
      ]),
    );
  }

  const journal = buildMiningJournalRows(miningData);
  if (journal.length) {
    writeOutput('mining-journal.csv', toCsv(journal, ['Rarity Category', 'Element List']));
  }

  const locRows = buildMiningLocationRows(miningData);
  if (locRows.length) {
    writeOutput(
      'mining-locations.csv',
      toCsv(locRows, ['Location Name', 'Ship Mineables', 'Hand Mineables', 'Ground Vehicle Mineables', 'Quality Note']),
    );
  }
}

function printVersions(versions: VersionEntry[]): void {
  console.log('Available SCMDB versions:');
  for (const entry of versions) {
    console.log(`  ${entry.version} -> ${entry.file}`);
  }
  console.log('');
  console.log('By default this scraper uses the latest live SCMDB version. Use --ptu to fetch the latest PTU version.');
}

async function main() {
  const args = process.argv.slice(2);
  const listVersions = args.includes('--list-versions');
  const rawOnly = args.includes('--raw');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    usage();
    process.exit(0);
  }

  const versionsUrl = 'https://scmdb.net/data/versions.json';
  const versions = await fetchAndValidate(versionsUrl, ScmdbVersionsSchema);

  if (listVersions) {
    printVersions(versions);
    process.exit(0);
  }

  const selected = selectVersion(args, versions);

  console.log(`Using SCMDB version ${selected.version}`);

  // Version-scoped output dirs: csv/scmdb/<version>/ and csv/scmdb/<version>/missions/
  outDir = join(repoRoot, 'csv', 'scmdb', selected.version);
  missionsOutDir = join(outDir, 'missions');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(missionsOutDir, { recursive: true });

  const mergedUrl = `https://scmdb.net/data/${selected.file}`;
  const mergedRaw = await fetchJson(mergedUrl);
  writeOutput(selected.file, JSON.stringify(mergedRaw, null, 2));

  const miningUrl = `https://scmdb.net/data/mining_data-${selected.file.replace('merged-', '')}`;
  const craftingItemsUrl = `https://scmdb.net/data/crafting_items-${selected.file.replace('merged-', '')}`;
  const craftingBlueprintsUrl = `https://scmdb.net/data/crafting_blueprints-${selected.file.replace('merged-', '')}`;

  const miningRaw = await fetchJson(miningUrl).catch(() => null);
  const craftingItemsRaw = await fetchJson(craftingItemsUrl).catch(() => null);
  const craftingBlueprintsRaw = await fetchJson(craftingBlueprintsUrl).catch(() => null);

  if (miningRaw) {
    writeOutput(`mining_data-${selected.file.replace('merged-', '')}`, JSON.stringify(miningRaw, null, 2));
    writeOutput('mining_data.json', JSON.stringify(miningRaw, null, 2));
  }
  if (craftingItemsRaw)
    writeOutput(`crafting_items-${selected.file.replace('merged-', '')}`, JSON.stringify(craftingItemsRaw, null, 2));
  if (craftingBlueprintsRaw)
    writeOutput(
      `crafting_blueprints-${selected.file.replace('merged-', '')}`,
      JSON.stringify(craftingBlueprintsRaw, null, 2),
    );

  if (rawOnly) {
    return;
  }

  // Validate at the integration boundary before data enters the transformation pipeline.
  // Fail fast with a descriptive error if the upstream API shape has changed.
  const mergedData = ScmdbMergedSchema.parse(mergedRaw);
  const miningData = miningRaw ? ScmdbMiningDataSchema.parse(miningRaw) : null;
  if (craftingItemsRaw) ScmdbCraftingItemsSchema.parse(craftingItemsRaw);
  if (craftingBlueprintsRaw) ScmdbCraftingBlueprintsSchema.parse(craftingBlueprintsRaw);

  const chainData = collectBlueprintChainData(mergedData.contracts);
  const factionRewardsContext = buildFactionRewardsContext(
    mergedData.factionRewardsPools,
    mergedData.factions,
    mergedData.contracts,
  );
  const contractRows = mergedData.contracts.map((c) =>
    buildContractRow(toContractRowSource(c), chainData, factionRewardsContext),
  );
  const legacyRows = mergedData.legacyContracts.map((c) =>
    buildContractRow(toLegacyContractRowSource(c), chainData, factionRewardsContext),
  );
  const missionRows = buildMissionRows(mergedData.contracts, chainData, mergedData.blueprintPools);
  const blueprintPoolRows = buildBlueprintPoolRows(mergedData.blueprintPools);
  const contractBlueprintRows = buildContractBlueprintRows(mergedData.contracts, mergedData.blueprintPools);

  if (missionRows.length) {
    writeMissionOutput(
      'scmdb-missions.csv',
      toCsv(missionRows, [
        'Localization Key',
        'Description',
        'TitleNote',
        'Note',
        'RewardList',
        'ItemRewardList',
        'Cooldown',
      ]),
    );
  }

  if (contractRows.length) {
    const headers = [
      'id',
      'debugName',
      'category',
      'missionType',
      'missionTypeKey',
      'title',
      'titleKey',
      'description',
      'descriptionKey',
      'descriptionLocKey',
      'rewardUEC',
      'timeToComplete',
      'canBeShared',
      'illegal',
      'factionGuid',
      'locations',
      'destinations',
      'prerequisites',
      'tokenSubstitutions',
      'minStanding',
      'maxStanding',
      'blueprintRewards',
      'isBlueprintReward',
      'isBlueprintChainPrerequisite',
      'blueprintChainDepth',
      'personalCooldownTime',
      'rewardRepCalculated',
      'factionRewards',
      'factionRewardsRaw',
      'shipEncounters',
      'haulingOrders',
      'itemRewards',
      'completionTags',
      'pyroRegion',
      'buyIn',
      'onceOnly',
      'maxPlayersPerInstance',
      'availableInPrison',
      'canReacceptAfterAbandoning',
      'canReacceptAfterFailing',
      'hasPersonalCooldown',
      'abandonedCooldownTime',
      'hideInMobiGlas',
      'systems',
      'factionRewards_fail',
      'requiredScenarios',
      'isIntro',
      'requiredIntros',
      'linkedIntros',
      'pickupCount',
      'deliveryCount',
      'propertyValues',
    ];
    writeOutput('contracts.csv', toCsv(contractRows, headers));
  }

  if (legacyRows.length) {
    const headers = [
      'id',
      'debugName',
      'category',
      'missionType',
      'missionTypeKey',
      'title',
      'titleKey',
      'description',
      'descriptionKey',
      'descriptionLocKey',
      'rewardUEC',
      'timeToComplete',
      'canBeShared',
      'illegal',
      'factionGuid',
      'locations',
      'destinations',
      'prerequisites',
      'tokenSubstitutions',
      'minStanding',
      'maxStanding',
      'blueprintRewards',
      'isBlueprintReward',
      'isBlueprintChainPrerequisite',
      'blueprintChainDepth',
      'personalCooldownTime',
      'rewardRepCalculated',
      'factionRewards',
      'factionRewardsRaw',
      'shipEncounters',
      'haulingOrders',
      'itemRewards',
      'completionTags',
      'pyroRegion',
      'buyIn',
      'onceOnly',
      'maxPlayersPerInstance',
      'availableInPrison',
      'canReacceptAfterAbandoning',
      'canReacceptAfterFailing',
      'hasPersonalCooldown',
      'abandonedCooldownTime',
      'hideInMobiGlas',
      'systems',
      'factionRewards_fail',
      'requiredScenarios',
      'isIntro',
      'requiredIntros',
      'linkedIntros',
      'pickupCount',
      'deliveryCount',
      'propertyValues',
    ];
    writeOutput('legacy-contracts.csv', toCsv(legacyRows, headers));
  }

  if (blueprintPoolRows.length) {
    writeOutput('blueprint-pools.csv', toCsv(blueprintPoolRows, ['id', 'name', 'source', 'blueprints']));
  }

  if (miningData) {
    writeMiningData(miningData);
  }

  if (contractBlueprintRows.length) {
    writeOutput(
      'contract-blueprint-rewards.csv',
      toCsv(contractBlueprintRows, [
        'contractId',
        'debugName',
        'title',
        'blueprintPoolId',
        'poolName',
        'chance',
        'trigger',
        'blueprintSource',
        'blueprintItems',
      ]),
    );
  }

  console.log(`SCMDB scrape complete. Outputs saved to csv/scmdb/${selected.version}/`);
}

try {
  await main();
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('ERROR:', error.message);
  process.exit(1);
}
