#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpviewerScrape, SPVIEWER_ITEM_TYPES } from '../src/application/use-cases/run-spviewer-scrape';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __rootDir = join(__dirname, '..');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scrape-spviewer.js [itemType ...] [options]

Item types: ${SPVIEWER_ITEM_TYPES.join(', ')}

Options:
  --all        Scrape all item types
  --ptu        Use PTU version label for output directory (default: LIVE)
  --live       Use LIVE version label for output directory (default)
  --list       List available item types
  --json       Output JSON instead of CSV
  -h, --help   Show this help

Output:
  CSVs are written to csv/spviewer/<version>-live/ or csv/spviewer/<version>-ptu/
  The version string is extracted from the SPViewer page header.

Examples:
  node scrape-spviewer.js --all
  node scrape-spviewer.js Radar Shield
  node scrape-spviewer.js --all --ptu`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Available item types:');
  for (const type of SPVIEWER_ITEM_TYPES) console.log(`  ${type}`);
  process.exit(0);
}

const usePtu = args.includes('--ptu');
const useJson = args.includes('--json');
const useAll = args.includes('--all');
const types = useAll ? SPVIEWER_ITEM_TYPES.slice() : args.filter((arg) => !arg.startsWith('--'));

if (types.length === 0) {
  console.error('Error: specify at least one item type, or use --all');
  process.exit(1);
}

const channel = usePtu ? 'ptu' : 'live';
let activeVersion = '';

try {
  const result = await runSpviewerScrape({
    repoRoot: __rootDir,
    ptu: usePtu,
    json: useJson,
    types,
    onVersionDetectStart: () => {
      console.log(`SPViewer scraper - channel: ${channel.toUpperCase()}`);
      console.log('Launching browser to detect version...');
    },
    onPrepared: ({ version }) => {
      activeVersion = version;
      console.log(`Version: ${version}`);
      console.log(`Output:  csv/spviewer/${version}/`);
      console.log();
    },
    onTypeStart: (itemType) => {
      console.log(`  Scraping ${itemType}...`);
    },
    onTypeScraped: (_itemType, data) => {
      console.log(`    ${data.rows.length} rows, ${data.headers.length} columns`);
    },
    onFileWritten: ({ fileName }) => {
      console.log(`    Saved: csv/spviewer/${activeVersion}/${fileName}`);
    },
    onTypeError: ({ itemType, message }) => {
      console.error(`  FAILED ${itemType}: ${message}`);
    },
  });

  console.log(`\nDone. Scraped ${result.types.length} item type(s) into csv/spviewer/${result.version}/`);
  if (result.exitCode !== 0) process.exit(result.exitCode);
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(error.message);
  process.exit(1);
}
