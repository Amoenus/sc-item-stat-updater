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
    stringParamOverrides: '',
    locationTagGuids: '',
    locationTagClasses: '',
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
    recordGuid: 'generator-guid',
    recordPath: 'libs/foundry/records/contracts/contractgenerator/delivery.xml',
    ...overrides,
  };
}
