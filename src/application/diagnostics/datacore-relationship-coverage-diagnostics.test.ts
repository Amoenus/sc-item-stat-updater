import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDataCoreRelationshipCoverageDiagnostics,
  formatDataCoreRelationshipCoverageDiagnostics,
} from './datacore-relationship-coverage-diagnostics';

test('DataCore relationship coverage audit separates graph, CSV, and guessed component title keys', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-relationship-coverage-'));
  try {
    const datacoreDir = path.join(tempDir, 'datacore');
    await fs.mkdir(datacoreDir);
    await fs.writeFile(
      path.join(datacoreDir, 'powerplant.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
        'POWR_TEST,item_name_csv_power,item_desc_power,ACME,1,A,Military,100',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'cooler.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
        'COOL_TEST,item_name_csv_cool,item_desc_cool,ACME,1,A,Industrial,100',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'shield.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
        'SHLD_TEST,,item_desc_shield,ACME,1,A,Industrial,100',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'record-graph.json'),
      `${JSON.stringify({
        source: 'datacore-record-graph',
        recordCount: 3,
        records: [
          {
            path: 'items/power.xml',
            ref: 'power-ref',
            rootTag: 'EntityClassDefinition.POWR_TEST_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'POWR_TEST_SCItem',
            localizationKeys: [{ attribute: 'Name', key: 'item_name_graph_power' }],
            referencedGuids: [],
          },
          {
            path: 'items/cooler.xml',
            ref: 'cooler-ref',
            rootTag: 'EntityClassDefinition.COOL_TEST_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'COOL_TEST_SCItem',
            localizationKeys: [],
            referencedGuids: [],
          },
          {
            path: 'items/shield.xml',
            ref: 'shield-ref',
            rootTag: 'EntityClassDefinition.SHLD_TEST_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'SHLD_TEST_SCItem',
            localizationKeys: [],
            referencedGuids: [],
          },
        ],
        indexes: {
          byRef: {
            'power-ref': 'items/power.xml',
            'cooler-ref': 'items/cooler.xml',
            'shield-ref': 'items/shield.xml',
          },
          byPath: {
            'items/power.xml': 0,
            'items/cooler.xml': 1,
            'items/shield.xml': 2,
          },
          byRootType: {
            EntityClassDefinition: ['items/power.xml', 'items/cooler.xml', 'items/shield.xml'],
          },
          byEntityClass: {},
          byLocalizationKey: {},
          byReferencedGuid: {},
        },
      })}\n`,
      'utf8',
    );
    const iniPath = path.join(tempDir, 'global.ini');
    await fs.writeFile(
      iniPath,
      ['item_name_graph_power=Graph Power', 'item_name_csv_cool=CSV Cooler', 'item_nameshld_test=Guessed Shield'].join(
        '\n',
      ),
      'utf8',
    );

    const diagnostics = await buildDataCoreRelationshipCoverageDiagnostics({
      datacoreVersionDir: datacoreDir,
      iniPath,
    });

    assert.equal(diagnostics.totalComponents, 3);
    assert.equal(diagnostics.componentsWithGraphTitleKeys, 1);
    assert.equal(diagnostics.componentsWithoutGraphTitleKeys, 2);
    assert.deepEqual(diagnostics.matchedIniKeys, {
      total: 3,
      graphLocalization: 1,
      csvNameKey: 1,
      guessedAlias: 1,
    });
    assert.equal(diagnostics.titleKeys.graphLocalization, 1);
    assert.equal(diagnostics.titleKeys.csvNameKey, 2);
    assert.equal(diagnostics.titleKeys.guessedOnly, 4);
    assert.deepEqual(
      diagnostics.componentFamilies.map((family) => [family.componentType, family.status]),
      [
        ['cooler', 'no-graph-title-keys'],
        ['powerplant', 'covered'],
        ['shield', 'no-graph-title-keys'],
      ],
    );
    assert.deepEqual(diagnostics.guessedOnlyMatches, [
      { key: 'item_nameshld_test', entityClass: 'shld_test', componentType: 'shield' },
    ]);

    const formatted = formatDataCoreRelationshipCoverageDiagnostics(diagnostics);
    assert.match(formatted, /DataCore relationship coverage audit/);
    assert.match(formatted, /Matched INI name keys: 3 total; 1 graph; 1 CSV name keys; 1 guessed aliases\./);
    assert.match(formatted, /item_nameshld_test \(shield, shld_test\)/);
    assert.match(formatted, /Summary: \d+ relationship coverage warnings\./);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
