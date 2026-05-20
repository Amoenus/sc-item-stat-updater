/**
 * Zod schema for the patch artifact (ADR 002).
 *
 * This is the single source of truth for the shape of `patch-data.json`.
 * Both the generator (`generateArtifact`) and the reader (`readArtifactFile`)
 * derive their TypeScript types from this schema — no hand-maintained
 * interface can silently drift from the runtime shape.
 *
 * ⚠️  Do NOT modify the shape of `ArtifactSchema` without also updating the
 *     Phase-2 compiler/client that consumes `patch-data.json`.
 */

import { z } from 'zod';

export const ArtifactIssueSchema = z.object({
  label: z.string(),
  key: z.string(),
  reason: z.string(),
  type: z.string(),
});

export type ArtifactIssueDTO = z.infer<typeof ArtifactIssueSchema>;

export const ArtifactStatsSchema = z.object({
  categoryCount: z.number().int().nonnegative(),
  totalEntries: z.number().int().nonnegative(),
  totalSkipped: z.number().int().nonnegative(),
  totalErrors: z.number().int().nonnegative(),
});

export type ArtifactStatsDTO = z.infer<typeof ArtifactStatsSchema>;

export const ArtifactSchema = z.object({
  generatedAt: z.string(),
  scmdbVersion: z.string().nullable(),
  spviewerVersion: z.string().nullable(),
  entries: z.record(z.string(), z.string()),
  stats: ArtifactStatsSchema,
  issues: z.array(ArtifactIssueSchema),
});

export type ArtifactDTO = z.infer<typeof ArtifactSchema>;
