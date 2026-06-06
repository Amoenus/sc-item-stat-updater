import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { artifactToPatchPlan, generateArtifact, patchPlanToArtifactEntries, readArtifactFile } from './artifact';
import type { Artifact } from './artifact';
import type { LocalizationPatchPlan } from '../localization/patch-application';
import type { ItemConfig } from '../enrichment/item-config';

async function writeArtifactFixture(body: unknown): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-artifact-read-'));
  const artifactPath = path.join(tempDir, 'patch-data.json');
  await fs.writeFile(artifactPath, typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return artifactPath;
}

function validArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    generatedAt: '2026-06-04T00:00:00.000Z',
    scmdbVersion: null,
    spviewerVersion: null,
    entries: {
      item_desc: 'updated',
    },
    stats: {
      categoryCount: 1,
      totalEntries: 1,
      totalSkipped: 0,
      totalErrors: 0,
    },
    issues: [],
    ...overrides,
  };
}

describe('artifact patch-plan conversion', () => {
  it('serializes patch-plan entries to the artifact entries map without application-only metadata', () => {
    const plan: LocalizationPatchPlan = {
      entries: [
        {
          key: 'item_desc',
          value: 'updated',
          source: 'test',
          reason: 'unit test',
          existingLineIndex: 12,
        },
      ],
      issues: [],
    };

    assert.deepStrictEqual(patchPlanToArtifactEntries(plan), {
      item_desc: 'updated',
    });
  });

  it('serializes duplicate occurrence patch plans without line-index metadata', () => {
    const plan: LocalizationPatchPlan = {
      entries: [
        {
          key: 'item_desc',
          value: 'updated base',
          source: 'test',
          reason: 'unit test',
          existingLineIndex: 0,
        },
        {
          key: 'item_desc',
          value: 'updated duplicate',
          source: 'test',
          reason: 'unit test',
          existingLineIndex: 3,
        },
      ],
      issues: [],
    };

    const entries = patchPlanToArtifactEntries(plan);

    assert.deepStrictEqual(entries, {
      item_desc: 'updated duplicate',
    });
    assert.strictEqual(JSON.stringify(entries).includes('existingLineIndex'), false);
  });

  it('rehydrates artifact entries as patch-plan entries with artifact defaults', () => {
    const artifact: Artifact = validArtifact({
      issues: [{ label: 'test', key: 'missing_desc', reason: 'missing', type: 'missing' }],
    });

    assert.deepStrictEqual(artifactToPatchPlan(artifact), {
      entries: [
        {
          key: 'item_desc',
          value: 'updated',
          source: 'artifact',
          reason: 'Serialized patch artifact entry',
        },
      ],
      issues: artifact.issues,
    });
  });

  it('generates artifacts from patch plans instead of serialized application metadata', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-artifact-'));
    try {
      const iniPath = path.join(tempDir, 'global.ini');
      const csvDir = path.join(tempDir, 'csv');
      await fs.mkdir(csvDir);
      await fs.writeFile(iniPath, 'item_name=Item\nitem_desc=old', 'utf8');
      await fs.writeFile(path.join(csvDir, 'items.csv'), 'Localization Key,Stat\nitem_name,new', 'utf8');

      const config: ItemConfig = {
        label: 'test-items',
        csvFile: 'items.csv',
        requiredColumns: ['Localization Key', 'Stat'],
        descKeyMatch: (key) => key.endsWith('_desc'),
        buildValue: (row) => `stat: ${row.Stat}`,
      };

      const artifact = await generateArtifact([{ config, csvDir }], {
        iniPath,
        scmdbVersion: 'scmdb-test',
      });

      assert.deepStrictEqual(artifact.entries, {
        item_desc: 'stat: new',
      });
      assert.strictEqual(artifact.stats.categoryCount, 1);
      assert.strictEqual(artifact.stats.totalEntries, 1);
      assert.strictEqual(artifact.stats.totalSkipped, 0);
      assert.strictEqual(artifact.stats.totalErrors, 0);
      assert.strictEqual(artifact.spviewerVersion, null);
      assert.strictEqual(JSON.stringify(artifact).includes('existingLineIndex'), false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reads a valid artifact without changing the artifact contract', async () => {
    const artifactPath = await writeArtifactFixture(validArtifact());
    try {
      assert.deepStrictEqual(await readArtifactFile(artifactPath), validArtifact());
    } finally {
      await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
    }
  });

  it('reports malformed JSON with the file path and JSON field context', async () => {
    const artifactPath = await writeArtifactFixture('{"entries": ');
    try {
      await assert.rejects(readArtifactFile(artifactPath), (err: Error) => {
        assert.match(err.message, /Artifact file is not valid JSON/);
        assert.match(err.message, new RegExp(artifactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(err.message, /Field: JSON/);
        assert.match(err.message, /Problem:/);
        return true;
      });
    } finally {
      await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
    }
  });

  it('reports missing entries with concise high-level field context', async () => {
    const { entries: _entries, ...artifactWithoutEntries } = validArtifact();
    const artifactPath = await writeArtifactFixture(artifactWithoutEntries);
    try {
      await assert.rejects(readArtifactFile(artifactPath), (err: Error) => {
        assert.match(err.message, /Artifact file is invalid/);
        assert.match(err.message, new RegExp(artifactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(err.message, /Field: entries/);
        assert.match(err.message, /Detail: entries:/);
        return true;
      });
    } finally {
      await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
    }
  });

  it('reports invalid entries payloads with entries field context', async () => {
    const artifactPath = await writeArtifactFixture(validArtifact({ entries: { item_desc: 42 } as never }));
    try {
      await assert.rejects(readArtifactFile(artifactPath), (err: Error) => {
        assert.match(err.message, /Field: entries/);
        assert.match(err.message, /Detail: entries\.item_desc:/);
        return true;
      });
    } finally {
      await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
    }
  });

  it('reports invalid issue payloads with issues field context', async () => {
    const artifactPath = await writeArtifactFixture(
      validArtifact({
        issues: [{ label: 'test', key: 'missing_desc', type: 'missing' } as never],
      }),
    );
    try {
      await assert.rejects(readArtifactFile(artifactPath), (err: Error) => {
        assert.match(err.message, /Field: issues/);
        assert.match(err.message, /Detail: issues\.0\.reason:/);
        return true;
      });
    } finally {
      await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
    }
  });
});
