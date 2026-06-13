import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreLocationLabels } from './location-label-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreLocationLabels reads StarMap labels and resolves law and affiliation refs', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-location-labels-'));
  const locationPath = 'libs/foundry/records/starmap/pu/pyro3_outpost.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, locationPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, locationPath),
    `
      <StarMapObject.Pyro3_Outpost
        name="@Pyro3_Outpost_Stale"
        affiliation="stale-affiliation-guid"
        description="@Pyro3_Outpost_stale_desc"
        callout1="@Pyro3_Outpost_stale_callout1"
        callout2="@LOC_UNINITIALIZED"
        callout3="@LOC_EMPTY"
        respawnLocationType="None"
        jurisdiction="stale-jurisdiction-guid"
        locationHierarchyTag="cd99a4ac-aeba-43f1-8edd-4f050d50b1bc"
        type="stale-type-guid"
        navIcon="Outpost"
        parent="stale-parent-guid"
        isScannable="0"
        size="1"
        hideInStarmap="0"
        hideInWorld="0"
        hideWhenInAdoptionRadius="0"
        blockTravel="0"
        onlyShowWhenParentSelected="1"
        overrideShowInAllZones="NoOverride"
        overridePermanent="NoOverride"
        minimumDisplaySize="0"
        showOrbitLine="0"
        useHoloMaterial="1"
        noAutoBodyRecovery="0"
        starMapGeomPath="objects/ui/starmap/icon_nav_marker_outpost_1_a.cgf"
        starMapMaterialPath="objects/ui/starmap/icon_nav_marker_outpost.mtl"
        starMapShapePath="UI/Textures/Vector/General/MarkerIcons/ui_icon_general_01.svg"
        locationImagePath="UI/Frontend/assets/TIF/Locations/Pyro_Outpost.tif"
        __type="StarMapObject"
        __ref="407847a6-4aae-4c3c-9a36-b80108d776f0"
        __path="${locationPath}">
        <quantumTravelData>
          <StarMapQuantumTravelDataParams arrivalRadius="2500" adoptionRadius="1500" />
        </quantumTravelData>
        <locationParams>
          <StarMapObjectLocationParams setEntityLocationOnEnter="1" exposeForPlayerCreatedMissions="0" />
        </locationParams>
      </StarMapObject.Pyro3_Outpost>
    `,
    'utf8',
  );

  const rows = await extractDataCoreLocationLabels({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph(locationPath)),
    starmapPathPrefix: locationPath,
  });

  assert.deepEqual(rows, [
    {
      ref: '407847a6-4aae-4c3c-9a36-b80108d776f0',
      path: locationPath,
      locationClass: 'Pyro3_Outpost',
      nameKey: 'Pyro3_Outpost',
      descriptionKey: 'Pyro3_Outpost_desc',
      callout1Key: 'Pyro3_Outpost_callout1',
      callout2Key: '',
      callout3Key: '',
      typeGuid: 'e207a1ec-1395-4c1c-8e51-b38c4420784c',
      parentGuid: '59637d5a-c67a-47eb-96dc-b648298f0023',
      parentClass: 'Pyro3',
      parentPath: 'libs/foundry/records/starmap/pu/system/pyro/pyro3.xml',
      affiliationGuid: '6f3699dd-123e-4f1a-82da-51207b073fe0',
      affiliationClass: 'HeadHunters',
      affiliationPath: 'libs/foundry/records/factions_legacy/headhunters.xml',
      affiliationNameKey: 'HeadHunters_RepUI_Name',
      jurisdictionGuid: '0d2e5d5e-a3d3-4a6d-869f-58dc705e7020',
      jurisdictionClass: 'XenoThreat',
      jurisdictionPath: 'libs/foundry/records/lawsystem/jurisdictions/pyro/xenothreat.xml',
      jurisdictionNameKey: 'Xenothreat_RepUI_Name',
      respawnLocationType: 'None',
      locationHierarchyTag: 'cd99a4ac-aeba-43f1-8edd-4f050d50b1bc',
      navIcon: 'Outpost',
      size: '1',
      hideInStarmap: '0',
      hideInWorld: '0',
      hideWhenInAdoptionRadius: '0',
      onlyShowWhenParentSelected: '1',
      overrideShowInAllZones: 'NoOverride',
      overridePermanent: 'NoOverride',
      minimumDisplaySize: '0',
      blockTravel: '0',
      isScannable: '0',
      showOrbitLine: '0',
      useHoloMaterial: '1',
      noAutoBodyRecovery: '0',
      arrivalRadius: '2500',
      adoptionRadius: '1500',
      setEntityLocationOnEnter: '1',
      exposeForPlayerCreatedMissions: '0',
      starMapGeomPath: 'objects/ui/starmap/icon_nav_marker_outpost_1_a.cgf',
      starMapMaterialPath: 'objects/ui/starmap/icon_nav_marker_outpost.mtl',
      starMapShapePath: 'UI/Textures/Vector/General/MarkerIcons/ui_icon_general_01.svg',
      locationImagePath: 'UI/Frontend/assets/TIF/Locations/Pyro_Outpost.tif',
    },
  ]);
});

function makeGraph(locationPath: string): DataCoreRecordGraph {
  const parentPath = 'libs/foundry/records/starmap/pu/system/pyro/pyro3.xml';
  const affiliationPath = 'libs/foundry/records/factions_legacy/headhunters.xml';
  const jurisdictionPath = 'libs/foundry/records/lawsystem/jurisdictions/pyro/xenothreat.xml';
  return {
    source: 'datacore-record-graph',
    recordCount: 4,
    records: [
      {
        ...node(locationPath, '407847a6-4aae-4c3c-9a36-b80108d776f0', 'StarMapObject', 'Pyro3_Outpost', [
          { attribute: 'name', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayName', key: 'Pyro3_Outpost' },
          { attribute: 'description', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayDescription', key: 'Pyro3_Outpost_desc' },
          { attribute: 'callout1', key: 'Pyro3_Outpost_callout1' },
        ]),
        referencedGuids: [
          '0d2e5d5e-a3d3-4a6d-869f-58dc705e7020',
          '59637d5a-c67a-47eb-96dc-b648298f0023',
          '6f3699dd-123e-4f1a-82da-51207b073fe0',
          'e207a1ec-1395-4c1c-8e51-b38c4420784c',
        ],
        referencedGuidAttributes: [
          { attribute: 'affiliation', value: '6f3699dd-123e-4f1a-82da-51207b073fe0' },
          { attribute: 'jurisdiction', value: '0d2e5d5e-a3d3-4a6d-869f-58dc705e7020' },
          { attribute: 'parent', value: '59637d5a-c67a-47eb-96dc-b648298f0023' },
          { attribute: 'type', value: 'e207a1ec-1395-4c1c-8e51-b38c4420784c' },
        ],
      },
      node(parentPath, '59637d5a-c67a-47eb-96dc-b648298f0023', 'StarMapObject', 'Pyro3'),
      node(affiliationPath, '6f3699dd-123e-4f1a-82da-51207b073fe0', 'Faction_LEGACY', 'HeadHunters', [
        { attribute: 'displayName', key: 'HeadHunters_RepUI_Name' },
      ]),
      node(jurisdictionPath, '0d2e5d5e-a3d3-4a6d-869f-58dc705e7020', 'Jurisdiction', 'XenoThreat', [
        { attribute: 'name', key: 'Xenothreat_RepUI_Name' },
      ]),
    ],
    indexes: {
      byRef: {
        '407847a6-4aae-4c3c-9a36-b80108d776f0': locationPath,
        '59637d5a-c67a-47eb-96dc-b648298f0023': parentPath,
        '6f3699dd-123e-4f1a-82da-51207b073fe0': affiliationPath,
        '0d2e5d5e-a3d3-4a6d-869f-58dc705e7020': jurisdictionPath,
      },
      byPath: {
        [locationPath]: 0,
        [parentPath]: 1,
        [affiliationPath]: 2,
        [jurisdictionPath]: 3,
      },
      byRootType: {
        StarMapObject: [locationPath, parentPath],
        Faction_LEGACY: [affiliationPath],
        Jurisdiction: [jurisdictionPath],
      },
      byEntityClass: {
        Pyro3_Outpost: [locationPath],
        Pyro3: [parentPath],
        HeadHunters: [affiliationPath],
        XenoThreat: [jurisdictionPath],
      },
      byLocalizationKey: {
        HeadHunters_RepUI_Name: [affiliationPath],
        Xenothreat_RepUI_Name: [jurisdictionPath],
      },
      byReferencedGuid: {},
    },
  };
}

function node(
  recordPath: string,
  ref: string,
  rootType: string,
  entityClass: string,
  localizationKeys: DataCoreRecordGraph['records'][number]['localizationKeys'] = [],
): DataCoreRecordGraph['records'][number] {
  return {
    path: recordPath,
    ref,
    rootTag: `${rootType}.${entityClass}`,
    rootType,
    entityClass,
    localizationKeys,
    referencedGuids: [],
  };
}
