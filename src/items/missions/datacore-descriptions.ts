import path from 'node:path';
import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { readIniFile } from '../../localization/ini-file';
import { loadDataCoreRecordGraph } from '../../sources/datacore/record-graph-loader';

const logger = getLogger('datacore-descriptions-config');

const GENERATED_SECTION_START_PATTERN =
  /\\n\\n(?:<EM4>Reputation Awarded(?: \(by difficulty\))?:<\/EM4>|<EM4>Potential Blueprints<\/EM4>|\*\* Contract Intel \*\*|\*\* Encounter \*\*|\*\* Hauling \*\*|Cooldown: [^\\]+|\[BP Reward\]|\[BP Chain\]|\[Item Reward\])/;

interface BlueprintDescriptionFacts {
  totalContractIds: Set<string>;
  rewardContractIds: Set<string>;
  rewardDebugNames: Set<string>;
  nonRewardDebugNames: Set<string>;
  rewardLines: Set<string>;
}

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

function removeInGameRewardIntelLines(value: string): string {
  return splitIntelLines(value)
    .filter((line) => !/^Reward:\s+/i.test(line.trim()))
    .join(String.raw`\n`);
}

function splitIntelLines(value: string): string[] {
  return value
    .split(/\\n|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildMetadata(row: Record<string, string>): string {
  const noteText = getCell(row, 'Note');

  return [
    formatNamedSection('Contract Intel', removeInGameRewardIntelLines(getCell(row, 'ContractIntel'))),
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
  const localizationValues = await loadLocalizationValues(datacoreDir);
  const recordGraph = await loadRecordGraph(datacoreDir);
  const blueprintByGuid = new Map<string, string>();
  for (const row of craftingBlueprints) {
    const guid = row['Ref'];
    const name = resolveBlueprintDisplayName(row, localizationValues, recordGraph);
    if (guid && name) {
      blueprintByGuid.set(guid, name);
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
          parsed.map((p) => ({ weight: p.weight, nameKey: blueprintByGuid.get(p.guid) || 'Unknown Blueprint' })),
        );
      } catch {}
    }
  }

  // 5. Build Blueprint Rewards strings, preserving shared-string caveats.
  const blueprintFactsByDescriptionKey = new Map<string, BlueprintDescriptionFacts>();
  for (const row of generators) {
    const descriptionKeys = getDescriptionKeys(row);
    if (descriptionKeys.length === 0) continue;

    const contractId = row['Contract ID'] || row['Contract Debug Name'] || row['Record GUID'] || JSON.stringify(row);
    const debugName = row['Contract Debug Name'] || contractId;
    const rewardLines = resolveBlueprintRewardLines(row['Blueprint Reward Pool Guids'], poolByGuid);

    for (const key of descriptionKeys) {
      const facts = getOrCreateBlueprintFacts(blueprintFactsByDescriptionKey, key);
      facts.totalContractIds.add(contractId);
      if (rewardLines.length > 0) {
        facts.rewardContractIds.add(contractId);
        facts.rewardDebugNames.add(debugName);
        for (const line of rewardLines) facts.rewardLines.add(line);
      } else {
        facts.nonRewardDebugNames.add(debugName);
      }
    }
  }

  for (const [key, facts] of blueprintFactsByDescriptionKey) {
    if (facts.rewardLines.size === 0) continue;
    const caveat =
      facts.rewardContractIds.size < facts.totalContractIds.size
        ? String.raw`\n<EM4>Applies only to ${describeBlueprintVariantScope(facts)}</EM4>`
        : '';
    const dest = getOrCreateRow(key);
    dest['RewardList'] = String.raw`<EM4>Potential Blueprints</EM4>${caveat}\n${[...facts.rewardLines].join(String.raw`\n`)}`;
  }

  return [...merged.values()];
}

function getDescriptionKeys(row: Record<string, string>): string[] {
  return [
    row['Description Key'],
    ...String(row['Description Variant Keys'] ?? '')
      .split('|')
      .map((key) => key.trim()),
  ]
    .map((key) => key.replace(/^@/, '').trim())
    .filter((key, index, keys) => key && keys.indexOf(key) === index);
}

function getOrCreateBlueprintFacts(
  factsByDescriptionKey: Map<string, BlueprintDescriptionFacts>,
  key: string,
): BlueprintDescriptionFacts {
  let facts = factsByDescriptionKey.get(key);
  if (!facts) {
    facts = {
      totalContractIds: new Set<string>(),
      rewardContractIds: new Set<string>(),
      rewardDebugNames: new Set<string>(),
      nonRewardDebugNames: new Set<string>(),
      rewardLines: new Set<string>(),
    };
    factsByDescriptionKey.set(key, facts);
  }
  return facts;
}

function resolveBlueprintRewardLines(
  poolGuidsStr: string,
  poolByGuid: Map<string, { weight: number; nameKey: string }[]>,
): string[] {
  const rewardLines = new Set<string>();
  for (const poolGuid of poolGuidsStr.split(',').map((guid) => guid.trim()).filter(Boolean)) {
      const poolEntries = poolByGuid.get(poolGuid);
      if (!poolEntries || poolEntries.length === 0) continue;

      const totalWeight = poolEntries.reduce((sum, e) => sum + e.weight, 0);
      for (const entry of poolEntries) {
        const percentage = totalWeight > 0 ? Math.round((entry.weight / totalWeight) * 100) : 0;
        const suffix = percentage > 0 ? ` (${percentage}%)` : '';
      rewardLines.add(`- ${entry.nameKey}${suffix}`);
      }
    }
  return [...rewardLines];
}

function describeBlueprintVariantScope(facts: BlueprintDescriptionFacts): string {
  const distinguishingTokens = findDistinguishingTokens(facts.rewardDebugNames, facts.nonRewardDebugNames);
  if (distinguishingTokens.length > 0) {
    return `variants containing: ${distinguishingTokens.slice(0, 3).join(', ')}`;
  }

  const examples = [...facts.rewardDebugNames].slice(0, 3);
  const suffix = facts.rewardDebugNames.size > examples.length ? ', ...' : '';
  return `${facts.rewardContractIds.size} of ${facts.totalContractIds.size} DataCore variants${examples.length ? `: ${examples.join(', ')}${suffix}` : ''}`;
}

function findDistinguishingTokens(rewardDebugNames: Set<string>, nonRewardDebugNames: Set<string>): string[] {
  const rewardNames = [...rewardDebugNames];
  const nonRewardTokens = new Set([...nonRewardDebugNames].flatMap(tokenizeDebugName));
  if (rewardNames.length === 0) return [];

  const [first, ...rest] = rewardNames.map((name) => new Set(tokenizeDebugName(name)));
  return [...first]
    .filter((token) => rest.every((tokens) => tokens.has(token)) && !nonRewardTokens.has(token))
    .filter((token) => !isLowValueDebugToken(token))
    .sort(compareDebugScopeTokens);
}

function tokenizeDebugName(value: string): string[] {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isLowValueDebugToken(token: string): boolean {
  return /^(contract|contracts|generator|mission|intro|easy|medium|hard|veryeasy|veryhard|super)$/i.test(token);
}

function compareDebugScopeTokens(a: string, b: string): number {
  return tokenScore(b) - tokenScore(a) || a.length - b.length || a.localeCompare(b);
}

function tokenScore(token: string): number {
  if (/^[A-Z0-9]{2,6}$/.test(token)) return 3;
  if (/^(Stanton|Pyro|Nyx|Hurston|Crusader|ArcCorp|MicroTech)$/i.test(token)) return 2;
  return 1;
}

async function loadRecordGraph(datacoreDir: string) {
  try {
    return await loadDataCoreRecordGraph({ versionDir: datacoreDir });
  } catch (err) {
    logger.warn('Failed to read DataCore record graph for blueprint reward names', { err: String(err) });
    return null;
  }
}

async function loadLocalizationValues(datacoreDir: string): Promise<Map<string, string>> {
  const iniPath = path.resolve(datacoreDir, '..', '..', '..', 'global.ini');
  const values = new Map<string, string>();
  try {
    const { lines } = await readIniFile(iniPath);
    for (const line of lines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      values.set(line.slice(0, eqIdx).toLowerCase(), stripLeadingTitleTag(line.slice(eqIdx + 1)));
    }
  } catch (err) {
    logger.info('Unable to read global.ini for blueprint reward display names', { iniPath, err: String(err) });
  }
  return values;
}

function resolveBlueprintDisplayName(
  row: Record<string, string>,
  localizationValues: Map<string, string>,
  recordGraph: Awaited<ReturnType<typeof loadDataCoreRecordGraph>> | null,
): string {
  const targetKey = resolveBlueprintTargetNameKey(row, recordGraph);
  if (targetKey) {
    return localizationValues.get(targetKey.toLowerCase()) ?? `@${targetKey}`;
  }

  return row['TargetEntityClass'] || row['BlueprintClass'] || '';
}

function resolveBlueprintTargetNameKey(
  row: Record<string, string>,
  recordGraph: Awaited<ReturnType<typeof loadDataCoreRecordGraph>> | null,
): string {
  const csvKey = row['TargetItemNameKey'];
  if (csvKey && !/^LOC_/i.test(csvKey)) return csvKey;

  const targetRef = row['TargetEntityClassGuid'];
  const targetClass = row['TargetEntityClass'];
  const targetRecord = targetRef
    ? recordGraph?.getByRef(targetRef)
    : targetClass
      ? recordGraph?.getByRef(targetClass)
      : undefined;
  const graphKey =
    targetRecord?.localizationKeys.find((l) => /(^|_)name/i.test(l.key) && !/^LOC_/i.test(l.key))?.key ??
    targetRecord?.localizationKeys.find((l) => !/^LOC_/i.test(l.key))?.key ??
    '';
  if (graphKey) return graphKey;

  if (targetClass && !isGuid(targetClass)) {
    const classRecord = recordGraph?.getByEntityClass(targetClass)[0];
    return (
      classRecord?.localizationKeys.find((l) => /(^|_)name/i.test(l.key) && !/^LOC_/i.test(l.key))?.key ??
      classRecord?.localizationKeys.find((l) => !/^LOC_/i.test(l.key))?.key ??
      ''
    );
  }

  return '';
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function stripLeadingTitleTag(value: string): string {
  return value
    .replace(/^\[[A-Z0-9| ]+\]\s+/i, '')
    .replace(/^[^/\s]+\/[^/\s]*\/[^ ]*\s+/u, '')
    .trim();
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
