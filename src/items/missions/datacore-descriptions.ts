import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';

const logger = getLogger('datacore-descriptions-config');

const GENERATED_SECTION_START_PATTERN =
  /\\n\\n(?:\*\* Contract Intel \*\*|\*\* Encounter \*\*|\*\* Hauling \*\*|Cooldown: [^\\]+|\[BP Reward\]|\[BP Chain\]|\[Item Reward\])/;

function appendParagraph(value: string): string {
  return value ? String.raw`\n\n${value}` : '';
}



function formatNamedSection(title: string, value: string): string {
  return value ? String.raw`\n\n** ${title} **\n${value}` : '';
}

function formatRewardList(rewardList: string, noteText: string): string {
  const noteAlreadyContainsRewardList = noteText.includes(rewardList);
  return rewardList && !noteAlreadyContainsRewardList ? appendParagraph(rewardList) : '';
}

function formatItemRewardList(itemRewardList: string): string {
  return itemRewardList ? String.raw`\n\n[Item Reward]\n\n${itemRewardList}` : '';
}

function getCell(row: Record<string, string>, column: string): string {
  return row[column] ?? '';
}

function buildMetadata(row: Record<string, string>): string {
  const noteText = getCell(row, 'Note');

  return [
    formatNamedSection('Contract Intel', getCell(row, 'ContractIntel')),
    formatNamedSection('Encounter', getCell(row, 'EncounterSummary')),
    formatNamedSection('Hauling', getCell(row, 'HaulingSummary')),
    appendParagraph(noteText),
    formatRewardList(getCell(row, 'RewardList'), noteText),
    formatItemRewardList(getCell(row, 'ItemRewardList')),
  ].join('');
}

function stripAppendedMetadata(oldValue: string): string {
  const match = GENERATED_SECTION_START_PATTERN.exec(oldValue);
  return match ? oldValue.slice(0, match.index) : oldValue;
}

export async function loadDatacoreDescriptionsSourceData(
  context: ItemSourceDataContext,
): Promise<Record<string, string>[]> {
  const datacoreDir = context.sourceDirs?.datacore;
  if (!datacoreDir) return [];

  const generatorIntelPath = resolveChildPath(
    datacoreDir,
    'contract-generator-intel.datacore.csv',
    'generator intel csv',
  );
  const missionIntelPath = resolveChildPath(datacoreDir, 'mission-contract-intel.datacore.csv', 'mission intel csv');
  const haulingSummaryPath = resolveChildPath(
    datacoreDir,
    'contract-hauling-summary.datacore.csv',
    'hauling summary csv',
  );

  const generatorsPath = resolveChildPath(datacoreDir, 'contract-generators.datacore.csv', 'generators csv');
  const poolsPath = resolveChildPath(datacoreDir, 'blueprint-pools.datacore.csv', 'pools csv');
  const blueprintsPath = resolveChildPath(datacoreDir, 'crafting-blueprints.datacore.csv', 'blueprints csv');

  const scmdbDir = context.sourceDirs?.scmdb;
  const memaPath = scmdbDir ? resolveChildPath(scmdbDir, 'scmdb-mema.csv', 'mema csv') : '';

  let generatorIntel: Record<string, string>[] = [];
  let missionIntel: Record<string, string>[] = [];
  let haulingSummary: Record<string, string>[] = [];
  let generators: Record<string, string>[] = [];
  let pools: Record<string, string>[] = [];
  let craftingBlueprints: Record<string, string>[] = [];
  let memaStats: Record<string, string>[] = [];

  try {
    generatorIntel = await readCsvFile(generatorIntelPath);
  } catch (err) {
    logger.warn('Failed to read contract-generator-intel.datacore.csv', { err: String(err) });
  }

  try {
    missionIntel = await readCsvFile(missionIntelPath);
  } catch (err) {
    logger.warn('Failed to read mission-contract-intel.datacore.csv', { err: String(err) });
  }

  try {
    haulingSummary = await readCsvFile(haulingSummaryPath);
  } catch (err) {
    logger.warn('Failed to read contract-hauling-summary.datacore.csv', { err: String(err) });
  }

  try {
    generators = await readCsvFile(generatorsPath);
  } catch (err) {
    logger.warn('Failed to read contract-generators.datacore.csv', { err: String(err) });
  }

  try {
    pools = await readCsvFile(poolsPath);
  } catch (err) {
    logger.warn('Failed to read blueprint-pools.datacore.csv', { err: String(err) });
  }

  try {
    craftingBlueprints = await readCsvFile(blueprintsPath);
  } catch (err) {
    logger.warn('Failed to read crafting-blueprints.datacore.csv', { err: String(err) });
  }

  if (memaPath) {
    try {
      memaStats = await readCsvFile(memaPath);
    } catch (err) {
      logger.info('Optional scmdb-mema.csv not found or unreadable', { err: String(err) });
    }
  }

  const merged = new Map<string, Record<string, string>>();

  const getOrCreateRow = (key: string) => {
    let row = merged.get(key);
    if (!row) {
      row = { 'Localization Key': key };
      merged.set(key, row);
    }
    return row;
  };

  // 1. Process Mission Intel (Brokers)
  for (const row of missionIntel) {
    const key = row['Description Key'];
    if (!key) continue;
    const dest = getOrCreateRow(key);
    if (row['Contract Intel']) dest['ContractIntel'] = row['Contract Intel'];
  }

  // 2. Process Generator Intel
  for (const row of generatorIntel) {
    const key = row['Description Key'];
    if (!key) continue;
    const dest = getOrCreateRow(key);
    // Prefer broker intel, fallback to generator intel if missing or overwrite?
    // Let's overwrite since generator is more specific for variants, or if we want to combine them,
    // usually generator intel has more details (Time Limit + Buy In).
    if (row['Contract Intel']) dest['ContractIntel'] = row['Contract Intel'];
  }

  // 2.5 Process MEMA Stats
  for (const row of memaStats) {
    const rawKey = row['description_key'];
    if (!rawKey) continue;
    const key = rawKey.startsWith('@') ? rawKey.substring(1) : rawKey;
    const dest = getOrCreateRow(key);
    
    const lines = [];
    if (row['mema_uec']) lines.push(`Community MEMA: ${Number(row['mema_uec']).toLocaleString('en-US')} aUEC/h`);
    if (row['dur_avg']) lines.push(`Avg Completion: ${row['dur_avg']} min`);
    if (row['avg_diff']) lines.push(`Difficulty: ${row['avg_diff']}/7.0`);
    if (row['avg_sat']) lines.push(`Satisfaction: ${row['avg_sat']}/7.0`);
    
    if (lines.length > 0) {
      const memaBlock = lines.join(String.raw`\n`);
      if (dest['ContractIntel']) {
        dest['ContractIntel'] += String.raw`\n${memaBlock}`;
      } else {
        dest['ContractIntel'] = memaBlock;
      }
    }
  }

  // 3. Process Hauling Summary
  for (const row of haulingSummary) {
    const key = row['Description Key'];
    if (!key) continue;
    const dest = getOrCreateRow(key);
    if (row['Hauling Summary']) dest['HaulingSummary'] = row['Hauling Summary'];
  }

  // 4. Precompute Blueprint Data
  const blueprintByGuid = new Map<string, string>();
  for (const row of craftingBlueprints) {
    const guid = row['Ref'];
    const nameKey = row['TargetItemNameKey'];
    if (guid && nameKey) {
      blueprintByGuid.set(guid, nameKey);
    }
  }

  const poolByGuid = new Map<string, { weight: number; nameKey: string }[]>();
  for (const row of pools) {
    const guid = row['Ref'];
    const guidsJson = row['BlueprintGuids'];
    if (guid && guidsJson) {
      try {
        const parsed = JSON.parse(guidsJson) as { guid: string; weight: number }[];
        poolByGuid.set(
          guid,
          parsed.map((p) => ({ weight: p.weight, nameKey: blueprintByGuid.get(p.guid) || 'Unknown' })),
        );
      } catch {}
    }
  }

  // 5. Build Blueprint Rewards string
  for (const row of generators) {
    const key = row['Description Key'];
    const poolGuidsStr = row['Blueprint Reward Pool Guids'];
    if (!key || !poolGuidsStr) continue;

    const guids = poolGuidsStr.split(',');
    const rewardLines: string[] = [];
    for (const poolGuid of guids) {
      const poolEntries = poolByGuid.get(poolGuid);
      if (!poolEntries || poolEntries.length === 0) continue;
      
      const totalWeight = poolEntries.reduce((sum, e) => sum + e.weight, 0);
      for (const entry of poolEntries) {
        const percentage = Math.round((entry.weight / totalWeight) * 100);
        // We use @ prefix for localization keys so the localizer will resolve them!
        rewardLines.push(` - @${entry.nameKey} (${percentage}%)`);
      }
    }

    if (rewardLines.length > 0) {
      const dest = getOrCreateRow(key);
      dest['RewardList'] = `[BP Reward]\n\nBlueprint Reward(s):\n${rewardLines.join('\\n')}`;
    }
  }

  return [...merged.values()];
}

export default {
  label: 'DataCore mission descriptions',
  sourceFiles: [
    { file: 'contract-generator-intel.datacore.csv', sourceDir: 'datacore' },
    { file: 'mission-contract-intel.datacore.csv', sourceDir: 'datacore' },
    { file: 'contract-hauling-summary.datacore.csv', sourceDir: 'datacore', optional: true },
    { file: 'contract-generators.datacore.csv', sourceDir: 'datacore' },
    { file: 'blueprint-pools.datacore.csv', sourceDir: 'datacore' },
    { file: 'crafting-blueprints.datacore.csv', sourceDir: 'datacore' },
  ],
  loadSourceData: loadDatacoreDescriptionsSourceData,
  requiredColumns: ['Localization Key'],
  noInsert: true,
  descKeyMatch: (key) => /_desc|_description/i.test(key),
  getTargetKeys(row) {
    const key = row['Localization Key'] ?? '';
    return key ? [key] : [];
  },
  buildValue(row, _flavorText, oldValue, _targetKey) {
    const description = row['Description'] ?? row['Text'] ?? '';
    const baseValue = oldValue ? stripAppendedMetadata(oldValue) : description;

    return `${baseValue}${buildMetadata(row)}`;
  },
} satisfies ItemConfig;
