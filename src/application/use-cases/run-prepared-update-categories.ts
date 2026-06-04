import type { EnrichGlobalIniOptions } from './enrich-global-ini';
import { enrichGlobalIni } from './enrich-global-ini';
import type { UpdateCategory } from './prepare-update-categories';

export interface BatchUpdateResult {
  label: string;
  summary: string;
  patches?: Record<string, string>;
  issues?: unknown[];
}

export interface BatchUpdateError {
  label: string;
  message: string;
  cause?: string;
}

export interface RunPreparedUpdateCategoriesOptions extends Omit<EnrichGlobalIniOptions, 'csvDir'> {
  onCategoryStart?: (category: UpdateCategory, index: number) => void;
  onCategoryError?: (error: BatchUpdateError) => void;
  enrich?: (category: UpdateCategory, options: EnrichGlobalIniOptions) => Promise<BatchUpdateResult>;
}

export interface RunPreparedUpdateCategoriesResult {
  results: BatchUpdateResult[];
  errors: BatchUpdateError[];
}

export async function runPreparedUpdateCategories(
  categories: UpdateCategory[],
  options: RunPreparedUpdateCategoriesOptions = {},
): Promise<RunPreparedUpdateCategoriesResult> {
  const { onCategoryStart, onCategoryError, enrich = defaultEnrich, ...sharedOptions } = options;
  const results: BatchUpdateResult[] = [];
  const errors: BatchUpdateError[] = [];

  for (let index = 0; index < categories.length; index++) {
    const category = categories[index];
    onCategoryStart?.(category, index);

    try {
      results.push(await enrich(category, { ...sharedOptions, csvDir: category.csvDir }));
    } catch (err) {
      const error = toBatchUpdateError(category, err);
      errors.push(error);
      onCategoryError?.(error);
    }
  }

  return { results, errors };
}

async function defaultEnrich(category: UpdateCategory, options: EnrichGlobalIniOptions): Promise<BatchUpdateResult> {
  return enrichGlobalIni(category.config, options);
}

function toBatchUpdateError(category: UpdateCategory, err: unknown): BatchUpdateError {
  const error = err instanceof Error ? err : new Error(String(err));
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  return {
    label: category.config.label,
    message: error.message,
    cause,
  };
}
