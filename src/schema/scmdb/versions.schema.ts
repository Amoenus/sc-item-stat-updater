// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// versions.json
// ---------------------------------------------------------------------------

export const VersionEntrySchema = z.object({
  version: z.string(),
  file: z.string(),
});
export type VersionEntry = z.infer<typeof VersionEntrySchema>;

export const VersionsSchema = z.array(VersionEntrySchema).min(1);
export type Versions = z.infer<typeof VersionsSchema>;
