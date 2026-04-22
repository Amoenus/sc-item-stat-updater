#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCSV } from '../src/lib/io/csv-parser.js';
import { readIniFile, writeIniFile, backupIniFile } from '../src/lib/io/ini-file.js';
import { normalizeTagSuffix, appendSection } from '../src/lib/localization-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __rootDir = path.join(__dirname, '..');

function help() {
  console.log(`Usage: node bin/update-scmdb-missions.js [options]

Options:
  --help                 Show this help message
  --ini-path <path>      Path to global.ini (default: ./global.ini)
  --csv-dir <path>       Directory containing SCMDB CSV output (default: ./csv/scmdb)
  --csv-file <path>      Specific SCMDB contracts CSV file to use
  --dry-run              Preview changes without writing
  --verbose              Enable verbose logging
`);
}

function parseArgsCli(args) {
  const parsed = {
    help: false,
    iniPath: null,
    csvDir: null,
    csvFile: null,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--ini-path':
        parsed.iniPath = args[++i];
        break;
      case '--csv-dir':
        parsed.csvDir = args[++i];
        break;
      case '--csv-file':
        parsed.csvFile = args[++i];
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        parsed.verbose = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function log(message, verbose) {
  if (verbose) console.log(message);
}

async function findLatestContractsCsv(csvDir) {
  const entries = await fs.readdir(csvDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('contracts-') && entry.name.endsWith('.csv'))
    .map((entry) => entry.name);

  if (candidates.length === 0) {
    throw new Error(`No contracts CSV found in ${csvDir}`);
  }

  const sorted = await Promise.all(
    candidates.map(async (name) => {
      const filePath = path.join(csvDir, name);
      const stat = await fs.stat(filePath);
      return { name, mtimeMs: stat.mtimeMs, filePath };
    }),
  );

  sorted.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return sorted[0].filePath;
}

function parseNumber(value) {
  if (value == null || value === '') return NaN;
  return Number(String(value).replace(/,/g, ''));
}

function parseBlueprintChances(value) {
  if (!value) return [];
  return String(value)
    .split('|')
    .map((chunk) => parseNumber(chunk.trim()))
    .filter((n) => !Number.isNaN(n));
}

function computeBpTag(row) {
  const count = parseNumber(row.blueprintRewardsCount);
  const hasBlueprintPools = String(row.blueprintPoolNames).trim() !== '' || String(row.blueprintPoolGuids).trim() !== '';
  const effectiveCount = count > 0 ? count : hasBlueprintPools ? 1 : 0;
  if (!effectiveCount) return null;

  const chanceValues = parseBlueprintChances(row.blueprintChances);
  const multiplePools = String(row.blueprintPoolNames).includes('|') || String(row.blueprintPoolGuids).includes('|') || effectiveCount > 1;
  const hasPartialChance = chanceValues.some((value) => value > 0 && value < 1);
  const hasNonGuaranteedChance = chanceValues.some((value) => value > 0 && value !== 1 && value !== 100);

  if (multiplePools || hasPartialChance || hasNonGuaranteedChance) {
    return '[BP]*';
  }
  return '[BP]';
}

function findLatestBlueprintPoolsCsv(csvDir) {
  return findLatestFile(csvDir, 'blueprint-pools-', '.csv');
}

function findLatestFile(csvDir, prefix, suffix) {
  return fs.readdir(csvDir, { withFileTypes: true })
    .then((entries) => entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(suffix))
      .map((entry) => entry.name))
    .then((candidates) => {
      if (candidates.length === 0) return null;
      return Promise.all(candidates.map(async (name) => {
        const filePath = path.join(csvDir, name);
        const stat = await fs.stat(filePath);
        return { name, mtimeMs: stat.mtimeMs, filePath };
      }))
        .then((stats) => {
          stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
          return stats[0].filePath;
        });
    });
}

async function loadBlueprintPoolMap(csvDir) {
  const blueprintPoolsCsv = await findLatestBlueprintPoolsCsv(csvDir);
  if (!blueprintPoolsCsv) return new Map();

  const csvContent = await fs.readFile(blueprintPoolsCsv, 'utf-8');
  const rows = parseCSV(csvContent);
  const map = new Map();

  for (const row of rows) {
    const guid = String(row.blueprintPoolGuid ?? '').trim();
    const name = String(row.blueprintName ?? '').trim();
    if (!guid || !name) continue;

    if (!map.has(guid)) map.set(guid, []);
    map.get(guid).push(name);
  }

  return map;
}

function getBlueprintNamesForRow(row, blueprintPoolMap) {
  const guids = String(row.blueprintPoolGuids ?? '').split('|').map((value) => value.trim()).filter(Boolean);
  const allNames = [];

  for (const guid of guids) {
    const names = blueprintPoolMap.get(guid);
    if (names) {
      for (const name of names) {
        if (!allNames.includes(name)) allNames.push(name);
      }
    }
  }

  return allNames;
}

function isRepeatOnlyMission(row, titleKey) {
  const debugName = String(row.debugName ?? '');
  return /repeat/i.test(debugName) || /repeat/i.test(titleKey);
}

function buildPotentialBlueprintsBlock(blueprintNames, repeatOnly) {
  if (!blueprintNames.length) return '';
  const header = repeatOnly ? 'Potential Blueprints (Repeat Only)' : 'Potential Blueprints';
  const lines = [`<EM4>${header}</EM4>`];
  for (const name of blueprintNames) lines.push(`- ${name}`);
  return `\\n\\n${lines.join('\\n')}\\n`;
}

function appendPotentialBlueprintsBlock(text, blueprintBlock) {
  const sectionRegex = /(?:\r?\n){0,2}<EM4>\s*Potential Blueprints(?: \(Repeat Only\))?<\/EM4>[\s\S]*$/i;
  if (!blueprintBlock) {
    return appendSection(text, sectionRegex, '');
  }
  return appendSection(text, sectionRegex, blueprintBlock);
}

function normalizeBpTag(title, tag) {
  if (!tag) {
    return String(title).replace(/\s*<EM4>\[BP\]\*?<\/EM4>/g, '').trim();
  }
  return normalizeTagSuffix(title, tag, {
    tagRegex: /\s*<EM4>\[BP\]\*?<\/EM4>/i,
    wrapper: (value) => `<EM4>${value}</EM4>`,
  });
}

const HAULING_TITLE_FORMATTERS = {
  Covalex_HaulCargo_AToB_title: () => '<EM2>~mission(ReputationRank)</EM2> | <EM3>DIRECT</EM3> ~mission(CargoRouteToken) ~mission(CargoGradeToken)',
  Covalex_HaulCargo_LinearChain_title: () => '~mission(ReputationRank) | ~mission(CargoRouteToken) ~mission(CargoGradeToken)',
  Covalex_HaulCargo_MultiToSingle_title: () => '~mission(ReputationRank) | ~mission(CargoRouteToken) ~mission(CargoGradeToken)',
  Covalex_HaulCargo_SingleToMulti_title: () => '~mission(ReputationRank) | ~mission(CargoRouteToken) ~mission(CargoGradeToken)',
  Covalex_HaulCargo_RoundDelivery_title: () => '~mission(ReputationRank) | ~mission(CargoRouteToken) ~mission(CargoGradeToken) Circuit',
};

function formatHaulingTitle(titleKey, titleValue) {
  const formatter = HAULING_TITLE_FORMATTERS[titleKey];
  if (!formatter) return titleValue;
  return formatter(titleValue);
}

const SCMDB_MISSION_PLACEHOLDERS = {
  APPROVAL_CODE: 'ApprovalCode',
  CARGOGRADETOKEN: 'CargoGradeToken',
  CLAIM: 'ClaimNumber',
  CONTRACTOR: 'Contractor',
  CREATURE: 'Creature',
  DANGER: 'Danger',
  DESCRIPTIONSETUP: 'DescriptionSetup',
  DESTINATION: 'Destination',
  DESTINATIONS: 'Destinations',
  GIFTSENDER: 'GiftSender',
  INFORMANT: 'Informant',
  ITEM: 'Item',
  LOCATION: 'Location',
  MAX_SCU: 'MissionMaxSCUSize',
  MISSINGPERSONLIST: 'MissingPersonList',
  MONITOR_COUNT: 'MonitorCount',
  MULTITOOL: 'MultiTool',
  MULTITOSINGLETOKEN: 'MultiToSingleToken',
  SHIP: 'Ship',
  SHIPSTORY: 'ShipStory',
  SIGN_OFF: 'SignOff',
  SINGLETOMULTITOKEN: 'SingleToMultiToken',
  STORENAME: 'StoreName',
  SYSTEM: 'System',
  TARGET: 'TargetName',
  TARGETNAME: 'TargetName',
  REPUTATIONRANK: 'ReputationRank',
  TIMER: 'Timer',
  TOTAL: 'Total',
  TRANSITNAMESHORT: 'TransitNameShort',
  HINT_TOOL: 'Hint_Tool',
  SCRIPAMOUNT: 'ScripAmount',
};

function normalizeScmdbPlaceholderName(token) {
  if (!token) return token;

  const explicit = {
    TARGETNAME: 'TargetName',
    REPUTATIONRANK: 'ReputationRank',
    MISSIONMAXSCUSIZE: 'MissionMaxSCUSize',
  };
  const upperToken = token.toUpperCase();
  if (explicit[upperToken]) return explicit[upperToken];

  if (token === token.toLowerCase()) return token;

  return token
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('_');
}

function normalizeMissionDescriptionForComparison(text) {
  return String(text)
    .replace(/~mission\(\s*([^)]+?)\s*\)/gi, (_, token) => {
      const normalizedToken = token.replace(/\|Address$/i, '').toLowerCase();
      return `~mission(${normalizedToken})`;
    });
}

function areMissionDescriptionsEquivalent(a, b) {
  return normalizeMissionDescriptionForComparison(a) === normalizeMissionDescriptionForComparison(b);
}

function isPlaceholderInsideEm4(text, offset, length) {
  const before = text.lastIndexOf('<EM4>', offset);
  const after = text.indexOf('</EM4>', offset + length);
  return before !== -1 && after !== -1 && before < offset && after >= offset + length;
}

function sanitizeScmdbPlaceholders(text) {
  if (!text) return text;
  return String(text).replace(/\[([A-Za-z_]+)\]/g, (match, token) => {
    const key = token.toUpperCase();
    if (key === 'LOCATION') return '~mission(Location|Address)';
    if (key === 'DESTINATION') return '~mission(Destination|Address)';

    const mapped = SCMDB_MISSION_PLACEHOLDERS[key];
    if (mapped) return `~mission(${mapped})`;
    return `~mission(${normalizeScmdbPlaceholderName(token)})`;
  });
}

function formatIniLine(key, value) {
  return `${key}=${value}`;
}

async function readOptionalIniFile(filePath) {
  try {
    return await readIniFile(filePath);
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgsCli(process.argv.slice(2));
  if (options.help) {
    help();
    return;
  }

  const iniPath = path.resolve(options.iniPath ?? path.join(__rootDir, 'global.ini'));
  const csvDir = path.resolve(options.csvDir ?? path.join(__rootDir, 'csv', 'scmdb'));
  const csvPath = options.csvFile ? path.resolve(options.csvFile) : await findLatestContractsCsv(csvDir);
  const originalIniPath = path.join(path.dirname(iniPath), 'global.original.ini');

  log(`INI path: ${iniPath}`, options.verbose);
  log(`Contracts CSV: ${csvPath}`, options.verbose);
  log(`Original INI path: ${originalIniPath}`, options.verbose);

  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);
  const blueprintPoolMap = await loadBlueprintPoolMap(csvDir);
  const { lines, index: existingKeys } = await readIniFile(iniPath);
  const originalIni = await readOptionalIniFile(originalIniPath);
  const issues = [];
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const titleKey = String(row.titleLocKey ?? '').trim();
    const descKey = String(row.descriptionLocKey ?? '').trim();
    if (!titleKey && !descKey) {
      skippedCount += 1;
      continue;
    }

    const tag = computeBpTag(row);
    const blueprintNames = getBlueprintNamesForRow(row, blueprintPoolMap);
    if (!tag && blueprintNames.length === 0) {
      skippedCount += 1;
      continue;
    }

    const description = String(row.description ?? '');
    const sanitizedDescription = sanitizeScmdbPlaceholders(description);
    const isRepeatOnly = isRepeatOnlyMission(row, titleKey);
    const blueprintBlock = buildPotentialBlueprintsBlock(blueprintNames, isRepeatOnly);

    if (titleKey) {
      const titleIndex = existingKeys[titleKey];
      if (titleIndex == null) {
        issues.push({ key: titleKey, reason: 'Title key not found in global.ini' });
      } else {
        const oldLine = lines[titleIndex];
        const oldValue = oldLine.slice(oldLine.indexOf('=') + 1);
        const formattedValue = formatHaulingTitle(titleKey, oldValue);
        const newTitle = normalizeBpTag(formattedValue, tag);
        if (oldValue !== newTitle && !areMissionDescriptionsEquivalent(oldValue, newTitle)) {
          lines[titleIndex] = formatIniLine(titleKey, newTitle);
          updatedCount += 1;
        }
      }
    }

    if (descKey) {
      const descIndex = existingKeys[descKey];
      if (descIndex == null) {
        issues.push({ key: descKey, reason: 'Description key not found in global.ini' });
      } else {
        const oldLine = lines[descIndex];
        const oldValue = oldLine.slice(oldLine.indexOf('=') + 1);
        const newDescription = appendPotentialBlueprintsBlock(oldValue, blueprintBlock);
        if (oldValue !== newDescription && !areMissionDescriptionsEquivalent(oldValue, newDescription)) {
          lines[descIndex] = formatIniLine(descKey, newDescription);
          updatedCount += 1;
        }
      }
    }
  }

  if (updatedCount === 0) {
    console.log('No updates were needed. global.ini is already in sync with SCMDB mission data.');
    return;
  }

  if (options.dryRun) {
    console.log(`Dry run: ${updatedCount} title/description updates detected.`);
    if (issues.length > 0) {
      console.log('\nIssues:');
      for (const issue of issues) console.log(`  ${issue.key}: ${issue.reason}`);
    }
    return;
  }

  await backupIniFile(iniPath);
  await writeIniFile(iniPath, lines);
  console.log(`Updated ${updatedCount} mission title/description values in global.ini.`);
  if (issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of issues) console.log(`  ${issue.key}: ${issue.reason}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
