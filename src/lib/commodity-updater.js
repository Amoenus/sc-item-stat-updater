import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIniFile, writeIniFile, backupIniFile } from './io/ini-file.js';
import { applyCommodityDisplayOverrides } from './commodity-mapping.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

/**
 * Updates commodity display names in global.ini.
 * @param {{iniPath?: string, dryRun?: boolean, skipBackup?: boolean}} options
 * @returns {Promise<{updatedCount:number, updates:Array<{key:string,from:string,to:string}>}>}
 */
export async function runCommodityUpdate(options = {}) {
  const iniPath = options.iniPath
    ? path.resolve(options.iniPath)
    : path.join(ROOT_DIR, 'global.ini');

  const { lines, index: existingKeys } = await readIniFile(iniPath);
  const result = applyCommodityDisplayOverrides(lines, existingKeys);

  if (result.updatedCount === 0) {
    return result;
  }

  if (!options.dryRun) {
    if (!options.skipBackup) {
      await backupIniFile(iniPath);
    }
    await writeIniFile(iniPath, lines, { skipBackup: true });
  }

  return result;
}
