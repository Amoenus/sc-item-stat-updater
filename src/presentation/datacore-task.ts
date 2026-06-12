import type {
  createDataCoreScrapePlan,
  DataCoreItemTypeStageDescriptor,
  DataCoreRawFactStageDescriptor,
  DataCoreRawFactStageId,
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
              const rawFactGroups = createRawFactTaskGroups(rawFactStages);
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
              const typeGroups = createItemTypeTaskGroups(typeStages);
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

interface RawFactTaskGroup {
  title: string;
  ids: DataCoreRawFactStageId[];
  concurrent: boolean;
}

interface ItemTypeTaskGroup {
  title: string;
  ids: string[];
}

const RAW_FACT_TASK_GROUPS: RawFactTaskGroup[] = [
  {
    title: 'Extract contract source facts',
    ids: ['contract-generators', 'contract-templates', 'contract-template-hauling'],
    concurrent: true,
  },
  {
    title: 'Build contract derived facts',
    ids: ['contract-generator-intel', 'contract-hauling-summary'],
    concurrent: true,
  },
  {
    title: 'Extract mission source facts',
    ids: ['mission-brokers', 'mission-localization'],
    concurrent: true,
  },
  {
    title: 'Build mission derived facts',
    ids: ['mission-contract-intel'],
    concurrent: false,
  },
  {
    title: 'Extract blueprint and material facts',
    ids: ['blueprint-pools', 'crafting-blueprints', 'material-localizations'],
    concurrent: true,
  },
  {
    title: 'Extract reference facts',
    ids: ['commodities', 'vehicles', 'factions', 'manufacturers', 'location-labels'],
    concurrent: true,
  },
  {
    title: 'Extract mining facts',
    ids: [
      'mining-elements',
      'mining-compositions',
      'mineable-entities',
      'mining-density-overrides',
      'mining-clustering',
      'mining-harvestable-presets',
      'mining-harvestable-setups',
      'mining-sub-harvestable-configs',
      'mining-quality-distributions',
      'mining-quality-quantizations',
      'mining-rock-signatures',
      'mining-location-labels',
      'mining-params',
      'mining-provider-presets',
    ],
    concurrent: true,
  },
];

const ITEM_TYPE_TASK_GROUPS: ItemTypeTaskGroup[] = [
  {
    title: 'Ship systems',
    ids: ['coolers', 'powerplants', 'quantum-drives', 'jump-drives', 'qeds', 'radars', 'shields', 'self-destruct'],
  },
  {
    title: 'Weapons and ordnance',
    ids: [
      'bombs',
      'emps',
      'missiles',
      'missile-launchers',
      'turrets',
      'throwables',
      'weapon-attachments',
      'weapon-defensive',
      'weapon-guns',
      'weapon-personal',
    ],
  },
  {
    title: 'Mining and utility',
    ids: ['mining-lasers', 'mining-modifiers', 'salvage-modifiers', 'tractor-beams'],
  },
];

function createRawFactTaskGroups(stages: DataCoreRawFactStageDescriptor[]): Array<{
  title: string;
  stages: DataCoreRawFactStageDescriptor[];
  concurrent: boolean;
}> {
  const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
  const assigned = new Set<DataCoreRawFactStageId>();
  const groups = RAW_FACT_TASK_GROUPS.flatMap((group) => {
    const groupStages = group.ids.flatMap((id) => {
      const stage = stagesById.get(id);
      if (!stage) return [];
      assigned.add(id);
      return [stage];
    });

    return groupStages.length > 0 ? [{ title: group.title, stages: groupStages, concurrent: group.concurrent }] : [];
  });
  const remainingStages = stages.filter((stage) => !assigned.has(stage.id));

  if (remainingStages.length > 0) {
    groups.push({ title: 'Extract remaining raw facts', stages: remainingStages, concurrent: true });
  }

  return groups;
}

function createItemTypeTaskGroups(stages: DataCoreItemTypeStageDescriptor[]): Array<{
  title: string;
  stages: DataCoreItemTypeStageDescriptor[];
}> {
  const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
  const assigned = new Set<string>();
  const groups = ITEM_TYPE_TASK_GROUPS.flatMap((group) => {
    const groupStages = group.ids.flatMap((id) => {
      const stage = stagesById.get(id);
      if (!stage) return [];
      assigned.add(id);
      return [stage];
    });

    return groupStages.length > 0 ? [{ title: group.title, stages: groupStages }] : [];
  });
  const remainingStages = stages.filter((stage) => !assigned.has(stage.id));

  if (remainingStages.length > 0) {
    groups.push({ title: 'Other item types', stages: remainingStages });
  }

  return groups;
}
