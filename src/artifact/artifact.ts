/**
 * Artifact generator and reader (ADR 002).
 *
 * The artifact is an intermediary JSON projection of a PatchPlan that decouples
 * the Extract+Transform phase from the Load (INI-write) phase. The CI/CD
 * pipeline (Phase 2) can commit this file to GitHub Pages so the browser
 * client can apply it locally without ever sending user files to a server.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ZodIssue } from 'zod';
import { buildPatchPlanResult } from '../application/use-cases/build-patch-plan';
import type { ItemConfig } from '../enrichment/item-config';
import type { PatchPlan } from '../pipeline/types';
import { type ArtifactDTO, ArtifactSchema } from '../schema/artifact.schema';

export type { ArtifactDTO as Artifact } from '../schema/artifact.schema';

const ARTIFACT_PATCH_SOURCE = 'artifact';
const ARTIFACT_PATCH_REASON = 'Serialized patch artifact entry';

/**
 * Converts an in-memory PatchPlan to the compact artifact entries map.
 *
 * The artifact schema intentionally persists only localization key/value pairs
 * for backward compatibility with existing consumers. In-memory application
 * hints such as LocalizationPatchEntry.existingLineIndex are not serialized.
 */
export function patchPlanToArtifactEntries(plan: PatchPlan): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const entry of plan.entries) {
    entries[entry.key] = entry.value;
  }
  return entries;
}

/**
 * Rehydrates artifact entries into a PatchPlan for code paths that operate on
 * the pipeline contract. Serialized artifacts do not contain source/reason
 * fields per entry, so stable artifact defaults are used.
 */
export function artifactToPatchPlan(artifact: Pick<ArtifactDTO, 'entries' | 'issues'>): PatchPlan {
  return {
    entries: Object.entries(artifact.entries).map(([key, value]) => ({
      key,
      value,
      source: ARTIFACT_PATCH_SOURCE,
      reason: ARTIFACT_PATCH_REASON,
    })),
    issues: artifact.issues,
  };
}

/**
 * Generates a patch artifact by planning every supplied config and merging the
 * resulting patch-plan entries into a single serialized manifest.
 */
export async function generateArtifact(
  categories: Array<{ config: ItemConfig; csvDir: string }>,
  opts: { iniPath: string; scmdbVersion?: string },
): Promise<ArtifactDTO> {
  const entries: Record<string, string> = {};
  const issues: PatchPlan['issues'] = [];
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { config, csvDir } of categories) {
    const result = await buildPatchPlanResult(config, { iniPath: opts.iniPath, csvDir, dryRun: true });

    Object.assign(entries, patchPlanToArtifactEntries(result.plan));

    totalSkipped += result.skippedCount;
    totalErrors += result.errorCount;

    for (const issue of result.issues) {
      issues.push(issue);
    }
  }

  return ArtifactSchema.parse({
    generatedAt: new Date().toISOString(),
    scmdbVersion: opts.scmdbVersion ?? null,
    spviewerVersion: null,
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
export async function writeArtifactFile(artifactPath: string, artifact: ArtifactDTO): Promise<void> {
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
}

function formatIssuePath(issue: ZodIssue): { field: string; detailPath: string } {
  const pathParts = issue.path.map((part) => String(part));
  const field = pathParts[0] ?? '(root)';
  return {
    field,
    detailPath: pathParts.length > 0 ? pathParts.join('.') : '(root)',
  };
}

function formatArtifactSchemaError(artifactPath: string, issues: ZodIssue[]): string {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return `Artifact file is invalid: ${artifactPath}\n  Field: (root)\n  Problem: Unknown schema error`;
  }
  const { field, detailPath } = formatIssuePath(firstIssue);
  const additionalCount = issues.length - 1;
  const additional = additionalCount > 0 ? `\n  Additional issues: ${additionalCount}` : '';
  return [
    `Artifact file is invalid: ${artifactPath}`,
    `  Field: ${field}`,
    `  Problem: ${firstIssue.message}`,
    `  Detail: ${detailPath}: ${firstIssue.message}${additional}`,
  ].join('\n');
}

/**
 * Reads and validates a patch artifact from disk against the canonical
 * `ArtifactSchema`. A `ZodError` is thrown if the file does not conform; this
 * is the system boundary where untyped JSON becomes a fully typed DTO.
 *
 * @param artifactPath - Absolute path to the JSON artifact
 * @returns The parsed and validated artifact DTO
 */
export async function readArtifactFile(artifactPath: string): Promise<ArtifactDTO> {
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
    const problem = err instanceof Error ? err.message : String(err);
    throw new Error(`Artifact file is not valid JSON: ${artifactPath}\n  Field: JSON\n  Problem: ${problem}`, {
      cause: err,
    });
  }

  const result = ArtifactSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatArtifactSchemaError(artifactPath, result.error.issues), { cause: result.error });
  }

  return result.data;
}
