import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataCoreContractHaulingSummary } from './contract-hauling-summary-builder';
import type {
  DataCoreContractGeneratorRecord,
  DataCoreContractTemplateHaulingOrderRecord,
} from './types';

describe('buildDataCoreContractHaulingSummary', () => {
  it('combines hauling orders with generators and formats summary', () => {
    const generators: DataCoreContractGeneratorRecord[] = [
      {
        generatorClass: 'RedWind_Hauling',
        contractId: 'db9d9b2d-d850-4df1-ab0f-7fa2261e8f62',
        contractDebugName: 'RedWind_Pyro',
        templateClass: 'HaulCargo_AtoB_Supply_Carbon',
        descriptionKey: 'RedWind_HaulCargo_desc_intro',
        descriptionVariantKeys: 'RedWind_HaulCargo_desc_variant1 | @RedWind_HaulCargo_desc_variant2',
        templateGuid: '6eb86e29-817a-4463-b37e-5a719004b4dc',
        handlerType: '',
        handlerDebugName: '',
        handlerNotForRelease: '',
        handlerWorkInProgress: '',
        factionReputationGuid: '',
        reputationScopeGuid: '',
        contractSection: '',
        contractNotForRelease: '',
        contractWorkInProgress: '',
        titleKey: '',
        contractorKey: '',
        titleVariantKeys: '',
        stringParamOverrides: '',
        locationTagGuids: '',
        locationTagClasses: '',
        maxInstances: '',
        maxInstancesPerPlayer: '',
        respawnTime: '',
        respawnTimeVariation: '',
        instanceLifeTime: '',
        instanceLifeTimeVariation: '',
        contractBuyInAmount: '',
        timeToComplete: '',
        difficultyProfileGuid: '',
        difficultyProfileClass: '',
        mechanicalSkill: '',
        mentalLoad: '',
        riskOfLoss: '',
        gameKnowledge: '',
        recordGuid: 'record-guid-1',
        recordPath: 'path/to/record.xml',
      },
    ];

    const haulingOrders: DataCoreContractTemplateHaulingOrderRecord[] = [
      {
        templateClass: 'HaulCargo_AtoB_Supply_Carbon',
        objectiveDebugName: 'obj1',
        orderIndex: '1',
        resourceGuid: 'carbon-guid',
        resourceClass: 'Carbon',
        resourceNameKey: 'carbon_name',
        minSCU: '10',
        maxSCU: '10',
        maxContainerSize: '0',
        orderSummary: '10 SCU Carbon',
        recordGuid: '6eb86e29-817a-4463-b37e-5a719004b4dc',
        recordPath: 'path/to/template.xml',
      },
      {
        templateClass: 'HaulCargo_AtoB_Supply_Carbon',
        objectiveDebugName: 'obj2',
        orderIndex: '2',
        resourceGuid: 'water-guid',
        resourceClass: 'Water',
        resourceNameKey: 'water_name',
        minSCU: '5',
        maxSCU: '15',
        maxContainerSize: '2',
        orderSummary: '5-15 SCU Water, max 2 SCU',
        recordGuid: '6eb86e29-817a-4463-b37e-5a719004b4dc',
        recordPath: 'path/to/template.xml',
      },
    ];

    const result = buildDataCoreContractHaulingSummary(generators, haulingOrders);
    
    assert.equal(result.length, 3); // primary + 2 variants

    assert.equal(result[0].descriptionKey, 'RedWind_HaulCargo_desc_intro');
    assert.equal(result[0].descriptionKeyRole, 'primary');
    assert.equal(result[0].haulingSummary, 'Order: 10 SCU @carbon_name + 5-15 SCU @water_name, max 2 SCU');
    assert.equal(result[0].recordGuid, 'record-guid-1');

    assert.equal(result[1].descriptionKey, 'RedWind_HaulCargo_desc_variant1');
    assert.equal(result[1].descriptionKeyRole, 'variant');
    assert.equal(result[1].haulingSummary, 'Order: 10 SCU @carbon_name + 5-15 SCU @water_name, max 2 SCU');

    assert.equal(result[2].descriptionKey, 'RedWind_HaulCargo_desc_variant2');
    assert.equal(result[2].descriptionKeyRole, 'variant');
    assert.equal(result[2].haulingSummary, 'Order: 10 SCU @carbon_name + 5-15 SCU @water_name, max 2 SCU');
  });

  it('filters out generators without hauling orders', () => {
    const generators: DataCoreContractGeneratorRecord[] = [
      {
        generatorClass: 'NoHauling',
        contractId: 'id',
        contractDebugName: 'NoHauling',
        templateClass: 'NoHaulingTemplate',
        descriptionKey: 'desc',
        descriptionVariantKeys: '',
        templateGuid: 'missing-guid',
        handlerType: '',
        handlerDebugName: '',
        handlerNotForRelease: '',
        handlerWorkInProgress: '',
        factionReputationGuid: '',
        reputationScopeGuid: '',
        contractSection: '',
        contractNotForRelease: '',
        contractWorkInProgress: '',
        titleKey: '',
        contractorKey: '',
        titleVariantKeys: '',
        stringParamOverrides: '',
        locationTagGuids: '',
        locationTagClasses: '',
        maxInstances: '',
        maxInstancesPerPlayer: '',
        respawnTime: '',
        respawnTimeVariation: '',
        instanceLifeTime: '',
        instanceLifeTimeVariation: '',
        contractBuyInAmount: '',
        timeToComplete: '',
        difficultyProfileGuid: '',
        difficultyProfileClass: '',
        mechanicalSkill: '',
        mentalLoad: '',
        riskOfLoss: '',
        gameKnowledge: '',
        recordGuid: 'record-guid-2',
        recordPath: 'path/to/record2.xml',
      },
    ];

    const result = buildDataCoreContractHaulingSummary(generators, []);
    assert.equal(result.length, 0);
  });
});
