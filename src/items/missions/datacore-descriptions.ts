import fs from 'node:fs/promises';
import path from 'node:path';
import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { readIniFile } from '../../localization/ini-file';
import { loadDataCoreRecordGraph } from '../../sources/datacore/record-graph-loader';
import { loadXml } from '../../sources/datacore/xml-parser';

const logger = getLogger('datacore-descriptions-config');

const GENERATED_SECTION_START_PATTERN =
  /\\n\\n(?:<EM4>Reputation Awarded(?: \(by difficulty\))?:<\/EM4>|<EM4>Potential Blueprints<\/EM4>|\*\* Contract Intel \*\*|\*\* Encounter \*\*|\*\* Hauling \*\*|Cooldown: [^\\]+|\[BP Reward\]|\[BP Chain\]|\[Item Reward\])/;

interface BlueprintDescriptionFacts {
  totalContractIds: Set<string>;
  rewardContractIds: Set<string>;
  rewardDebugNames: Set<string>;
  nonRewardDebugNames: Set<string>;
  rewardStandingLabels: Set<string>;
  rewardLines: Set<string>;
}

interface DescriptionKeyResolution {
  keys: string[];
  usedTemplateFallback: boolean;
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

function extractReputationIntelLine(value: string): string {
  const reputationLines = splitIntelLines(value).filter((line) => /^Reputation Awarded/i.test(line));
  if (reputationLines.length === 0) return '';
  return [...new Set(reputationLines.map(formatReputationLine))].join(String.raw`\n`);
}

function removeReputationIntelLines(value: string): string {
  return splitIntelLines(value)
    .filter((line) => !/^Reputation Awarded/i.test(line))
    .join(String.raw`\n`);
}

function formatReputationLine(line: string): string {
  const match = /^(Reputation Awarded(?: \(by difficulty\))?):\s*(.+)$/i.exec(line.trim());
  if (!match) return line.trim();
  return `<EM4>${match[1]}:</EM4> ${match[2].trim()}`;
}

function splitIntelLines(value: string): string[] {
  return value
    .split(/\\n|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildMetadata(row: Record<string, string>): string {
  const noteText = getCell(row, 'Note');
  const contractIntel = removeReputationIntelLines(removeInGameRewardIntelLines(getCell(row, 'ContractIntel')));
  const reputationIntel = extractReputationIntelLine(getCell(row, 'ContractIntel'));

  return [
    appendParagraph(reputationIntel),
    formatNamedSection('Contract Intel', contractIntel),
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
  const templatesPath = resolveChildPath(datacoreDir, 'contract-templates.datacore.csv', 'templates csv');
  const poolsPath = resolveChildPath(datacoreDir, 'blueprint-pools.datacore.csv', 'pools csv');
  const blueprintsPath = resolveChildPath(datacoreDir, 'crafting-blueprints.datacore.csv', 'blueprints csv');

  const scmdbDir = context.sourceDirs?.scmdb;
  const memaPath = scmdbDir ? resolveChildPath(scmdbDir, 'scmdb-mema.csv', 'mema csv') : '';

  let generatorIntel: Record<string, string>[] = [];
  let missionIntel: Record<string, string>[] = [];
  let haulingSummary: Record<string, string>[] = [];
  let generators: Record<string, string>[] = [];
  let templates: Record<string, string>[] = [];
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
    templates = await readCsvFile(templatesPath);
  } catch (err) {
    logger.warn('Failed to read contract-templates.datacore.csv', { err: String(err) });
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
  const xmlCacheDir = await resolveXmlCacheDir(datacoreDir);
  const templateDescriptionKeysByGuid = await loadTemplateDescriptionKeysByGuid(templates, xmlCacheDir);
  const standingLabelCache = new Map<string, string>();
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
  const repeatBlueprintListsByDescriptionKey = new Map<string, string>();
  for (const row of generators) {
    const descriptionKeyResolution = getDescriptionKeys(row, templateDescriptionKeysByGuid);
    const { keys: descriptionKeys } = descriptionKeyResolution;
    if (descriptionKeys.length === 0) continue;

    const contractId = row['Contract ID'] || row['Contract Debug Name'] || row['Record GUID'] || JSON.stringify(row);
    const debugName = row['Contract Debug Name'] || contractId;
    const poolGuids = getBlueprintRewardPoolGuids(row);
    const repeatBlueprintList = shouldUseRepeatOnlyMultiPoolBlock(row, descriptionKeyResolution, poolGuids)
      ? formatRepeatOnlyMultiPoolBlueprintList(poolGuids, poolByGuid)
      : '';
    const rewardLines = repeatBlueprintList ? [] : resolveBlueprintRewardLines(poolGuids, poolByGuid);

    if (repeatBlueprintList) {
      for (const key of descriptionKeys) {
        repeatBlueprintListsByDescriptionKey.set(key, repeatBlueprintList);
      }
      continue;
    }

    for (const key of descriptionKeys) {
      const facts = getOrCreateBlueprintFacts(blueprintFactsByDescriptionKey, key);
      facts.totalContractIds.add(contractId);
      if (rewardLines.length > 0) {
        facts.rewardContractIds.add(contractId);
        facts.rewardDebugNames.add(debugName);
        const standingLabel = await resolveContractStandingLabel(
          row,
          xmlCacheDir,
          localizationValues,
          recordGraph,
          standingLabelCache,
        );
        if (standingLabel) facts.rewardStandingLabels.add(standingLabel);
        for (const line of rewardLines) facts.rewardLines.add(line);
      } else {
        facts.nonRewardDebugNames.add(debugName);
      }
    }
  }

  for (const [key, facts] of blueprintFactsByDescriptionKey) {
    if (facts.rewardLines.size === 0) continue;
    const caveat = formatBlueprintCaveat(facts);
    const dest = getOrCreateRow(key);
    dest['RewardList'] =
      String.raw`<EM4>Potential Blueprints</EM4>${caveat}\n${[...facts.rewardLines].join(String.raw`\n`)}`;
  }

  for (const [key, rewardList] of repeatBlueprintListsByDescriptionKey) {
    const dest = getOrCreateRow(key);
    dest['RewardList'] = rewardList;
  }

  return [...merged.values()];
}

function getDescriptionKeys(
  row: Record<string, string>,
  templateDescriptionKeysByGuid: Map<string, string[]>,
): DescriptionKeyResolution {
  const directKeys = [
    row['Description Key'],
    ...String(row['Description Variant Keys'] ?? '')
      .split('|')
      .map((key) => key.trim()),
  ]
    .map((key) => key.replace(/^@/, '').trim())
    .filter((key, index, keys) => isUsableLocalizationKey(key) && keys.indexOf(key) === index);
  if (directKeys.length > 0) return { keys: directKeys, usedTemplateFallback: false };

  const templateGuid = row['Template GUID'] || row['Template Guid'] || row['Template Ref'];
  const templateKeys = templateGuid ? (templateDescriptionKeysByGuid.get(templateGuid) ?? []) : [];
  return { keys: templateKeys, usedTemplateFallback: templateKeys.length > 0 };
}

function isUsableLocalizationKey(key: string): boolean {
  return key.length > 0 && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(key);
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
      rewardStandingLabels: new Set<string>(),
      rewardLines: new Set<string>(),
    };
    factsByDescriptionKey.set(key, facts);
  }
  return facts;
}

function resolveBlueprintRewardLines(
  poolGuids: string[],
  poolByGuid: Map<string, { weight: number; nameKey: string }[]>,
): string[] {
  const rewardLines = new Set<string>();
  for (const poolGuid of poolGuids) {
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

function getBlueprintRewardPoolGuids(row: Record<string, string>): string[] {
  const parsedRewards = parseBlueprintRewards(row['Blueprint Rewards']);
  if (parsedRewards.length > 0) return uniqueOrderedStrings(parsedRewards.map((reward) => reward.blueprintPool));
  return parseGuidList(row['Blueprint Reward Pool Guids']);
}

function parseBlueprintRewards(value: string): Array<{ blueprintPool: string }> {
  try {
    const parsed = JSON.parse(value.trim());
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): Array<{ blueprintPool: string }> => {
      if (!entry || typeof entry !== 'object') return [];
      const blueprintPool = String((entry as { blueprintPool?: unknown }).blueprintPool ?? '').trim();
      return blueprintPool ? [{ blueprintPool }] : [];
    });
  } catch {
    return [];
  }
}

function shouldUseRepeatOnlyMultiPoolBlock(
  row: Record<string, string>,
  descriptionKeyResolution: DescriptionKeyResolution,
  poolGuids: string[],
): boolean {
  if (!descriptionKeyResolution.usedTemplateFallback || poolGuids.length < 2) return false;
  return hasContractPrerequisiteTags(row);
}

function hasContractPrerequisiteTags(row: Record<string, string>): boolean {
  return parseGuidList(row['Required Completed Contract Tags']).length > 0;
}

function formatRepeatOnlyMultiPoolBlueprintList(
  poolGuids: string[],
  poolByGuid: Map<string, { weight: number; nameKey: string }[]>,
): string {
  const poolBlocks = poolGuids
    .map((poolGuid, index) => {
      const lines = resolveBlueprintPoolLines(poolGuid, poolByGuid);
      if (lines.length === 0) return '';
      return `<EM4>Pool ${index + 1}</EM4>${String.raw`\n`}${lines.join(String.raw`\n`)}`;
    })
    .filter(Boolean);

  if (poolBlocks.length === 0) return '';
  return `<EM4>Multiple Blueprint Pools (Repeat Only)</EM4>${String.raw`\n`}${poolBlocks.join(String.raw`\n\n`)}`;
}

function resolveBlueprintPoolLines(
  poolGuid: string,
  poolByGuid: Map<string, { weight: number; nameKey: string }[]>,
): string[] {
  const poolEntries = poolByGuid.get(poolGuid);
  if (!poolEntries || poolEntries.length === 0) return [];
  return poolEntries.map((entry) => `- ${entry.nameKey}`);
}

function parseGuidList(value: string): string[] {
  return value
    .split(',')
    .map((guid) => guid.trim())
    .filter(Boolean);
}

function formatBlueprintCaveat(facts: BlueprintDescriptionFacts): string {
  const lines: string[] = [];
  const standingText = formatRewardStandingText(facts.rewardStandingLabels);
  if (standingText) lines.push(standingText);
  if (facts.rewardContractIds.size < facts.totalContractIds.size) {
    lines.push(`Applies only to ${describeBlueprintVariantScope(facts)}`);
  }
  return lines.map((line) => String.raw`\n<EM4>${line}</EM4>`).join('');
}

function formatRewardStandingText(labels: Set<string>): string {
  const sorted = [...labels].sort(compareStandingLabels);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `Awarded from ${sorted[0]} level variants`;
  return `Awarded from ${sorted.join(' / ')} level variants`;
}

function compareStandingLabels(a: string, b: string): number {
  return standingLabelRank(a) - standingLabelRank(b) || a.localeCompare(b);
}

function standingLabelRank(label: string): number {
  const normalized = label.toLowerCase();
  if (normalized === 'applicant') return 0;
  if (normalized === 'jr. contractor') return 1;
  if (normalized === 'contractor') return 2;
  if (normalized === 'sr. contractor') return 3;
  if (normalized === 'veteran contractor') return 4;
  if (normalized === 'head contractor') return 5;
  if (normalized === 'elite contractor') return 6;
  return 99;
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

async function resolveContractStandingLabel(
  row: Record<string, string>,
  xmlCacheDir: string | null,
  localizationValues: Map<string, string>,
  recordGraph: Awaited<ReturnType<typeof loadDataCoreRecordGraph>> | null,
  cache: Map<string, string>,
): Promise<string> {
  const cacheKey = `${row['Record Path'] ?? ''}\0${row['Contract ID'] ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const explicitKey = row['Min Standing Name Key'] || row['MinStandingNameKey'];
  const explicitGuid = row['Min Standing GUID'] || row['MinStandingGuid'];
  const standingGuid = explicitGuid || (await readContractMinStandingGuid(row, xmlCacheDir));

  if (standingGuid) {
    const standingRecord = recordGraph?.getByRef(standingGuid);
    const standingKey =
      standingRecord?.localizationKeys.find(
        (l) => /displayname|name/i.test(l.attribute) && isUsableGraphLocalizationKey(l.key),
      )?.key ??
      standingRecord?.localizationKeys.find((l) => isUsableGraphLocalizationKey(l.key))?.key ??
      '';
    if (standingKey) {
      const label = resolveLocalizedValue(standingKey, localizationValues) || inferStandingLabel(standingKey);
      cache.set(cacheKey, label);
      return label;
    }

    const inferredLabel = inferStandingLabel(standingRecord?.entityClass ?? standingGuid);
    if (inferredLabel) {
      cache.set(cacheKey, inferredLabel);
      return inferredLabel;
    }
  }

  if (explicitKey) {
    const label = resolveLocalizedValue(explicitKey, localizationValues) || explicitKey;
    cache.set(cacheKey, label);
    return label;
  }

  cache.set(cacheKey, '');
  return '';
}

async function readContractMinStandingGuid(row: Record<string, string>, xmlCacheDir: string | null): Promise<string> {
  const recordPath = row['Record Path'];
  const contractId = row['Contract ID'];
  if (!xmlCacheDir || !recordPath || !contractId) return '';

  try {
    const xml = await fs.readFile(resolveChildPath(xmlCacheDir, recordPath, 'DataCore ContractGenerator XML path'), 'utf8');
    const $ = loadXml(xml);
    return $(`[id="${contractId}"]`).first().attr('minStanding') ?? '';
  } catch {
    return '';
  }
}

async function resolveXmlCacheDir(datacoreDir: string): Promise<string | null> {
  const version = path.basename(datacoreDir);
  const candidates = [path.join(path.dirname(datacoreDir), '.xmlcache', version), path.join(datacoreDir, '.xmlcache')];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

async function loadTemplateDescriptionKeysByGuid(
  templates: Record<string, string>[],
  xmlCacheDir: string | null,
): Promise<Map<string, string[]>> {
  const keysByGuid = new Map<string, string[]>();
  for (const row of templates) {
    const guid = row['Record GUID'];
    if (!guid) continue;

    const csvKeys = parseTemplateDescriptionKeys(row);
    if (csvKeys.length > 0) {
      keysByGuid.set(guid, csvKeys);
      continue;
    }

    const xmlKeys = await readTemplateDisplayDescriptionKeys(row, xmlCacheDir);
    if (xmlKeys.length > 0) keysByGuid.set(guid, xmlKeys);
  }
  return keysByGuid;
}

function parseTemplateDescriptionKeys(row: Record<string, string>): string[] {
  return uniqueOrderedStrings(
    [row['Display Description Keys'], row['Description Keys'], row['Contract Description Keys']]
      .flatMap((value) => String(value ?? '').split('|'))
      .map(normalizeLocalizationKey)
      .filter(Boolean),
  );
}

async function readTemplateDisplayDescriptionKeys(
  row: Record<string, string>,
  xmlCacheDir: string | null,
): Promise<string[]> {
  const recordPath = row['Record Path'];
  if (!xmlCacheDir || !recordPath) return [];

  try {
    const xml = await fs.readFile(resolveChildPath(xmlCacheDir, recordPath, 'DataCore ContractTemplate XML path'), 'utf8');
    const $ = loadXml(xml);
    const locIds = $('contractDisplayInfo ContractDisplayInfo > displayString > LocID[value]')
      .map((_, element) => normalizeLocalizationKey($(element).attr('value') ?? ''))
      .get()
      .filter(Boolean);
    const descriptionKeys = locIds.filter((key) => /(?:^|_)desc(?:ription)?(?:_|$)/i.test(key));
    return uniqueOrderedStrings(descriptionKeys);
  } catch {
    return [];
  }
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '@LOC_EMPTY' || trimmed === '@LOC_UNINITIALIZED') return '';
  return trimmed.replace(/^@/, '');
}

function isUsableGraphLocalizationKey(value: string): boolean {
  const key = normalizeLocalizationKey(value);
  return !!key && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(key);
}

function uniqueOrderedStrings(values: string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function resolveLocalizedValue(key: string, localizationValues: Map<string, string>): string {
  const normalized = key.replace(/^@/, '');
  return localizationValues.get(normalized.toLowerCase()) ?? '';
}

function inferStandingLabel(value: string): string {
  const match = /Rank([0-6])/i.exec(value);
  if (!match) return '';
  return (
    [
      'Applicant',
      'Jr. Contractor',
      'Contractor',
      'Sr. Contractor',
      'Veteran Contractor',
      'Head Contractor',
      'Elite Contractor',
    ][Number(match[1])] ?? ''
  );
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
  const targetRecord = resolveBlueprintTargetRecord(row, recordGraph);
  const targetKey = resolveBlueprintTargetNameKey(row, recordGraph, targetRecord);
  let name = '';
  if (targetKey) {
    name = localizationValues.get(targetKey.toLowerCase()) ?? `@${targetKey}`;
  } else {
    name = row['TargetEntityClass'] || row['BlueprintClass'] || '';
  }

  return appendBlueprintDisplayType(name, targetRecord);
}

function resolveBlueprintTargetNameKey(
  row: Record<string, string>,
  recordGraph: Awaited<ReturnType<typeof loadDataCoreRecordGraph>> | null,
  resolvedTargetRecord?: ReturnType<Awaited<ReturnType<typeof loadDataCoreRecordGraph>>['getByRef']>,
): string {
  const targetRecord = resolvedTargetRecord ?? resolveBlueprintTargetRecord(row, recordGraph);
  const graphKey =
    targetRecord?.localizationKeys.find((l) => /(^|_)name/i.test(l.key) && isUsableGraphLocalizationKey(l.key))?.key ??
    targetRecord?.localizationKeys.find((l) => isUsableGraphLocalizationKey(l.key))?.key ??
    '';
  if (graphKey) return graphKey;

  const csvKey = row['TargetItemNameKey'];
  if (csvKey && isUsableGraphLocalizationKey(csvKey)) return csvKey;

  const targetClass = row['TargetEntityClass'];
  if (targetClass && !isGuid(targetClass)) {
    const classRecord = recordGraph?.getByEntityClass(targetClass)[0];
    return (
      classRecord?.localizationKeys.find((l) => /(^|_)name/i.test(l.key) && isUsableGraphLocalizationKey(l.key))?.key ??
      classRecord?.localizationKeys.find((l) => isUsableGraphLocalizationKey(l.key))?.key ??
      ''
    );
  }

  return '';
}

function resolveBlueprintTargetRecord(
  row: Record<string, string>,
  recordGraph: Awaited<ReturnType<typeof loadDataCoreRecordGraph>> | null,
) {
  const targetRef = row['TargetEntityClassGuid'];
  const targetClass = row['TargetEntityClass'];
  return targetRef
    ? recordGraph?.getByRef(targetRef)
    : targetClass
      ? recordGraph?.getByRef(targetClass) ?? recordGraph?.getByEntityClass(targetClass)[0]
      : undefined;
}

function appendBlueprintDisplayType(
  name: string,
  targetRecord: ReturnType<Awaited<ReturnType<typeof loadDataCoreRecordGraph>>['getByRef']>,
): string {
  if (!name || /\([^)]+\)$/.test(name)) return name;
  const type = inferBlueprintDisplayType(targetRecord);
  return type ? `${name} (${type})` : name;
}

function inferBlueprintDisplayType(
  targetRecord: ReturnType<Awaited<ReturnType<typeof loadDataCoreRecordGraph>>['getByRef']>,
): string {
  const pathValue = targetRecord?.path.toLowerCase() ?? '';
  if (!pathValue.includes('/entities/scitem/ships/')) return '';
  if (pathValue.includes('/powerplant/')) return 'Powerplant';
  if (pathValue.includes('/cooler/')) return 'Cooler';
  if (pathValue.includes('/shield/')) return 'Shield';
  if (pathValue.includes('/radar/')) return 'Radar';
  if (pathValue.includes('/quantumdrive/')) return 'Quantum Drive';
  if (pathValue.includes('/jumpdrive/')) return 'Jump Drive';
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
    { file: 'contract-templates.datacore.csv', sourceDir: 'datacore', optional: true },
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
