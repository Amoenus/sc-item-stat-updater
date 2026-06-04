export type SourceName = 'datacore' | 'scmdb' | 'spviewer';

export type GameChannel = 'live' | 'ptu';

export interface SourceDataset<TRecord> {
  source: SourceName;
  version: string;
  channel: GameChannel;
  records: TRecord[];
}

export interface PatchEntry {
  key: string;
  value: string;
  source: string;
  reason: string;
  existingLineIndex?: number;
}

export interface UpdateIssue {
  label: string;
  key: string;
  reason: string;
  type: string;
}

export interface PatchPlan {
  entries: PatchEntry[];
  issues: UpdateIssue[];
}

export interface PipelineRunMetadata {
  startedAt: string;
  channel: GameChannel;
  dryRun: boolean;
  provider?: SourceName;
}
