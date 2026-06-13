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
      path.join(datacoreDir, 'radar.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
        'RADR_TEST,LOC_UNINITIALIZED,item_desc_radar,ACME,1,A,Industrial,100',
        'RADR_S01_TEMPLATE,LOC_PLACEHOLDER,item_desc_template,ACME,1,A,Industrial,100',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'record-graph.json'),
      `${JSON.stringify({
        source: 'datacore-record-graph',
        recordCount: 4,
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
          {
            path: 'items/radar.xml',
            ref: 'radar-ref',
            rootTag: 'EntityClassDefinition.RADR_TEST_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'RADR_TEST_SCItem',
            localizationKeys: [],
            referencedGuids: [],
          },
          {
            path: 'items/radr_s01_template.xml',
            ref: 'radar-template-ref',
            rootTag: 'EntityClassDefinition.RADR_S01_TEMPLATE',
            rootType: 'EntityClassDefinition',
            entityClass: 'RADR_S01_TEMPLATE',
            localizationKeys: [],
            referencedGuids: [],
          },
        ],
        indexes: {
          byRef: {
            'power-ref': 'items/power.xml',
            'cooler-ref': 'items/cooler.xml',
            'shield-ref': 'items/shield.xml',
            'radar-ref': 'items/radar.xml',
            'radar-template-ref': 'items/radr_s01_template.xml',
          },
          byPath: {
            'items/power.xml': 0,
            'items/cooler.xml': 1,
            'items/shield.xml': 2,
            'items/radar.xml': 3,
            'items/radr_s01_template.xml': 4,
          },
          byRootType: {
            EntityClassDefinition: [
              'items/power.xml',
              'items/cooler.xml',
              'items/shield.xml',
              'items/radar.xml',
              'items/radr_s01_template.xml',
            ],
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

    assert.equal(diagnostics.totalComponents, 5);
    assert.equal(diagnostics.duplicateComponentRowsIgnored, 1);
    assert.equal(diagnostics.componentsWithGraphTitleKeys, 1);
    assert.equal(diagnostics.componentsWithoutGraphTitleKeys, 4);
    assert.deepEqual(diagnostics.matchedIniKeys, {
      total: 3,
      graphLocalization: 1,
      csvNameKey: 1,
      guessedAlias: 1,
    });
    assert.equal(diagnostics.titleKeys.graphLocalization, 1);
    assert.equal(diagnostics.titleKeys.csvNameKey, 2);
    assert.equal(diagnostics.titleKeys.guessedOnly, 12);
    assert.deepEqual(diagnostics.titleKeyGaps, {
      placeholderNameKey: 2,
      missingNameKey: 1,
      csvNameKeyOnly: 1,
      other: 0,
      likelyNonUserFacing: 1,
      samples: [
        {
          entityClass: 'cool_test',
          componentType: 'cooler',
          nameKey: 'item_name_csv_cool',
          reason: 'csv-name-key-only',
        },
        {
          entityClass: 'radr_test',
          componentType: 'radar',
          nameKey: 'loc_uninitialized',
          reason: 'placeholder-name-key',
        },
        {
          entityClass: 'radr_s01_template',
          componentType: 'radar',
          nameKey: 'loc_placeholder',
          reason: 'placeholder-name-key',
        },
        {
          entityClass: 'shld_test',
          componentType: 'shield',
          nameKey: '',
          reason: 'missing-name-key',
        },
      ],
    });
    assert.deepEqual(
      diagnostics.componentFamilies.map((family) => [family.componentType, family.status]),
      [
        ['cooler', 'no-graph-title-keys'],
        ['powerplant', 'covered'],
        ['radar', 'no-graph-title-keys'],
        ['shield', 'no-graph-title-keys'],
      ],
    );
    assert.deepEqual(diagnostics.guessedOnlyMatches, [
      { key: 'item_nameshld_test', entityClass: 'shld_test', componentType: 'shield' },
    ]);

    const formatted = formatDataCoreRelationshipCoverageDiagnostics(diagnostics);
    assert.match(formatted, /DataCore relationship coverage audit/);
    assert.match(
      formatted,
      /Components: 5 unique; 1 with graph title keys; 4 without graph title keys; 1 duplicate rows ignored\./,
    );
    assert.match(formatted, /Matched INI name keys: 3 total; 1 graph; 1 CSV name keys; 1 guessed aliases\./);
    assert.match(formatted, /Rows without graph title keys: 2 placeholder name keys; 1 missing name keys; 1 CSV name-key only; 0 other\./);
    assert.match(formatted, /Likely non-user-facing title gaps: 1\./);
    assert.match(formatted, /item_nameshld_test \(shield, shld_test\)/);
    assert.match(formatted, /cooler, cool_test: csv-name-key-only \(item_name_csv_cool\)/);
    assert.match(formatted, /radar, radr_test: placeholder-name-key \(loc_uninitialized\)/);
    assert.match(formatted, /Summary: \d+ relationship coverage warnings\./);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
