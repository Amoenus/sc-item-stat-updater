/**
 * apply-artifact.js  (ADR 002 — Load phase CLI)
 *
 * Applies a pre-generated patch artifact (patch-data.json) to a local
 * global.ini without re-fetching any upstream data.  This is the counterpart
 * to `update-all.js --emit-artifact` and enables the Phase-2 workflow where
 * the artifact is produced by CI/CD and consumed separately by the user.
 *
 * Usage:
 *   node apply-artifact.js <artifact-path> [options]
 *
 * Examples:
 *   node apply-artifact.js patch-data.json
 *   node apply-artifact.js patch-data.json --dry-run
 *   node apply-artifact.js patch-data.json -i /path/to/global.ini
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { readArtifactFile } from '../src/artifact/artifact.js';
import { applyArtifact } from '../src/artifact/loader.js';
import { applyLogFlags, printIssues, registerUnhandledRejectionHandler } from '../src/lib/cli.js';
import { getLogger, shutdownLogger } from '../src/lib/logger.js';

const logger = getLogger('apply-artifact');

registerUnhandledRejectionHandler(logger);

const { values, positionals } = parseArgs({
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
  console.log('Usage: node apply-artifact.js <artifact-path> [options]');
  console.log('\nArguments:');
  console.log('  <artifact-path>        Path to a patch artifact JSON file');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('      --skip-missing     Silently skip keys absent from the INI (default: true)');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  process.exit(values.help ? 0 : 1);
}

applyLogFlags(values);

const repoRoot = path.resolve(import.meta.dirname, '..');
const artifactPath = path.resolve(artifactArg);
const iniPath = values['ini-path'] ? path.resolve(values['ini-path']) : path.join(repoRoot, 'global.ini');

try {
  logger.info('Reading artifact', { path: artifactPath });
  const artifact = await readArtifactFile(artifactPath);

  console.log(`Artifact: ${artifactPath}`);
  console.log(`  Generated: ${artifact.generatedAt ?? 'unknown'}`);
  if (artifact.scmdbVersion) console.log(`  SCMDB:     ${artifact.scmdbVersion}`);
  if (artifact.spviewerVersion) console.log(`  SPViewer:  ${artifact.spviewerVersion}`);
  console.log(`  Entries:   ${Object.keys(artifact.entries).length}`);
  console.log();

  const result = await applyArtifact(artifact, iniPath, {
    dryRun: values['dry-run'],
    skipMissing: values['skip-missing'],
  });

  console.log(result.summary);

  printIssues(result.issues);
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to apply artifact', {
    error: error.message,
    cause: err instanceof Error && 'cause' in err && err.cause instanceof Error ? err.cause.message : undefined,
  });
  console.error(`ERROR: ${error.message}`);
  await shutdownLogger();
  process.exit(1);
}

await shutdownLogger();
