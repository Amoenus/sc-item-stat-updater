/**
 * Artifact generator and reader (ADR 002).
 *
 * The artifact is an intermediary JSON manifest that decouples the
 * Extract+Transform phase from the Load (INI-write) phase.  The CI/CD
 * pipeline (Phase 2) can commit this file to GitHub Pages so the browser
 * client can apply it locally without ever sending user files to a server.
 *
 * Schema:
 * {
 *   "generatedAt": "<ISO 8601>",
 *   "scmdbVersion": "<string>",
 *   "spviewerVersion": "<string>",
 *   "entries": { "<iniKey>": "<iniValue>", ... },
 *   "stats": {
 *     "categoryCount": <n>,
 *     "totalEntries": <n>,
 *     "totalSkipped": <n>,
 *     "totalErrors": <n>
 *   },
 *   "issues": [{ "label": "<string>", "key": "<string>", "reason": "<string>", "type": "<string>" }]
 * }
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ItemConfig } from '../lib/types.js';
import { buildPatchData } from '../lib/updater.js';

export interface Artifact {
  generatedAt: string;
  scmdbVersion: string | null;
  spviewerVersion: string | null;
  entries: Record<string, string>;
  stats: {
    categoryCount: number;
    totalEntries: number;
    totalSkipped: number;
    totalErrors: number;
  };
  issues: Array<{ label: string; key: string; reason: string; type: string }>;
}

/**
 * Generates a patch artifact by running the Extract+Transform phase for every
 * supplied config and merging the resulting patches into a single manifest.
 *
 * @param {Array<{ config: import('./types.js').ItemConfig, csvDir: string }>} categories
 * @param {object} opts
 * @param {string} opts.iniPath - Path to global.ini (needed for flavor-text extraction)
 * @param {string} [opts.scmdbVersion]
 * @param {string} [opts.spviewerVersion]
 * @returns {Promise<object>} The in-memory artifact object
 */
export async function generateArtifact(
  categories: Array<{ config: ItemConfig; csvDir: string }>,
  opts: { iniPath: string; scmdbVersion?: string; spviewerVersion?: string },
): Promise<object> {
  const entries: Record<string, string> = {};
  const issues = [];
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { config, csvDir } of categories) {
    const result = await buildPatchData(config, { iniPath: opts.iniPath, csvDir });

    // Merge key/value patches from this category.
    Object.assign(entries, result.patches);

    // Merge new-entry lines (key=value strings) — parse back to structured entries.
    for (const line of result.newLines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > -1) {
        const key = line.substring(0, eqIdx);
        const value = line.substring(eqIdx + 1);
        entries[key] = value;
      }
    }

    totalSkipped += result.stats.skippedCount ?? 0;
    totalErrors += result.stats.errorCount ?? 0;

    for (const issue of result.issues) {
      issues.push({ label: config.label, ...issue });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    scmdbVersion: opts.scmdbVersion ?? null,
    spviewerVersion: opts.spviewerVersion ?? null,
    entries,
    stats: {
      categoryCount: categories.length,
      totalEntries: Object.keys(entries).length,
      totalSkipped,
      totalErrors,
    },
    issues,
  };
}

/**
 * Writes a patch artifact to disk as JSON.
 *
 * @param {string} artifactPath - Absolute path to write (e.g. patch-data.json)
 * @param {object} artifact - Artifact object returned by {@link generateArtifact}
 */
export async function writeArtifactFile(artifactPath: string, artifact: Artifact): Promise<void> {
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
}

/**
 * Reads and performs basic validation of a patch artifact from disk.
 *
 * @param {string} artifactPath - Absolute path to the JSON artifact
 * @returns {Promise<object>} The parsed artifact object
 */
export async function readArtifactFile(artifactPath: string): Promise<Artifact> {
  let raw;
  try {
    raw = await fs.readFile(artifactPath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read artifact file: ${artifactPath}`, { cause: err });
  }

  let artifact;
  try {
    artifact = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Artifact file is not valid JSON: ${artifactPath}`, { cause: err });
  }

  if (!artifact || typeof artifact.entries !== 'object' || Array.isArray(artifact.entries)) {
    throw new Error(`Artifact file has unexpected structure (missing "entries" object): ${artifactPath}`);
  }

  return artifact;
}
