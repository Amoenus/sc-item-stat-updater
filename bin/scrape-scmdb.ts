import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runScmdbScrape } from '../src/application/use-cases/run-scmdb-scrape';
import { ScmdbVersionsSchema } from '../src/schema/scmdb.schemas';
import { fetchAndValidateScmdbJson, SCMDB_VERSIONS_URL } from '../src/sources/scmdb/acquisition';
import type { ScmdbVersionEntry } from '../src/sources/scmdb/version-selection';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

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
  node scrape-scmdb.js --version 4.8.1-live.11875683
  node scrape-scmdb.js --list-versions
`);
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

  if (listVersions) {
    const versions = await fetchAndValidateScmdbJson(SCMDB_VERSIONS_URL, ScmdbVersionsSchema);
    printVersions(versions);
    process.exit(0);
  }

  const result = await runScmdbScrape({
    repoRoot,
    ...getVersionSelection(args),
    rawOnly,
    onVersionSelected: (selected) => {
      console.log(`Using SCMDB version ${selected.version}`);
    },
    onFileWritten: (file) => {
      console.log(`Saved ${file.section === 'missions' ? 'missions/' : ''}${file.fileName}`);
    },
  });

  console.log(`SCMDB scrape complete. Outputs saved to csv/scmdb/${result.selected.version}/`);
}

try {
  await main();
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('ERROR:', error.message);
  process.exit(1);
}
