import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { compareProviderCategoryOutputs, formatProviderOutputComparison } from './provider-output-comparison';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'provider-comparison-'));
}

function makeConfig(label: string, csvFile: string): ItemConfig {
  return {
    label,
    csvFile,
    requiredColumns: ['Localization Key', 'Stat'],
    descKeyMatch: (key) => key.includes('desc_cool_'),
    buildValue: (row) => `Stat: ${row.Stat}`,
  };
}

test('compareProviderCategoryOutputs reports coverage gaps and changed values without writing global.ini', async () => {
  const tempDir = await makeTempDir();
  try {
    const datacoreDir = path.join(tempDir, 'datacore');
    const spviewerDir = path.join(tempDir, 'spviewer');
    const iniPath = path.join(tempDir, 'global.ini');
    await fs.mkdir(datacoreDir, { recursive: true });
    await fs.mkdir(spviewerDir, { recursive: true });

    const originalIni = [
      'item_Desc_COOL_SHARED=old shared',
      'item_Desc_COOL_DATACORE_ONLY=old datacore',
      'item_Desc_COOL_SPVIEWER_ONLY=old spviewer',
    ].join('\n');
    await fs.writeFile(iniPath, originalIni, 'utf8');
    await fs.writeFile(
      path.join(datacoreDir, 'coolers.datacore.csv'),
      ['Localization Key,Stat', 'item_Name_COOL_SHARED,42', 'item_Name_COOL_DATACORE_ONLY,99'].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(spviewerDir, 'coolers.spviewer.csv'),
      ['Localization Key,Stat', 'item_Name_COOL_SHARED,43', 'item_Name_COOL_SPVIEWER_ONLY,12'].join('\n'),
      'utf8',
    );

    const comparison = await compareProviderCategoryOutputs({
      category: 'coolers',
      iniPath,
      datacore: {
        config: makeConfig('DataCore Coolers', 'coolers.datacore.csv'),
        csvDir: datacoreDir,
      },
      spviewer: {
        config: makeConfig('SPViewer Coolers', 'coolers.spviewer.csv'),
        csvDir: spviewerDir,
      },
    });

    assert.deepEqual(comparison.counts, {
      datacoreKeys: 2,
      spviewerKeys: 2,
      commonKeys: 1,
      changedValues: 1,
      datacoreOnly: 1,
      spviewerOnly: 1,
    });
    assert.deepEqual(comparison.changedValues, [
      {
        key: 'item_Desc_COOL_SHARED',
        datacoreValue: 'Stat: 42',
        spviewerValue: 'Stat: 43',
      },
    ]);
    assert.deepEqual(comparison.datacoreOnly, [{ key: 'item_Desc_COOL_DATACORE_ONLY', value: 'Stat: 99' }]);
    assert.deepEqual(comparison.spviewerOnly, [{ key: 'item_Desc_COOL_SPVIEWER_ONLY', value: 'Stat: 12' }]);
    assert.equal(await fs.readFile(iniPath, 'utf8'), originalIni);

    const formatted = formatProviderOutputComparison(comparison);
    assert.match(formatted, /Provider comparison: coolers/);
    assert.match(formatted, /Changed values: 1 \(item_Desc_COOL_SHARED\)/);
    assert.match(formatted, /DataCore only:\s+1 \(item_Desc_COOL_DATACORE_ONLY\)/);
    assert.match(formatted, /SPViewer only:\s+1 \(item_Desc_COOL_SPVIEWER_ONLY\)/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('formatProviderOutputComparison caps representative key output', () => {
  const formatted = formatProviderOutputComparison(
    {
      category: 'coolers',
      counts: {
        datacoreKeys: 4,
        spviewerKeys: 0,
        commonKeys: 0,
        changedValues: 0,
        datacoreOnly: 4,
        spviewerOnly: 0,
      },
      changedValues: [],
      datacoreOnly: [
        { key: 'key_1', value: '1' },
        { key: 'key_2', value: '2' },
        { key: 'key_3', value: '3' },
        { key: 'key_4', value: '4' },
      ],
      spviewerOnly: [],
    },
    { maxKeys: 2 },
  );

  assert.match(formatted, /DataCore only:\s+4 \(key_1, key_2, \.\.\.and 2 more\)/);
  assert.doesNotMatch(formatted, /key_3/);
});
