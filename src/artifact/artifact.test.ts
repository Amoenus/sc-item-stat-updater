import assert from 'node:assert';
import { describe, it } from 'node:test';
import { artifactToPatchPlan, patchPlanToArtifactEntries } from './artifact';
import type { Artifact } from './artifact';
import type { PatchPlan } from '../pipeline/types';

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
});
