import { runCliCommand } from '../src/presentation/cli';
import { runExtractGlobalIniCommand } from '../src/presentation/commands/extract-global-ini';

process.exitCode = await runCliCommand(runExtractGlobalIniCommand, process.argv.slice(2));
