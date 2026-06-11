import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDynamicCoverageAudit, formatDynamicCoverageAudit } from './dynamic-coverage-audit';

test('dynamic coverage audit identifies DataCore mission grouping and enhancement-only source use', async () => {
  const audit = await buildDynamicCoverageAudit();

  assert.match(audit.goal, /DataCore graph-derived facts/);

  const descriptions = audit.entries.find((entry) => entry.slug === 'mission-datacore-descriptions');
  assert.equal(descriptions?.provider, 'datacore');
  assert.equal(descriptions?.status, 'dynamic');
  assert.equal(descriptions?.sourceFiles.includes('datacore:contract-generators.datacore.csv'), true);
  assert.equal(descriptions?.sourceFiles.includes('datacore:blueprint-pools.datacore.csv'), true);
  assert.match(descriptions?.dynamicSignals.join('\n') ?? '', /custom source loader/);
  assert.match(descriptions?.dynamicSignals.join('\n') ?? '', /aggregates multiple source rows per localization key/);
  assert.match(descriptions?.dynamicSignals.join('\n') ?? '', /handles shared description variant keys/);
  assert.match(descriptions?.dynamicSignals.join('\n') ?? '', /degrades safely/);
  assert.equal(
    descriptions?.sourceGapSignals.some((signal) => /SCMDB bridge/.test(signal)),
    false,
  );

  const commodities = audit.entries.find((entry) => entry.slug === 'mission-commodities');
  assert.equal(commodities?.provider, 'datacore');
  assert.equal(commodities?.status, 'dynamic');
  assert.equal(commodities?.reviewSignals.length, 0);
});

test('dynamic coverage audit keeps any remaining SCMDB categories visible as source gaps', async () => {
  const audit = await buildDynamicCoverageAudit();

  const scmdbEntries = audit.entries.filter((entry) => entry.provider === 'scmdb');
  assert.equal(
    scmdbEntries.every((entry) => entry.status === 'known-source-gap'),
    true,
  );
  assert.equal(
    scmdbEntries.every((entry) => entry.sourceGapSignals.some((signal) => /SCMDB bridge/.test(signal))),
    true,
  );
});

test('formatted dynamic coverage audit includes status summary', async () => {
  const output = formatDynamicCoverageAudit(await buildDynamicCoverageAudit());

  assert.match(output, /Dynamic coverage audit/);
  assert.match(output, /\| Category \| Provider \| Status \| Sources \| Dynamic signals \| Review\/source-gap signals \|/);
  assert.match(output, /mission-datacore-descriptions \(DataCore mission descriptions\)/);
  assert.match(output, /Summary: \d+ dynamic, \d+ need review, \d+ known source gaps\./);
});
