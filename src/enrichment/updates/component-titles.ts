import { getLogger } from '../../infrastructure/logger';
import { readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import {
  type ComponentFact,
  type ComponentTitleKeySource,
  loadDataCoreComponentFacts,
} from '../../sources/datacore/component-facts';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  toVariantFamilyKey,
} from './title-tag-utils';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('component-titles-update');

const CLASS_ABBREV = {
  Stealth: 'Sth',
  Industrial: 'Ind',
  Civilian: 'Civ',
  Competition: 'Cmp',
  Commercial: 'Cmp',
  Military: 'Mil',
};
const TITLE_KEY_SOURCE_PRIORITY: Record<ComponentTitleKeySource, number> = {
  'guessed-alias': 1,
  'csv-name-key': 2,
  'graph-localization': 3,
};

function getDisplayGrade(grade: string): string {
  const clean = normalizeSpaces(grade).toUpperCase();
  if (/^[A-Z]$/.test(clean)) {
    return clean;
  }

  const numeric = Number(clean);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 26) {
    return String.fromCharCode('A'.charCodeAt(0) + numeric - 1);
  }

  return clean;
}

function getComponentPrefix(fact: ComponentFact): string | null {
  const cls = normalizeSpaces(fact.componentClass);
  const size = normalizeSpaces(fact.size);
  const grade = getDisplayGrade(fact.grade);
  if (!cls || !size || !grade) {
    return null;
  }
  const abbr = CLASS_ABBREV[cls as keyof typeof CLASS_ABBREV] || cls.slice(0, 3);
  return `${abbr}/${size}/${grade}`;
}

async function buildComponentTitleLookupFromDataCore(datacoreDir: string, scmdbDir?: string) {
  const keyToPrefix = new Map<string, { prefix: string; priority: number }>();
  const facts = await loadDataCoreComponentFacts({ datacoreDir, scmdbDir });

  for (const fact of facts) {
    const prefix = getComponentPrefix(fact);
    if (!prefix) continue;
    for (const { key, source } of fact.titleKeySources) {
      const priority = TITLE_KEY_SOURCE_PRIORITY[source];
      const existing = keyToPrefix.get(key);
      if (!existing || priority > existing.priority) {
        keyToPrefix.set(key, { prefix, priority });
      }
    }
  }

  return keyToPrefix;
}

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}

function applyComponentTitlePrefixes(lines: string[], keyToPrefix: Map<string, { prefix: string }>) {
  const updatedLines = [...lines];
  const familyIndex = buildVariantFamilyIndex(updatedLines);
  const processedFamilies = new Set();

  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const parsed = parseNameLine(line);
    if (!parsed) {
      continue;
    }

    scannedCount++;
    const base = keyToPrefix.get(normalizeLocalizationKey(parsed.key));

    if (!base) {
      continue;
    }

    matchedCount++;
    const familyKey = toVariantFamilyKey(parsed.key);
    if (processedFamilies.has(familyKey)) {
      continue;
    }

    processedFamilies.add(familyKey);
    updatedCount += applyTagToFamily(
      updatedLines,
      familyIndex,
      familyKey,
      (cleanName: string) => `${base.prefix} ${cleanName}`,
    );
  }

  return { updatedLines, scannedCount, matchedCount, updatedCount };
}

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.datacoreDir
 * @param {boolean} params.dryRun
 */
export async function runComponentTitleUpdate({
  iniPath,
  datacoreDir,
  scmdbDir,
  dryRun,
}: {
  iniPath: string;
  datacoreDir: string;
  scmdbDir?: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const keyToPrefix = await buildComponentTitleLookupFromDataCore(datacoreDir, scmdbDir);

  logger.info('Loaded component title lookup data', {
    componentCount: keyToPrefix.size,
  });

  const iniData = await readIniFile(iniPath);
  const { lines } = iniData;
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyComponentTitlePrefixes(lines, keyToPrefix);

  await writeIniFileIfChanged(iniPath, updatedLines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  return buildScannedUpdateResult({
    label: 'Component Titles',
    updatedCount,
    matchedCount,
    scannedCount,
    dryRun,
    durationMs,
  });
}
