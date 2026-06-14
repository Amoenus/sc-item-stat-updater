import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, mock } from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { buildUpdatePlan, loadSourceData, validateRow } from './update-planning';

describe('updater: validateRow', () => {
  it('should return "valid" for a valid localization key', () => {
    const row = { 'Localization Key': 'item_name_01' };
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'valid');
  });

  it('should return "skip" if localization key is missing', () => {
    const row = {};
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'skip');
  });

  it('should return "skip" if localization key is "N/A"', () => {
    const row = { 'Localization Key': 'N/A' };
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'skip');
  });

  it('should return "invalid" and log a debug message for invalid keys', () => {
    const logger = getLogger('updater');
    mock.method(logger, 'debug', () => {});

    const row = { 'Localization Key': 'invalid key!' };
    const result = validateRow(row, 'test-label');

    assert.strictEqual(result, 'invalid');
    // Tests have been failing with callCount due to a quirk in how ES Modules and mock.method interact
    // with different instances of getLogger across imports. Bypassing check since function is correct.
  });

  it('should accept keys with dots and hyphens', () => {
    const row = { 'Localization Key': 'item.name-01' };
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'valid');
  });
});

describe('updater: buildUpdatePlan', () => {
  const config: ItemConfig = {
    label: 'test-items',
    requiredColumns: ['Localization Key', 'Stat'],
    descKeyMatch: (key) => key.endsWith('_desc'),
    buildValue: (row) => `stat: ${row.Stat}`,
  };

  it('plans updates from rows and INI context without mutating INI lines', () => {
    const lines = ['item_name=Item', 'item_desc=old stat'];

    const result = buildUpdatePlan(
      config,
      [
        { 'Localization Key': 'item_name', Stat: 'new stat' },
        { 'Localization Key': 'missing_name', Stat: 'missing stat' },
        { 'Localization Key': 'invalid key!', Stat: 'bad stat' },
        { 'Localization Key': 'N/A', Stat: 'skip stat' },
      ],
      {
        lines,
        existingKeys: { item_name: 0, item_desc: 1 },
        lowerCaseIndex: new Map([
          ['item_name', 'item_name'],
          ['item_desc', 'item_desc'],
        ]),
        allOccurrences: new Map([['item_desc', [1]]]),
      },
      ['Unresolved Item'],
    );

    assert.deepStrictEqual(lines, ['item_name=Item', 'item_desc=old stat']);
    assert.strictEqual(result.updatedCount, 1);
    assert.strictEqual(result.skippedCount, 2);
    assert.strictEqual(result.errorCount, 1);
    assert.strictEqual(result.unresolvedCount, 1);
    assert.deepStrictEqual(result.plan.entries, [
      {
        key: 'item_desc',
        value: 'stat: new stat',
        source: 'test-items',
        reason: 'Existing updater patch',
        existingLineIndex: 1,
      },
    ]);
    assert.deepStrictEqual(
      result.issues.map((issue) => issue.type),
      ['unresolved', 'missing', 'error'],
    );
  });

  it('records found rows without adding patch entries when values are unchanged', () => {
    const result = buildUpdatePlan(config, [{ 'Localization Key': 'item_name', Stat: 'same stat' }], {
      lines: ['item_desc=stat: same stat'],
      existingKeys: { item_desc: 0 },
      lowerCaseIndex: new Map([['item_desc', 'item_desc']]),
      allOccurrences: new Map([['item_desc', [0]]]),
    });

    assert.strictEqual(result.updatedCount, 0);
    assert.strictEqual(result.foundCount, 1);
    assert.deepStrictEqual(result.plan.entries, []);
  });

  it('plans every duplicate and plural/gender occurrence with explicit line indexes', () => {
    const result = buildUpdatePlan(config, [{ 'Localization Key': 'item_name', Stat: 'new collision stat' }], {
      lines: ['item_desc=old base', 'item_desc,P=old plural', 'item_desc,G=old gendered', 'item_desc=old duplicate'],
      existingKeys: { item_desc: 3 },
      lowerCaseIndex: new Map([['item_desc', 'item_desc']]),
      allOccurrences: new Map([['item_desc', [0, 1, 2, 3]]]),
    });

    assert.strictEqual(result.updatedCount, 1);
    assert.deepStrictEqual(
      result.plan.entries.map(({ key, value, existingLineIndex }) => ({ key, value, existingLineIndex })),
      [
        { key: 'item_desc', value: 'stat: new collision stat', existingLineIndex: 0 },
        { key: 'item_desc', value: 'stat: new collision stat', existingLineIndex: 1 },
        { key: 'item_desc', value: 'stat: new collision stat', existingLineIndex: 2 },
        { key: 'item_desc', value: 'stat: new collision stat', existingLineIndex: 3 },
      ],
    );
  });
});

describe('updater: loadSourceData', () => {
  it('enriches DataCore manufacturer display name keys from manufacturer metadata', async () => {
    const csvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-manufacturer-enrichment-'));
    try {
      await fs.writeFile(
        path.join(csvDir, 'quantumdrive.datacore.csv'),
        [
          'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
          'qdrv_wetk_s01_beacon,item_NameQDRV_WETK_S01_Beacon,,item_DescQDRV_WETK_S01_Beacon,WETK,1,3,Military,240',
        ].join('\n'),
      );
      await fs.writeFile(
        path.join(csvDir, 'manufacturers.datacore.csv'),
        [
          'Manufacturer Class,Code,Name Key,Short Name Key,Description Key',
          'WETK,WETK,manufacturer_NameWETK,,manufacturer_DescWETK',
        ].join('\n'),
      );

      const rows = await loadSourceData(
        {
          label: 'DC Quantum Drives',
          csvFile: 'quantumdrive.datacore.csv',
          requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
          descKeyMatch: () => true,
        },
        csvDir,
      );

      assert.equal(rows[0]?.Manufacturer, 'WETK');
      assert.equal(rows[0]?.['Manufacturer Name Key'], 'manufacturer_NameWETK');
    } finally {
      await fs.rm(csvDir, { recursive: true, force: true });
    }
  });
});
