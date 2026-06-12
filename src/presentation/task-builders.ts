import type { CommandTask } from './task-list';

type CommandTaskFn<Ctx> = Exclude<CommandTask<Ctx>['task'], undefined>;
export type CommandTaskWrapper<Ctx> = Parameters<CommandTaskFn<Ctx>>[1];

export interface PlannedChildTaskListOptions<Ctx> {
  title: string;
  tasks: CommandTask<Ctx>[];
  unit: string;
  pluralUnit?: string;
  plannedUnit?: string;
  plannedPluralUnit?: string;
  summary?: string;
  plannedSummary?: string;
  concurrent?: boolean | number;
}

export interface CompactTaskListOptions<Item, Result> {
  title: string;
  items: Item[];
  unit: string;
  pluralUnit?: string;
  plannedUnit?: string;
  plannedPluralUnit?: string;
  concurrency?: boolean | number;
  label: (item: Item, index: number) => string;
  task: (item: Item, index: number) => Promise<Result>;
  summary?: (result: Result, item: Item, index: number) => string | undefined;
}

export function createPlannedChildTaskList<Ctx>(
  task: CommandTaskWrapper<Ctx>,
  options: PlannedChildTaskListOptions<Ctx>,
) {
  const count = options.tasks.length;
  const summary = options.summary ?? formatCount(count, options.unit, options.pluralUnit);
  const plannedSummary =
    options.plannedSummary ??
    `${formatCount(count, options.plannedUnit ?? options.unit, options.plannedPluralUnit ?? options.pluralUnit)} planned`;

  task.title = `${options.title} - ${summary}`;
  task.output = plannedSummary;
  return task.newListr(options.tasks, { concurrent: options.concurrent ?? false });
}

export async function runCompactTaskList<Ctx, Item, Result>(
  task: CommandTaskWrapper<Ctx>,
  options: CompactTaskListOptions<Item, Result>,
): Promise<Result[]> {
  const count = options.items.length;
  const summary = formatCount(count, options.unit, options.pluralUnit);
  const plannedSummary = `${formatCount(
    count,
    options.plannedUnit ?? options.unit,
    options.plannedPluralUnit ?? options.pluralUnit,
  )} planned`;
  task.title = `${options.title} - ${summary}`;

  if (count === 0) {
    task.output = `No ${options.pluralUnit ?? pluralize(options.unit)}`;
    return [];
  }

  const statuses = options.items.map((item, index) => ({
    label: options.label(item, index),
    state: 'pending' as 'pending' | 'running' | 'done' | 'failed',
    summary: undefined as string | undefined,
  }));
  const results = new Array<Result>(count);
  const concurrency = normalizeConcurrency(options.concurrency, count);
  let completed = 0;
  let nextIndex = 0;

  const updateOutput = () => {
    const running = statuses.filter((status) => status.state === 'running').map((status) => status.label);
    const next = statuses.find((status) => status.state === 'pending')?.label;
    const latestDone = statuses.findLast((status) => status.state === 'done' && status.summary);
    const parts = [`${completed.toLocaleString()}/${count.toLocaleString()} complete`];

    if (running.length > 0) {
      parts.push(`running: ${running.slice(0, 3).join(', ')}${running.length > 3 ? ', ...' : ''}`);
    }
    if (next) parts.push(`next: ${next}`);
    if (latestDone?.summary) parts.push(`last: ${latestDone.label} (${latestDone.summary})`);

    task.output = parts.join(' | ');
  };

  task.output = plannedSummary;

  const worker = async () => {
    while (nextIndex < count) {
      const index = nextIndex++;
      const item = options.items[index];
      statuses[index].state = 'running';
      updateOutput();

      try {
        const result = await options.task(item, index);
        results[index] = result;
        statuses[index].state = 'done';
        statuses[index].summary = options.summary?.(result, item, index);
        completed++;
        updateOutput();
      } catch (error) {
        statuses[index].state = 'failed';
        task.output = `Failed: ${statuses[index].label}`;
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  task.output = `Completed ${summary}`;
  return results;
}

export function createIndexedTasks<Ctx, Item>(
  items: Item[],
  options: {
    title: (item: Item) => string;
    task: (item: Item, index: number) => CommandTask<Ctx>['task'];
  },
): CommandTask<Ctx>[] {
  const total = items.length;

  return items.map((item, index) => ({
    title: `${(index + 1).toLocaleString()}/${total.toLocaleString()} ${options.title(item)}`,
    task: options.task(item, index),
  }));
}

export function boundedConcurrency(count: number, limit: number): number | false {
  return count > 1 ? Math.min(count, limit) : false;
}

export function formatCount(count: number, singular: string, plural = pluralize(singular)): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function pluralize(singular: string): string {
  const words = singular.split(' ');
  const lastWord = words.at(-1);
  if (!lastWord) return `${singular}s`;

  const lowerLastWord = lastWord.toLowerCase();
  const pluralLastWord = /[^aeiou]y$/i.test(lastWord)
    ? `${lastWord.slice(0, -1)}ies`
    : /(s|x|z|ch|sh)$/i.test(lastWord)
      ? `${lastWord}es`
      : `${lastWord}s`;

  return [...words.slice(0, -1), matchCase(pluralLastWord, lowerLastWord === lastWord ? 'lower' : 'original')].join(
    ' ',
  );
}

function normalizeConcurrency(concurrency: boolean | number | undefined, count: number): number {
  if (count <= 1 || concurrency === false || concurrency === undefined) return 1;
  if (concurrency === true) return count;
  return Math.max(1, Math.min(count, concurrency));
}

function matchCase(value: string, mode: 'lower' | 'original'): string {
  return mode === 'lower' ? value.toLowerCase() : value;
}
