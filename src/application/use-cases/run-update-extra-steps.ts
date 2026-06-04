import { runAdagioLocationTagUpdate } from '../../enrichment/updates/adagio-location-tags';
import { runComponentTitleUpdate } from '../../enrichment/updates/component-titles';
import { runFpsTitleTagUpdate } from '../../enrichment/updates/fps-title-tags';
import { runMiningJournalUpdate } from '../../enrichment/updates/mining-journal-update';
import { runMissileTitleTagUpdate } from '../../enrichment/updates/missile-title-tags';
import { runRawCommodityLabelFixUpdate } from '../../enrichment/updates/raw-commodity-label-fixes';
import type { BatchUpdateError, BatchUpdateResult } from './run-prepared-update-categories';

export type UpdateExtraStepLabel =
  | 'Component Titles'
  | 'FPS title tags'
  | 'Missile title tags'
  | 'Mining journal'
  | 'Raw commodity labels'
  | 'Adagio location tags (experimental)';

export type UpdateExtraStepRunner = () => Promise<BatchUpdateResult | null | undefined>;

export interface RunUpdateExtraStepsOptions {
  iniPath: string;
  repoRoot: string;
  missionCsvDir: string;
  dryRun?: boolean;
  includeMiningJournal?: boolean;
  spviewerVersionDir?: string;
  runners?: Partial<Record<UpdateExtraStepLabel, UpdateExtraStepRunner>>;
  onStepStart?: (label: UpdateExtraStepLabel, index: number) => void;
  onStepError?: (error: BatchUpdateError) => void;
}

export interface RunUpdateExtraStepsResult {
  results: BatchUpdateResult[];
  errors: BatchUpdateError[];
}

const FIXED_EXTRA_STEP_LABELS: UpdateExtraStepLabel[] = [
  'Component Titles',
  'FPS title tags',
  'Missile title tags',
  'Raw commodity labels',
  'Adagio location tags (experimental)',
];

export function getUpdateExtraStepLabels(options: { includeMiningJournal?: boolean } = {}): UpdateExtraStepLabel[] {
  const labels = [...FIXED_EXTRA_STEP_LABELS];
  if (options.includeMiningJournal) {
    labels.splice(3, 0, 'Mining journal');
  }
  return labels;
}

export async function runUpdateExtraSteps(
  options: RunUpdateExtraStepsOptions,
): Promise<RunUpdateExtraStepsResult> {
  const labels = getUpdateExtraStepLabels({ includeMiningJournal: options.includeMiningJournal });
  const runners = { ...defaultRunners(options), ...options.runners };
  const results: BatchUpdateResult[] = [];
  const errors: BatchUpdateError[] = [];

  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    options.onStepStart?.(label, index);

    try {
      const result = await runners[label]?.();
      if (result != null) {
        results.push(result);
      }
    } catch (err) {
      const error = toBatchUpdateError(label, err);
      errors.push(error);
      options.onStepError?.(error);
    }
  }

  return { results, errors };
}

function defaultRunners(options: RunUpdateExtraStepsOptions): Record<UpdateExtraStepLabel, UpdateExtraStepRunner> {
  const dryRun = options.dryRun ?? false;
  return {
    'Component Titles': async () => {
      if (!options.spviewerVersionDir) return null;
      return runComponentTitleUpdate({ iniPath: options.iniPath, spviewerDir: options.spviewerVersionDir, dryRun });
    },
    'FPS title tags': async () => {
      if (!options.spviewerVersionDir) return null;
      return runFpsTitleTagUpdate({ iniPath: options.iniPath, spviewerDir: options.spviewerVersionDir, dryRun });
    },
    'Missile title tags': async () => {
      if (!options.spviewerVersionDir) return null;
      return runMissileTitleTagUpdate({
        iniPath: options.iniPath,
        spviewerDir: options.spviewerVersionDir,
        repoRoot: options.repoRoot,
        dryRun,
      });
    },
    'Mining journal': () =>
      runMiningJournalUpdate({ iniPath: options.iniPath, missionCsvDir: options.missionCsvDir, dryRun }),
    'Raw commodity labels': () => runRawCommodityLabelFixUpdate({ iniPath: options.iniPath, dryRun }),
    'Adagio location tags (experimental)': () => runAdagioLocationTagUpdate({ iniPath: options.iniPath, dryRun }),
  };
}

function toBatchUpdateError(label: UpdateExtraStepLabel, err: unknown): BatchUpdateError {
  const error = err instanceof Error ? err : new Error(String(err));
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  return {
    label,
    message: error.message,
    cause,
  };
}
