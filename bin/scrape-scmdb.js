#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildMiningElementRows,
  buildMiningJournalRows,
  buildMiningLocationRows,
} from '../src/lib/scmdb/mining-parser.js';

import {
  buildBlueprintPoolRows,
  buildContractBlueprintRows,
  buildContractRow,
  buildMissionRows,
  collectBlueprintChainData,
} from '../src/lib/scmdb/mission-parser.js';
import {
  ScmdbCraftingBlueprintsSchema,
  ScmdbCraftingItemsSchema,
  ScmdbMergedDataSchema,
  ScmdbMiningDataSchema,
  ScmdbVersionsSchema,
} from '../src/lib/schemas/scmdb.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// outDir and missionsOutDir are set inside main() after the version is resolved.
let outDir;
let missionsOutDir;

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

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'SCMDB Scraper' } });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

/**
 * Fetches JSON from a URL and validates it against a Zod schema.
 * Throws a descriptive error immediately if the response does not conform.
 *
 * @template T
 * @param {string} url
 * @param {import('zod').ZodType<T>} schema
 * @returns {Promise<T>}
 */
async function fetchAndValidate(url, schema) {
  const raw = await fetchJson(url);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Schema validation failed for ${url}:\n${result.error.toString()}`,
    );
  }
  return result.data;
}

function writeOutput(fileName, content) {
  const path = join(outDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved ${fileName}`);
}

function writeMissionOutput(fileName, content) {
  const path = join(missionsOutDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved missions/${fileName}`);
}

export function isLiveVersion(version) {
  return /\blive\b/i.test(version) || /-live\./i.test(version);
}

export function isPtuVersion(version) {
  return /\bptu\b/i.test(version) || /-ptu\./i.test(version);
}

/**
 * Converts a map of { mineralName -> totalWeight } into a newline-separated list
 * sorted by descending probability, each entry formatted as "Name — XX.X%".
 * Returns an empty string if the map has no entries.
 *
 * @param {Record<string, number>} weightMap
 * @returns {string}
 */
function toWeightedMineableList(weightMap) {
  const entries = Object.entries(weightMap);
  if (entries.length === 0) return '';
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([name, weight]) => {
      const pct = Math.round((weight / total) * 1000) / 10;
      return `${name} — ${pct}%`;
    })
    .join('\n');
}

/**
 * Scans qualityDistribution.shipmineables for location-specific quality floor overrides.
 * Returns a Map<locationName, string[]> where each string is a human-readable note about
 * an elevated quality floor at that location (only recorded when min > the rarity default).
 *
 * @param {object} qualityDistribution
 * @returns {Map<string, string[]>}
 */
function buildLocationQualityNotes(qualityDistribution) {
  /** @type {Map<string, string[]>} */
  const notes = new Map();

  const sm = qualityDistribution?.shipmineables;
  if (!sm) return notes;

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  for (const rarity of RARITY_ORDER) {
    const rarityData = sm[rarity];
    if (!rarityData) continue;

    const defaultMin = rarityData.default?.min ?? null;
    if (defaultMin === null) continue;

    const locationOverrides = rarityData.locationOverrides;
    if (!locationOverrides) continue;

    for (const groupEntries of Object.values(locationOverrides)) {
      for (const entry of groupEntries) {
        const overrideMin = entry.distribution?.min;
        if (overrideMin === undefined || overrideMin <= defaultMin) continue;

        // This location group has an elevated quality floor
        const floorPct = (overrideMin / 10).toFixed(1);
        const defaultPct = (defaultMin / 10).toFixed(1);
        const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
        const note = `${label} ship rocks: quality floor ${floorPct}% (standard ${defaultPct}%)`;

        for (const locName of entry.locations ?? []) {
          const existing = notes.get(locName) ?? [];
          if (!existing.includes(note)) existing.push(note);
          notes.set(locName, existing);
        }
      }
    }
  }

  return notes;
}

async function main() {
  const args = process.argv.slice(2);
  const versionArgIndex = args.indexOf('--version');
  const ptu = args.includes('--ptu');
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
    console.log('Available SCMDB versions:');
    for (const entry of versions) {
      console.log(`  ${entry.version} -> ${entry.file}`);
    }
    console.log('');
    console.log(
      'By default this scraper uses the latest live SCMDB version. Use --ptu to fetch the latest PTU version.',
    );
    process.exit(0);
  }

  let selected = null;
  if (versionArgIndex !== -1) {
    const requested = args[versionArgIndex + 1];
    if (!requested) {
      throw new Error('--version requires a value');
    }
    selected = versions.find((entry) => entry.version === requested);
    if (!selected) {
      throw new Error(`Version not found: ${requested}`);
    }
  } else if (ptu) {
    selected = versions.find((entry) => isPtuVersion(entry.version));
    if (!selected) {
      throw new Error('No PTU SCMDB version available');
    }
  } else {
    selected = versions.find((entry) => isLiveVersion(entry.version));
    if (!selected) {
      selected = versions[0];
    }
  }

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
  const mergedData = ScmdbMergedDataSchema.parse(mergedRaw);
  const miningData = miningRaw ? ScmdbMiningDataSchema.parse(miningRaw) : null;
  if (craftingItemsRaw) ScmdbCraftingItemsSchema.parse(craftingItemsRaw);
  if (craftingBlueprintsRaw) ScmdbCraftingBlueprintsSchema.parse(craftingBlueprintsRaw);

  const chainData = collectBlueprintChainData(Array.isArray(mergedData.contracts) ? mergedData.contracts : []);
  const contractRows = Array.isArray(mergedData.contracts)
    ? mergedData.contracts.map((contract) => buildContractRow(contract, chainData))
    : [];
  const legacyRows = Array.isArray(mergedData.legacyContracts)
    ? mergedData.legacyContracts.map((contract) => buildContractRow(contract, chainData))
    : [];
  const missionRows = buildMissionRows(mergedData.contracts, chainData, mergedData.blueprintPools);
  const blueprintPoolRows = buildBlueprintPoolRows(mergedData.blueprintPools);
  const contractBlueprintRows = buildContractBlueprintRows(mergedData.contracts, mergedData.blueprintPools);

  if (missionRows.length) {
    writeMissionOutput(
      'scmdb-missions.csv',
      toCsv(missionRows, ['Localization Key', 'Description', 'TitleNote', 'Note', 'RewardList']),
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
    ];
    writeOutput('legacy-contracts.csv', toCsv(legacyRows, headers));
  }

  if (blueprintPoolRows.length) {
    writeOutput('blueprint-pools.csv', toCsv(blueprintPoolRows, ['id', 'name', 'source', 'blueprints']));
  }

  if (miningData) {
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

    // Map compositionGuid -> composition name (the primary mineral label for that deposit type)
    const compNameCache = {};
    for (const [id, comp] of Object.entries(miningData.compositions || {})) {
      compNameCache[id] = comp.name || null;
    }

    // Build per-location quality override notes.
    // Scans qualityDistribution.shipmineables.{rarity}.locationOverrides for any location
    // where the quality floor (min) is elevated above the rarity's default floor.
    const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);

    // Build per-location weighted deposit maps.
    // Weight = groupProbability * relativeProbability, then normalised to % within each mining type.
    const locationData = {};
    for (const loc of miningData.locations || []) {
      const name = loc.locationName;
      if (!locationData[name]) {
        locationData[name] = { ship: {}, hand: {}, ground: {} };
      }
      for (const group of loc.groups || []) {
        const isHand = group.groupName.includes('FPS');
        const isGround = group.groupName.includes('GroundVehicle');
        const isShip =
          !isHand && !isGround && (group.groupName.includes('SpaceShip') || group.groupName.includes('Ship'));
        if (!isHand && !isGround && !isShip) continue;

        const target = isHand
          ? locationData[name].hand
          : isGround
            ? locationData[name].ground
            : locationData[name].ship;

        const gp = group.groupProbability ?? 1;
        for (const dep of group.deposits || []) {
          const compName = compNameCache[dep.compositionGuid];
          if (!compName) continue;
          const weight = gp * (dep.relativeProbability ?? 1);
          target[compName] = (target[compName] ?? 0) + weight;
        }
      }
    }

    const locRows = [];
    for (const [name, dat] of Object.entries(locationData)) {
      const shipList = toWeightedMineableList(dat.ship);
      const handList = toWeightedMineableList(dat.hand);
      const groundList = toWeightedMineableList(dat.ground);
      if (shipList || handList || groundList) {
        locRows.push({
          'Location Name': name,
          'Ship Mineables': shipList,
          'Hand Mineables': handList,
          'Ground Vehicle Mineables': groundList,
          'Quality Note': (qualityNotesByLocation.get(name) ?? []).join('\n'),
        });
      }
    }
    locRows.sort((a, b) => a['Location Name'].localeCompare(b['Location Name']));
    if (locRows.length) {
      writeOutput(
        'mining-locations.csv',
        toCsv(locRows, [
          'Location Name',
          'Ship Mineables',
          'Hand Mineables',
          'Ground Vehicle Mineables',
          'Quality Note',
        ]),
      );
    }
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
  console.error('ERROR:', err.message);
  process.exit(1);
}
