import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGlobalIni } from '../src/pipeline/extract.js';

// Run when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    await extractGlobalIni(process.argv[2]);
  } catch (err) {
    console.error(`[extract-global-ini] ERROR: ${(err as Error).message}`);
    process.exit(1);
  }
}
