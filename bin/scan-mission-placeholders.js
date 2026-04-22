#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCSV } from '../src/lib/io/csv-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __rootDir = path.join(__dirname, '..');

function help() {
  console.log(`Usage: node bin/scan-mission-placeholders.js [options]

Options:
  --help                 Show this help message
  --ini-path <path>      Path to global.ini (default: ./global.ini)
  --csv-dir <path>       Directory containing SCMDB CSV output (default: ./csv/scmdb)
  --csv-file <path>      Specific SCMDB contracts CSV file to use
  --verbose              Enable verbose logging
`);
}

function parseArgsCli(args) {
  const parsed = {
    help: false,
    iniPath: null,
    csvDir: null,
    csvFile: null,
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

const SCMDB_MISSION_PLACEHOLDERS = {
  APPROVAL_CODE: 'ApprovalCode',
  CARGOGRADETOKEN: 'CargoGradeToken',
  CLAIM: 'ClaimNumber',
  CONTRACTOR: 'Contractor',
  CREATURE: 'Creature',
  DANGER: 'Danger',
  DESCRIPTIONSETUP: 'DescriptionSetup',
  DESTINATION: 'Destination|Address',
  DESTINATIONS: 'Destinations',
  GIFTSENDER: 'GiftSender',
  INFORMANT: 'Informant',
  ITEM: 'Item',
  LOCATION: 'Location',
  MAX_SCU: 'MissionMaxSCUSize',
  MISSINGPERSONLIST: 'MissingPersonList',
  MONITOR_COUNT: 'MonitorCount',
  MULTITOOL: 'MultiTool',
  MULTITOINGLETOKEN: 'MultiToSingleToken',
  MULTITOSINGLETOKEN: 'MultiToSingleToken',
  SHIP: 'Ship',
  SHIPSTORY: 'ShipStory',
  SIGN_OFF: 'SignOff',
  SINGLETOMULTITOKEN: 'SingleToMultiToken',
  STORENAME: 'StoreName',
  SYSTEM: 'System',
  TARGET: 'TargetName',
  TARGETNAME: 'TargetName',
  TIMER: 'Timer',
  TOTAL: 'Total',
  TRANSITNAMESHORT: 'TransitNameShort',
  REPUTATIONRANK: 'ReputationRank',
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

  return token
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('_');
}

function resolveCsvPath(csvDir, csvFile) {
  return csvFile ? path.resolve(csvFile) : null;
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

function collectCsvPlaceholders(rows) {
  const pattern = /\[([A-Za-z_]+)\]/g;
  const tokenCounts = new Map();
  const sampleTexts = new Map();

  for (const row of rows) {
    for (const field of ['title', 'description']) {
      const text = String(row[field] ?? '');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const token = match[1];
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
        if (!sampleTexts.has(token) && sampleTexts.size < 200) {
          sampleTexts.set(token, text);
        }
      }
    }
  }

  return { tokenCounts, sampleTexts };
}

function collectIniMissionTokens(text) {
  const pattern = /~mission\(([^)]+)\)/gi;
  const tokenCounts = new Map();
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const token = match[1];
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }
  return tokenCounts;
}

function sortedTokenArray(tokenCounts) {
  return [...tokenCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function printTokenTable(title, tokenCounts, limit = 25) {
  console.log(`\n${title}`);
  console.log('----------------------------------');
  for (const [token, count] of sortedTokenArray(tokenCounts).slice(0, limit)) {
    console.log(`${count.toString().padStart(5)}  ${token}`);
  }
  const total = tokenCounts.size;
  console.log(`\n${total} unique tokens found.`);
}

function printCsvTokenDetails(tokenCounts) {
  const unknowns = [];
  for (const [token] of tokenCounts.entries()) {
    const key = token.toUpperCase();
    if (!SCMDB_MISSION_PLACEHOLDERS[key] && key !== 'LOCATION' && key !== 'DESTINATION') {
      unknowns.push(token);
    }
  }

  console.log('\nCSV token mapping details');
  console.log('----------------------------------');
  for (const token of sortedTokenArray(tokenCounts).map((entry) => entry[0])) {
    const key = token.toUpperCase();
    const mapped = SCMDB_MISSION_PLACEHOLDERS[key];
    const normalized = normalizeScmdbPlaceholderName(token);
    if (mapped) {
      console.log(`  ${token} => ~mission(${mapped}) [mapped]`);
    } else if (key === 'LOCATION') {
      console.log(`  ${token} => ~mission(Location|Address) [mapped]`);
    } else if (key === 'DESTINATION') {
      console.log(`  ${token} => ~mission(Destination|Address) [mapped]`);
    } else {
      console.log(`  ${token} => ~mission(${normalized}) [fallback]`);
    }
  }

  if (unknowns.length === 0) {
    console.log('\nNo unmapped CSV placeholder tokens found.');
  } else {
    console.log(`\n${unknowns.length} unmapped CSV placeholder token(s): ${unknowns.join(', ')}`);
  }
}

async function main() {
  const options = parseArgsCli(process.argv.slice(2));
  if (options.help) {
    help();
    return;
  }

  const iniPath = path.resolve(options.iniPath ?? path.join(__rootDir, 'global.ini'));
  const csvPath = options.csvFile
    ? path.resolve(options.csvFile)
    : await findLatestContractsCsv(path.resolve(options.csvDir ?? path.join(__rootDir, 'csv', 'scmdb')));

  if (options.verbose) {
    console.log(`INI path: ${iniPath}`);
    console.log(`Contracts CSV: ${csvPath}`);
  }

  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);
  const csvResults = collectCsvPlaceholders(rows);

  const iniContent = await fs.readFile(iniPath, 'utf-8');
  const iniResults = collectIniMissionTokens(iniContent);

  printTokenTable('SCMDB CSV placeholder tokens', csvResults.tokenCounts, 50);
  printCsvTokenDetails(csvResults.tokenCounts);
  printTokenTable('global.ini ~mission(...) tokens', iniResults, 50);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
