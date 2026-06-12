import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { DataCoreRecordGraph } from '../../sources/datacore/types';
import {
  buildDataCorePatchDriftDiagnostics,
  formatDataCorePatchDriftDiagnostics,
} from './datacore-patch-drift-diagnostics';

test('DataCore patch drift audit flags unowned component-shaped CSVs and missing graph records', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-patch-drift-'));
  try {
    const currentDir = path.join(tempDir, '4.8.1-live.2');
    const previousDir = path.join(tempDir, '4.8.1-live.1');
    await fs.mkdir(currentDir, { recursive: true });
    await fs.mkdir(previousDir, { recursive: true });
    await fs.writeFile(
      path.join(currentDir, 'powerplant.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power Output',
        'POWR_AEGS_S01_Charger,item_name_charger,item_desc_charger,AEGS,1,A,Military,100,2500',
        'POWR_MISSING,item_name_missing,item_desc_missing,AEGS,1,B,Civilian,90,1200',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(currentDir, 'newcomponent.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Some Stat',
        'NEW_Component,item_name_new,item_desc_new,ACME,2,C,Industrial,300,42',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(currentDir, 'commodities.datacore.csv'),
      'Entity Class,Name Key,Description Key,Display Name Key\nCommodity,item_name,item_desc,item_display\n',
      'utf8',
    );
    await fs.writeFile(path.join(currentDir, 'record-graph.json'), `${JSON.stringify(makeGraph(3))}\n`, 'utf8');
    await fs.writeFile(path.join(previousDir, 'record-graph.json'), `${JSON.stringify(makeGraph(1))}\n`, 'utf8');

    const diagnostics = await buildDataCorePatchDriftDiagnostics({
      datacoreVersionDir: currentDir,
      previousDatacoreVersionDir: previousDir,
      ownedDataCoreFiles: { 'powerplant.datacore.csv': ['dc-powerplants'] },
      relationshipChangeThreshold: 0.5,
    });

    assert.equal(diagnostics.graphStatus, 'present');
    assert.equal(diagnostics.componentFiles.length, 2);
    assert.deepEqual(
      diagnostics.componentFiles.map((file) => [file.csvFile, file.status, file.missingGraphRecords]),
      [
        ['newcomponent.datacore.csv', 'unowned-component-shaped', 1],
        ['powerplant.datacore.csv', 'owned', 1],
      ],
    );
    assert.match(diagnostics.warnings.join('\n'), /newcomponent\.datacore\.csv looks component-shaped/);
    assert.match(diagnostics.warnings.join('\n'), /powerplant\.datacore\.csv has 1 rows/);
    assert.equal(
      diagnostics.relationshipMetrics.find((metric) => metric.name === 'relationships.referenced-guids')?.status,
      'changed',
    );

    const formatted = formatDataCorePatchDriftDiagnostics(diagnostics);
    assert.match(formatted, /DataCore patch drift audit/);
    assert.match(formatted, /\| newcomponent\.datacore\.csv \| unowned-component-shaped \| 1 \| none \| 1 \| 0 \|/);
    assert.match(formatted, /Summary: \d+ patch drift warnings\./);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('DataCore patch drift audit reports missing graph without failing CSV ownership checks', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-patch-drift-'));
  try {
    await fs.writeFile(
      path.join(tempDir, 'cooler.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Cooling Rate',
        'COOL_AEGS_S01,item_name_cooler,item_desc_cooler,AEGS,1,A,Military,100,12000',
      ].join('\n'),
      'utf8',
    );

    const diagnostics = await buildDataCorePatchDriftDiagnostics({
      datacoreVersionDir: tempDir,
      ownedDataCoreFiles: { 'cooler.datacore.csv': ['dc-coolers'] },
    });

    assert.equal(diagnostics.graphStatus, 'missing');
    assert.equal(diagnostics.componentFiles[0]?.missingGraphRecords, 1);
    assert.match(diagnostics.warnings.join('\n'), /record-graph\.json is missing/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

function makeGraph(referenceCount: number): DataCoreRecordGraph {
  const referencedGuids = Array.from({ length: referenceCount }, (_, index) => `ref-${index}`);
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: 'items/powr_aegs_s01_charger.xml',
        ref: 'charger-ref',
        rootTag: 'EntityClassDefinition.POWR_AEGS_S01_Charger_SCItem',
        rootType: 'EntityClassDefinition',
        entityClass: 'POWR_AEGS_S01_Charger_SCItem',
        localizationKeys: [
          { attribute: 'Name', key: 'item_name_charger' },
          { attribute: 'Description', key: 'item_desc_charger' },
        ],
        referencedGuids,
      },
      {
        path: 'items/commodity.xml',
        ref: 'commodity-ref',
        rootTag: 'EntityClassDefinition.Commodity',
        rootType: 'EntityClassDefinition',
        entityClass: 'Commodity',
        localizationKeys: [],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'charger-ref': 'items/powr_aegs_s01_charger.xml',
        'commodity-ref': 'items/commodity.xml',
      },
      byPath: {
        'items/powr_aegs_s01_charger.xml': 0,
        'items/commodity.xml': 1,
      },
      byRootType: {
        EntityClassDefinition: ['items/powr_aegs_s01_charger.xml', 'items/commodity.xml'],
      },
      byEntityClass: {
        POWR_AEGS_S01_Charger_SCItem: ['items/powr_aegs_s01_charger.xml'],
        Commodity: ['items/commodity.xml'],
      },
      byLocalizationKey: {
        item_name_charger: ['items/powr_aegs_s01_charger.xml'],
        item_desc_charger: ['items/powr_aegs_s01_charger.xml'],
      },
      byReferencedGuid: Object.fromEntries(referencedGuids.map((ref) => [ref, ['items/powr_aegs_s01_charger.xml']])),
    },
  };
}
