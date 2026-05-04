#!/usr/bin/env node
/**
 * Regenerates mining-locations.csv from the locally cached mining_data.json,
 * without fetching anything from the network.
 *
 * Usage: node bin/regen-mining-locations.js
 *
 * Reads:  csv/scmdb/<latest-version>/mining_data.json  (or mining_data.json symlink)
 * Writes: csv/scmdb/<latest-version>/mining-locations.csv
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function toCsv(rows, headers) {
  const escape = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((col) => escape(row[col])).join(',')),
  ];
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
  return entries
    .sort((a, b) => b[1] - a[1])
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

// ── main ─────────────────────────────────────────────────────────────────────

// Find latest versioned scmdb dir
const scmdbRoot = join(repoRoot, 'csv', 'scmdb');
const versions = readdirSync(scmdbRoot).filter((d) => d.includes('live') || d.includes('ptu'));
if (versions.length === 0) throw new Error('No scmdb version directories found');
versions.sort().reverse();
const latestVersion = versions[0];
const outDir = join(scmdbRoot, latestVersion);

// Read the cached mining data JSON
const miningJsonPath = join(outDir, 'mining_data.json');
const miningData = JSON.parse(readFileSync(miningJsonPath, 'utf-8'));
console.log(`Loaded mining data from: ${miningJsonPath}`);
console.log(`  ${Object.keys(miningData.mineableElements || {}).length} elements`);
console.log(`  ${Object.keys(miningData.compositions || {}).length} compositions`);
console.log(`  ${(miningData.locations || []).length} locations`);

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
    const isShip = !isHand && !isGround && (
      group.groupName.includes('SpaceShip') || group.groupName.includes('Ship')
    );
    if (!isHand && !isGround && !isShip) continue;

    const target = isHand ? locationData[name].hand
      : isGround ? locationData[name].ground
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

const csvContent = toCsv(locRows, [
  'Location Name', 'Ship Mineables', 'Hand Mineables', 'Ground Vehicle Mineables', 'Quality Note',
]);

const outPath = join(outDir, 'mining-locations.csv');
writeFileSync(outPath, csvContent, 'utf-8');
console.log(`\nWrote ${locRows.length} location rows to: ${outPath}`);

// Preview a couple of entries
console.log('\n-- Preview (first 3 rows) --');
for (const row of locRows.slice(0, 3)) {
  console.log(`\n[${row['Location Name']}]`);
  if (row['Ship Mineables']) {
    console.log('  Ship Mineables:');
    row['Ship Mineables'].split('\n').forEach((l) => console.log('    ' + l));
  }
  if (row['Hand Mineables']) {
    console.log('  Hand Mineables:');
    row['Hand Mineables'].split('\n').forEach((l) => console.log('    ' + l));
  }
  if (row['Ground Vehicle Mineables']) {
    console.log('  Ground Vehicle Mineables:');
    row['Ground Vehicle Mineables'].split('\n').forEach((l) => console.log('    ' + l));
  }
  if (row['Quality Note']) {
    console.log('  Quality Note:', row['Quality Note']);
  }
}

// Show any quality overrides found
if (qualityNotesByLocation.size > 0) {
  console.log('\n-- Elevated quality floors detected --');
  for (const [loc, notes] of qualityNotesByLocation) {
    console.log(`  ${loc}: ${notes.join('; ')}`);
  }
}
