import { runCliCommand } from '../src/presentation/cli';
import { runApplyArtifactCommand } from '../src/presentation/commands/apply-artifact';

process.exitCode = await runCliCommand(runApplyArtifactCommand, process.argv.slice(2));
