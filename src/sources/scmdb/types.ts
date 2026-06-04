import type { SourceDataset } from '../../pipeline/types';

export type ScmdbRecordFamily =
  | 'mission'
  | 'contract'
  | 'legacy-contract'
  | 'blueprint-pool'
  | 'contract-blueprint-reward'
  | 'mining-element'
  | 'mining-journal'
  | 'mining-location';

/**
 * Normalized SCMDB row record after upstream JSON has been validated and
 * transformed into stable mission/mining/crafting output rows.
 */
export interface ScmdbOutputRecord extends Record<string, unknown> {
  family: ScmdbRecordFamily;
}

export type ScmdbOutputDataset = SourceDataset<ScmdbOutputRecord> & {
  source: 'scmdb';
};
