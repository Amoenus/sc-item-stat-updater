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

export interface DataCoreLocalizationReference {
  attribute: string;
  key: string;
}

export interface DataCoreRecordNode {
  path: string;
  ref: string;
  rootTag: string;
  rootType: string;
  entityClass: string;
  localizationKeys: DataCoreLocalizationReference[];
  referencedGuids: string[];
}

export interface DataCoreRecordGraph {
  source: 'datacore-record-graph';
  recordCount: number;
  records: DataCoreRecordNode[];
  indexes: {
    byRef: Record<string, string>;
    byPath: Record<string, number>;
    byRootType: Record<string, string[]>;
    byEntityClass: Record<string, string[]>;
    byLocalizationKey: Record<string, string[]>;
    byReferencedGuid: Record<string, string[]>;
  };
}
