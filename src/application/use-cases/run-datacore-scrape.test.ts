import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runDatacoreScrape, type DataCoreTypeEntry } from './run-datacore-scrape';

const typeEntry: DataCoreTypeEntry = {
  name: 'shields',
  csvFile: 'shields.datacore.csv',
  typeConfig: {
    recordFilter: 'shieldgenerator',
    entityClassPrefix: 'shld_',
    nameKeyInfix: 'SHLD_',
    fieldSelectors: {
      Power: 'Power',
      Efficiency: { selector: 'Efficiency', attr: 'value', format: 'percent' },
    },
  },
};

test('runDatacoreScrape parses cached XML records without writing during dry run', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.0-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <SAttachableComponentParams>
          <AttachDef size="2" grade="b" subtype="CIVILIAN">
            <Manufacturer name="ACME" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    dryRun: true,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.versionTag, '4.8.0-live');
  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shields.datacore.csv' }]);
  assert.deepEqual(result.errors, []);
  await assert.rejects(() => fs.stat(path.join(repoRoot, 'csv', 'datacore', '4.8.0-live')));
});

test('runDatacoreScrape extracts XML cache when cached records are missing', async () => {
  const events: string[] = [];

  const result = await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async (_toolDir, log) => {
      log('tools ready');
      return { unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' };
    },
    countXmlFiles: async () => 0,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, false);
      events.push('extract');
      return { workDcbPath: 'cache/Game.dcb', monolithicXmlPath: 'cache/Game.xml', xmlFileCount: 123 };
    },
    onToolsLog: (message) => events.push(message),
    onCacheExtractStart: (_dcbPath, _xmlCacheDir, clearExisting) => {
      assert.equal(clearExisting, false);
      events.push('start');
    },
    onCacheExtractComplete: (count) => events.push(`complete:${count}`),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.results, []);
  assert.deepEqual(events, ['tools ready', 'start', 'extract', 'complete:123']);
});

test('runDatacoreScrape reports whether force extract will clear an existing cache', async () => {
  let clearExistingValue: boolean | undefined;

  await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    forceExtract: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 7,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, true);
      return { workDcbPath: 'cache/Game.dcb', monolithicXmlPath: 'cache/Game.xml', xmlFileCount: 123 };
    },
    onCacheExtractStart: (_dcbPath, _xmlCacheDir, clearExisting) => {
      clearExistingValue = clearExisting;
    },
  });

  assert.equal(clearExistingValue, true);
});

test('runDatacoreScrape reports unknown requested types before touching local game state', async () => {
  let resolvedLiveDir = false;

  await assert.rejects(
    () =>
      runDatacoreScrape({
        repoRoot: 'repo',
        types: ['unknown'],
        loadTypes: async () => [typeEntry],
        resolveLiveDir: () => {
          resolvedLiveDir = true;
          return 'C:/Games/StarCitizen/LIVE';
        },
      }),
    /Unknown item type: "unknown"/,
  );

  assert.equal(resolvedLiveDir, false);
});
