import {
  createWritable,
  type DefaultRenderer,
  Listr,
  ListrLogger,
  type ListrTask,
  ProcessOutput,
  type SimpleRenderer,
} from 'listr2';
import type { CommandIO } from './cli';

export type CommandTask<Ctx> = ListrTask<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>;

export function createCommandTaskList<Ctx>(
  tasks: CommandTask<Ctx>[],
  io: CommandIO,
  ctx: Ctx,
): Listr<Ctx, 'default', 'simple'> {
  const processOutput = new ProcessOutput(
    createWritable((chunk) => {
      io.stdout.write(chunk);
    }) as NodeJS.WriteStream,
    createWritable((chunk) => {
      io.stderr.write(chunk);
    }) as NodeJS.WriteStream,
    { leaveEmptyLine: false },
  );

  return new Listr<Ctx, 'default', 'simple'>(tasks, {
    ctx,
    fallbackRenderer: 'simple',
    fallbackRendererCondition: !io.stdout.isTTY,
    registerSignalListeners: false,
    rendererOptions: {
      processOutput,
      clearOutput: false,
      collapseSubtasks: false,
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
