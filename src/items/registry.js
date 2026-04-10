import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const itemsDir = path.resolve(import.meta.dirname);
const erkulDir = path.join(itemsDir, 'erkul');
const spviewerDir = path.join(itemsDir, 'spviewer');

/**
 * Derives a CLI-friendly slug from a config filename.
 * @param {string} filename - e.g. "quantum-drives.js"
 * @param {string} prefix - e.g. "sp-" for spviewer configs
 */
function toSlug(filename, prefix = '') {
  return prefix + filename.replace(/\.js$/, '');
}

/**
 * Loads all item configs from a directory via dynamic import.
 * @param {string} dir
 * @param {string} prefix
 * @returns {Promise<Map<string, import('../lib/types.js').ItemConfig>>}
 */
async function loadConfigsFromDir(dir, prefix) {
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return new Map();
  }
  const configs = new Map();
  for (const entry of entries) {
    if (!entry.endsWith('.js') || entry === 'registry.js') continue;
    const slug = toSlug(entry, prefix);
    const fullPath = path.join(dir, entry);
    const { default: config } = await import(pathToFileURL(fullPath).href);
    configs.set(slug, config);
  }
  return configs;
}

/** @returns {Promise<Map<string, import('../lib/types.js').ItemConfig>>} */
export async function loadErkulConfigs() {
  return loadConfigsFromDir(erkulDir, '');
}

/** @returns {Promise<Map<string, import('../lib/types.js').ItemConfig>>} */
export async function loadSpviewerConfigs() {
  return loadConfigsFromDir(spviewerDir, 'sp-');
}

/**
 * Loads all configs (default + spviewer) into a single map.
 * @returns {Promise<Map<string, import('../lib/types.js').ItemConfig>>}
 */
export async function loadAllConfigs() {
  const [erkul, spviewer] = await Promise.all([loadErkulConfigs(), loadSpviewerConfigs()]);
  return new Map([...erkul, ...spviewer]);
}

/**
 * Loads a single config by its slug name.
 * @param {string} slug - e.g. "coolers" or "sp-weapon-guns"
 * @returns {Promise<import('../lib/types.js').ItemConfig>}
 */
export async function loadConfig(slug) {
  let filePath;
  if (slug.startsWith('sp-')) {
    filePath = path.join(spviewerDir, `${slug.slice(3)}.js`);
  } else {
    filePath = path.join(erkulDir, `${slug}.js`);
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
 * @returns {Promise<{ default: string[], spviewer: string[] }>}
 */
export async function listCategories() {
  const readSlugs = async (dir, prefix) => {
    try {
      const entries = await fs.readdir(dir);
      return entries.filter((e) => e.endsWith('.js') && e !== 'registry.js').map((e) => toSlug(e, prefix));
    } catch {
      return [];
    }
  };
  const [erkul, spviewer] = await Promise.all([readSlugs(erkulDir, ''), readSlugs(spviewerDir, 'sp-')]);
  return { erkul, spviewer };
}
