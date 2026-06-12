import { runCliCommand } from '../src/presentation/cli';
import { runDeployCommand } from '../src/presentation/commands/deploy';

process.exitCode = await runCliCommand(runDeployCommand, process.argv.slice(2));
