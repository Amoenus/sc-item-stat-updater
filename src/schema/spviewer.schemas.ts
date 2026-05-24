import { z } from 'zod';

/**
 * Shape returned by scrapeItems() — the raw table extracted from the SPViewer page.
 */
export const SpviewerScrapedDataSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
