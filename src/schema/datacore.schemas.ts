import { z } from 'zod';

/**
 * A single data row extracted from a DataForge entity XML file.
 * All values are strings (matching the CSV output format).
 */
export const DataCoreRowSchema = z.record(z.string(), z.string());
export type DataCoreRow = z.infer<typeof DataCoreRowSchema>;

/**
 * The structured output of the DataCore scraper for one item type:
 * a list of column headers and an array of rows (one per XML file).
 */
export const DataCoreScrapedDataSchema = z.object({
  itemType: z.string(),
  version: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
export type DataCoreScrapedData = z.infer<typeof DataCoreScrapedDataSchema>;
