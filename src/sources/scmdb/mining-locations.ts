import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { toCsv } from '../../infrastructure/csv';
import { ScmdbMiningDataSchema } from '../../schema/scmdb.schemas';
import { buildLocationQualityNotes, buildMiningLocationRows } from './mining-parser';

export interface RegenMiningLocationsOptions {
  repoRoot: string;
  scmdbDir?: string;
  log?: (message: string) => void;
}

export interface RegenMiningLocationsResult {
  outPath: string;
  rowCount: number;
  outDir: string;
}

function resolveTargetDir(repoRoot: string, scmdbDir: string | undefined): string {
  if (scmdbDir) return resolve(scmdbDir);
  const scmdbRoot = join(repoRoot, 'csv', 'scmdb');
  const versions = readdirSync(scmdbRoot).filter(
    (directory) => directory.includes('live') || directory.includes('ptu'),
  );
  if (versions.length === 0) throw new Error('No scmdb version directories found');
  versions.toSorted((a, b) => a.localeCompare(b)).reverse();
  const latestVersion = versions[0];
  return join(scmdbRoot, latestVersion);
}

/**
 * Regenerates mining-locations.csv from cached mining_data.json.
 */
export function regenMiningLocations(options: RegenMiningLocationsOptions): RegenMiningLocationsResult {
  const log = options.log ?? (() => {});
  const outDir = resolveTargetDir(options.repoRoot, options.scmdbDir);

  const miningJsonPath = join(outDir, 'mining_data.json');
  const rawMiningData = JSON.parse(readFileSync(miningJsonPath, 'utf-8'));
  const miningData = ScmdbMiningDataSchema.parse(rawMiningData);
  log(`Loaded mining data from: ${miningJsonPath}`);
  log(`  ${Object.keys(miningData.mineableElements || {}).length} elements`);
  log(`  ${Object.keys(miningData.compositions || {}).length} compositions`);
  log(`  ${(miningData.locations || []).length} locations`);

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

  log('\n-- Preview (first 3 rows) --');
  for (const row of locRows.slice(0, 3)) {
    log(`\n[${row['Location Name']}]`);
    if (row['Ship Mineables']) {
      log('  Ship Mineables:');
      String(row['Ship Mineables'])
        .split('\n')
        .forEach((line: string) => {
          log(`    ${line}`);
        });
    }
    if (row['Hand Mineables']) {
      log('  Hand Mineables:');
      String(row['Hand Mineables'])
        .split('\n')
        .forEach((line: string) => {
          log(`    ${line}`);
        });
    }
    if (row['Ground Vehicle Mineables']) {
      log('  Ground Vehicle Mineables:');
      String(row['Ground Vehicle Mineables'])
        .split('\n')
        .forEach((line: string) => {
          log(`    ${line}`);
        });
    }
    if (row['Quality Note']) {
      log(`  Quality Note: ${row['Quality Note']}`);
    }
  }

  const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);
  if (qualityNotesByLocation.size > 0) {
    log('\n-- Elevated quality floors detected --');
    for (const [loc, notes] of qualityNotesByLocation) {
      log(`  ${loc}: ${notes.join('; ')}`);
    }
  }

  return { outPath, rowCount: locRows.length, outDir };
}
