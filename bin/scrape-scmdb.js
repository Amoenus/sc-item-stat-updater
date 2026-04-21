#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMergedData } from '../src/lib/scmdb/fetcher.js';
import {
  flattenContracts,
  flattenBlueprintPools,
  flattenFactions,
  flattenLocationPools,
  flattenResourcePools,
  flattenShipPools,
} from '../src/lib/scmdb/flatten.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __rootDir = path.join(__dirname, '..');

function help() {
  console.log(`Usage: node bin/scrape-scmdb.js [options]

Options:
  --help                 Show this help message
  --force-refresh, -f    Re-download SCMDB merged JSON even when cached
  --cache-dir <path>     Custom cache directory (default: ./cache/scmdb)
  --output-dir <path>    Custom output directory (default: ./csv/scmdb)
  --delay-ms <ms>        Milliseconds to wait between SCMDB requests (default: 0)
`);
}

function parseArgs(args) {
  const parsed = { forceRefresh: false, cacheDir: null, outputDir: null, delayMs: 0 };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      break;
    }
    if (arg === '--force-refresh' || arg === '-f') {
      parsed.forceRefresh = true;
      continue;
    }
    if (arg === '--cache-dir') {
      parsed.cacheDir = args[++i];
      continue;
    }
    if (arg === '--output-dir') {
      parsed.outputDir = args[++i];
      continue;
    }
    if (arg === '--delay-ms') {
      parsed.delayMs = Number(args[++i]);
      if (Number.isNaN(parsed.delayMs) || parsed.delayMs < 0) {
        throw new Error('Invalid value for --delay-ms; expected a non-negative number');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function normalizeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function objectRowsToCsv(rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const escapeValue = (value) => {
    const text = value == null ? '' : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.map(escapeValue).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeValue(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function writeCsv(filePath, rows) {
  const content = objectRowsToCsv(rows);
  await fs.writeFile(filePath, content, 'utf-8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return;
  }

  const cacheDir = path.resolve(args.cacheDir ?? path.join(__rootDir, 'cache', 'scmdb'));
  const outputDir = path.resolve(args.outputDir ?? path.join(__rootDir, 'csv', 'scmdb'));

  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  console.log('Fetching SCMDB merged data...');
  const { payload, version, file } = await fetchMergedData(cacheDir, {
    forceRefresh: args.forceRefresh,
    delayMs: args.delayMs,
  });
  const stableVersion = normalizeFileName(version);
  const prefix = `scmdb-${stableVersion}`;

  console.log(`Resolved SCMDB version ${version} from ${file}`);

  const rawJsonPath = path.join(outputDir, `merged-${stableVersion}.json`);
  await fs.writeFile(rawJsonPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log(`Saved raw payload to ${path.relative(__rootDir, rawJsonPath)}`);

  const contracts = flattenContracts(payload);
  await writeCsv(path.join(outputDir, `contracts-${stableVersion}.csv`), contracts);
  console.log(`Wrote ${contracts.length} contract rows`);

  const blueprintPools = flattenBlueprintPools(payload);
  await writeCsv(path.join(outputDir, `blueprint-pools-${stableVersion}.csv`), blueprintPools);
  console.log(`Wrote ${blueprintPools.length} blueprint-pool rows`);

  const factions = flattenFactions(payload);
  await writeCsv(path.join(outputDir, `factions-${stableVersion}.csv`), factions);
  console.log(`Wrote ${factions.length} faction rows`);

  const locationPools = flattenLocationPools(payload);
  await writeCsv(path.join(outputDir, `location-pools-${stableVersion}.csv`), locationPools);
  console.log(`Wrote ${locationPools.length} location rows`);

  const resourcePools = flattenResourcePools(payload);
  await writeCsv(path.join(outputDir, `resource-pools-${stableVersion}.csv`), resourcePools);
  console.log(`Wrote ${resourcePools.length} resource rows`);

  const shipPools = flattenShipPools(payload);
  await writeCsv(path.join(outputDir, `ship-pools-${stableVersion}.csv`), shipPools);
  console.log(`Wrote ${shipPools.length} ship-pool rows`);

  console.log('SCMDB scrape complete. Review csv/scmdb for generated output.');
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
