import assert from 'node:assert';
import { describe, it } from 'node:test';
import config from './scmdb-descriptions';

const { buildValue } = config;
assert.ok(buildValue, 'buildValue must be defined on the SCMDB mission descriptions config');

describe('SCMDB mission descriptions buildValue', () => {
  it('builds a new description with cooldown, note, blueprint rewards, and item rewards', () => {
    const row = {
      Description: 'Recover the package.',
      Cooldown: '15m',
      Note: 'Bring a ship.',
      RewardList: '[BP Reward]\\n\\nReward one',
      ItemRewardList: 'Item one',
    };

    const result = buildValue(row, '', '', 'mission_description');

    assert.strictEqual(
      result,
      String.raw`Recover the package.\n\nCooldown: 15m\n\nBring a ship.\n\n[BP Reward]\n\nReward one\n\n[Item Reward]\n\nItem one`,
    );
  });

  it('rebuilds metadata from an existing value instead of duplicating old appended metadata', () => {
    const row = {
      Description: 'unused when old value exists',
      Cooldown: '30m',
      Note: 'Updated note.',
      RewardList: '[BP Chain]\\n\\nUpdated chain',
    };
    const oldValue = String.raw`Existing localized text.\n\nCooldown: 10m\n\n[BP Reward]\n\nOld reward`;

    const result = buildValue(row, '', oldValue, 'mission_description');

    assert.strictEqual(
      result,
      String.raw`Existing localized text.\n\nCooldown: 30m\n\nUpdated note.\n\n[BP Chain]\n\nUpdated chain`,
    );
  });

  it('does not append a blueprint reward list already embedded in the note text', () => {
    const embeddedRewardList = String.raw`[BP Reward]\n\nReward one`;
    const row = {
      Description: 'Recover the package.',
      Note: `Reward summary:${embeddedRewardList}`,
      RewardList: embeddedRewardList,
    };

    const result = buildValue(row, '', '', 'mission_description');

    assert.strictEqual(result, String.raw`Recover the package.\n\nReward summary:[BP Reward]\n\nReward one`);
  });

  it('returns the normalized old value unchanged when no metadata is available', () => {
    const oldValue = String.raw`Existing localized text.\n\n[Item Reward]\n\nOld item`;

    const result = buildValue({}, '', oldValue, 'mission_description');

    assert.strictEqual(result, 'Existing localized text.');
  });
});
