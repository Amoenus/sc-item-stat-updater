import path from 'node:path';
import { parseArgs } from 'node:util';
import { readArtifactFile } from '../../artifact/artifact';
import { applyArtifact, formatArtifactApplyPreview } from '../../artifact/loader';
import { getLogger } from '../../infrastructure/logger';
import {
  applyLogFlags,
  type CommandIO,
  defaultCommandIO,
  printIssuesTo,
  registerUnhandledRejectionHandler,
  writeErrorLine,
  writeLine,
} from '../cli';

const logger = getLogger('apply-artifact');

export async function runApplyArtifactCommand(argv: string[], io: CommandIO = defaultCommandIO()): Promise<number> {
  registerUnhandledRejectionHandler(logger);

  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      'ini-path': { type: 'string', short: 'i' },
      'dry-run': { type: 'boolean', default: false },
      'skip-missing': { type: 'boolean', default: true },
      verbose: { type: 'boolean', short: 'v', default: false },
      'json-logs': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  const artifactArg = positionals[0];

  if (values.help || !artifactArg) {
    writeLine(io, 'Usage: node apply-artifact.js <artifact-path> [options]');
    writeLine(io, '\nArguments:');
    writeLine(io, '  <artifact-path>        Path to a patch artifact JSON file');
    writeLine(io, '\nOptions:');
    writeLine(io, '  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
    writeLine(io, '      --dry-run          Preview changes without writing');
    writeLine(io, '      --skip-missing     Silently skip keys absent from the INI (default: true)');
    writeLine(io, '  -v, --verbose          Enable verbose logging');
    writeLine(io, '      --json-logs        Output logs as JSON (for log aggregation)');
    writeLine(io, '  -h, --help             Show this help message');
    return values.help ? 0 : 1;
  }

  applyLogFlags(values);

  const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
  const artifactPath = path.resolve(artifactArg);
  const iniPath = values['ini-path'] ? path.resolve(values['ini-path']) : path.join(repoRoot, 'global.ini');

  try {
    logger.info('Reading artifact', { path: artifactPath });
    const artifact = await readArtifactFile(artifactPath);

    writeLine(io, `Artifact: ${artifactPath}`);
    writeLine(io, `  Generated: ${artifact.generatedAt ?? 'unknown'}`);
    if (artifact.scmdbVersion) writeLine(io, `  SCMDB:     ${artifact.scmdbVersion}`);
    if (artifact.spviewerVersion) writeLine(io, `  SPViewer:  ${artifact.spviewerVersion}`);
    writeLine(io, `  Entries:   ${Object.keys(artifact.entries).length}`);
    writeLine(io);

    const result = await applyArtifact(artifact, iniPath, {
      dryRun: values['dry-run'],
      skipMissing: values['skip-missing'],
    });

    if (values['dry-run']) {
      writeLine(io, formatArtifactApplyPreview(result));
    }
    writeLine(io, result.summary);

    printIssuesTo(io, result.issues);
    return 0;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to apply artifact', {
      error: error.message,
      cause: err instanceof Error && 'cause' in err && err.cause instanceof Error ? err.cause.message : undefined,
    });
    writeErrorLine(io, `ERROR: ${error.message}`);
    return 1;
  }
}
