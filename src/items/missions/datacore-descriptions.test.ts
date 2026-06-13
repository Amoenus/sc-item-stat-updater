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

  await fs.writeFile(
    path.join(dir, 'global.ini'),
    [
      'item_Name_Test_Target=[S1|PST|ENG] Test Blueprint Item',
      'item_Name_Test_Repeat_A=Repeat Blueprint A',
      'item_Name_Test_Repeat_B=Repeat Blueprint B',
      'item_Name_Test_Repeat_C=Repeat Powerplant',
      'RepScope_Contractor_Rank3=Sr. Contractor',
      'RepScope_Contractor_Rank4=Veteran Contractor',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'contract-generators.datacore.csv'),
    [
      'Contract ID,Contract Debug Name,Handler Debug Name,Template GUID,Description Key,Description Variant Keys,Blueprint Reward Pool Guids,Blueprint Rewards,Min Standing Name Key,Min Standing GUID,Required Completed Contract Tags',
      'contract-1,RewardVariant,,template-ref,test_desc,test_desc_variant,,"[{""blueprintPool"":""pool-ref"",""chance"":0.25,""trigger"":""MissionSuccess"",""type"":""BlueprintRewards""}]",RepScope_Contractor_Rank3,standing-rank-4,',
      'contract-2,NoRewardVariant,,template-ref,shared_desc,,,,,,',
      'contract-3,StantonRewardVariant,,template-ref,shared_desc,,pool-ref,,RepScope_Contractor_Rank3,standing-rank-4,',
      'contract-4,FacilityFollowup,FacilityHandler,template-repeat-ref,LOC_PLACEHOLDER,LOC_UNINITIALIZED,"repeat-pool-1,repeat-pool-2",,,,completed-contract-tag',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'contract-templates.datacore.csv'),
    ['Template Class,Record GUID,Record Path', 'RepeatTemplate,template-repeat-ref,templates/repeat-template.xml'].join(
      '\n',
    ),
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
    [
      'PoolClass,BlueprintGuids,Ref,Path',
      'Pool,"[{""guid"":""blueprint-ref"",""weight"":1}]",pool-ref,pool.xml',
      'RepeatPool1,"[{""guid"":""repeat-blueprint-a"",""weight"":1},{""guid"":""repeat-blueprint-b"",""weight"":1}]",repeat-pool-1,repeat-pool-1.xml',
      'RepeatPool2,"[{""guid"":""repeat-blueprint-c"",""weight"":1}]",repeat-pool-2,repeat-pool-2.xml',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'crafting-blueprints.datacore.csv'),
    [
      'BlueprintClass,TargetEntityClassGuid,TargetEntityClass,TargetItemNameKey,RecipeCosts,Ref,Path',
      'Blueprint,,target-ref,item_Name_Test_Repeat_A,"[]",blueprint-ref,blueprint.xml',
      'RepeatBlueprintA,,,item_Name_Test_Repeat_A,"[]",repeat-blueprint-a,repeat-a.xml',
      'RepeatBlueprintB,,,item_Name_Test_Repeat_B,"[]",repeat-blueprint-b,repeat-b.xml',
      'RepeatBlueprintC,powerplant-ref,,,"[]",repeat-blueprint-c,repeat-c.xml',
    ].join('\n'),
    'utf8',
  );
  const xmlCacheDir = path.join(dir, 'csv', 'datacore', '.xmlcache', '4.8.test-live');
  await fs.mkdir(path.join(xmlCacheDir, 'templates'), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, 'templates', 'repeat-template.xml'),
    [
      '<ContractTemplate.RepeatTemplate __type="ContractTemplate" __ref="template-repeat-ref" __path="templates/repeat-template.xml">',
      '  <contractDisplayInfo>',
      '    <ContractDisplayInfo>',
      '      <displayString>',
      '        <LocID value="@repeat_title" />',
      '        <LocID value="@repeat_desc" />',
      '      </displayString>',
      '    </ContractDisplayInfo>',
      '  </contractDisplayInfo>',
      '</ContractTemplate.RepeatTemplate>',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'record-graph.json'),
    JSON.stringify({
      source: 'datacore-record-graph',
      recordCount: 3,
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
        {
          path: 'libs/foundry/records/entities/scitem/ships/powerplant/test_powerplant.xml',
          ref: 'powerplant-ref',
          rootTag: 'EntityClassDefinition.Test_Powerplant',
          rootType: 'EntityClassDefinition',
          entityClass: 'Test_Powerplant',
          localizationKeys: [{ attribute: 'Name', key: 'item_Name_Test_Repeat_C' }],
          referencedGuids: [],
        },
        {
          path: 'reputation/contractor-rank-4.xml',
          ref: 'standing-rank-4',
          rootTag: 'ReputationScope.Contractor_Rank4',
          rootType: 'ReputationScope',
          entityClass: 'Contractor_Rank4',
          localizationKeys: [{ attribute: 'displayName', key: 'RepScope_Contractor_Rank4' }],
          referencedGuids: [],
        },
      ],
      indexes: {
        byRef: {
          'target-ref': 'target.xml',
          'powerplant-ref': 'libs/foundry/records/entities/scitem/ships/powerplant/test_powerplant.xml',
          'standing-rank-4': 'reputation/contractor-rank-4.xml',
        },
        byPath: {
          'target.xml': 0,
          'libs/foundry/records/entities/scitem/ships/powerplant/test_powerplant.xml': 1,
          'reputation/contractor-rank-4.xml': 2,
        },
        byRootType: {
          EntityClassDefinition: ['target.xml', 'libs/foundry/records/entities/scitem/ships/powerplant/test_powerplant.xml'],
          ReputationScope: ['reputation/contractor-rank-4.xml'],
        },
        byEntityClass: {
          Test_Target: ['target.xml'],
          Test_Powerplant: ['libs/foundry/records/entities/scitem/ships/powerplant/test_powerplant.xml'],
          Contractor_Rank4: ['reputation/contractor-rank-4.xml'],
        },
        byLocalizationKey: {
          item_Name_Test_Target: ['target.xml'],
          item_Name_Test_Repeat_C: ['libs/foundry/records/entities/scitem/ships/powerplant/test_powerplant.xml'],
          RepScope_Contractor_Rank4: ['reputation/contractor-rank-4.xml'],
        },
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

      assert.equal(
        row?.RewardList,
        String.raw`<EM4>Potential Blueprints</EM4>\n<EM4>Awarded from Veteran Contractor level variants</EM4>\n- Test Blueprint Item (100%)`,
      );
      assert.equal(row?.ContractIntel, String.raw`Time Limit: 12 min\nReputation Awarded: 100`);
      assert.equal(
        missionDescriptionValue(row ?? {}, 'Base description.'),
        String.raw`Base description.\n\n<EM4>Reputation Awarded:</EM4> 100\n\n** Contract Intel **\nTime Limit: 12 min\n\n<EM4>Potential Blueprints</EM4>\n<EM4>Awarded from Veteran Contractor level variants</EM4>\n- Test Blueprint Item (100%)`,
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
      assert.equal(
        variantRow?.RewardList,
        String.raw`<EM4>Potential Blueprints</EM4>\n<EM4>Awarded from Veteran Contractor level variants</EM4>\n- Test Blueprint Item (100%)`,
      );

      const sharedRow = rows.find((candidate) => candidate['Localization Key'] === 'shared_desc');
      assert.equal(
        sharedRow?.RewardList,
        String.raw`<EM4>Potential Blueprints</EM4>\n<EM4>Awarded from Veteran Contractor level variants</EM4>\n<EM4>Applies only to variants containing: StantonRewardVariant</EM4>\n- Test Blueprint Item (100%)`,
      );

      const repeatRow = rows.find((candidate) => candidate['Localization Key'] === 'repeat_desc');
      assert.equal(
        repeatRow?.RewardList,
        String.raw`<EM4>Multiple Blueprint Pools (Repeat Only)</EM4>\n<EM4>Pool 1</EM4>\n- Repeat Blueprint A\n- Repeat Blueprint B\n\n<EM4>Pool 2</EM4>\n- Repeat Powerplant (Powerplant)`,
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
