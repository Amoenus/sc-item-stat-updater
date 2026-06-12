import { dirname, join } from 'node:path';
import type { RunScmdbScrapeResult } from '../../application/use-cases/run-scmdb-scrape';
import { ScmdbVersionsSchema } from '../../schema/scmdb.schemas';
import { fetchAndValidateScmdbJson, SCMDB_VERSIONS_URL } from '../../sources/scmdb/acquisition';
import type { ScmdbVersionEntry } from '../../sources/scmdb/version-selection';
import { type CommandIO, defaultCommandIO, writeErrorLine, writeLine } from '../cli';
import { createScmdbScrapeTask } from '../scmdb-task';
import { createCommandTaskList } from '../task-list';

const repoRoot = join(dirname(import.meta.dirname), '..', '..');

function usage(io: CommandIO) {
  writeLine(
    io,
    `Usage: node scrape-scmdb.js [options]

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
`,
  );
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

function printVersions(io: CommandIO, versions: ScmdbVersionEntry[]): void {
  writeLine(io, 'Available SCMDB versions:');
  for (const entry of versions) {
    writeLine(io, `  ${entry.version} -> ${entry.file}`);
  }
  writeLine(io, '');
  writeLine(
    io,
    'By default this scraper uses the latest live SCMDB version. Use --ptu to fetch the latest PTU version instead.',
  );
}

interface ScrapeScmdbTaskContext {
  result?: RunScmdbScrapeResult;
}

export async function runScrapeScmdbCommand(argv: string[], io: CommandIO = defaultCommandIO()): Promise<number> {
  const listVersions = argv.includes('--list-versions');
  const rawOnly = argv.includes('--raw');
  const help = argv.includes('--help') || argv.includes('-h');

  try {
    if (help) {
      usage(io);
      return 0;
    }

    if (listVersions) {
      const versions = await fetchAndValidateScmdbJson(SCMDB_VERSIONS_URL, ScmdbVersionsSchema);
      printVersions(io, versions);
      return 0;
    }

    const context: ScrapeScmdbTaskContext = {};
    await createCommandTaskList(
      [
        createScmdbScrapeTask<ScrapeScmdbTaskContext>({
          title: 'Scrape SCMDB',
          repoRoot,
          ...getVersionSelection(argv),
          rawOnly,
          onResult: (result) => {
            context.result = result;
          },
          onWarning: (message, error) => {
            const detail = error instanceof Error ? error.message : error ? String(error) : '';
            writeErrorLine(io, `WARNING: ${message}${detail ? `: ${detail}` : ''}`);
          },
        }),
      ],
      io,
      context,
    ).run();

    const result = context.result;
    if (!result) throw new Error('SCMDB scraper did not produce a result.');
    writeLine(io, `SCMDB scrape complete. Outputs saved to csv/scmdb/${result.selected.version}/`);
    return 0;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    writeErrorLine(io, `ERROR: ${error.message}`);
    return 1;
  }
}
