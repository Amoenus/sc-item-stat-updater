import { runCliCommand } from '../src/presentation/cli';
import { runUpdateAllCommand } from '../src/presentation/commands/update-all';

process.exitCode = await runCliCommand(runUpdateAllCommand, process.argv.slice(2));
