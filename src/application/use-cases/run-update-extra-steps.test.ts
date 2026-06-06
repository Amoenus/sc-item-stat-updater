import assert from 'node:assert/strict';
import test from 'node:test';
import { getUpdateExtraStepLabels, runUpdateExtraSteps, type UpdateExtraStepLabel } from './run-update-extra-steps';

test('getUpdateExtraStepLabels includes mining journal only when requested', () => {
  assert.deepEqual(getUpdateExtraStepLabels(), [
    'Component Titles',
    'FPS title tags',
    'Missile title tags',
    'Raw commodity labels',
    'Adagio location tags (experimental)',
  ]);
  assert.deepEqual(getUpdateExtraStepLabels({ includeMiningJournal: true }), [
    'Component Titles',
    'FPS title tags',
    'Missile title tags',
    'Mining journal',
    'Raw commodity labels',
    'Adagio location tags (experimental)',
  ]);
});

test('runUpdateExtraSteps records results and observes every configured step', async () => {
  const started: string[] = [];
  const result = await runUpdateExtraSteps({
    iniPath: 'global.ini',
    repoRoot: '.',
    missionCsvDir: 'csv/scmdb',
    includeMiningJournal: true,
    onStepStart: (label) => started.push(label),
    runners: runnersFor({
      'Component Titles': { label: 'Component Titles', summary: 'component done' },
      'FPS title tags': null,
      'Missile title tags': { label: 'Missile title tags', summary: 'missile done' },
      'Mining journal': { label: 'Mining journal', summary: 'journal done' },
      'Raw commodity labels': { label: 'Raw commodity labels', summary: 'raw done' },
      'Adagio location tags (experimental)': { label: 'Adagio location tags (experimental)', summary: 'adagio done' },
    }),
  });

  assert.deepEqual(started, getUpdateExtraStepLabels({ includeMiningJournal: true }));
  assert.deepEqual(
    result.results.map((entry) => entry.summary),
    ['component done', 'missile done', 'journal done', 'raw done', 'adagio done'],
  );
  assert.deepEqual(result.errors, []);
});

test('runUpdateExtraSteps records step errors and continues', async () => {
  const observedErrors: string[] = [];
  const result = await runUpdateExtraSteps({
    iniPath: 'global.ini',
    repoRoot: '.',
    missionCsvDir: 'csv/scmdb',
    onStepError: (error) => observedErrors.push(`${error.label}: ${error.message}`),
    runners: runnersFor({
      'Component Titles': async () => {
        throw new Error('spviewer missing', { cause: new Error('weapon.csv') });
      },
      'FPS title tags': { label: 'FPS title tags', summary: 'fps done' },
      'Missile title tags': null,
      'Raw commodity labels': { label: 'Raw commodity labels', summary: 'raw done' },
      'Adagio location tags (experimental)': null,
    }),
  });

  assert.deepEqual(result.results, [
    { label: 'FPS title tags', summary: 'fps done' },
    { label: 'Raw commodity labels', summary: 'raw done' },
  ]);
  assert.deepEqual(result.errors, [{ label: 'Component Titles', message: 'spviewer missing', cause: 'weapon.csv' }]);
  assert.deepEqual(observedErrors, ['Component Titles: spviewer missing']);
});

function runnersFor(
  definitions: Partial<
    Record<
      UpdateExtraStepLabel,
      null | { label: string; summary: string } | (() => Promise<null | { label: string; summary: string } | undefined>)
    >
  >,
) {
  return Object.fromEntries(
    Object.entries(definitions).map(([label, definition]) => [
      label,
      typeof definition === 'function' ? definition : async () => definition,
    ]),
  );
}
