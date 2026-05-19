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

import { buildLocationQualityNotes, buildMiningLocationRows } from '../src/extractor/mining-parser';
import { toCsv } from '../src/lib/csv';
import { ScmdbMiningDataSchema } from '../src/schema/scmdb.schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function defaultLogger(message: string): void {
  console.log(message);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveTargetDir(scmdbDir: string | undefined): string {
  if (scmdbDir) return resolve(scmdbDir);
  const scmdbRoot = join(repoRoot, 'csv', 'scmdb');
  const versions = readdirSync(scmdbRoot).filter((d) => d.includes('live') || d.includes('ptu'));
  if (versions.length === 0) throw new Error('No scmdb version directories found');
  versions.toSorted((a, b) => a.localeCompare(b)).reverse();
  const latestVersion = versions[0];
  return join(scmdbRoot, latestVersion);
}

/**
 * Regenerates mining-locations.csv from cached mining_data.json.
 *
 * @param {{ scmdbDir?: string, log?: (message: string) => void }} [options]
 * @returns {{ outPath: string, rowCount: number, outDir: string }}
 */
export function regenMiningLocations(options: { scmdbDir?: string; log?: (message: string) => void } = {}): {
  outPath: string;
  rowCount: number;
  outDir: string;
} {
  const log = options.log ?? defaultLogger;
  const outDir = resolveTargetDir(options.scmdbDir);

  // Read the cached mining data JSON
  const miningJsonPath = join(outDir, 'mining_data.json');
  const rawMiningData = JSON.parse(readFileSync(miningJsonPath, 'utf-8'));
  const miningData = ScmdbMiningDataSchema.parse(rawMiningData);
  log(`Loaded mining data from: ${miningJsonPath}`);
  log(`  ${Object.keys(miningData.mineableElements || {}).length} elements`);
  log(`  ${Object.keys(miningData.compositions || {}).length} compositions`);
  log(`  ${(miningData.locations || []).length} locations`);

  // Build rows using encapsulated extraction engine logic
  const locRows = buildMiningLocationRows(miningData);

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
      String(row['Ship Mineables'])
        .split('\n')
        .forEach((l: string) => {
          log(`    ${l}`);
        });
    }
    if (row['Hand Mineables']) {
      log('  Hand Mineables:');
      String(row['Hand Mineables'])
        .split('\n')
        .forEach((l: string) => {
          log(`    ${l}`);
        });
    }
    if (row['Ground Vehicle Mineables']) {
      log('  Ground Vehicle Mineables:');
      String(row['Ground Vehicle Mineables'])
        .split('\n')
        .forEach((l: string) => {
          log(`    ${l}`);
        });
    }
    if (row['Quality Note']) {
      log(`  Quality Note: ${row['Quality Note']}`);
    }
  }

  // Show any quality overrides found
  const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);
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
