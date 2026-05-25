import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureToolsInstalled, resolveLiveDir, runTool } from '../src/io/local/unp4k-tool';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LIVE_DIR = resolveLiveDir(__dirname);

const FILTER = 'global.ini';

function log(msg: string): void {
  console.log(`[extract-global-ini] ${msg}`);
}

export async function extractGlobalIni(p4kFile?: string): Promise<string> {
  const resolvedP4k = p4kFile ?? path.join(LIVE_DIR, 'Data.p4k');
  const outputDir = path.dirname(resolvedP4k);
  const toolDir = path.join(outputDir, 'unp4k');
  const resultPath = path.join(outputDir, 'Data', 'Localization', 'english', FILTER);

  if (!fs.existsSync(resolvedP4k)) {
    throw new Error(`Data.p4k not found at: ${resolvedP4k}`);
  }

  const { unp4k: toolExe } = await ensureToolsInstalled(toolDir, log);

  log(`Extracting: ${FILTER}`);
  log(`  Source : ${resolvedP4k}`);
  log(`  Output : ${outputDir}`);

  if (fs.existsSync(resultPath)) {
    log('Removing existing global.ini before fresh extraction...');
    fs.rmSync(resultPath);
  }

  // unp4k extracts relative to cwd; run from outputDir
  runTool(toolExe, [resolvedP4k, FILTER], { cwd: outputDir });

  if (!fs.existsSync(resultPath)) {
    throw new Error(`Extraction completed but global.ini not found at: ${resultPath}`);
  }

  const { size } = fs.statSync(resultPath);
  log(`SUCCESS: global.ini extracted (${size} bytes)`);
  log(`  Path: ${resultPath}`);
  return resultPath;
}

// Run when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    await extractGlobalIni(process.argv[2]);
  } catch (err) {
    console.error(`[extract-global-ini] ERROR: ${(err as Error).message}`);
    process.exit(1);
  }
}
