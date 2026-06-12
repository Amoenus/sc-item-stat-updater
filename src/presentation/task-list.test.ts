import assert from 'node:assert/strict';
import test from 'node:test';
import { getLogger } from '../infrastructure/logger';
import type { CommandIO } from './cli';
import { createCommandTaskList } from './task-list';

function createFakeIO(): CommandIO & { stdoutText: () => string; stderrText: () => string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    cwd: process.cwd(),
    stdout: {
      isTTY: false,
      write: (chunk: string | Uint8Array) => {
        stdout.push(String(chunk));
        return true;
      },
    },
    stderr: {
      isTTY: false,
      write: (chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
      },
    },
    stdoutText: () => stdout.join(''),
    stderrText: () => stderr.join(''),
  };
}

test('command task list routes shared logger output through the active Listr task', async () => {
  const io = createFakeIO();
  const logger = getLogger('task-list-test');
  const taskList = createCommandTaskList(
    [
      {
        title: 'Render task',
        task: async (_ctx, task) => {
          logger.info('this would clash with the renderer');
          task.output = 'task output';
        },
      },
    ],
    io,
    {},
  );

  await taskList.run();

  assert.match(io.stdoutText(), /Render task/);
  assert.match(io.stdoutText(), /INFO this would clash with the renderer/);
  assert.doesNotMatch(io.stderrText(), /this would clash/);
});

test('command task list preserves the compact final tree after live rendering', () => {
  const io = createFakeIO();

  const compactTaskList = createCommandTaskList([], io, {});
  const verboseTaskList = createCommandTaskList([], io, {}, { verbose: true });

  assert.equal(compactTaskList.options?.rendererOptions?.clearOutput, false);
  assert.equal(compactTaskList.options?.rendererOptions?.collapseSubtasks, true);
  assert.equal(verboseTaskList.options?.rendererOptions?.collapseSubtasks, false);
});

test('command task list keeps logger routing for child Listr tasks created after awaits', async () => {
  const io = createFakeIO();
  const logger = getLogger('task-list-child-test');
  const taskList = createCommandTaskList(
    [
      {
        title: 'Parent task',
        task: async (_ctx, task) => {
          await Promise.resolve();
          return task.newListr(
            [
              {
                title: 'Delayed child task',
                task: async () => {
                  logger.warn('child log belongs to child output');
                },
              },
            ],
            { concurrent: false },
          );
        },
      },
    ],
    io,
    {},
  );

  await taskList.run();

  assert.match(io.stdoutText(), /Delayed child task/);
  assert.match(io.stdoutText(), /WARN child log belongs to child output/);
  assert.doesNotMatch(io.stderrText(), /child log belongs/);
});
