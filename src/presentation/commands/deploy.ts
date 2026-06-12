import path from 'node:path';
import { parseArgs } from 'node:util';
import { deployGlobalIni } from '../../application/use-cases/deploy-global-ini';
import { resolveLiveDir } from '../../io/local/unp4k-tool';
import { type CommandIO, defaultCommandIO, writeErrorLine, writeLine } from '../cli';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..', '..');

interface DeployCommandDependencies {
  deployGlobalIni?: typeof deployGlobalIni;
  resolveLiveDir?: typeof resolveLiveDir;
}

function printHelp(io: CommandIO): void {
  writeLine(
    io,
    `Usage: node --import tsx/esm bin/deploy.ts [options]

Deploy repo global.ini to the resolved game directory.

Options:
  -i, --ini-path <path>  Repo global.ini path (default: ./global.ini)
  --target <path>        Explicit game global.ini target path
  -h, --help             Show this message`,
  );
}

function defaultTargetPath(resolveLive: typeof resolveLiveDir): string {
  return path.join(resolveLive(path.join(ROOT_DIR, 'bin')), 'Data', 'Localization', 'english', 'global.ini');
}

export async function runDeployCommand(
  argv: string[],
  io: CommandIO = defaultCommandIO(),
  dependencies: DeployCommandDependencies = {},
): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      'ini-path': { type: 'string', short: 'i' },
      target: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  const deploy = dependencies.deployGlobalIni ?? deployGlobalIni;
  const resolveLive = dependencies.resolveLiveDir ?? resolveLiveDir;
  const repoIniPath = values['ini-path'] ? path.resolve(values['ini-path']) : path.join(ROOT_DIR, 'global.ini');
  const targetIniPath = values.target ? path.resolve(values.target) : defaultTargetPath(resolveLive);

  try {
    const result = await deploy({ repoIniPath, targetIniPath });
    writeLine(io, `Deployed ${result.repoIniPath} -> ${result.targetIniPath}`);
    return 0;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    writeErrorLine(io, `ERROR: ${error.message}`);
    return 1;
  }
}
