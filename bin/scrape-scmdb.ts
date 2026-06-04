import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toCsv } from '../src/lib/csv';
import {
  ScmdbCraftingBlueprintsSchema,
  ScmdbCraftingItemsSchema,
  ScmdbMergedSchema,
  ScmdbMiningDataSchema,
  ScmdbVersionsSchema,
} from '../src/schema/scmdb.schemas';
import {
  buildScmdbDataUrls,
  fetchAndValidateScmdbJson,
  fetchScmdbJson,
  SCMDB_VERSIONS_URL,
} from '../src/sources/scmdb/acquisition';
import { planScmdbOutputFiles } from '../src/sources/scmdb/output-files';
import { buildScmdbOutputRows } from '../src/sources/scmdb/outputs';
import { selectScmdbVersion, type ScmdbVersionEntry } from '../src/sources/scmdb/version-selection';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// outDir and missionsOutDir are set inside main() after the version is resolved.
let outDir: string;
let missionsOutDir: string;

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

function writeOutput(fileName: string, content: string): void {
  const path = join(outDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved ${fileName}`);
}

function writeMissionOutput(fileName: string, content: string): void {
  const path = join(missionsOutDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved missions/${fileName}`);
}

function getVersionSelection(args: string[]): { version?: string; ptu: boolean } {
  const versionArgIndex = args.indexOf('--version');
  if (versionArgIndex !== -1) {
    const requested = args[versionArgIndex + 1];
    if (!requested) throw new Error('--version requires a value');
    return { version: requested, ptu: args.includes('--ptu') };
  }

  return { ptu: args.includes('--ptu') };
}

function printVersions(versions: ScmdbVersionEntry[]): void {
  console.log('Available SCMDB versions:');
  for (const entry of versions) {
    console.log(`  ${entry.version} -> ${entry.file}`);
  }
  console.log('');
  console.log('By default this scraper uses the latest live SCMDB version. Use --ptu to fetch the latest PTU version.');
}

async function main() {
  const args = process.argv.slice(2);
  const listVersions = args.includes('--list-versions');
  const rawOnly = args.includes('--raw');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    usage();
    process.exit(0);
  }

  const versions = await fetchAndValidateScmdbJson(SCMDB_VERSIONS_URL, ScmdbVersionsSchema);

  if (listVersions) {
    printVersions(versions);
    process.exit(0);
  }

  const selected = selectScmdbVersion(versions, getVersionSelection(args));

  console.log(`Using SCMDB version ${selected.version}`);

  // Version-scoped output dirs: csv/scmdb/<version>/ and csv/scmdb/<version>/missions/
  outDir = join(repoRoot, 'csv', 'scmdb', selected.version);
  missionsOutDir = join(outDir, 'missions');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(missionsOutDir, { recursive: true });

  const { mergedUrl, miningUrl, craftingItemsUrl, craftingBlueprintsUrl } = buildScmdbDataUrls(selected.file);
  const mergedRaw = await fetchScmdbJson(mergedUrl);
  writeOutput(selected.file, JSON.stringify(mergedRaw, null, 2));

  const miningRaw = await fetchScmdbJson(miningUrl).catch(() => null);
  const craftingItemsRaw = await fetchScmdbJson(craftingItemsUrl).catch(() => null);
  const craftingBlueprintsRaw = await fetchScmdbJson(craftingBlueprintsUrl).catch(() => null);

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
  const mergedData = ScmdbMergedSchema.parse(mergedRaw);
  const miningData = miningRaw ? ScmdbMiningDataSchema.parse(miningRaw) : null;
  if (craftingItemsRaw) ScmdbCraftingItemsSchema.parse(craftingItemsRaw);
  if (craftingBlueprintsRaw) ScmdbCraftingBlueprintsSchema.parse(craftingBlueprintsRaw);

  const outputRows = buildScmdbOutputRows(mergedData, miningData);

  for (const outputFile of planScmdbOutputFiles(outputRows)) {
    const content = toCsv(outputFile.rows, outputFile.headers);
    if (outputFile.section === 'missions') {
      writeMissionOutput(outputFile.fileName, content);
    } else {
      writeOutput(outputFile.fileName, content);
    }
  }

  console.log(`SCMDB scrape complete. Outputs saved to csv/scmdb/${selected.version}/`);
}

try {
  await main();
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('ERROR:', error.message);
  process.exit(1);
}
