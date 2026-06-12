import {
  createWritable,
  type DefaultRenderer,
  Listr,
  ListrLogger,
  type ListrTask,
  ProcessOutput,
  type SimpleRenderer,
} from 'listr2';
import { withLoggerOutputSink } from '../infrastructure/logger';
import type { CommandIO } from './cli';

export type CommandTask<Ctx> = ListrTask<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>;

interface CommandTaskListOptions {
  verbose?: boolean;
}

export function createCommandTaskList<Ctx>(
  tasks: CommandTask<Ctx>[],
  io: CommandIO,
  ctx: Ctx,
  options: CommandTaskListOptions = {},
): Listr<Ctx, 'default', 'simple'> {
  const useLiveRenderer = io.stdout === process.stdout && io.stderr === process.stderr && io.stdout.isTTY === true;
  const processOutput = useLiveRenderer
    ? new ProcessOutput(process.stdout, process.stderr, { leaveEmptyLine: false })
    : new ProcessOutput(
        createWritable((chunk) => {
          io.stdout.write(chunk);
        }) as NodeJS.WriteStream,
        createWritable((chunk) => {
          io.stderr.write(chunk);
        }) as NodeJS.WriteStream,
        { leaveEmptyLine: false },
      );

  return new Listr<Ctx, 'default', 'simple'>(wrapTaskLoggerOutput(tasks), {
    ctx,
    fallbackRenderer: 'simple',
    fallbackRendererCondition: !useLiveRenderer,
    registerSignalListeners: false,
    rendererOptions: {
      processOutput,
      // Keep scrollback readable: the default renderer redraws live frames, so old frames must be cleared.
      clearOutput: true,
      // Keep the live view rich, then collapse successful children into their parent summary in final scrollback.
      collapseSubtasks: !options.verbose,
      showSubtasks: true,
      showSkipMessage: true,
      outputBar: 3,
      logger: new ListrLogger({ processOutput }),
    } as never,
    fallbackRendererOptions: {
      logger: new ListrLogger({ processOutput }),
    } as never,
  });
}

function wrapTaskLoggerOutput<Ctx>(tasks: CommandTask<Ctx>[]): CommandTask<Ctx>[] {
  return tasks.map((taskConfig) => {
    if (!taskConfig.task) return taskConfig;

    const originalTask = taskConfig.task;
    return {
      ...taskConfig,
      task: (ctx, task) => {
        const originalNewListr = task.newListr.bind(task);
        task.newListr = ((childTasks: CommandTask<Ctx>[], options?: Parameters<typeof task.newListr>[1]) =>
          originalNewListr(wrapTaskLoggerOutput(childTasks), options as never)) as typeof task.newListr;

        const restoreNewListr = () => {
          task.newListr = originalNewListr as typeof task.newListr;
        };

        try {
          const result = withLoggerOutputSink(
            (line) => {
              task.output = line;
            },
            () => originalTask(ctx, task),
          );

          if (result instanceof Promise) {
            return result.finally(restoreNewListr);
          }

          restoreNewListr();
          return result;
        } catch (error) {
          restoreNewListr();
          throw error;
        }
      },
    };
  });
}
