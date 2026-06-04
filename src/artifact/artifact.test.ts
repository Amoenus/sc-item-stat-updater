import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { artifactToPatchPlan, generateArtifact, patchPlanToArtifactEntries } from './artifact';
import type { Artifact } from './artifact';
import type { PatchPlan } from '../pipeline/types';
import type { ItemConfig } from '../lib/types';

describe('artifact patch-plan conversion', () => {
  it('serializes patch-plan entries to the artifact entries map without application-only metadata', () => {
    const plan: PatchPlan = {
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

  it('rehydrates artifact entries as patch-plan entries with artifact defaults', () => {
    const artifact: Artifact = {
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
      issues: [{ label: 'test', key: 'missing_desc', reason: 'missing', type: 'missing' }],
    };

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
        spviewerVersion: 'spviewer-test',
      });

      assert.deepStrictEqual(artifact.entries, {
        item_desc: 'stat: new',
      });
      assert.strictEqual(artifact.stats.categoryCount, 1);
      assert.strictEqual(artifact.stats.totalEntries, 1);
      assert.strictEqual(artifact.stats.totalSkipped, 0);
      assert.strictEqual(artifact.stats.totalErrors, 0);
      assert.strictEqual(JSON.stringify(artifact).includes('existingLineIndex'), false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
