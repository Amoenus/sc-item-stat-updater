import { runCliCommand } from '../src/presentation/cli';
import { runCacheCommand } from '../src/presentation/commands/cache';

process.exitCode = await runCliCommand(runCacheCommand, process.argv.slice(2));
