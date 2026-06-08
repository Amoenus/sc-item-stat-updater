import fs from 'node:fs/promises';
import path from 'node:path';

export async function findDataCoreDcbFile(liveDir: string): Promise<string> {
  const dataDir = path.join(liveDir, 'Data');
  let entries: import('node:fs').Dirent<string>[];
  try {
    entries = await fs.readdir(dataDir, { withFileTypes: true });
  } catch {
    throw new Error(`Could not read LIVE/Data directory: ${dataDir}. Set SC_LIVE_DIR correctly.`);
  }

  const dcb = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.dcb'));
  if (!dcb) {
    throw new Error(`No .dcb file found in ${dataDir}. Ensure the game is installed.`);
  }

  return path.join(dataDir, dcb.name);
}

export async function collectDataCoreXmlFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: import('node:fs').Dirent<string>[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectDataCoreXmlFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
      results.push(full);
    }
  }

  return results;
}

export async function collectDataCoreXmlFilesMatching(dir: string, filter: string): Promise<string[]> {
  const all = await collectDataCoreXmlFiles(dir);
  const lowerFilter = filter.toLowerCase();
  return all.filter((file) => file.toLowerCase().replaceAll('\\', '/').includes(lowerFilter));
}

export async function countDataCoreXmlFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await countDataCoreXmlFiles(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
        count++;
      }
    }
  } catch {
    // ignore
  }
  return count;
}
