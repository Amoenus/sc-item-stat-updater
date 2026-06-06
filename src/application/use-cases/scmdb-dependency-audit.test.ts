import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScmdbDependencyAudit, formatScmdbDependencyAudit } from './scmdb-dependency-audit';

test('SCMDB dependency audit classifies mission categories and datacore-active bridges', async () => {
  const audit = await buildScmdbDependencyAudit({ provider: 'datacore' });

  assert.deepEqual(audit.sourceHierarchy, [
    'DataCore/Data.p4k: authoritative source for game-derived raw facts.',
    'SCMDB: temporary bridge for derived/generated mission, blueprint, crafting, and mining aggregations not yet reconstructed from DataCore.',
    'SPViewer: legacy comparison/audit source only.',
  ]);

  const descriptions = audit.entries.find((entry) => entry.slug === 'mission-scmdb-descriptions');
  assert.equal(descriptions?.classification, 'Probably extractable from DataCore with new graph traversal');
  assert.equal(descriptions?.activeForDatacoreProvider, true);
  assert.deepEqual(descriptions?.sourceFiles, ['missions/scmdb-missions.csv']);

  const commodities = audit.entries.find((entry) => entry.slug === 'mission-commodities');
  assert.equal(commodities?.classification, 'Already extractable from DataCore');
  assert.equal(commodities?.sourceFiles.includes('dynamic SCMDB JSON: merged-*.json'), false);
  assert.equal(commodities?.sourceFiles.includes('datacore:commodities.datacore.csv'), true);
  assert.match(commodities?.reason ?? '', /explicit carryable commodity localization keys/);
  assert.match(commodities?.reason ?? '', /first-party harvestable base aliases/);
  assert.match(commodities?.reason ?? '', /first-party hauling entity class labels/);
  assert.match(commodities?.reason ?? '', /no longer reads SCMDB resource pools/);
  assert.match(commodities?.reason ?? '', /LOC_PLACEHOLDER resource-pool entries are ignored/);
  assert.match(commodities?.migrationSlice ?? '', /Retired for commodities/);

  const generatedMining = audit.entries.find((entry) => entry.slug === 'regen-mining-locations');
  assert.equal(generatedMining?.kind, 'generated source step');
  assert.equal(generatedMining?.activeForDatacoreProvider, false);
  assert.match(generatedMining?.reason ?? '', /--refresh-scmdb-mining-locations/);

  const optionalJournal = audit.entries.find((entry) => entry.slug === 'mining-journal' && entry.kind === 'extra step');
  assert.equal(optionalJournal?.classification, 'SCMDB-only derived/generated');
  assert.equal(optionalJournal?.sourceFiles.includes('datacore:mining-elements.datacore.csv'), true);
  assert.equal(optionalJournal?.sourceFiles.includes('fallback:mining-journal.csv'), true);
  assert.equal(optionalJournal?.activeForDatacoreProvider, false);

  const journalCategory = audit.entries.find((entry) => entry.slug === 'mission-mining-journal');
  assert.equal(journalCategory?.classification, 'SCMDB-only derived/generated');
  assert.match(journalCategory?.reason ?? '', /no explicit per-element journal rarity field/);
  assert.match(journalCategory?.reason ?? '', /DataCore journal use is limited to separately rendered insight summaries/);

  const miningElements = audit.entries.find((entry) => entry.slug === 'mission-mining-elements');
  assert.equal(miningElements?.sourceFiles.includes('datacore:mining-rock-signatures.datacore.csv'), true);
  assert.equal(miningElements?.sourceFiles.includes('datacore:mining-quality-quantizations.datacore.csv'), true);
  assert.match(miningElements?.reason ?? '', /rarity from mineable rock variants/);
  assert.match(miningElements?.reason ?? '', /SCMDB cannot create active mining-element target rows/);
  assert.match(miningElements?.reason ?? '', /SCMDB still contributes density, best-refinery bonus joins/);
  assert.match(miningElements?.reason ?? '', /unreconstructed ground scan fallbacks/);
  assert.match(miningElements?.reason ?? '', /refiningprocess records define only global process speed\/quality labels/);
  assert.match(miningElements?.migrationSlice ?? '', /avoid carryable Mass\/SCU/);
  assert.match(miningElements?.migrationSlice ?? '', /ground scan/);
  assert.match(miningElements?.migrationSlice ?? '', /station\/material bonus source is proven/);

  const miningLocations = audit.entries.find((entry) => entry.slug === 'mission-mining-locations');
  assert.equal(miningLocations?.classification, 'Already extractable from DataCore');
  assert.equal(miningLocations?.sourceFiles.includes('mining-locations.csv'), false);
  assert.equal(miningLocations?.sourceFiles.includes('datacore:mining-provider-presets.datacore.csv'), true);

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
    /\| generated source step \| regen-mining-locations \(Regenerate mining-locations\.csv\) \| mining_data\.json, mining_data-\*\.json \| SCMDB-only derived\/generated \| no \|/,
  );
  assert.match(output, /Why SCMDB is still used:/);
});
