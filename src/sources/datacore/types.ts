import type { SourceDataset } from '../../pipeline/types';

/**
 * Normalized DataCore component record produced from unforged game-file XML.
 *
 * The common fields are shared across component families; additional
 * type-specific stat columns are kept as string values keyed by their CSV
 * header names so existing item planners can migrate one family at a time.
 */
export interface DataCoreComponentRecord extends Record<string, string> {
  'Entity Class': string;
  Manufacturer: string;
  Size: string;
  Grade: string;
  Class: string;
  Health: string;
}

export type DataCoreComponentDataset = SourceDataset<DataCoreComponentRecord> & {
  source: 'datacore';
};
