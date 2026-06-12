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

function matchCase(value: string, mode: 'lower' | 'original'): string {
  return mode === 'lower' ? value.toLowerCase() : value;
}
