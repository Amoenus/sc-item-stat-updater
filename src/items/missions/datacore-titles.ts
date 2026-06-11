import fs from 'node:fs/promises';
import path from 'node:path';
import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { IniTag } from '../../localization/ini-tags';
import { loadXml } from '../../sources/datacore/xml-parser';

const logger = getLogger('datacore-titles-config');

interface DatacoreTitleRow {
  'Localization Key': string;
  Description: string;
  TitleNote: string;
}

interface DataCoreMissionTitleContract {
  id: string;
  titleKeys: string[];
  isIntro: boolean;
  blueprintRewardPoolGuids: string[];
  requiredCompletedContractTags: string[];
  completionTags: string[];
}

interface MissionTitleState {
  intro: boolean;
  total: number;
  blueprint: number;
  chain: number;
}

export async function loadDatacoreTitlesSourceData(context: ItemSourceDataContext): Promise<Record<string, string>[]> {
  const datacoreDir = context.sourceDirs?.datacore;
  if (!datacoreDir) return [];

  const generatorsCsvPath = resolveChildPath(datacoreDir, 'contract-generators.datacore.csv', 'generators csv');
  let generators: Record<string, string>[] = [];
  try {
    generators = await readCsvFile(generatorsCsvPath);
  } catch (err) {
    logger.warn('Failed to read contract-generators.datacore.csv', { err: String(err) });
    return [];
  }

  const contracts = await buildTitleContracts(generators, datacoreDir);
  const titleNotesByKey = buildTitleNotesByKey(contracts);
  const resultRows: DatacoreTitleRow[] = [];

  for (const [key, titleNote] of titleNotesByKey) {
    resultRows.push({
      'Localization Key': key,
      Description: '',
      TitleNote: titleNote,
    });
  }

  return resultRows as unknown as Record<string, string>[];
}

async function buildTitleContracts(
  rows: Record<string, string>[],
  datacoreDir: string,
): Promise<DataCoreMissionTitleContract[]> {
  const xmlCacheDir = await resolveXmlCacheDir(datacoreDir);
  const xmlCache = new Map<string, ReturnType<typeof loadXml> | null>();
  const contracts: DataCoreMissionTitleContract[] = [];

  for (const row of rows) {
    const xmlFacts = await readContractXmlMissionTagFacts(row, xmlCacheDir, xmlCache);
    const titleKeys = getTitleKeys(row);
    if (titleKeys.length === 0) continue;

    contracts.push({
      id: normalizeToken(row['Contract ID']),
      titleKeys,
      isIntro:
        row['Contract Section'] === 'introContracts' || row['Contract Debug Name']?.toLowerCase().includes('intro'),
      blueprintRewardPoolGuids: splitTokenList(row['Blueprint Reward Pool Guids'] || xmlFacts.blueprintRewardPoolGuids),
      requiredCompletedContractTags: splitTokenList(
        row['Required Completed Contract Tags'] || xmlFacts.requiredCompletedContractTags,
      ),
      completionTags: splitTokenList(row['Completion Tags'] || xmlFacts.completionTags),
    });
  }

  return contracts;
}

function buildTitleNotesByKey(contracts: DataCoreMissionTitleContract[]): Map<string, string> {
  const blueprintDepths = collectBlueprintDepths(contracts);
  const titleStates = new Map<string, MissionTitleState>();
  const seen = new Set<string>();

  for (const contract of contracts) {
    const depth = blueprintDepths.get(contract.id);
    for (const key of contract.titleKeys) {
      const seenKey = `${key}\0${contract.id}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      const state = titleStates.get(key) ?? { intro: false, total: 0, blueprint: 0, chain: 0 };
      state.intro ||= contract.isIntro;
      state.total += 1;
      if (depth === 0) state.blueprint += 1;
      if (depth !== undefined && depth > 0) state.chain += 1;
      titleStates.set(key, state);
    }
  }

  const rows = new Map<string, string>();
  for (const [key, state] of titleStates) {
    rows.set(key, titleNoteForState(state));
  }
  return rows;
}

function collectBlueprintDepths(contracts: DataCoreMissionTitleContract[]): Map<string, number> {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const providersByTag = new Map<string, string[]>();
  const depths = new Map<string, number>();
  const queue: Array<{ contractId: string; depth: number }> = [];

  for (const contract of contracts) {
    for (const tag of contract.completionTags) {
      const providers = providersByTag.get(tag) ?? [];
      providers.push(contract.id);
      providersByTag.set(tag, providers);
    }
  }

  for (const contract of contracts) {
    if (contract.blueprintRewardPoolGuids.length === 0) continue;
    depths.set(contract.id, 0);
    for (const tag of contract.requiredCompletedContractTags) {
      for (const providerId of providersByTag.get(tag) ?? []) {
        queue.push({ contractId: providerId, depth: 1 });
      }
    }
  }

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const currentDepth = depths.get(item.contractId);
    if (currentDepth !== undefined && currentDepth <= item.depth) continue;
    depths.set(item.contractId, item.depth);

    const contract = contractById.get(item.contractId);
    if (!contract) continue;
    for (const tag of contract.requiredCompletedContractTags) {
      for (const providerId of providersByTag.get(tag) ?? []) {
        if (providerId !== item.contractId) {
          queue.push({ contractId: providerId, depth: item.depth + 1 });
        }
      }
    }
  }

  return depths;
}

function titleNoteForState(state: MissionTitleState): string {
  if (state.intro) return ` ${IniTag.EM4.wrap('[Intro]')}`;
  if (state.blueprint > 0) return ` ${IniTag.EM4.wrap(state.blueprint < state.total ? '[BP]*' : '[BP]')}`;
  if (state.chain > 0) return ` ${IniTag.EM4.wrap(state.chain < state.total ? '[BP Chain]*' : '[BP Chain]')}`;
  return '';
}

function getTitleKeys(row: Record<string, string>): string[] {
  const keys = new Set<string>();
  const titleKey = normalizeToken(row['Title Key']);
  if (titleKey) keys.add(titleKey);
  for (const variant of splitTokenList(row['Title Variant Keys'], '|')) {
    keys.add(variant);
  }
  return [...keys];
}

async function readContractXmlMissionTagFacts(
  row: Record<string, string>,
  xmlCacheDir: string | null,
  xmlCache: Map<string, ReturnType<typeof loadXml> | null>,
): Promise<{
  blueprintRewardPoolGuids: string;
  requiredCompletedContractTags: string;
  completionTags: string;
}> {
  const empty = { blueprintRewardPoolGuids: '', requiredCompletedContractTags: '', completionTags: '' };
  const recordPath = normalizeToken(row['Record Path']);
  const contractId = normalizeToken(row['Contract ID']);
  if (!xmlCacheDir || !recordPath || !contractId) return empty;

  const $ = await loadCachedXml(xmlCacheDir, recordPath, xmlCache);
  if (!$) return empty;

  const contract = $(`[id="${contractId}"]`).first();
  if (contract.length === 0) return empty;

  return {
    blueprintRewardPoolGuids: contract
      .find('BlueprintRewards[blueprintPool]')
      .map((_, element) => $(element).attr('blueprintPool'))
      .get()
      .filter(Boolean)
      .join(','),
    requiredCompletedContractTags: contract
      .find('ContractPrerequisite_CompletedContractTags requiredCompletedContractTags Reference[value]')
      .map((_, element) => $(element).attr('value'))
      .get()
      .filter(Boolean)
      .join(','),
    completionTags: contract
      .find('ContractResult_CompletionTags completionTags ContractResult_CompletionTag[tag]')
      .map((_, element) => $(element).attr('tag'))
      .get()
      .filter(Boolean)
      .join(','),
  };
}

async function loadCachedXml(
  xmlCacheDir: string,
  recordPath: string,
  xmlCache: Map<string, ReturnType<typeof loadXml> | null>,
): Promise<ReturnType<typeof loadXml> | null> {
  if (xmlCache.has(recordPath)) {
    return xmlCache.get(recordPath) ?? null;
  }

  try {
    const xml = await fs.readFile(resolveChildPath(xmlCacheDir, recordPath, 'DataCore ContractGenerator XML path'), 'utf8');
    const loaded = loadXml(xml);
    xmlCache.set(recordPath, loaded);
    return loaded;
  } catch {
    xmlCache.set(recordPath, null);
    return null;
  }
}

async function resolveXmlCacheDir(datacoreDir: string): Promise<string | null> {
  const version = path.basename(datacoreDir);
  const candidates = [
    path.join(path.dirname(datacoreDir), '.xmlcache', version),
    path.join(datacoreDir, '.xmlcache'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
    }
  }

  return null;
}

function splitTokenList(value: unknown, delimiter: string | RegExp = /[,|]/): string[] {
  return normalizeToken(value)
    .split(delimiter)
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim();
}

function rebuildTitleValue(oldValue: string, noteText: string): string {
  // Strip any existing Intro/BP tags from the value (in case it was previously modified, though it shouldn't be for a fresh ini)
  const normalizedOldValue = oldValue
    .replace(
      new RegExp(
        String.raw`(?:\s*(?:${IniTag.EM4.open}\[(?:Intro|BP(?: Chain)?)\](?:\*)?${IniTag.EM4.close}|\[(?:Intro|BP(?: Chain)?)\](?:\*)?))+\s*$`,
      ),
      '',
    )
    .trimEnd();
  return noteText ? `${normalizedOldValue}${noteText}` : normalizedOldValue;
}

export default {
  label: 'DataCore mission titles',
  sourceFiles: [
    { file: 'contract-generators.datacore.csv', sourceDir: 'datacore' },
    { file: 'contract-templates.datacore.csv', sourceDir: 'datacore', optional: true },
  ],
  loadSourceData: loadDatacoreTitlesSourceData,
  requiredColumns: ['Localization Key'],
  noInsert: true,
  descKeyMatch: (key) => /_title(?:_.+)?$/i.test(key) || key.includes('_name'),
  getTargetKeys(row) {
    const key = row['Localization Key'] ?? '';
    return key ? [key] : [];
  },
  buildValue(row, _flavorText, oldValue, _targetKey) {
    // Only modify if we actually have a valid string to modify
    if (!oldValue) return '';

    const noteText = row['TitleNote'] ?? '';
    return rebuildTitleValue(oldValue, noteText);
  },
} satisfies ItemConfig;
