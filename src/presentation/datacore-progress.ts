import type { DefaultRenderer, ListrTaskWrapper, SimpleRenderer } from 'listr2';
import type { DataCoreTypeEntry } from '../application/use-cases/run-datacore-scrape';

interface DataCoreProgressOptions<Ctx> {
  task: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>;
  baseTitle: string;
}

export function createDataCoreProgressCallbacks<Ctx>({ task, baseTitle }: DataCoreProgressOptions<Ctx>) {
  let scrapeTypesCount = 0;

  return {
    onCacheExtractStart: () => {
      task.title = `${baseTitle} - unforge extraction can take several minutes`;
    },
    onCacheExtractProgress: (count: number) => {
      task.title = `${baseTitle} - unforge ${count.toLocaleString()} XMLs extracted`;
    },
    onCacheExtractComplete: (count: number) => {
      task.title = `${baseTitle} - unforge complete (${count.toLocaleString()} XMLs)`;
    },
    onCacheHit: (count: number) => {
      task.title = `${baseTitle} - XML cache reused (${count.toLocaleString()} files)`;
    },
    onDatacorePrepared: (context: { selectedTypes: DataCoreTypeEntry[] }) => {
      scrapeTypesCount = context.selectedTypes.length;
      task.title = `${baseTitle} - prepared ${scrapeTypesCount.toLocaleString()} type extractors`;
    },
    onRecordGraphStart: (total: number) => {
      task.title = `${baseTitle} - building record graph from ${total.toLocaleString()} XML files`;
    },
    onRecordGraphProgress: (current: number, total: number) => {
      task.title = `${baseTitle} - record graph ${current.toLocaleString()}/${total.toLocaleString()}`;
    },
    onRecordGraphCacheHit: (recordCount: number) => {
      task.title = `${baseTitle} - record graph reused (${recordCount.toLocaleString()} records)`;
    },
    onRawFactStart: (slug: string, total: number) => {
      task.title = `${baseTitle} - ${formatRawFactProgress(slug, 0, total)}`;
    },
    onRawFactProgress: (slug: string, current: number, total: number) => {
      task.title = `${baseTitle} - ${formatRawFactProgress(slug, current, total)}`;
    },
    onTypeStart: (entry: DataCoreTypeEntry, index: number) => {
      const total = scrapeTypesCount > 0 ? scrapeTypesCount.toLocaleString() : '?';
      task.title = `${baseTitle} - scraping ${index + 1}/${total}: ${entry.name}`;
    },
  };
}

interface DataCoreStageProgressCallbacksOptions<Ctx> {
  parentTask: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>;
  baseTitle: string;
}

export function createDataCoreStageProgressCallbacks<Ctx>({
  parentTask,
  baseTitle,
}: DataCoreStageProgressCallbacksOptions<Ctx>) {
  let prepareTask: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer> | undefined;
  let cacheTask: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer> | undefined;
  let graphTask: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer> | undefined;
  const rawFactTasks = new Map<
    string,
    { task: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>; title: string }
  >();
  let scrapeTypesCount = 0;

  return {
    bindPrepareTask(task: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>) {
      prepareTask = task;
    },
    bindCacheTask(task: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>) {
      cacheTask = task;
    },
    bindGraphTask(task: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>) {
      graphTask = task;
    },
    bindRawFactTask(
      slug: string,
      task: ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>,
      title: string,
    ) {
      rawFactTasks.set(slug, { task, title });
    },
    callbacks: {
      onCacheExtractStart: () => {
        if (cacheTask) cacheTask.title = 'Ensure XML cache - unforge extraction can take several minutes';
      },
      onCacheExtractProgress: (count: number) => {
        if (cacheTask) cacheTask.title = `Ensure XML cache - ${count.toLocaleString()} XMLs extracted`;
      },
      onCacheExtractComplete: (count: number) => {
        if (cacheTask) cacheTask.output = `Extracted ${count.toLocaleString()} XML files`;
      },
      onCacheHit: (count: number) => {
        if (cacheTask) cacheTask.output = `Reused ${count.toLocaleString()} XML files`;
      },
      onPrepared: (context: { selectedTypes: DataCoreTypeEntry[] }) => {
        scrapeTypesCount = context.selectedTypes.length;
        if (prepareTask) prepareTask.output = `Prepared ${scrapeTypesCount.toLocaleString()} type extractors`;
      },
      onRecordGraphStart: (total: number) => {
        if (graphTask) graphTask.title = `Prepare record graph - reading ${total.toLocaleString()} XML files`;
      },
      onRecordGraphProgress: (current: number, total: number) => {
        if (graphTask) graphTask.title = `Prepare record graph - ${current.toLocaleString()}/${total.toLocaleString()}`;
      },
      onRecordGraphCacheHit: (recordCount: number) => {
        if (graphTask) graphTask.output = `Reused ${recordCount.toLocaleString()} graph records`;
      },
      onRawFactStart: (slug: string, total: number) => {
        const rawFact = rawFactTasks.get(slug);
        if (rawFact) rawFact.task.title = formatRawFactProgress(rawFact.title, 0, total);
      },
      onRawFactProgress: (slug: string, current: number, total: number) => {
        const rawFact = rawFactTasks.get(slug);
        if (rawFact) {
          rawFact.task.title = formatRawFactProgress(rawFact.title, current, total);
        }
      },
      onToolsLog: (message: string) => {
        parentTask.output = message;
      },
      completeParent: () => {
        parentTask.title = baseTitle;
      },
    },
  };
}

function formatRawFactProgress(title: string, current: number, total: number): string {
  if (!title || total <= 0) {
    return `extracting raw facts: ${current.toLocaleString()}`;
  }

  return `${title} - ${current.toLocaleString()}/${total.toLocaleString()}`;
}
