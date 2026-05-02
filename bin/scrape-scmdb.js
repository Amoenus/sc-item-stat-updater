#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'csv', 'scmdb');

mkdirSync(outDir, { recursive: true });

function usage() {
  console.log(`Usage: node scrape-scmdb.js [options]

Options:
  --version <version>    Use a specific SCMDB merged version file
  --list-versions        List available SCMDB merged versions
  --raw                  Save only raw SCMDB JSON output
  --help                 Show this help message

Examples:
  node scrape-scmdb.js
  node scrape-scmdb.js --version 4.8.0-ptu.11759767
  node scrape-scmdb.js --list-versions
`);
}

function toCsv(rows, headers) {
  const escape = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => headers.map((col) => escape(row[col])).join(','))];
  return `${lines.join('\n')}\n`;
}

function flattenValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'SCMDB Scraper' } });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

function writeOutput(fileName, content) {
  const path = join(outDir, fileName);
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved ${fileName}`);
}

function buildContractRow(contract) {
  return {
    id: contract.id,
    debugName: contract.debugName,
    category: contract.category,
    missionType: contract.missionType,
    missionTypeKey: contract.missionTypeKey,
    title: contract.title,
    titleKey: contract.titleKey,
    description: contract.description,
    descriptionKey: contract.descriptionKey,
    descriptionLocKey: contract.descriptionLocKey,
    rewardUEC: contract.rewardUEC,
    timeToComplete: contract.timeToComplete,
    canBeShared: contract.canBeShared,
    illegal: contract.illegal,
    factionGuid: contract.factionGuid,
    locations: flattenValue(contract.locations),
    destinations: flattenValue(contract.destinations),
    prerequisites: flattenValue(contract.prerequisites),
    tokenSubstitutions: flattenValue(contract.tokenSubstitutions),
    minStanding: flattenValue(contract.minStanding),
    maxStanding: flattenValue(contract.maxStanding),
    blueprintRewards: flattenValue(contract.blueprintRewards),
  };
}

function buildBlueprintPoolRows(blueprintPools) {
  return Object.entries(blueprintPools || {}).map(([id, pool]) => ({
    id,
    name: pool.name,
    source: pool.source,
    blueprints: flattenValue(pool.blueprints),
  }));
}

function buildContractBlueprintRows(contracts, blueprintPools) {
  return (contracts || []).flatMap((contract) => {
    if (!Array.isArray(contract.blueprintRewards)) return [];
    return contract.blueprintRewards.map((entry) => ({
      contractId: contract.id,
      debugName: contract.debugName,
      title: contract.title,
      blueprintPoolId: entry.blueprintPool,
      poolName: entry.poolName,
      chance: entry.chance,
      trigger: entry.trigger,
      blueprintSource: blueprintPools?.[entry.blueprintPool]?.source,
      blueprintItems: flattenValue(blueprintPools?.[entry.blueprintPool]?.blueprints),
    }));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const versionArgIndex = args.indexOf('--version');
  const listVersions = args.includes('--list-versions');
  const rawOnly = args.includes('--raw');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    usage();
    process.exit(0);
  }

  const versionsUrl = 'https://scmdb.net/data/versions.json';
  const versions = await fetchJson(versionsUrl);

  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('Unable to read SCMDB versions list');
  }

  if (listVersions) {
    console.log('Available SCMDB versions:');
    for (const entry of versions) {
      console.log(`  ${entry.version} -> ${entry.file}`);
    }
    process.exit(0);
  }

  let selected = versions[0];
  if (versionArgIndex !== -1) {
    const requested = args[versionArgIndex + 1];
    if (!requested) {
      throw new Error('--version requires a value');
    }
    selected = versions.find((entry) => entry.version === requested);
    if (!selected) {
      throw new Error(`Version not found: ${requested}`);
    }
  }

  console.log(`Using SCMDB version ${selected.version}`);

  const mergedUrl = `https://scmdb.net/data/${selected.file}`;
  const mergedData = await fetchJson(mergedUrl);
  const rawFileName = `${selected.file}`;
  writeOutput(rawFileName, JSON.stringify(mergedData, null, 2));

  if (rawOnly) {
    return;
  }

  const contractRows = Array.isArray(mergedData.contracts)
    ? mergedData.contracts.map(buildContractRow)
    : [];
  const legacyRows = Array.isArray(mergedData.legacyContracts)
    ? mergedData.legacyContracts.map(buildContractRow)
    : [];
  const blueprintPoolRows = buildBlueprintPoolRows(mergedData.blueprintPools);
  const contractBlueprintRows = buildContractBlueprintRows(mergedData.contracts, mergedData.blueprintPools);

  if (contractRows.length) {
    const headers = [
      'id', 'debugName', 'category', 'missionType', 'missionTypeKey', 'title', 'titleKey',
      'description', 'descriptionKey', 'descriptionLocKey', 'rewardUEC', 'timeToComplete',
      'canBeShared', 'illegal', 'factionGuid', 'locations', 'destinations',
      'prerequisites', 'tokenSubstitutions', 'minStanding', 'maxStanding', 'blueprintRewards',
    ];
    writeOutput('contracts.csv', toCsv(contractRows, headers));
  }

  if (legacyRows.length) {
    const headers = [
      'id', 'debugName', 'category', 'missionType', 'missionTypeKey', 'title', 'titleKey',
      'description', 'descriptionKey', 'descriptionLocKey', 'rewardUEC', 'timeToComplete',
      'canBeShared', 'illegal', 'factionGuid', 'locations', 'destinations',
      'prerequisites', 'tokenSubstitutions', 'minStanding', 'maxStanding',
    ];
    writeOutput('legacy-contracts.csv', toCsv(legacyRows, headers));
  }

  if (blueprintPoolRows.length) {
    writeOutput('blueprint-pools.csv', toCsv(blueprintPoolRows, ['id', 'name', 'source', 'blueprints']));
  }

  if (contractBlueprintRows.length) {
    writeOutput('contract-blueprint-rewards.csv', toCsv(contractBlueprintRows, [
      'contractId', 'debugName', 'title', 'blueprintPoolId', 'poolName', 'chance', 'trigger', 'blueprintSource', 'blueprintItems',
    ]));
  }

  console.log('SCMDB scrape complete. Outputs are in csv/scmdb/');
}

try {
  await main();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
