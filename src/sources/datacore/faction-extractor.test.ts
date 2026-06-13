import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreFactions } from './faction-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreFactions reads faction flags and linked reputation UI metadata', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-factions-'));
  const factionPath = 'libs/foundry/records/factions/faction_reputation_unlawful_headhunters.xml';
  const reputationPath = 'libs/foundry/records/factions/factionreputation/factionreputation_headhunters.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, factionPath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, reputationPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, factionPath),
    `
      <Faction.Faction_Reputation_Unlawful_HeadHunters
        name="@HeadHunters_RepUI_Name_Stale"
        description="@HeadHunters_RepUI_Description_Stale"
        defaultReaction="Neutral"
        factionType="Unlawful"
        ableToArrest="0"
        policesLawfulTrespass="0"
        policesCriminality="0"
        noLegalRights="0"
        factionReputationRef="stale-reputation-guid"
        __type="Faction"
        __ref="9f89edc0-441b-4f40-a502-df12ebf3f1eb"
        __path="${factionPath}">
        <alliedFactions>
          <Reference value="3c9a42a9-a986-494f-b724-4d74415f6016" />
        </alliedFactions>
        <enemyFactions>
          <Reference value="cd2b32d1-0362-41fb-8cfd-d29781daf789" />
          <Reference value="14789370-bf3a-42b9-ac55-a49ee406e1f1" />
        </enemyFactions>
      </Faction.Faction_Reputation_Unlawful_HeadHunters>
    `,
    'utf8',
  );
  await fs.writeFile(
    path.join(xmlCacheDir, reputationPath),
    `
      <FactionReputation.FactionReputation_HeadHunters
        displayName="@HeadHunters_RepUI_Name_Stale"
        __type="FactionReputation"
        __ref="09efeef4-c646-408d-a979-3ae56a3b1beb"
        __path="${reputationPath}">
        <propertiesBB>
          <SReputationContextBBPropertyParams name="entityDescription">
            <dynamicProperty>
              <SBBDynamicPropertyLocString value="@HeadHunters_RepUI_Description" />
            </dynamicProperty>
          </SReputationContextBBPropertyParams>
          <SReputationContextBBPropertyParams name="entityLawful">
            <dynamicProperty>
              <SBBDynamicPropertyBool value="0" />
            </dynamicProperty>
          </SReputationContextBBPropertyParams>
          <SReputationContextBBPropertyParams name="entityHeadquarters">
            <dynamicProperty>
              <SBBDynamicPropertyLocString value="@HeadHunters_RepUI_Headquarters" />
            </dynamicProperty>
          </SReputationContextBBPropertyParams>
          <SReputationContextBBPropertyParams name="entityFocus">
            <dynamicProperty>
              <SBBDynamicPropertyLocString value="@HeadHunters_RepUI_Focus" />
            </dynamicProperty>
          </SReputationContextBBPropertyParams>
        </propertiesBB>
      </FactionReputation.FactionReputation_HeadHunters>
    `,
    'utf8',
  );

  const rows = await extractDataCoreFactions({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph(factionPath, reputationPath)),
  });

  assert.deepEqual(rows, [
    {
      ref: '9f89edc0-441b-4f40-a502-df12ebf3f1eb',
      path: factionPath,
      factionClass: 'Faction_Reputation_Unlawful_HeadHunters',
      nameKey: 'HeadHunters_RepUI_Name',
      descriptionKey: 'HeadHunters_RepUI_Description',
      defaultReaction: 'Neutral',
      factionType: 'Unlawful',
      ableToArrest: '0',
      policesLawfulTrespass: '0',
      policesCriminality: '0',
      noLegalRights: '0',
      factionReputationGuid: '09efeef4-c646-408d-a979-3ae56a3b1beb',
      factionReputationClass: 'FactionReputation_HeadHunters',
      factionReputationPath: reputationPath,
      reputationDisplayNameKey: 'HeadHunters_RepUI_Name',
      reputationDescriptionKey: 'HeadHunters_RepUI_Description',
      reputationHeadquartersKey: 'HeadHunters_RepUI_Headquarters',
      reputationFoundedKey: '',
      reputationLeadershipKey: '',
      reputationAreaKey: '',
      reputationFocusKey: 'HeadHunters_RepUI_Focus',
      reputationLawful: '0',
      alliedFactionGuids: '3c9a42a9-a986-494f-b724-4d74415f6016',
      enemyFactionGuids: '14789370-bf3a-42b9-ac55-a49ee406e1f1;cd2b32d1-0362-41fb-8cfd-d29781daf789',
    },
  ]);
});

function makeGraph(factionPath: string, reputationPath: string): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: factionPath,
        ref: '9f89edc0-441b-4f40-a502-df12ebf3f1eb',
        rootTag: 'Faction.Faction_Reputation_Unlawful_HeadHunters',
        rootType: 'Faction',
        entityClass: 'Faction_Reputation_Unlawful_HeadHunters',
        localizationKeys: [
          { attribute: 'name', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayName', key: 'HeadHunters_RepUI_Name' },
          { attribute: 'description', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayDescription', key: 'HeadHunters_RepUI_Description' },
        ],
        referencedGuids: [
          '14789370-bf3a-42b9-ac55-a49ee406e1f1',
          '3c9a42a9-a986-494f-b724-4d74415f6016',
          'cd2b32d1-0362-41fb-8cfd-d29781daf789',
          '09efeef4-c646-408d-a979-3ae56a3b1beb',
        ],
        referencedGuidAttributes: [
          { attribute: 'factionReputationRef', value: '' },
          { attribute: 'factionReputationRef', value: '09efeef4-c646-408d-a979-3ae56a3b1beb' },
          { attribute: 'value', value: '14789370-bf3a-42b9-ac55-a49ee406e1f1' },
          { attribute: 'value', value: '3c9a42a9-a986-494f-b724-4d74415f6016' },
          { attribute: 'value', value: 'cd2b32d1-0362-41fb-8cfd-d29781daf789' },
        ],
      },
      {
        path: reputationPath,
        ref: '09efeef4-c646-408d-a979-3ae56a3b1beb',
        rootTag: 'FactionReputation.FactionReputation_HeadHunters',
        rootType: 'FactionReputation',
        entityClass: 'FactionReputation_HeadHunters',
        localizationKeys: [
          { attribute: 'displayName', key: 'LOC_UNINITIALIZED' },
          { attribute: 'name', key: 'HeadHunters_RepUI_Name' },
        ],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        '9f89edc0-441b-4f40-a502-df12ebf3f1eb': factionPath,
        '09efeef4-c646-408d-a979-3ae56a3b1beb': reputationPath,
      },
      byPath: {
        [factionPath]: 0,
        [reputationPath]: 1,
      },
      byRootType: {
        Faction: [factionPath],
        FactionReputation: [reputationPath],
      },
      byEntityClass: {
        Faction_Reputation_Unlawful_HeadHunters: [factionPath],
        FactionReputation_HeadHunters: [reputationPath],
      },
      byLocalizationKey: {
        HeadHunters_RepUI_Name: [factionPath, reputationPath],
        HeadHunters_RepUI_Description: [factionPath],
      },
      byReferencedGuid: {},
    },
  };
}
