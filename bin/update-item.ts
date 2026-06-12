import { runCliCommand } from '../src/presentation/cli';
import { runUpdateItemCommand } from '../src/presentation/commands/update-item';

process.exitCode = await runCliCommand(runUpdateItemCommand, process.argv.slice(2));
