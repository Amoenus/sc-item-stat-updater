import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScmdbDependencyAudit, formatScmdbDependencyAudit } from './scmdb-dependency-audit';

test('SCMDB dependency audit classifies mission categories and datacore-active bridges', async () => {
  const audit = await buildScmdbDependencyAudit({ provider: 'datacore' });

  assert.deepEqual(audit.sourceHierarchy, [
    'DataCore/Data.p4k: authoritative source for game-derived raw facts.',
    'SCMDB: temporary bridge for derived/generated mission, blueprint, crafting, and mining aggregations not yet reconstructed from DataCore.',
    'SPViewer: retired from active pipeline/cache/update support.',
  ]);

  const descriptions = audit.entries.find((entry) => entry.slug === 'mission-datacore-descriptions');
  assert.equal(descriptions?.classification, 'Already extractable from DataCore');
  assert.equal(descriptions?.activeForDatacoreProvider, true);
  assert.deepEqual(descriptions?.sourceFiles, [
    'datacore:contract-generator-intel.datacore.csv',
    'datacore:mission-contract-intel.datacore.csv',
    'optional:datacore:contract-hauling-summary.datacore.csv',
    'datacore:contract-generators.datacore.csv',
    'optional:datacore:contract-templates.datacore.csv',
    'datacore:blueprint-pools.datacore.csv',
    'datacore:crafting-blueprints.datacore.csv',
  ]);

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

  assert.equal(
    audit.entries.some((entry) => entry.slug === 'regen-mining-locations'),
    false,
  );

  const optionalJournal = audit.entries.find((entry) => entry.slug === 'mining-journal' && entry.kind === 'extra step');
  assert.equal(optionalJournal?.classification, 'SCMDB-only derived/generated');
  assert.equal(optionalJournal?.sourceFiles.includes('datacore:mining-elements.datacore.csv'), true);
  assert.equal(optionalJournal?.sourceFiles.includes('fallback:mining-journal.csv'), true);
  assert.equal(optionalJournal?.activeForDatacoreProvider, false);

  assert.equal(
    audit.entries.some((entry) => entry.slug === 'mission-mining-journal'),
    false,
  );

  const miningElements = audit.entries.find((entry) => entry.slug === 'mission-mining-elements');
  assert.equal(miningElements?.sourceFiles.includes('optional:mining-elements.csv'), true);
  assert.equal(miningElements?.sourceFiles.includes('datacore:mining-rock-signatures.datacore.csv'), true);
  assert.equal(miningElements?.sourceFiles.includes('datacore:mining-quality-quantizations.datacore.csv'), true);
  assert.match(miningElements?.reason ?? '', /rarity from mineable rock variants/);
  assert.match(miningElements?.reason ?? '', /SCMDB cannot create active mining-element target rows/);
  assert.match(
    miningElements?.reason ?? '',
    /no longer backfills mining behavior, rarity, density, scan signatures, or quality bands/,
  );
  assert.match(
    miningElements?.reason ?? '',
    /Optional SCMDB rows can still contribute derived best-refinery bonus joins/,
  );
  assert.match(
    miningElements?.reason ?? '',
    /refiningprocess records define only global process speed\/quality labels/,
  );
  assert.match(
    miningElements?.migrationSlice ?? '',
    /Density is intentionally omitted until a DataCore source is proven/,
  );
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
    /\| update category \| mission-datacore-descriptions \(DataCore mission descriptions\) \| datacore:contract-generator-intel\.datacore\.csv, datacore:mission-contract-intel\.datacore\.csv, optional:datacore:contract-hauling-summary\.datacore\.csv, datacore:contract-generators\.datacore\.csv, optional:datacore:contract-templates\.datacore\.csv, datacore:blueprint-pools\.datacore\.csv, datacore:crafting-blueprints\.datacore\.csv \| Already extractable from DataCore \| yes \|/,
  );
  assert.doesNotMatch(output, /regen-mining-locations/);
  assert.match(output, /Why SCMDB is still used:/);
});
