import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScmdbDependencyAudit, formatScmdbDependencyAudit } from './scmdb-dependency-audit';

test('SCMDB dependency audit classifies mission categories and datacore-active bridges', async () => {
  const audit = await buildScmdbDependencyAudit({ provider: 'datacore' });

  assert.deepEqual(audit.sourceHierarchy, [
    'DataCore/Data.p4k: authoritative source for game-derived raw facts.',
    'SCMDB: temporary bridge for derived/generated mission, blueprint, crafting, and mining aggregations not yet reconstructed from DataCore.',
    'SPViewer: legacy fallback/comparison provider only.',
  ]);

  const descriptions = audit.entries.find((entry) => entry.slug === 'mission-scmdb-descriptions');
  assert.equal(descriptions?.classification, 'Probably extractable from DataCore with new graph traversal');
  assert.equal(descriptions?.activeForDatacoreProvider, true);
  assert.deepEqual(descriptions?.sourceFiles, ['missions/scmdb-missions.csv']);

  const commodities = audit.entries.find((entry) => entry.slug === 'mission-commodities');
  assert.equal(commodities?.classification, 'Already extractable from DataCore');
  assert.equal(commodities?.sourceFiles.includes('dynamic SCMDB JSON: merged-*.json'), true);
  assert.equal(commodities?.sourceFiles.includes('datacore:commodities.datacore.csv'), true);

  const generatedMining = audit.entries.find((entry) => entry.slug === 'regen-mining-locations');
  assert.equal(generatedMining?.kind, 'generated source step');
  assert.equal(generatedMining?.activeForDatacoreProvider, true);

  const optionalJournal = audit.entries.find((entry) => entry.slug === 'mining-journal' && entry.kind === 'extra step');
  assert.equal(optionalJournal?.classification, 'SCMDB-only derived/generated');
  assert.equal(optionalJournal?.sourceFiles.includes('datacore:mining-elements.datacore.csv'), true);
  assert.equal(optionalJournal?.sourceFiles.includes('fallback:mining-journal.csv'), true);
  assert.equal(optionalJournal?.activeForDatacoreProvider, false);

  const journalCategory = audit.entries.find((entry) => entry.slug === 'mission-mining-journal');
  assert.equal(journalCategory?.classification, 'SCMDB-only derived/generated');
  assert.match(journalCategory?.reason ?? '', /no explicit per-element journal rarity field/);

  assert.deepEqual(
    audit.entries.filter((entry) => entry.classification === 'Unknown, needs investigation').map((entry) => entry.slug),
    [],
  );
});

test('formatted SCMDB dependency audit shows source hierarchy and migration slices', async () => {
  const output = formatScmdbDependencyAudit(await buildScmdbDependencyAudit({ provider: 'datacore' }));

  assert.match(output, /SCMDB dependency audit/);
  assert.match(output, /DataCore\/Data\.p4k: authoritative source/);
  assert.match(
    output,
    /\| update category \| mission-scmdb-descriptions \(SCMDB mission descriptions\) \| missions\/scmdb-missions\.csv \| Probably extractable from DataCore with new graph traversal \| yes \|/,
  );
  assert.match(
    output,
    /\| generated source step \| regen-mining-locations \(Regenerate mining-locations\.csv\) \| mining_data\.json, mining_data-\*\.json \| SCMDB-only derived\/generated \| yes \|/,
  );
  assert.match(output, /Why SCMDB is still used:/);
});
