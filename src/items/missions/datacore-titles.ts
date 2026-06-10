import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { IniTag } from '../../localization/ini-tags';

const logger = getLogger('datacore-titles-config');

interface DatacoreTitleRow {
  'Localization Key': string;
  Description: string;
  TitleNote: string;
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

  const resultRows: DatacoreTitleRow[] = [];
  const processedKeys = new Set<string>();

  for (const row of generators) {
    const isIntro =
      row['Contract Section'] === 'introContracts' || row['Contract Debug Name']?.toLowerCase().includes('intro');
    const hasBlueprint = Boolean(row['Blueprint Reward Pool Guids']);
    
    let titleNote = isIntro ? ` ${IniTag.EM4.wrap('[Intro]')}` : '';
    if (hasBlueprint) {
      titleNote += ` ${IniTag.EM4.wrap('[BP]')}`;
    }

    const keysToProcess = new Set<string>();

    // Add primary Title Key
    if (row['Title Key']) {
      keysToProcess.add(row['Title Key'].trim());
    }

    // Add any Title Variant Keys
    if (row['Title Variant Keys']) {
      for (const variant of row['Title Variant Keys'].split('|')) {
        keysToProcess.add(variant.trim());
      }
    }

    for (const key of keysToProcess) {
      if (!key || processedKeys.has(key)) continue;

      // We don't have the base localized string here; it's resolved during buildValue
      // by looking up `oldValue`.
      resultRows.push({
        'Localization Key': key,
        Description: '',
        TitleNote: titleNote,
      });
      processedKeys.add(key);
    }
  }

  return resultRows as unknown as Record<string, string>[];
}

function rebuildTitleValue(oldValue: string, noteText: string): string {
  // Strip any existing Intro/BP tags from the value (in case it was previously modified, though it shouldn't be for a fresh ini)
  const normalizedOldValue = oldValue
    .replace(
      new RegExp(
        String.raw`(?:\s*(?:${IniTag.EM4.open}\[(?:Intro|BP(?: Chain)?)\]${IniTag.EM4.close}|\[(?:Intro|BP(?: Chain)?)\]))+\s*$`,
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
