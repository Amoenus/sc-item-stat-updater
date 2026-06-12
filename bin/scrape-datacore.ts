import { runCliCommand } from '../src/presentation/cli';
import { runScrapeDatacoreCommand } from '../src/presentation/commands/scrape-datacore';

process.exitCode = await runCliCommand(runScrapeDatacoreCommand, process.argv.slice(2));
