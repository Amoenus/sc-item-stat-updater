import { runCliCommand } from '../src/presentation/cli';
import { runScrapeScmdbCommand } from '../src/presentation/commands/scrape-scmdb';

process.exitCode = await runCliCommand(runScrapeScmdbCommand, process.argv.slice(2));
