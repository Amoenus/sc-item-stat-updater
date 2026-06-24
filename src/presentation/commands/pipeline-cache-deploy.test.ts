import assert from 'node:assert/strict';
import test from 'node:test';
import type { runBatchUpdate } from '../../application/use-cases/run-batch-update';
import type { createDataCoreScrapePlan } from '../../application/use-cases/run-datacore-scrape';
import type { createScmdbScrapePlan } from '../../application/use-cases/run-scmdb-scrape';
import type { CommandIO } from '../cli';
import { runCacheCommand } from './cache';
import { runDeployCommand } from './deploy';
import { runPipelineCommand } from './pipeline';

function createFakeIO(): CommandIO & { stdoutText: () => string; stderrText: () => string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    cwd: process.cwd(),
    stdout: {
      isTTY: false,
      write(chunk: string | Uint8Array) {
        stdout.push(String(chunk));
        return true;
      },
    },
    stderr: {
      isTTY: false,
      write(chunk: string | Uint8Array) {
        stderr.push(String(chunk));
        return true;
      },
    },
    stdoutText: () => stdout.join(''),
    stderrText: () => stderr.join(''),
  };
}

function successfulUpdateResult(): Awaited<ReturnType<typeof runBatchUpdate>> {
  return {
    exitCode: 0,
    results: [],
    errors: [],
    prepared: {} as Awaited<ReturnType<typeof runBatchUpdate>>['prepared'],
    sourceDiagnostics: { versions: [], warnings: [] },
    iniPath: 'repo/global.ini',
    totalDurationMs: 0,
  };
}

function updateResultWithAudit(): Awaited<ReturnType<typeof runBatchUpdate>> {
  return {
    ...successfulUpdateResult(),
    scmdbDependencyAudit: {
      sourceHierarchy: ['DataCore first'],
      entries: [
        {
          kind: 'extra step',
          slug: 'mining-journal',
          label: 'Mining journal',
          sourceFiles: ['fallback:mining-journal.csv'],
          classification: 'SCMDB-only derived/generated',
          reason: 'journal rarity labels still need the bridge',
          migrationSlice: 'keep as bridge',
          activeForDatacoreProvider: false,
        },
      ],
    },
  };
}

test('pipeline command defaults to source refresh and deploy', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runPipelineCommand([], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async (options) => {
      observed.push(options);
      return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
    },
    runBatchUpdate: async () => successfulUpdateResult(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    observed.map((entry) => (entry as { target: string }).target),
    ['datacore'],
  );
  assert.equal(io.stderrText(), '');
});

test('pipeline command refreshes SCMDB only through an explicit source target', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runPipelineCommand(['--source', 'all'], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async (options) => {
      observed.push(options);
      return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
    },
    runBatchUpdate: async () => successfulUpdateResult(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(observed.map((entry) => (entry as { target: string }).target).sort(), ['datacore', 'scmdb']);
  assert.equal(io.stderrText(), '');
});

test('pipeline command renders phases and task completions', async () => {
  const io = createFakeIO();

  const exitCode = await runPipelineCommand([], io, {
    refreshGlobalIni: async ({ repoIniPath, log }) => {
      log?.('global.ini extracted');
      return { repoIniPath, extractedGamePath: 'game/global.ini' };
    },
    refreshSourceCache: async (options) => {
      options.log?.(`${options.target?.toUpperCase()} cache refreshed`);
      return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
    },
    runBatchUpdate: async () => successfulUpdateResult(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText(), /Extract fresh global\.ini/);
  assert.match(io.stdoutText(), /Refresh source caches/);
  assert.match(io.stdoutText(), /DATACORE cache/);
  assert.doesNotMatch(io.stdoutText(), /SCMDB cache/);
  assert.match(io.stdoutText(), /Apply localization updates/);
  assert.match(io.stdoutText(), /Deploy global\.ini to game/);
  assert.match(io.stdoutText(), /Pipeline complete/);
});

test('pipeline command maps cached, repo-only, and rebuild-cache flags', async () => {
  const io = createFakeIO();
  const updateOptions: unknown[] = [];
  const deployed: unknown[] = [];

  const exitCode = await runPipelineCommand(['--cached', '--repo-only', '--rebuild-cache', '--ptu'], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async () => {
      throw new Error('source refresh should be skipped');
    },
    runBatchUpdate: async (options) => {
      updateOptions.push(options);
      return successfulUpdateResult();
    },
    deployGlobalIni: async (options) => {
      deployed.push(options);
      return options;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(updateOptions.length, 1);
  assert.equal(deployed.length, 0);
  assert.equal((updateOptions[0] as { ptu: boolean }).ptu, true);
});

test('pipeline command treats npm rebuild-cache config as force fallback', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];
  const original = process.env.npm_config_rebuild_cache;
  process.env.npm_config_rebuild_cache = 'true';

  try {
    const exitCode = await runPipelineCommand([], io, {
      refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
      refreshSourceCache: async (options) => {
        observed.push(options);
        return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
      },
      runBatchUpdate: async () => successfulUpdateResult(),
      deployGlobalIni: async (options) => options,
    });

    assert.equal(exitCode, 0);
    assert.equal((observed[0] as { force: boolean }).force, true);
    assert.equal(observed.length, 1);
  } finally {
    if (original === undefined) {
      delete process.env.npm_config_rebuild_cache;
    } else {
      process.env.npm_config_rebuild_cache = original;
    }
  }
});

test('pipeline command rejects npm force flag name', async () => {
  const io = createFakeIO();
  await assert.rejects(() => runPipelineCommand(['--force'], io), /Unknown option '--force'/);
});

test('pipeline command keeps SCMDB audit out of normal Listr output', async () => {
  const io = createFakeIO();

  const exitCode = await runPipelineCommand([], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async (options) => ({
      exitCode: 0,
      refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'],
    }),
    runBatchUpdate: async () => updateResultWithAudit(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.doesNotMatch(io.stdoutText(), /SCMDB dependency audit/);
  assert.match(io.stdoutText(), /Pipeline complete/);
});

test('pipeline command prints detailed diagnostics after tasks in verbose mode', async () => {
  const io = createFakeIO();

  const exitCode = await runPipelineCommand(['--verbose'], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async (options) => ({
      exitCode: 0,
      refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'],
    }),
    runBatchUpdate: async () => updateResultWithAudit(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText(), /SCMDB dependency audit/);
  assert.match(io.stdoutText(), /Source data:/);
  assert.ok(io.stdoutText().indexOf('SCMDB dependency audit') < io.stdoutText().indexOf('Pipeline complete'));
});

test('cache command refreshes source outputs without global.ini workflow hooks', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runCacheCommand(['--source', 'datacore', '--rebuild-cache'], io, {
    refreshSourceCache: async (options) => {
      observed.push(options);
      return { exitCode: 0, refreshed: ['datacore'] };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal((observed[0] as { target: string }).target, 'datacore');
  assert.equal((observed[0] as { force: boolean }).force, true);
  assert.match(io.stdoutText(), /Cache refresh complete: datacore/);
  assert.equal(io.stderrText(), '');
});

test('cache command defaults to DataCore and keeps SCMDB behind explicit source selection', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runCacheCommand([], io, {
    refreshSourceCache: async (options) => {
      observed.push(options);
      return { exitCode: 0, refreshed: ['datacore'] };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    observed.map((entry) => (entry as { target: string }).target),
    ['datacore'],
  );
  assert.match(io.stdoutText(), /Cache refresh complete: datacore/);
  assert.equal(io.stderrText(), '');
});

test('cache command does not render callback progress as fake nested Listr stages', async () => {
  const io = createFakeIO();

  const exitCode = await runCacheCommand(['--source', 'datacore'], io, {
    refreshSourceCache: async (options) => {
      options.onDatacorePrepared?.({ selectedTypes: [] });
      options.onCacheHit?.(12, 'xml-cache');
      options.onRecordGraphCacheHit?.(34, 'record-graph.json');
      options.onRawFactStart?.('contract-generators', 3);
      options.onRawFactProgress?.('contract-generators', 1, 3);
      return { exitCode: 0, refreshed: ['datacore'] };
    },
  });

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText(), /DATACORE cache/);
  assert.doesNotMatch(io.stdoutText(), /Prepare DataCore scrape/);
  assert.doesNotMatch(io.stdoutText(), /Ensure XML cache/);
  assert.doesNotMatch(io.stdoutText(), /Prepare record graph/);
  assert.doesNotMatch(io.stdoutText(), /Extract raw fact datasets/);
});

test('cache command renders DataCore plan stages as real nested Listr tasks', async () => {
  const io = createFakeIO();
  const calls: string[] = [];
  const typeEntry = { name: 'weapons', csvFile: 'weapons.datacore.csv', typeConfig: {} as never };

  const createPlan: typeof createDataCoreScrapePlan = (options) => ({
    async prepare() {
      calls.push('prepare');
      options.onPrepared?.({
        gameVersion: '1.2.3.4',
        channel: 'live',
        dcbPath: 'Game2.dcb',
        outputBase: 'csv/datacore/1.2.3-live.4',
        xmlCacheDir: 'csv/datacore/.xmlcache/1.2.3-live.4',
        selectedTypes: [typeEntry],
        allTypes: [typeEntry],
        dryRun: false,
      });
      return {
        gameVersion: '1.2.3.4',
        channel: 'live',
        dcbPath: 'Game2.dcb',
        outputBase: 'csv/datacore/1.2.3-live.4',
        xmlCacheDir: 'csv/datacore/.xmlcache/1.2.3-live.4',
        selectedTypes: [typeEntry],
        allTypes: [typeEntry],
        dryRun: false,
      };
    },
    async ensureXmlCache() {
      calls.push('cache');
      options.onCacheHit?.(12, 'xml-cache');
      return { xmlFileCount: 12, reused: true };
    },
    async prepareRecordGraph() {
      calls.push('graph');
      options.onRecordGraphCacheHit?.(34, 'record-graph.json');
      return { recordCount: 34, outputPath: 'record-graph.json', cached: true };
    },
    getRawFactStages() {
      return [{ id: 'blueprint-pools', title: 'Blueprint pools' }];
    },
    async extractRawFactStage(stageId) {
      calls.push(`fact:${stageId}`);
      options.onRawFactStart?.('blueprint-pools', 116);
      options.onRawFactProgress?.('blueprint-pools', 116, 116);
      return { rows: 116, csvFile: 'blueprint-pools.datacore.csv' };
    },
    async finalizeRawFacts() {
      calls.push('finalize-facts');
      return [
        { slug: 'blueprint-pools', label: 'Blueprint pools', rows: 116, csvFile: 'blueprint-pools.datacore.csv' },
      ];
    },
    async extractRawFacts() {
      calls.push('facts');
      await this.extractRawFactStage('blueprint-pools');
      return this.finalizeRawFacts();
    },
    getItemTypeStages() {
      return [{ id: 'weapons', title: 'weapons' }];
    },
    async scrapeItemTypeStage(typeName) {
      calls.push(`type:${typeName}`);
      options.onTypeStart?.(typeEntry, 0);
      return { result: { type: 'weapons', rows: 1, skipped: 0, csvFile: 'weapons.datacore.csv' } };
    },
    async finalizeItemTypes() {
      calls.push('finalize-types');
      return { results: [{ type: 'weapons', rows: 1, skipped: 0, csvFile: 'weapons.datacore.csv' }], errors: [] };
    },
    async scrapeItemTypes() {
      calls.push('types');
      await this.scrapeItemTypeStage('weapons');
      return this.finalizeItemTypes();
    },
    result() {
      calls.push('result');
      return { exitCode: 0 } as ReturnType<ReturnType<typeof createDataCoreScrapePlan>['result']>;
    },
  });

  const exitCode = await runCacheCommand(['--source', 'datacore'], io, { createDataCoreScrapePlan: createPlan });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    'prepare',
    'cache',
    'graph',
    'fact:blueprint-pools',
    'finalize-facts',
    'type:weapons',
    'finalize-types',
    'result',
  ]);
  assert.match(io.stdoutText(), /Prepare DataCore scrape/);
  assert.match(io.stdoutText(), /Ensure XML cache/);
  assert.match(io.stdoutText(), /Prepare record graph/);
  assert.match(io.stdoutText(), /Extract raw fact datasets/);
  assert.match(io.stdoutText(), /Extract blueprint and material facts/);
  assert.match(io.stdoutText(), /Blueprint pools - 116\/116/);
  assert.match(io.stdoutText(), /Blueprint pools/);
  assert.doesNotMatch(io.stdoutText(), /1\/1 Blueprint pools/);
  assert.match(io.stdoutText(), /Finalize raw fact catalog/);
  assert.match(io.stdoutText(), /Scrape item type CSVs/);
  assert.match(io.stdoutText(), /weapons/);
  assert.match(io.stdoutText(), /Finalize item type catalog/);
  assert.match(io.stdoutText(), /Complete DataCore cache/);
});

test('cache command runs independent DataCore raw fact children concurrently', async () => {
  const io = createFakeIO();
  const typeEntry = { name: 'weapons', csvFile: 'weapons.datacore.csv', typeConfig: {} as never };
  let inFlight = 0;
  let maxInFlight = 0;

  const createPlan: typeof createDataCoreScrapePlan = (options) => ({
    async prepare() {
      const prepared = {
        gameVersion: '1.2.3.4',
        channel: 'live' as const,
        dcbPath: 'Game2.dcb',
        outputBase: 'csv/datacore/1.2.3-live.4',
        xmlCacheDir: 'csv/datacore/.xmlcache/1.2.3-live.4',
        selectedTypes: [typeEntry],
        allTypes: [typeEntry],
        dryRun: false,
      };
      options.onPrepared?.(prepared);
      return prepared;
    },
    async ensureXmlCache() {
      return { xmlFileCount: 12, reused: true };
    },
    async prepareRecordGraph() {
      return { recordCount: 34, outputPath: 'record-graph.json', cached: true };
    },
    getRawFactStages() {
      return [
        { id: 'blueprint-pools', title: 'Blueprint pools' },
        { id: 'crafting-blueprints', title: 'Crafting blueprints' },
      ];
    },
    async extractRawFactStage(stageId) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      options.onRawFactStart?.(stageId, 1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      options.onRawFactProgress?.(stageId, 1, 1);
      inFlight -= 1;
      return { rows: 1, csvFile: `${stageId}.datacore.csv` };
    },
    async finalizeRawFacts() {
      return [
        { slug: 'blueprint-pools', label: 'Blueprint pools', rows: 1, csvFile: 'blueprint-pools.datacore.csv' },
        {
          slug: 'crafting-blueprints',
          label: 'Crafting blueprints',
          rows: 1,
          csvFile: 'crafting-blueprints.datacore.csv',
        },
      ];
    },
    async extractRawFacts() {
      await this.extractRawFactStage('blueprint-pools');
      await this.extractRawFactStage('crafting-blueprints');
      return this.finalizeRawFacts();
    },
    getItemTypeStages() {
      return [];
    },
    async scrapeItemTypeStage() {
      throw new Error('no item type stages expected');
    },
    async finalizeItemTypes() {
      return { results: [], errors: [] };
    },
    async scrapeItemTypes() {
      return this.finalizeItemTypes();
    },
    result() {
      return { exitCode: 0 } as ReturnType<ReturnType<typeof createDataCoreScrapePlan>['result']>;
    },
  });

  const exitCode = await runCacheCommand(['--source', 'datacore'], io, { createDataCoreScrapePlan: createPlan });

  assert.equal(exitCode, 0);
  assert.equal(maxInFlight, 2);
  assert.match(io.stdoutText(), /Blueprint pools - 1\/1/);
  assert.match(io.stdoutText(), /Crafting blueprints - 1\/1/);
});

test('cache command runs independent DataCore item type children concurrently', async () => {
  const io = createFakeIO();
  const typeEntries = [
    { name: 'coolers', csvFile: 'coolers.datacore.csv', typeConfig: {} as never },
    { name: 'powerplants', csvFile: 'powerplants.datacore.csv', typeConfig: {} as never },
  ];
  let inFlight = 0;
  let maxInFlight = 0;

  const createPlan: typeof createDataCoreScrapePlan = (options) => ({
    async prepare() {
      const prepared = {
        gameVersion: '1.2.3.4',
        channel: 'live' as const,
        dcbPath: 'Game2.dcb',
        outputBase: 'csv/datacore/1.2.3-live.4',
        xmlCacheDir: 'csv/datacore/.xmlcache/1.2.3-live.4',
        selectedTypes: typeEntries,
        allTypes: typeEntries,
        dryRun: false,
      };
      options.onPrepared?.(prepared);
      return prepared;
    },
    async ensureXmlCache() {
      return { xmlFileCount: 12, reused: true };
    },
    async prepareRecordGraph() {
      return { recordCount: 34, outputPath: 'record-graph.json', cached: true };
    },
    getRawFactStages() {
      return [];
    },
    async extractRawFactStage() {
      return null;
    },
    async finalizeRawFacts() {
      return [];
    },
    async extractRawFacts() {
      return this.finalizeRawFacts();
    },
    getItemTypeStages() {
      return typeEntries.map((entry) => ({ id: entry.name, title: entry.name }));
    },
    async scrapeItemTypeStage(typeName) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { result: { type: typeName, rows: 1, skipped: 0, csvFile: `${typeName}.datacore.csv` } };
    },
    async finalizeItemTypes() {
      return {
        results: typeEntries.map((entry) => ({
          type: entry.name,
          rows: 1,
          skipped: 0,
          csvFile: entry.csvFile,
        })),
        errors: [],
      };
    },
    async scrapeItemTypes() {
      for (const entry of typeEntries) await this.scrapeItemTypeStage(entry.name);
      return this.finalizeItemTypes();
    },
    result() {
      return { exitCode: 0 } as ReturnType<ReturnType<typeof createDataCoreScrapePlan>['result']>;
    },
  });

  const exitCode = await runCacheCommand(['--source', 'datacore'], io, { createDataCoreScrapePlan: createPlan });

  assert.equal(exitCode, 0);
  assert.equal(maxInFlight, 2);
  assert.match(io.stdoutText(), /Scrape item type CSVs - 2 types across 1 group/);
  assert.match(io.stdoutText(), /Ship systems - 2 types/);
  assert.match(io.stdoutText(), /coolers/);
  assert.match(io.stdoutText(), /powerplants/);
});

test('cache command renders SCMDB plan stages and parallel fetch children as real nested Listr tasks', async () => {
  const io = createFakeIO();
  const calls: string[] = [];
  const selected = { version: '4.8.1-live.test', file: 'merged-4.8.1-live.test.json' };

  const createPlan: typeof createScmdbScrapePlan = () => ({
    async selectVersion() {
      calls.push('select');
      return selected;
    },
    async prepareOutputDirs() {
      calls.push('dirs');
      return { outDir: 'csv/scmdb/4.8.1-live.test', missionsOutDir: 'csv/scmdb/4.8.1-live.test/missions' };
    },
    async fetchMergedDataset() {
      calls.push('merged');
      return {};
    },
    async fetchMiningDataset() {
      calls.push('mining');
      return {};
    },
    async fetchCraftingItemsDataset() {
      calls.push('crafting-items');
      return null;
    },
    async fetchCraftingBlueprintsDataset() {
      calls.push('crafting-blueprints');
      return {};
    },
    async fetchMemaDataset() {
      calls.push('mema');
      return null;
    },
    async fetchRawDatasets() {
      calls.push('fetch-all');
      return {
        mergedRaw: {},
        miningRaw: {},
        craftingItemsRaw: null,
        craftingBlueprintsRaw: {},
        memaRaw: null,
      };
    },
    async writeRawDatasets() {
      calls.push('write-raw');
      return [];
    },
    async writeDerivedOutputs() {
      calls.push('write-csv');
      return [];
    },
    result() {
      calls.push('result');
      return {
        selected,
        outDir: 'csv/scmdb/4.8.1-live.test',
        missionsOutDir: 'csv/scmdb/4.8.1-live.test/missions',
        files: [],
      };
    },
  });

  const exitCode = await runCacheCommand(['--source', 'scmdb'], io, { createScmdbScrapePlan: createPlan });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    'select',
    'dirs',
    'merged',
    'mining',
    'crafting-items',
    'crafting-blueprints',
    'mema',
    'write-raw',
    'write-csv',
    'result',
  ]);
  assert.match(io.stdoutText(), /Select SCMDB version/);
  assert.match(io.stdoutText(), /Fetch SCMDB raw datasets/);
  assert.match(io.stdoutText(), /Fetch merged game data/);
  assert.match(io.stdoutText(), /Fetch crafting blueprints/);
  assert.match(io.stdoutText(), /Write SCMDB derived CSV files/);
});

test('cache command treats npm rebuild-cache config as force fallback', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];
  const original = process.env.npm_config_rebuild_cache;
  process.env.npm_config_rebuild_cache = 'true';

  try {
    const exitCode = await runCacheCommand(['--source', 'datacore'], io, {
      refreshSourceCache: async (options) => {
        observed.push(options);
        return { exitCode: 0, refreshed: ['datacore'] };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal((observed[0] as { force: boolean }).force, true);
  } finally {
    if (original === undefined) {
      delete process.env.npm_config_rebuild_cache;
    } else {
      process.env.npm_config_rebuild_cache = original;
    }
  }
});

test('cache command rejects npm force flag name', async () => {
  const io = createFakeIO();
  await assert.rejects(() => runCacheCommand(['--force'], io), /Unknown option '--force'/);
});

test('deploy command resolves the game target and copies repo global.ini', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runDeployCommand(['--ini-path', 'custom-global.ini'], io, {
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    deployGlobalIni: async (options) => {
      observed.push(options);
      return options;
    },
  });

  assert.equal(exitCode, 0);
  assert.match((observed[0] as { repoIniPath: string }).repoIniPath, /custom-global\.ini$/);
  assert.equal(
    (observed[0] as { targetIniPath: string }).targetIniPath,
    'C:\\Games\\StarCitizen\\LIVE\\Data\\Localization\\english\\global.ini',
  );
  assert.match(io.stdoutText(), /Deployed/);
  assert.equal(io.stderrText(), '');
});
