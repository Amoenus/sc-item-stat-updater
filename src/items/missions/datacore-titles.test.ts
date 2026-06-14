import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import config, { loadDatacoreTitlesSourceData } from './datacore-titles';

async function makeWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mission-titles-'));
  const datacoreRoot = path.join(dir, 'csv', 'datacore');
  const version = '4.8.test-live';
  const datacoreDir = path.join(datacoreRoot, version);
  const xmlCacheDir = path.join(datacoreRoot, '.xmlcache', version);
  const recordPath = 'libs/foundry/records/contracts/contractgenerator/test.xml';

  await fs.mkdir(datacoreDir, { recursive: true });
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, recordPath)), { recursive: true });

  await fs.writeFile(
    path.join(datacoreDir, 'contract-generators.datacore.csv'),
    [
      [
        'Generator Class',
        'Contract Section',
        'Contract ID',
        'Contract Debug Name',
        'Title Key',
        'Title Variant Keys',
        'Record Path',
      ].join(','),
      ['TestGenerator', 'contracts', 'root-contract', 'RootContract', 'root_title', '', recordPath].join(','),
      [
        'TestGenerator',
        'contracts',
        'reward-contract',
        'RewardContract',
        'reward_title',
        'reward_title_alt',
        recordPath,
      ].join(','),
      [
        'TestGenerator',
        'contracts',
        'mixed-reward-contract',
        'StantonRewardContract',
        'mixed_title',
        '',
        recordPath,
      ].join(','),
      [
        'TestGenerator',
        'contracts',
        'mixed-empty-contract',
        'PyroNoRewardContract',
        'mixed_title',
        '',
        recordPath,
      ].join(','),
      ['TestGenerator', 'introContracts', 'intro-contract', 'IntroContract', 'intro_title', '', recordPath].join(','),
    ].join('\n'),
    'utf8',
  );

  await fs.writeFile(
    path.join(xmlCacheDir, recordPath),
    `
<ContractGenerator.Test>
  <contracts>
    <Contract id="root-contract" debugName="RootContract">
      <contractResults>
        <contractResults>
          <ContractResult_CompletionTags>
            <completionTags>
              <ContractResult_CompletionTag count="1" tag="root-complete" />
            </completionTags>
          </ContractResult_CompletionTags>
        </contractResults>
      </contractResults>
    </Contract>
    <Contract id="reward-contract" debugName="RewardContract">
      <additionalPrerequisites>
        <ContractPrerequisite_CompletedContractTags>
          <requiredCompletedContractTags>
            <tags>
              <Reference value="root-complete" />
            </tags>
          </requiredCompletedContractTags>
        </ContractPrerequisite_CompletedContractTags>
      </additionalPrerequisites>
      <contractResults>
        <contractResults>
          <BlueprintRewards chance="1" blueprintPool="blueprint-pool" />
        </contractResults>
      </contractResults>
    </Contract>
    <Contract id="mixed-reward-contract" debugName="StantonRewardContract">
      <contractResults>
        <contractResults>
          <BlueprintRewards chance="1" blueprintPool="mixed-blueprint-pool" />
        </contractResults>
      </contractResults>
    </Contract>
    <Contract id="mixed-empty-contract" debugName="PyroNoRewardContract">
      <contractResults>
        <contractResults />
      </contractResults>
    </Contract>
    <Contract id="intro-contract" debugName="IntroContract">
      <contractResults>
        <contractResults>
          <BlueprintRewards chance="1" blueprintPool="intro-blueprint-pool" />
        </contractResults>
      </contractResults>
    </Contract>
  </contracts>
</ContractGenerator.Test>
`,
    'utf8',
  );

  return { dir, datacoreDir };
}

describe('loadDatacoreTitlesSourceData', () => {
  it('builds mission title tags from DataCore blueprint rewards and prerequisite chains', async () => {
    const { dir, datacoreDir } = await makeWorkspace();
    try {
      const rows = await loadDatacoreTitlesSourceData({ sourceDirs: { datacore: datacoreDir } } as never);
      const notes = new Map(rows.map((row) => [row['Localization Key'], row.TitleNote]));

      assert.equal(notes.get('reward_title'), ' <EM4>[BP]</EM4>');
      assert.equal(notes.get('reward_title_alt'), ' <EM4>[BP]</EM4>');
      assert.equal(notes.get('mixed_title'), ' <EM4>[BP]*</EM4>');
      assert.equal(notes.get('root_title'), ' <EM4>[BP Chain]</EM4>');
      assert.equal(notes.get('intro_title'), ' <EM4>[BP]</EM4>');
      assert.equal(
        config.buildValue({ TitleNote: notes.get('reward_title') ?? '' }, '', 'Recover Prototype', ''),
        'Recover Prototype <EM4>[BP]</EM4>',
      );
      assert.equal(
        config.buildValue({ TitleNote: notes.get('mixed_title') ?? '' }, '', 'Recover Prototype <EM4>[BP]</EM4>', ''),
        'Recover Prototype <EM4>[BP]*</EM4>',
      );
      assert.equal(
        config.buildValue(
          { TitleNote: notes.get('mixed_title') ?? '' },
          '',
          'Recover Prototype <EM4>[BP]*</EM4> <EM4>[BP]*</EM4>',
          '',
        ),
        'Recover Prototype <EM4>[BP]*</EM4>',
      );
      assert.equal(
        config.buildValue(
          { TitleNote: ' <EM4>[BP]*</EM4> <EM4>[BP]*</EM4>' },
          '',
          'High-Risk Bounty: ~mission(TargetName)',
          'EckhartSecurity_EliminateBoss_DC_Title_001',
        ),
        'High-Risk Bounty: ~mission(TargetName) <EM4>[BP]*</EM4>',
      );
      assert.equal(
        config.buildValue({ TitleNote: ' <EM4>[BP]</EM4>' }, '', 'Intro Contract <EM4>[Intro] [BP]</EM4>', ''),
        'Intro Contract <EM4>[BP]</EM4>',
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
