import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { loadDatacoreConfigs, loadMissionConfigs } from '../../items/registry';
import { inferCategorySourceProvider, listCategorySourceFiles } from './category-source-contracts';

test('listCategorySourceFiles exposes custom loader declarations instead of hidden primary files', () => {
  const config: ItemConfig = {
    label: 'Contracted custom source',
    csvFile: 'legacy-hidden.csv',
    requiredColumns: [],
    descKeyMatch: () => false,
    loadSourceData: async () => [],
    sourceFiles: [
      { file: 'primary.datacore.csv', sourceDir: 'datacore' },
      { file: 'fallback.csv', sourceDir: 'scmdb', optional: true },
    ],
  };

  assert.deepEqual(listCategorySourceFiles(config, 'scmdb'), [
    { filename: 'primary.datacore.csv', provider: 'datacore', optional: undefined, role: 'companion' },
    { filename: 'fallback.csv', provider: 'scmdb', optional: true, role: 'companion' },
  ]);
});

test('active category configs have explicit source ownership', async () => {
  const [datacoreConfigs, missionConfigs] = await Promise.all([loadDatacoreConfigs(), loadMissionConfigs()]);
  const activeConfigs = [
    ...[...datacoreConfigs.entries()].map(([slug, config]) => ({ slug, config, fallback: 'datacore' as const })),
    ...[...missionConfigs.entries()]
      .filter(([, config]) => !config.skip)
      .map(([slug, config]) => ({ slug, config, fallback: 'scmdb' as const })),
  ];

  const ambiguous = activeConfigs
    .map(({ slug, config, fallback }) => ({ slug, provider: inferCategorySourceProvider(config, fallback) }))
    .filter((entry) => entry.provider === 'unknown');

  assert.deepEqual(ambiguous, []);
});
