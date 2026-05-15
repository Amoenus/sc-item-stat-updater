#!/usr/bin/env node
/**
 * Regenerates mining-locations.csv from the locally cached mining_data.json,
 * without fetching anything from the network.
 *
 * Usage: node bin/regen-mining-locations.js [--scmdb-dir <path>]
 *
 * Reads:  <scmdb-dir>/mining_data.json or csv/scmdb/<latest-version>/mining_data.json
 * Writes: <scmdb-dir>/mining-locations.csv
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function defaultLogger(message) {
  console.log(message);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toCsv(rows, headers) {
  const escape = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => headers.map((col) => escape(row[col])).join(','))];
  return `${lines.join('\n')}\n`;
}

/**
 * @param {Record<string, number>} weightMap
 * @returns {string}
 */
function toWeightedMineableList(weightMap) {
  const entries = Object.entries(weightMap);
  if (entries.length === 0) return '';
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const sortedEntries = entries.sort((a, b) => b[1] - a[1]);
  return sortedEntries
    .map(([name, weight]) => {
      const pct = Math.round((weight / total) * 1000) / 10;
      return `${name} — ${pct}%`;
    })
    .join('\n');
}

/**
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

function resolveTargetDir(scmdbDir) {
  if (scmdbDir) return resolve(scmdbDir);
  const scmdbRoot = join(repoRoot, 'csv', 'scmdb');
  const versions = readdirSync(scmdbRoot).filter((d) => d.includes('live') || d.includes('ptu'));
  if (versions.length === 0) throw new Error('No scmdb version directories found');
  versions.sort().reverse();
  const latestVersion = versions[0];
  return join(scmdbRoot, latestVersion);
}

/**
 * Regenerates mining-locations.csv from cached mining_data.json.
 *
 * @param {{ scmdbDir?: string, log?: (message: string) => void }} [options]
 * @returns {{ outPath: string, rowCount: number, outDir: string }}
 */
export function regenMiningLocations(options = {}) {
  const log = options.log ?? defaultLogger;
  const outDir = resolveTargetDir(options.scmdbDir);

  // Read the cached mining data JSON
  const miningJsonPath = join(outDir, 'mining_data.json');
  const miningData = JSON.parse(readFileSync(miningJsonPath, 'utf-8'));
  log(`Loaded mining data from: ${miningJsonPath}`);
  log(`  ${Object.keys(miningData.mineableElements || {}).length} elements`);
  log(`  ${Object.keys(miningData.compositions || {}).length} compositions`);
  log(`  ${(miningData.locations || []).length} locations`);

  // Map compositionGuid -> composition name
  const compNameCache = {};
  for (const [id, comp] of Object.entries(miningData.compositions || {})) {
    compNameCache[id] = comp.name || null;
  }

  // Build quality notes
  const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);

  // Build per-location weighted deposit maps
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

      let target;
      if (isHand) target = locationData[name].hand;
      else if (isGround) target = locationData[name].ground;
      else target = locationData[name].ship;

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

  const csvContent = toCsv(locRows, [
    'Location Name',
    'Ship Mineables',
    'Hand Mineables',
    'Ground Vehicle Mineables',
    'Quality Note',
  ]);

  const outPath = join(outDir, 'mining-locations.csv');
  writeFileSync(outPath, csvContent, 'utf-8');
  log(`\nWrote ${locRows.length} location rows to: ${outPath}`);

  // Preview a couple of entries
  log('\n-- Preview (first 3 rows) --');
  for (const row of locRows.slice(0, 3)) {
    log(`\n[${row['Location Name']}]`);
    if (row['Ship Mineables']) {
      log('  Ship Mineables:');
      row['Ship Mineables'].split('\n').forEach((l) => log(`    ${l}`));
    }
    if (row['Hand Mineables']) {
      log('  Hand Mineables:');
      row['Hand Mineables'].split('\n').forEach((l) => log(`    ${l}`));
    }
    if (row['Ground Vehicle Mineables']) {
      log('  Ground Vehicle Mineables:');
      row['Ground Vehicle Mineables'].split('\n').forEach((l) => log(`    ${l}`));
    }
    if (row['Quality Note']) {
      log(`  Quality Note: ${row['Quality Note']}`);
    }
  }

  // Show any quality overrides found
  if (qualityNotesByLocation.size > 0) {
    log('\n-- Elevated quality floors detected --');
    for (const [loc, notes] of qualityNotesByLocation) {
      log(`  ${loc}: ${notes.join('; ')}`);
    }
  }

  return { outPath, rowCount: locRows.length, outDir };
}

export function runCli() {
  const { values } = parseArgs({
    options: {
      'scmdb-dir': { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log('Usage: node bin/regen-mining-locations.js [--scmdb-dir <path>]');
    console.log('  --scmdb-dir, -c   Explicit SCMDB version directory to process');
    return;
  }

  regenMiningLocations({ scmdbDir: values['scmdb-dir'] });
}

const isEntrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url : false;

if (isEntrypoint) {
  runCli();
}
