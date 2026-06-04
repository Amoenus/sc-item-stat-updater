#!/usr/bin/env node
/**
 * scrape-datacore.ts
 *
 * Extracts item stats from the Star Citizen DataForge database (Game*.dcb),
 * parses the resulting entity XML records, and writes one CSV file per item type.
 *
 * Source: LIVE/Data/Game2.dcb (or game.dcb) — already on disk, NOT inside Data.p4k.
 *         unforge.cli.exe converts the DCB to individual entity XML files.
 *
 * Parallel architecture to scrape-spviewer.ts / scrape-scmdb.ts.
 * Output: csv/datacore/<version>-<channel>/<type>.datacore.csv
 *
 * XML cache: csv/datacore/.xmlcache/<version>-<channel>/
 *   The unforge step is expensive (~several minutes). Extracted XMLs are cached
 *   per game version so subsequent runs skip re-extraction.
 *   Add csv/datacore/.xmlcache/ to .gitignore.
 *
 * Usage:
 *   node --import tsx/esm bin/scrape-datacore.ts [options] [types...]
 *
 * Options:
 *   --all              Process all item types (default when no types given)
 *   --ptu              Use PTU channel label (affects output directory name)
 *   --live             Use LIVE channel label (default)
 *   --list             Print available item types and exit
 *   --dry-run          Parse cached XMLs without writing CSV files
 *   --force-extract    Re-run unforge even if the XML cache already exists
 *   -h, --help         Show this help message
 *
 * Environment:
 *   SC_LIVE_DIR        Path to the Star Citizen LIVE (or PTU) directory
 *
 * ⚠️  All DataForge XML field selectors, entity class prefixes, and recordFilter
 * path patterns are best-effort derivations. Verify against actual unforged files.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { stringify } from 'csv-stringify/sync';
import {
  extractAttachDef,
  extractEntityClass,
  extractHealth,
  loadXml,
  xmlVal,
} from '../src/sources/datacore/xml-parser';
import { ensureToolsInstalled, readGameVersion, resolveLiveDir, runTool } from '../src/io/local/unp4k-tool';
import type { DataCoreFieldSelector, DataCoreItemTypeConfig } from '../src/items/datacore/types';
import { extractDataCoreXmlCache } from '../src/sources/datacore/acquisition';
import {
  collectDataCoreXmlFilesMatching,
  countDataCoreXmlFiles,
  findDataCoreDcbFile,
} from '../src/sources/datacore/xml-files';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATACORE_ITEMS_DIR = path.join(REPO_ROOT, 'src', 'items', 'datacore');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const { values, positionals } = parseArgs({
  options: {
    all: { type: 'boolean', default: false },
    ptu: { type: 'boolean', default: false },
    live: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'force-extract': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: true,
});

if (values.help) {
  console.log(
    `
Usage: node scrape-datacore.js [options] [type...]

Scrapes item stats from the Star Citizen DataForge database and writes CSV files.
Source: LIVE/Data/Game*.dcb (already on disk — no p4k extraction needed).

Options:
  --all              Process all item types (default)
  --ptu              Tag output directory with "-ptu" channel
  --live             Tag output directory with "-live" channel (default)
  --list             Print available item types and exit
  --dry-run          Parse XMLs but do not write CSV files
  --force-extract    Re-run unforge even if the XML cache already exists
  -h, --help         Show this help message

Arguments:
  type...          One or more item type names (e.g. shields quantum-drives)
                   Run with --list to see all available types.

Environment:
  SC_LIVE_DIR      Path to the Star Citizen LIVE directory (required)
`.trim(),
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Load all DataCore item type modules
// ---------------------------------------------------------------------------

interface TypeEntry {
  name: string;
  csvFile: string;
  typeConfig: DataCoreItemTypeConfig;
}

async function loadAllTypeEntries(): Promise<TypeEntry[]> {
  const entries = await fsp.readdir(DATACORE_ITEMS_DIR);
  const result: TypeEntry[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry === 'types.ts') continue;
    const slug = entry.replace(/\.ts$/, '');
    const fullPath = path.join(DATACORE_ITEMS_DIR, entry);
    const mod = await import(pathToFileURL(fullPath).href);
    if (!mod.DATACORE_TYPE_CONFIG) continue;
    const typeConfig: DataCoreItemTypeConfig = mod.DATACORE_TYPE_CONFIG;
    const csvFile: string = mod.default?.csvFile ?? `${slug}.datacore.csv`;
    result.push({ name: slug, csvFile, typeConfig });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

const allTypes = await loadAllTypeEntries();

if (values.list) {
  console.log('Available DataCore item types:');
  for (const t of allTypes) {
    console.log(`  ${t.name.padEnd(28)} filter: ${t.typeConfig.recordFilter}`);
  }
  process.exit(0);
}

let selectedTypes: TypeEntry[];
if (positionals.length > 0) {
  selectedTypes = [];
  for (const name of positionals) {
    const found = allTypes.find((t) => t.name === name);
    if (!found) {
      console.error(`Unknown item type: "${name}". Run with --list to see valid types.`);
      process.exit(1);
    }
    selectedTypes.push(found);
  }
} else {
  selectedTypes = allTypes;
}

// ---------------------------------------------------------------------------
// Resolve paths & game version
// ---------------------------------------------------------------------------

const LIVE_DIR = resolveLiveDir(__dirname);
const gameVersion = await readGameVersion(LIVE_DIR);
const channel = values.ptu ? 'ptu' : 'live';
const versionTag = `${gameVersion}-${channel}`;

const outputBase = path.join(REPO_ROOT, 'csv', 'datacore', versionTag);
const xmlCacheDir = path.join(REPO_ROOT, 'csv', 'datacore', '.xmlcache', versionTag);

// ---------------------------------------------------------------------------
// Find the DataForge DCB file (already on disk, not inside Data.p4k)
// ---------------------------------------------------------------------------

const dcbPath = await findDataCoreDcbFile(LIVE_DIR);
const toolDir = path.join(LIVE_DIR, 'unp4k');

if (!values['dry-run']) {
  await fsp.mkdir(outputBase, { recursive: true });
}

console.log(`=== DataCore scraper ===`);
console.log(`  Game version:  ${gameVersion} (${channel.toUpperCase()})`);
console.log(`  DCB source:    ${dcbPath}`);
console.log(`  XML cache:     ${xmlCacheDir}`);
console.log(`  CSV output:    ${outputBase}`);
console.log(`  Types:         ${selectedTypes.length} of ${allTypes.length}`);
console.log(`  Dry run:       ${values['dry-run'] ? 'yes' : 'no'}`);
console.log();

// ---------------------------------------------------------------------------
// Ensure unforge is installed (comes with the unp4k suite)
// ---------------------------------------------------------------------------

const tools = await ensureToolsInstalled(toolDir, (msg) => console.log(`[tools] ${msg}`));
console.log(`  unforge: ${tools.unforge}`);
console.log();

// ---------------------------------------------------------------------------
// Prime the XML cache — run unforge once per game version
// ---------------------------------------------------------------------------

const cachedCount = await countDataCoreXmlFiles(xmlCacheDir);

if (cachedCount > 0 && !values['force-extract']) {
  console.log(`Using XML cache: ${cachedCount.toLocaleString()} files`);
  console.log(`  (${xmlCacheDir})`);
  console.log('  Run with --force-extract to re-run unforge.\n');
} else {
  if (values['force-extract'] && cachedCount > 0) {
    console.log('--force-extract: clearing existing cache...');
  }

  console.log(`Extracting DataForge records from ${path.basename(dcbPath)}...`);
  console.log('  This takes several minutes on first run.\n');

  // Copy the DCB into the cache directory and run unforge in directory mode.
  // unforge produces:
  //   <cacheDir>/<dcbname>.xml  — monolithic XML (deleted after extraction)
  //   <cacheDir>/libs/foundry/records/...  — individual entity record XMLs
  console.log(`  Running: unforge.cli.exe "${xmlCacheDir}"`);
  const { xmlFileCount: newCount } = await extractDataCoreXmlCache({
    dcbPath,
    xmlCacheDir,
    clearExisting: Boolean(values['force-extract'] && cachedCount > 0),
    runUnforge: (cacheDir) => runTool(tools.unforge, [cacheDir]),
  });

  console.log(`  Extraction complete: ${newCount.toLocaleString()} XML records cached.\n`);
}

// ---------------------------------------------------------------------------
// Per-type scraping
// ---------------------------------------------------------------------------

const COMMON_HEADERS = ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Class', 'Health'];

const bar = new cliProgress.SingleBar({
  format: '{bar} {percentage}% | {value}/{total} | {type}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
});

const results: Array<{ type: string; rows: number; skipped: number; csvFile: string }> = [];
const errors: Array<{ type: string; message: string }> = [];

bar.start(selectedTypes.length, 0, { type: '' });

for (let i = 0; i < selectedTypes.length; i++) {
  const { name, csvFile, typeConfig } = selectedTypes[i];
  bar.update(i, { type: name });

  try {
    // Filter cached XMLs whose path contains the recordFilter substring.
    const xmlFiles = await collectDataCoreXmlFilesMatching(xmlCacheDir, typeConfig.recordFilter);

    const typeHeaders = Object.keys(typeConfig.fieldSelectors);
    const headers = [...COMMON_HEADERS, ...typeHeaders];
    const rows: string[][] = [];
    let skipped = 0;

    for (const xmlPath of xmlFiles) {
      const xml = await fsp.readFile(xmlPath, 'utf8');
      let $: ReturnType<typeof loadXml>;
      try {
        $ = loadXml(xml);
      } catch {
        skipped++;
        continue;
      }

      let entityClass = extractEntityClass($);
      if (!entityClass) {
        entityClass = path.basename(xmlPath, path.extname(xmlPath));
      }

      if (!entityClass || entityClass.startsWith('__')) {
        skipped++;
        continue;
      }

      const attachDef = extractAttachDef($);
      const health = extractHealth($);

      const rowRecord: Record<string, string> = {
        'Entity Class': entityClass,
        Manufacturer: attachDef.manufacturer,
        Size: attachDef.size,
        Grade: attachDef.grade,
        Class: attachDef.subtype,
        Health: health,
      };

      const typeFields = typeHeaders.map((col) => {
        const spec = typeConfig.fieldSelectors[col];
        if (!spec) {
          rowRecord[col] = '';
          return '';
        }
        const value = resolveField($, spec, rowRecord);
        rowRecord[col] = value;
        return value;
      });

      rows.push([
        entityClass,
        attachDef.manufacturer,
        attachDef.size,
        attachDef.grade,
        attachDef.subtype,
        health,
        ...typeFields,
      ]);
    }

    if (!values['dry-run'] && rows.length > 0) {
      const csvContent = stringify([headers, ...rows]);
      const csvPath = path.join(outputBase, csvFile);
      await fsp.writeFile(csvPath, csvContent, 'utf8');
    }

    results.push({ type: name, rows: rows.length, skipped, csvFile });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push({ type: name, message });
  }
}

bar.update(selectedTypes.length, { type: '' });
bar.stop();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Results ===');
for (const r of results) {
  const dryNote = values['dry-run'] ? ' (dry run, not written)' : '';
  const skippedNote = r.skipped > 0 ? ` (${r.skipped} skipped)` : '';
  console.log(`  ${r.type.padEnd(28)} ${String(r.rows).padStart(4)} rows \u2192 ${r.csvFile}${dryNote}${skippedNote}`);
}

if (errors.length > 0) {
  console.error('\n=== Errors ===');
  for (const e of errors) {
    console.error(`  ${e.type}: ${e.message}`);
  }
}

if (!values['dry-run']) {
  console.log(`\nCSV output:  ${outputBase}`);
}
console.log(`XML cache:   ${xmlCacheDir}`);
console.log('\n=== Done ===');

if (errors.length > 0) process.exit(1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a field spec to a string value from the XML document.
 * Handles both plain string selectors (using xmlVal) and
 * { selector, attr } objects (using xmlAttr).
 */
function resolveField($: ReturnType<typeof loadXml>, spec: DataCoreFieldSelector, row: Record<string, string>): string {
  if (typeof spec === 'object' && 'derive' in spec) return spec.derive(row);
  if (typeof spec === 'string') return xmlVal($, spec);

  const element = spec.index === undefined ? $(spec.selector).first() : $(spec.selector).eq(spec.index);
  const values = spec.attrs?.map((attr) => element.attr(attr) ?? '') ?? [
    spec.attr ? (element.attr(spec.attr) ?? '') : '',
  ];

  if (spec.format === 'percent' && values[0]) return formatPercent(values[0]);
  if (spec.format === 'percent-pair') return values.map(formatPercent).join(spec.separator ?? ' / ');

  return values.join(spec.separator ?? ' / ');
}

function formatPercent(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `${Number((num * 100).toFixed(2))}%`;
}
