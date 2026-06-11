import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDataCoreContractGeneratorIntel } from './contract-generator-intel-builder';
import type { DataCoreContractGeneratorRecord } from './types';

test('buildDataCoreContractGeneratorIntel emits primary and variant description intel', () => {
  assert.deepEqual(
    buildDataCoreContractGeneratorIntel([
      generator({
        descriptionKey: '@mission_desc',
        descriptionVariantKeys: 'mission_desc_variant | @mission_desc',
        timeToComplete: '18',
        contractBuyInAmount: '2500',
      }),
    ]),
    [
      {
        generatorClass: 'DeliveryGenerator',
        contractId: 'contract-id',
        contractDebugName: 'Delivery_Debug',
        templateClass: 'DeliveryTemplate',
        descriptionKey: 'mission_desc',
        descriptionKeyRole: 'primary',
        contractIntel: String.raw`Time Limit: 18 min\nBuy-in: 2,500 aUEC`,
        timeLimit: '18',
        contractBuyInAmount: '2500',
        difficultyProfileClass: 'General',
        recordGuid: 'generator-guid',
        recordPath: 'libs/foundry/records/contracts/contractgenerator/delivery.xml',
      },
      {
        generatorClass: 'DeliveryGenerator',
        contractId: 'contract-id',
        contractDebugName: 'Delivery_Debug',
        templateClass: 'DeliveryTemplate',
        descriptionKey: 'mission_desc_variant',
        descriptionKeyRole: 'variant',
        contractIntel: String.raw`Time Limit: 18 min\nBuy-in: 2,500 aUEC`,
        timeLimit: '18',
        contractBuyInAmount: '2500',
        difficultyProfileClass: 'General',
        recordGuid: 'generator-guid',
        recordPath: 'libs/foundry/records/contracts/contractgenerator/delivery.xml',
      },
    ],
  );
});

test('buildDataCoreContractGeneratorIntel emits single reputation awards in contract intel', () => {
  assert.deepEqual(
    buildDataCoreContractGeneratorIntel([
      generator({
        successReputationRewards: JSON.stringify([{ amount: 100, factionGuid: 'faction-guid', scopeGuid: 'scope-guid' }]),
      }),
    ]),
    [
      {
        generatorClass: 'DeliveryGenerator',
        contractId: 'contract-id',
        contractDebugName: 'Delivery_Debug',
        templateClass: 'DeliveryTemplate',
        descriptionKey: 'mission_desc',
        descriptionKeyRole: 'primary',
        contractIntel: 'Reputation Awarded: 100',
        timeLimit: '',
        contractBuyInAmount: '',
        difficultyProfileClass: 'General',
        recordGuid: 'generator-guid',
        recordPath: 'libs/foundry/records/contracts/contractgenerator/delivery.xml',
      },
    ],
  );
});

test('buildDataCoreContractGeneratorIntel groups shared descriptions as reputation by difficulty in contract intel', () => {
  assert.deepEqual(
    buildDataCoreContractGeneratorIntel([
      generator({
        contractId: 'easy',
        contractDebugName: 'Easy_Debug',
        successReputationRewards: JSON.stringify([{ amount: 75, factionGuid: 'faction-guid', scopeGuid: 'scope-guid' }]),
      }),
      generator({
        contractId: 'hard',
        contractDebugName: 'Hard_Debug',
        successReputationRewards: JSON.stringify([{ amount: 100, factionGuid: 'faction-guid', scopeGuid: 'scope-guid' }]),
      }),
    ]).map(({ contractId, contractIntel }) => ({ contractId, contractIntel })),
    [
      {
        contractId: 'easy',
        contractIntel: 'Reputation Awarded (by difficulty): 75 / 100',
      },
      {
        contractId: 'hard',
        contractIntel: 'Reputation Awarded (by difficulty): 75 / 100',
      },
    ],
  );
});

test('buildDataCoreContractGeneratorIntel skips rows without description keys or intel fields', () => {
  assert.deepEqual(
    buildDataCoreContractGeneratorIntel([
      generator({ descriptionKey: '', descriptionVariantKeys: '', timeToComplete: '18' }),
      generator({ descriptionKey: 'mission_desc', timeToComplete: '0', contractBuyInAmount: '0' }),
    ]),
    [],
  );
});

function generator(overrides: Partial<DataCoreContractGeneratorRecord> = {}): DataCoreContractGeneratorRecord {
  return {
    generatorClass: 'DeliveryGenerator',
    handlerType: 'ContractGeneratorHandler_List',
    handlerDebugName: 'Delivery',
    handlerNotForRelease: '0',
    handlerWorkInProgress: '0',
    factionReputationGuid: '',
    reputationScopeGuid: '',
    contractSection: 'contracts',
    contractId: 'contract-id',
    contractDebugName: 'Delivery_Debug',
    contractNotForRelease: '0',
    contractWorkInProgress: '0',
    templateGuid: 'template-guid',
    templateClass: 'DeliveryTemplate',
    titleKey: 'mission_title',
    descriptionKey: 'mission_desc',
    contractorKey: '',
    titleVariantKeys: '',
    descriptionVariantKeys: '',
    blueprintRewardPoolGuids: '',
    stringParamOverrides: '',
    locationTagGuids: '',
    locationTagClasses: '',
    successReputationRewards: '',
    failureReputationRewards: '',
    maxInstances: '',
    maxInstancesPerPlayer: '',
    respawnTime: '',
    respawnTimeVariation: '',
    instanceLifeTime: '',
    instanceLifeTimeVariation: '',
    contractBuyInAmount: '0',
    timeToComplete: '0',
    difficultyProfileGuid: '',
    difficultyProfileClass: 'General',
    mechanicalSkill: '',
    mentalLoad: '',
    riskOfLoss: '',
    gameKnowledge: '',
    requiredCompletedContractTags: '',
    completionTags: '',
    recordGuid: 'generator-guid',
    recordPath: 'libs/foundry/records/contracts/contractgenerator/delivery.xml',
    ...overrides,
  };
}
