import type { SourceDataset } from '../../pipeline/types';

/**
 * Normalized SPViewer item record. SPViewer remains a legacy/fallback provider,
 * so records retain source table columns while adding optional localization
 * resolution metadata for planners that need INI keys.
 */
export interface SpviewerItemRecord extends Record<string, string | undefined> {
  Name: string;
  'Localization Key'?: string;
}

export type SpviewerItemDataset = SourceDataset<SpviewerItemRecord> & {
  source: 'spviewer';
};
