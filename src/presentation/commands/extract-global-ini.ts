import { parseArgs } from 'node:util';
import { extractGlobalIni } from '../../pipeline/extract';
import { type CommandIO, defaultCommandIO, writeErrorLine, writeLine } from '../cli';

interface ExtractGlobalIniCommandDependencies {
  extractGlobalIni?: typeof extractGlobalIni;
}

function printHelp(io: CommandIO): void {
  writeLine(
    io,
    `Usage: node --import tsx/esm bin/extract-global-ini.ts [Data.p4k]

Extract original global.ini from the game files.

Arguments:
  Data.p4k       Optional path to Data.p4k. Defaults to the resolved Star Citizen LIVE directory.

Options:
  -h, --help     Show this message`,
  );
}

export async function runExtractGlobalIniCommand(
  argv: string[],
  io: CommandIO = defaultCommandIO(),
  dependencies: ExtractGlobalIniCommandDependencies = {},
): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  try {
    const extract = dependencies.extractGlobalIni ?? extractGlobalIni;
    await extract(positionals[0], (message) => writeLine(io, `[extract-global-ini] ${message}`));
    return 0;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    writeErrorLine(io, `[extract-global-ini] ERROR: ${error.message}`);
    return 1;
  }
}
