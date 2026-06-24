import type {
  createDataCoreScrapePlan,
  RunDatacoreScrapeOptions,
  RunDatacoreScrapeResult,
} from '../application/use-cases/run-datacore-scrape';
import { createDataCoreStageProgressCallbacks } from './datacore-progress';
import { boundedConcurrency, createPlannedChildTaskList, runCompactTaskList } from './task-builders';
import type { CommandTask } from './task-list';

interface DataCoreScrapeTaskOptions {
  title: string;
  repoRoot: string;
  binDirname?: string;
  ptu?: boolean;
  dryRun?: boolean;
  forceExtract?: boolean;
  types?: string[];
  loadTypes?: RunDatacoreScrapeOptions['loadTypes'];
  planFactory: typeof createDataCoreScrapePlan;
  onResult?: (result: RunDatacoreScrapeResult) => void;
}

export function createDataCoreScrapeTask<Ctx>(options: DataCoreScrapeTaskOptions): CommandTask<Ctx> {
  return {
    title: options.title,
    task: (_ctx, task) => {
      const progress = createDataCoreStageProgressCallbacks({ parentTask: task, baseTitle: options.title });
      const plan = options.planFactory({
        repoRoot: options.repoRoot,
        binDirname: options.binDirname,
        ptu: options.ptu,
        dryRun: options.dryRun,
        forceExtract: options.forceExtract,
        types: options.types,
        loadTypes: options.loadTypes,
        ...progress.callbacks,
      });

      return task.newListr(
        [
          {
            title: 'Prepare DataCore scrape',
            task: async (_childCtx, childTask) => {
              progress.bindPrepareTask(childTask);
              const prepared = await plan.prepare();
              childTask.output = `Using ${prepared.channel.toUpperCase()} ${prepared.gameVersion}`;
            },
          },
          {
            title: 'Ensure XML cache',
            task: async (_childCtx, childTask) => {
              progress.bindCacheTask(childTask);
              const result = await plan.ensureXmlCache();
              childTask.output = `${result.reused ? 'Reused' : 'Prepared'} ${result.xmlFileCount.toLocaleString()} XML files`;
            },
          },
          {
            title: 'Prepare record graph',
            task: async (_childCtx, childTask) => {
              progress.bindGraphTask(childTask);
              const result = await plan.prepareRecordGraph();
              childTask.output = `${result.cached ? 'Reused' : 'Prepared'} ${result.recordCount.toLocaleString()} graph records`;
            },
          },
          {
            title: 'Extract raw fact datasets',
            task: (_childCtx, childTask) => {
              const rawFactStages = plan.getRawFactStages();
              const rawFactGroups = plan.getRawFactStageGroups();
              return createPlannedChildTaskList(childTask, {
                title: 'Extract raw fact datasets',
                tasks: rawFactGroups.map((group) => ({
                  title: group.title,
                  task: (_groupCtx, groupTask) => {
                    return createPlannedChildTaskList(groupTask, {
                      title: group.title,
                      tasks: group.stages.map((stage) => ({
                        title: stage.title,
                        task: async (_rawFactCtx, rawFactTask) => {
                          progress.bindRawFactTask(stage.id, rawFactTask, stage.title);
                          const result = await plan.extractRawFactStage(stage.id);
                          if (result) {
                            rawFactTask.output = `${result.rows.toLocaleString()} rows -> ${result.csvFile}`;
                          }
                        },
                      })),
                      unit: 'stage',
                      concurrent: group.concurrent ? boundedConcurrency(group.stages.length, 6) : false,
                    });
                  },
                })),
                unit: 'stage',
                plannedUnit: 'extraction stage',
                summary: `${rawFactStages.length.toLocaleString()} stages across ${rawFactGroups.length.toLocaleString()} groups`,
                plannedSummary: `${rawFactStages.length.toLocaleString()} extraction stages planned`,
              });
            },
          },
          {
            title: 'Finalize raw fact catalog',
            task: async (_childCtx, childTask) => {
              const results = await plan.finalizeRawFacts();
              childTask.output = `Cataloged ${results.length.toLocaleString()} raw fact datasets`;
            },
          },
          {
            title: 'Scrape item type CSVs',
            task: (_childCtx, childTask) => {
              const typeStages = plan.getItemTypeStages();
              const typeGroups = plan.getItemTypeStageGroups();
              return createPlannedChildTaskList(childTask, {
                title: 'Scrape item type CSVs',
                tasks: typeGroups.map((group) => ({
                  title: group.title,
                  task: async (_groupCtx, groupTask) => {
                    await runCompactTaskList(groupTask, {
                      title: group.title,
                      items: group.stages,
                      unit: 'type',
                      plannedUnit: 'item type',
                      concurrency: boundedConcurrency(group.stages.length, 4),
                      label: (stage) => stage.title,
                      task: (stage) => plan.scrapeItemTypeStage(stage.id),
                      summary: ({ result, error }) =>
                        result ? `${result.rows.toLocaleString()} rows -> ${result.csvFile}` : error?.message,
                    });
                  },
                })),
                unit: 'group',
                plannedUnit: 'item type',
                summary: `${typeStages.length.toLocaleString()} types across ${typeGroups.length.toLocaleString()} groups`,
                plannedSummary: `${typeStages.length.toLocaleString()} item types planned`,
              });
            },
          },
          {
            title: 'Finalize item type catalog',
            task: async (_childCtx, childTask) => {
              const result = await plan.finalizeItemTypes();
              childTask.output = `Scraped ${result.results.length.toLocaleString()} item type CSVs, ${result.errors.length.toLocaleString()} error(s)`;
            },
          },
          {
            title: 'Complete DataCore cache',
            task: () => {
              const result = plan.result();
              options.onResult?.(result);
              if (result.exitCode !== 0) {
                throw new Error('DATACORE cache refresh failed.');
              }
              progress.callbacks.completeParent();
            },
          },
        ],
        { concurrent: false },
      );
    },
  };
}
