import assert from 'node:assert/strict';
import test from 'node:test';
import type { DataCoreComponentDataset } from './datacore/types';
import type { ScmdbOutputDataset } from './scmdb/types';
import type { SpviewerItemDataset } from './spviewer/types';

test('provider source dataset contracts carry source metadata and provider records', () => {
  const datacore = {
    source: 'datacore',
    version: '4.8.1.11875683',
    channel: 'live',
    records: [
      {
        'Entity Class': 'shield_test',
        'Name Key': 'item_NameSHLD_Test',
        'Short Name Key': '',
        'Description Key': 'item_DescSHLD_Test',
        Manufacturer: 'BEHR',
        Size: '1',
        Grade: 'A',
        Class: 'Military',
        Health: '1000',
      },
    ],
  } satisfies DataCoreComponentDataset;

  const scmdb = {
    source: 'scmdb',
    version: '4.8.1-live.11875683',
    channel: 'live',
    records: [{ family: 'mission', 'Localization Key': 'mission_desc' }],
  } satisfies ScmdbOutputDataset;

  const spviewer = {
    source: 'spviewer',
    version: '4.8.1.11875683-live',
    channel: 'live',
    records: [{ Name: 'CF-117 Bulldog', 'Localization Key': 'item_NameGUN_CF117' }],
  } satisfies SpviewerItemDataset;

  assert.equal(datacore.source, 'datacore');
  assert.equal(scmdb.records[0].family, 'mission');
  assert.equal(spviewer.records[0].Name, 'CF-117 Bulldog');
});
