import fs from 'node:fs';
import path from 'node:path';
import { ensureToolsInstalled, resolveLiveDir, runTool } from '../io/local/unp4k-tool.js';

const FILTER = 'global.ini';

function log(msg: string): void {
  console.log(`[extract-global-ini] ${msg}`);
}

/**
 * Extracts global.ini from Data.p4k using the unp4k tool.
 *
 * @param p4kFile - Optional path to Data.p4k. Defaults to Data.p4k in the
 *   resolved Star Citizen LIVE directory.
 * @returns The absolute path to the extracted global.ini file.
 */
export async function extractGlobalIni(p4kFile?: string): Promise<string> {
  const liveDir = resolveLiveDir(path.resolve(import.meta.dirname, '..', '..', 'bin'));
  const resolvedP4k = p4kFile ?? path.join(liveDir, 'Data.p4k');
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
