import { createScmdbScrapePlan, type RunScmdbScrapeResult } from '../application/use-cases/run-scmdb-scrape';
import { createPlannedChildTaskList } from './task-builders';
import type { CommandTask } from './task-list';

interface ScmdbScrapeTaskOptions {
  title: string;
  repoRoot: string;
  ptu?: boolean;
  version?: string;
  rawOnly?: boolean;
  planFactory?: typeof createScmdbScrapePlan;
  onResult?: (result: RunScmdbScrapeResult) => void;
  onWarning?: (message: string, error?: unknown) => void;
}

export function createScmdbScrapeTask<Ctx>(options: ScmdbScrapeTaskOptions): CommandTask<Ctx> {
  return {
    title: options.title,
    task: (_ctx, task) => {
      const plan = (options.planFactory ?? createScmdbScrapePlan)({
        repoRoot: options.repoRoot,
        ptu: options.ptu,
        version: options.version,
        rawOnly: options.rawOnly,
        onWarning: options.onWarning,
      });

      return task.newListr(
        [
          {
            title: 'Select SCMDB version',
            task: async (_childCtx, childTask) => {
              const selected = await plan.selectVersion();
              childTask.output = selected.version;
            },
          },
          {
            title: 'Prepare SCMDB output directories',
            task: async (_childCtx, childTask) => {
              const dirs = await plan.prepareOutputDirs();
              childTask.output = dirs.outDir;
            },
          },
          {
            title: 'Fetch SCMDB raw datasets',
            task: (_childCtx, childTask) => {
              const fetchTasks: CommandTask<Ctx>[] = [
                {
                  title: 'Fetch merged game data',
                  task: async (_fetchCtx, fetchTask) => {
                    await plan.fetchMergedDataset();
                    fetchTask.output = 'Fetched merged data';
                  },
                },
                {
                  title: 'Fetch mining data',
                  task: async (_fetchCtx, fetchTask) => {
                    const result = await plan.fetchMiningDataset();
                    fetchTask.output = result ? 'Fetched mining data' : 'Not available';
                  },
                },
                {
                  title: 'Fetch crafting items',
                  task: async (_fetchCtx, fetchTask) => {
                    const result = await plan.fetchCraftingItemsDataset();
                    fetchTask.output = result ? 'Fetched crafting items' : 'Not available';
                  },
                },
                {
                  title: 'Fetch crafting blueprints',
                  task: async (_fetchCtx, fetchTask) => {
                    const result = await plan.fetchCraftingBlueprintsDataset();
                    fetchTask.output = result ? 'Fetched crafting blueprints' : 'Not available';
                  },
                },
                {
                  title: 'Fetch MEMA cache',
                  task: async (_fetchCtx, fetchTask) => {
                    const result = await plan.fetchMemaDataset();
                    fetchTask.output = result ? 'Fetched MEMA cache' : 'Not available';
                  },
                },
              ];
              return createPlannedChildTaskList(childTask, {
                title: 'Fetch SCMDB raw datasets',
                tasks: fetchTasks,
                unit: 'dataset',
                summary: `${fetchTasks.length.toLocaleString()} checked`,
                plannedSummary: `${fetchTasks.length.toLocaleString()} raw dataset fetches planned`,
                concurrent: true,
              });
            },
          },
          {
            title: 'Write SCMDB raw JSON files',
            task: async (_childCtx, childTask) => {
              const files = await plan.writeRawDatasets();
              childTask.output = `Wrote ${files.length.toLocaleString()} raw file(s)`;
            },
          },
          {
            title: 'Write SCMDB derived CSV files',
            skip: options.rawOnly ? '--raw' : false,
            task: async (_childCtx, childTask) => {
              const files = await plan.writeDerivedOutputs();
              childTask.output = `Wrote ${files.length.toLocaleString()} CSV file(s)`;
            },
          },
          {
            title: 'Complete SCMDB scrape',
            task: (_childCtx, childTask) => {
              const result = plan.result();
              options.onResult?.(result);
              childTask.output = `Outputs saved to ${result.outDir}`;
            },
          },
        ],
        { concurrent: false },
      );
    },
  };
}
