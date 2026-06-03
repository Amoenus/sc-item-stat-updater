import assert from 'node:assert';
import { describe, it } from 'node:test';
import config from './scmdb-descriptions';

const { buildValue, getTargetKeys } = config;
assert.ok(buildValue, 'buildValue must be defined on the SCMDB mission descriptions config');
assert.ok(getTargetKeys, 'getTargetKeys must be defined on the SCMDB mission descriptions config');

describe('SCMDB mission descriptions buildValue', () => {
  it('targets only description localization keys', () => {
    assert.deepStrictEqual(getTargetKeys({ 'Localization Key': 'mission_desc' }), ['mission_desc']);
    assert.deepStrictEqual(getTargetKeys({ 'Localization Key': 'mission_title' }), []);
  });

  it('builds a new description with cooldown, note, blueprint rewards, and item rewards', () => {
    const row = {
      Description: 'Recover the package.',
      Cooldown: '15m',
      Note: 'Bring a ship.',
      RewardList: String.raw`[BP Reward]\n\nReward one`,
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
      ContractIntel: String.raw`Reward: 10,000 aUEC\nTime Limit: 10 min`,
      Cooldown: '30m',
      Note: 'Updated note.',
      RewardList: String.raw`[BP Chain]\n\nUpdated chain`,
    };
    const oldValue = String.raw`Existing localized text.\n\n** Contract Intel **\nReward: 5,000 aUEC\n\nCooldown: 10m\n\n[BP Reward]\n\nOld reward`;

    const result = buildValue(row, '', oldValue, 'mission_description');

    assert.strictEqual(
      result,
      String.raw`Existing localized text.\n\n** Contract Intel **\nReward: 10,000 aUEC\nTime Limit: 10 min\n\nCooldown: 30m\n\nUpdated note.\n\n[BP Chain]\n\nUpdated chain`,
    );
  });

  it('preserves runtime mission tags in the base description', () => {
    const row = {
      Description: 'Deliver to ~mission(Location|Address) for ~mission(reward).',
      ContractIntel: 'Time Limit: 10 min',
    };

    const result = buildValue(row, '', '', 'mission_description');

    assert.strictEqual(
      result,
      String.raw`Deliver to ~mission(Location|Address) for ~mission(reward).\n\n** Contract Intel **\nTime Limit: 10 min`,
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
