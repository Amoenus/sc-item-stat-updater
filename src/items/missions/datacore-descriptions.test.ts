import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import missionDescriptionsConfig, { loadDatacoreDescriptionsSourceData } from './datacore-descriptions';

async function makeWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mission-descriptions-'));
  const datacoreDir = path.join(dir, 'csv', 'datacore', '4.8.test-live');
  await fs.mkdir(datacoreDir, { recursive: true });

  await fs.writeFile(path.join(dir, 'global.ini'), 'item_Name_Test_Target=[S1|PST|ENG] Test Blueprint Item', 'utf8');
  await fs.writeFile(
    path.join(datacoreDir, 'contract-generators.datacore.csv'),
    [
      'Contract ID,Contract Debug Name,Description Key,Description Variant Keys,Blueprint Reward Pool Guids',
      'contract-1,RewardVariant,test_desc,test_desc_variant,pool-ref',
      'contract-2,NoRewardVariant,shared_desc,,',
      'contract-3,StantonRewardVariant,shared_desc,,pool-ref',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'contract-generator-intel.datacore.csv'),
    ['Description Key,Contract Intel', '"test_desc","Time Limit: 12 min\\nReputation Awarded: 100"'].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'mission-contract-intel.datacore.csv'),
    [
      'Description Key,Contract Intel',
      '"broker_desc","Reward: 12,000 aUEC\\nTime Limit: 18 min"',
      '"broker_reward_only_desc","Reward: 9,000 aUEC"',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'blueprint-pools.datacore.csv'),
    ['PoolClass,BlueprintGuids,Ref,Path', 'Pool,"[{""guid"":""blueprint-ref"",""weight"":1}]",pool-ref,pool.xml'].join(
      '\n',
    ),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'crafting-blueprints.datacore.csv'),
    [
      'BlueprintClass,TargetEntityClassGuid,TargetEntityClass,TargetItemNameKey,RecipeCosts,Ref,Path',
      'Blueprint,,target-ref,,"[]",blueprint-ref,blueprint.xml',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'record-graph.json'),
    JSON.stringify({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [
        {
          path: 'target.xml',
          ref: 'target-ref',
          rootTag: 'EntityClassDefinition.Test_Target',
          rootType: 'EntityClassDefinition',
          entityClass: 'Test_Target',
          localizationKeys: [{ attribute: 'Name', key: 'item_Name_Test_Target' }],
          referencedGuids: [],
        },
      ],
      indexes: {
        byRef: { 'target-ref': 'target.xml' },
        byPath: { 'target.xml': 0 },
        byRootType: { EntityClassDefinition: ['target.xml'] },
        byEntityClass: { Test_Target: ['target.xml'] },
        byLocalizationKey: { item_Name_Test_Target: ['target.xml'] },
        byReferencedGuid: {},
      },
    }),
    'utf8',
  );

  return { dir, datacoreDir };
}

describe('loadDatacoreDescriptionsSourceData', () => {
  it('resolves blueprint reward names through DataCore target refs and global.ini', async () => {
    const { dir, datacoreDir } = await makeWorkspace();
    try {
      const rows = await loadDatacoreDescriptionsSourceData({ sourceDirs: { datacore: datacoreDir } } as never);
      const row = rows.find((candidate) => candidate['Localization Key'] === 'test_desc');

      assert.equal(row?.RewardList, String.raw`<EM4>Potential Blueprints</EM4>\n- Test Blueprint Item (100%)`);
      assert.equal(row?.ContractIntel, String.raw`Time Limit: 12 min\nReputation Awarded: 100`);
      assert.equal(
        missionDescriptionValue(row ?? {}, 'Base description.'),
        String.raw`Base description.\n\n<EM4>Reputation Awarded:</EM4> 100\n\n** Contract Intel **\nTime Limit: 12 min\n\n<EM4>Potential Blueprints</EM4>\n- Test Blueprint Item (100%)`,
      );

      const brokerRow = rows.find((candidate) => candidate['Localization Key'] === 'broker_desc');
      assert.equal(brokerRow?.ContractIntel, String.raw`Reward: 12,000 aUEC\nTime Limit: 18 min`);
      assert.equal(
        missionDescriptionValue(brokerRow ?? {}, 'Broker description.'),
        String.raw`Broker description.\n\n** Contract Intel **\nTime Limit: 18 min`,
      );

      const rewardOnlyBrokerRow = rows.find((candidate) => candidate['Localization Key'] === 'broker_reward_only_desc');
      assert.equal(missionDescriptionValue(rewardOnlyBrokerRow ?? {}, 'Reward-only broker.'), 'Reward-only broker.');

      assert.equal(
        missionDescriptionValue(
          {
            'Localization Key': 'shared_rep_desc',
            ContractIntel: String.raw`Time Limit: 10 min\nReputation Awarded (by difficulty): 75 / 100`,
          },
          'Shared reputation.',
        ),
        String.raw`Shared reputation.\n\n<EM4>Reputation Awarded (by difficulty):</EM4> 75 / 100\n\n** Contract Intel **\nTime Limit: 10 min`,
      );

      const variantRow = rows.find((candidate) => candidate['Localization Key'] === 'test_desc_variant');
      assert.equal(variantRow?.RewardList, String.raw`<EM4>Potential Blueprints</EM4>\n- Test Blueprint Item (100%)`);

      const sharedRow = rows.find((candidate) => candidate['Localization Key'] === 'shared_desc');
      assert.equal(
        sharedRow?.RewardList,
        String.raw`<EM4>Potential Blueprints</EM4>\n<EM4>Applies only to variants containing: StantonRewardVariant</EM4>\n- Test Blueprint Item (100%)`,
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

function missionDescriptionValue(row: Record<string, string>, oldValue: string): string {
  assert.ok(missionDescriptionsConfig.buildValue);
  return missionDescriptionsConfig.buildValue(row, '', oldValue, row['Localization Key'] ?? '');
}
