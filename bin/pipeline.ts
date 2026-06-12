import { runCliCommand } from '../src/presentation/cli';
import { runPipelineCommand } from '../src/presentation/commands/pipeline';

process.exitCode = await runCliCommand(runPipelineCommand, process.argv.slice(2));
