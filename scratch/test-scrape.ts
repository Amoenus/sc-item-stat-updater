import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDatacoreScrape } from '../src/application/use-cases/run-datacore-scrape';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const result = await runDatacoreScrape({
    repoRoot: path.resolve(__dirname, '..'),
    binDirname: path.resolve(__dirname, '../bin'),
    ptu: false,
    dryRun: false,
    forceExtract: false,
    types: [],
    loadTypes: async () => [],
    onPrepared: () => console.log('Prepared'),
    onToolsLog: (msg) => console.log(`[tools] ${msg}`),
    onToolsReady: () => console.log('Tools ready'),
    onCacheHit: () => console.log('Cache hit'),
    onCacheExtractStart: () => console.log('Extracting...'),
    onCacheExtractComplete: () => console.log('Extracted'),
  });

  console.log('Done:', result.contractHaulingSummaryResult);
}

main().catch(console.error);
