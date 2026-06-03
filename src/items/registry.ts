import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ItemConfig } from '../lib/types';

const itemsDir = path.resolve(import.meta.dirname);
const spviewerDir = path.join(itemsDir, 'spviewer');
const missionsDir = path.join(itemsDir, 'missions');
const datacoreDir = path.join(itemsDir, 'datacore');

/**
 * Derives a CLI-friendly slug from a config filename.
 */
function toSlug(filename: string, prefix = ''): string {
  return prefix + filename.replace(/\.ts$/, '');
}

/**
 * Loads all item configs from a directory via dynamic import.
 */
async function loadConfigsFromDir(dir: string, prefix: string): Promise<Map<string, ItemConfig>> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return new Map();
  }
  const configs = new Map<string, ItemConfig>();
  for (const entry of entries) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry === 'registry.ts' || entry === 'types.ts')
      continue;
    const slug = toSlug(entry, prefix);
    const fullPath = path.join(dir, entry);
    const { default: config } = await import(pathToFileURL(fullPath).href);
    configs.set(slug, config);
  }
  return configs;
}

export async function loadSpviewerConfigs(): Promise<Map<string, ItemConfig>> {
  return loadConfigsFromDir(spviewerDir, 'sp-');
}

export async function loadDatacoreConfigs(): Promise<Map<string, ItemConfig>> {
  return loadConfigsFromDir(datacoreDir, 'dc-');
}

export async function loadMissionConfigs(): Promise<Map<string, ItemConfig>> {
  return loadConfigsFromDir(missionsDir, 'mission-');
}

/**
 * Loads a single config by its slug name.
 */
export async function loadConfig(slug: string): Promise<ItemConfig> {
  let filePath: string;
  if (slug.startsWith('sp-')) {
    filePath = path.join(spviewerDir, `${slug.slice(3)}.ts`);
  } else if (slug.startsWith('mission-')) {
    filePath = path.join(missionsDir, `${slug.slice(8)}.ts`);
  } else if (slug.startsWith('dc-')) {
    filePath = path.join(datacoreDir, `${slug.slice(3)}.ts`);
  } else {
    throw new Error(`Unknown category: ${slug}`);
  }
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Unknown category: ${slug}`);
  }
  const { default: config } = await import(pathToFileURL(filePath).href);
  return config;
}

/**
 * Lists all available category slugs without loading the modules.
 */
export async function listCategories(): Promise<{ spviewer: string[]; missions: string[]; datacore: string[] }> {
  const readSlugs = async (dir: string, prefix: string): Promise<string[]> => {
    try {
      const entries = await fs.readdir(dir);
      return entries
        .filter((e) => e.endsWith('.ts') && !e.endsWith('.test.ts') && e !== 'registry.ts' && e !== 'types.ts')
        .map((e) => toSlug(e, prefix));
    } catch {
      return [];
    }
  };
  const [spviewer, missions, datacore] = await Promise.all([
    readSlugs(spviewerDir, 'sp-'),
    readSlugs(missionsDir, 'mission-'),
    readSlugs(datacoreDir, 'dc-'),
  ]);
  return { spviewer, missions, datacore };
}
