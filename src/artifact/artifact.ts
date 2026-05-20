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
import type { ItemConfig } from '../lib/types';
import { buildPatchData } from '../lib/updater';
import { ArtifactSchema } from '../schema/artifact.schema';

export type { ArtifactDTO as Artifact } from '../schema/artifact.schema';

/**
 * Generates a patch artifact by running the Extract+Transform phase for every
 * supplied config and merging the resulting patches into a single manifest.
 */
export async function generateArtifact(
  categories: Array<{ config: ItemConfig; csvDir: string }>,
  opts: { iniPath: string; scmdbVersion?: string; spviewerVersion?: string },
): Promise<import('../schema/artifact.schema').ArtifactDTO> {
  const entries: Record<string, string> = {};
  const issues: Array<{ label: string; key: string; reason: string; type: string }> = [];
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

  return ArtifactSchema.parse({
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
  });
}

/**
 * Writes a patch artifact to disk as JSON.
 *
 * @param artifactPath - Absolute path to write (e.g. patch-data.json)
 * @param artifact - Artifact object returned by {@link generateArtifact}
 */
export async function writeArtifactFile(
  artifactPath: string,
  artifact: import('../schema/artifact.schema').ArtifactDTO,
): Promise<void> {
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
}

/**
 * Reads and validates a patch artifact from disk against the canonical
 * `ArtifactSchema`.  A `ZodError` is thrown if the file does not conform —
 * this is the system boundary where untyped JSON becomes a fully typed DTO.
 *
 * @param artifactPath - Absolute path to the JSON artifact
 * @returns The parsed and validated artifact DTO
 */
export async function readArtifactFile(
  artifactPath: string,
): Promise<import('../schema/artifact.schema').ArtifactDTO> {
  let raw: string;
  try {
    raw = await fs.readFile(artifactPath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read artifact file: ${artifactPath}`, { cause: err });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Artifact file is not valid JSON: ${artifactPath}`, { cause: err });
  }

  const result = ArtifactSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Artifact file has unexpected structure: ${artifactPath}\n${result.error.message}`,
    );
  }

  return result.data;
}
