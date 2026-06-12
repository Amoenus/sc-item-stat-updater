import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommandIO } from './cli';
import { boundedConcurrency, createIndexedTasks, createPlannedChildTaskList, formatCount } from './task-builders';
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

test('planned child task list applies parent summary and planned output', async () => {
  const io = createFakeIO();
  const taskList = createCommandTaskList(
    [
      {
        title: 'Parent stage',
        task: (_ctx, task) =>
          createPlannedChildTaskList(task, {
            title: 'Parent stage',
            tasks: [
              {
                title: 'Child stage',
                task: async (_childCtx, childTask) => {
                  childTask.output = 'done';
                },
              },
            ],
            unit: 'child',
          }),
      },
    ],
    io,
    {},
  );

  await taskList.run();

  assert.match(io.stdoutText(), /Parent stage - 1 child/);
  assert.match(io.stdoutText(), /1 child planned/);
  assert.match(io.stdoutText(), /Child stage/);
});

test('indexed tasks use stable one-based progress titles', () => {
  const tasks = createIndexedTasks(['alpha', 'beta'], {
    title: (item) => item.toUpperCase(),
    task: () => async () => {},
  });

  assert.deepEqual(
    tasks.map((task) => task.title),
    ['1/2 ALPHA', '2/2 BETA'],
  );
});

test('count and concurrency helpers keep display grammar consistent', () => {
  assert.equal(formatCount(1, 'stage'), '1 stage');
  assert.equal(formatCount(2, 'stage'), '2 stages');
  assert.equal(formatCount(2, 'category'), '2 categories');
  assert.equal(formatCount(2, 'source cache'), '2 source caches');
  assert.equal(formatCount(2, 'category', 'categories'), '2 categories');
  assert.equal(boundedConcurrency(1, 6), false);
  assert.equal(boundedConcurrency(4, 6), 4);
  assert.equal(boundedConcurrency(8, 6), 6);
});
