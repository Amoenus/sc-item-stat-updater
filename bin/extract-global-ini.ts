import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGlobalIni } from '../src/pipeline/extract.js';

// Run when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  extractGlobalIni(process.argv[2]).catch((err: Error) => {
    console.error(`[extract-global-ini] ERROR: ${err.message}`);
    process.exit(1);
  });
}
