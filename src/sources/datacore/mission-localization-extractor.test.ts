import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDataCoreMissionLocalization } from './mission-localization-extractor';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreMissionLocalization emits usable mission and contract localization facts', () => {
  const graph: DataCoreRecordGraph = {
    source: 'datacore-record-graph',
    recordCount: 3,
    records: [
      {
        path: 'libs/foundry/records/missionbroker/pu_missions/bounty.xml',
        ref: 'mission-ref',
        rootTag: 'MissionBrokerEntry.Bounty',
        rootType: 'MissionBrokerEntry',
        entityClass: 'Bounty',
        localizationKeys: [
          { attribute: 'title', key: 'bounty_title_001' },
          { attribute: 'description', key: 'bounty_desc_001' },
          { attribute: 'name', key: 'LOC_UNINITIALIZED' },
          { attribute: 'displayName', key: 'LOC_PLACEHOLDER' },
        ],
        referencedGuids: [],
      },
      {
        path: 'libs/foundry/records/contracts/contracttemplates/bounty.xml',
        ref: 'contract-ref',
        rootTag: 'ContractTemplate.Bounty',
        rootType: 'ContractTemplate',
        entityClass: 'BountyContract',
        localizationKeys: [{ attribute: 'name', key: 'mission_items_QTQuantumBeacon' }],
        referencedGuids: [],
      },
      {
        path: 'libs/foundry/records/entities/scitem/ships/cooler.xml',
        ref: 'item-ref',
        rootTag: 'EntityClassDefinition.Cooler',
        rootType: 'EntityClassDefinition',
        entityClass: 'Cooler',
        localizationKeys: [{ attribute: 'Description', key: 'item_DescCOOL_Test' }],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {},
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };

  assert.deepEqual(extractDataCoreMissionLocalization(graph), [
    {
      localizationKey: 'bounty_desc_001',
      localizationRole: 'description',
      attribute: 'description',
      rootType: 'MissionBrokerEntry',
      entityClass: 'Bounty',
      ref: 'mission-ref',
      path: 'libs/foundry/records/missionbroker/pu_missions/bounty.xml',
    },
    {
      localizationKey: 'bounty_title_001',
      localizationRole: 'title',
      attribute: 'title',
      rootType: 'MissionBrokerEntry',
      entityClass: 'Bounty',
      ref: 'mission-ref',
      path: 'libs/foundry/records/missionbroker/pu_missions/bounty.xml',
    },
    {
      localizationKey: 'mission_items_QTQuantumBeacon',
      localizationRole: 'other',
      attribute: 'name',
      rootType: 'ContractTemplate',
      entityClass: 'BountyContract',
      ref: 'contract-ref',
      path: 'libs/foundry/records/contracts/contracttemplates/bounty.xml',
    },
  ]);
});
