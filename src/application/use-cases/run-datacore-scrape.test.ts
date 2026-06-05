import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { DataCoreMiningParamRecord } from '../../sources/datacore/types';
import { runDatacoreScrape, type DataCoreTypeEntry } from './run-datacore-scrape';
import { DATACORE_RAW_FACTS } from './category-listing';

const typeEntry: DataCoreTypeEntry = {
  name: 'shields',
  csvFile: 'shields.datacore.csv',
  typeConfig: {
    recordFilter: 'shieldgenerator',
    entityClassPrefix: 'shld_',
    nameKeyInfix: 'SHLD_',
    fieldSelectors: {
      Power: 'Power',
      Efficiency: { selector: 'Efficiency', attr: 'value', format: 'percent' },
    },
  },
};

test('runDatacoreScrape parses cached XML records without writing during dry run', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.0-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <SAttachableComponentParams>
          <AttachDef size="2" grade="b" subtype="CIVILIAN">
            <Manufacturer name="ACME" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    dryRun: true,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.versionTag, '4.8.0-live');
  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shields.datacore.csv' }]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.rawFactResults.map((entry) => [entry.slug, entry.csvFile, entry.rows]),
    DATACORE_RAW_FACTS.map((entry) => [entry.slug, entry.sourceFiles[0], 0]),
  );
  await assert.rejects(() => fs.stat(path.join(repoRoot, 'csv', 'datacore', '4.8.0-live')));
});

test('runDatacoreScrape writes raw component identity keys and capitalized AttachDef stats', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-component-identity-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.0-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'aegs.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN" Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2">
            <Localization Name="@item_NameSHLD_Test" ShortName="@LOC_EMPTY" Description="@item_DescSHLD_Test" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.AEGS
        Code="AEGS"
        __type="SCItemManufacturer"
        __ref="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2"
        __path="libs/foundry/records/scitemmanufacturer/aegs.xml">
        <Localization Name="@manufacturer_NameAEGS" Description="@manufacturer_DescAEGS" />
      </SCItemManufacturer.AEGS>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'shields.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shields.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power,Efficiency\r?\n/,
  );
  assert.match(csv, /shld_test,item_NameSHLD_Test,,item_DescSHLD_Test,AEGS,2,B,Civilian,500,42,87.5%/);
});

test('runDatacoreScrape extracts XML cache when cached records are missing', async () => {
  const events: string[] = [];

  const result = await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async (_toolDir, log) => {
      log('tools ready');
      return { unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' };
    },
    countXmlFiles: async () => 0,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, false);
      events.push('extract');
      return { workDcbPath: 'cache/Game.dcb', monolithicXmlPath: 'cache/Game.xml', xmlFileCount: 123 };
    },
    onToolsLog: (message) => events.push(message),
    onCacheExtractStart: (_dcbPath, _xmlCacheDir, clearExisting) => {
      assert.equal(clearExisting, false);
      events.push('start');
    },
    onCacheExtractComplete: (count) => events.push(`complete:${count}`),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.results, []);
  assert.deepEqual(events, ['tools ready', 'start', 'extract', 'complete:123']);
});

test('runDatacoreScrape writes DataCore commodity CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-commodities-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [
      {
        ref: 'af5dcf22-7a28-4b1e-88f0-4309d34be11a',
        path: 'libs/foundry/records/entities/commodities/alloys/atlasium.xml',
        entityClass: 'atlasium',
        nameKey: 'items_commodities_atlasium',
        descriptionKey: 'items_commodities_atlasium_desc',
        displayNameKey: 'items_commodities_atlasium',
        displayDescriptionKey: 'items_commodities_atlasium_desc',
        displayTypeKey: 'items_commodities_type_alloy',
        typeGuid: '22325f28-8d37-46ab-8c08-8a9b34101fad',
        subtypeGuid: '45f89d34-3167-4723-9b85-f9df3770ce00',
        cargoOccupancyUnit: 'SCentiCargoUnit',
        cargoOccupancyValue: '1',
        cargoOccupancySCU: '0.01',
        boxable: '1',
        isUnrefinedElement: '0',
        isRaw: '',
        isRefined: '1',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'commodities.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.commodityResult.rows, 1);
  assert.equal(result.commodityResult.csvFile, 'commodities.datacore.csv');
  assert.match(
    csv,
    /^Entity Class,Name Key,Description Key,Display Name Key,Display Description Key,Display Type Key,Type GUID,Subtype GUID,Cargo Occupancy Unit,Cargo Occupancy Value,Cargo Occupancy SCU,Boxable,Unrefined,Raw,Refined,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /atlasium,items_commodities_atlasium,items_commodities_atlasium_desc/);
});

test('runDatacoreScrape writes DataCore vehicle CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-vehicles-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [
      {
        ref: '11111111-1111-1111-1111-111111111111',
        path: 'libs/foundry/records/entities/spaceships/aegs_avenger_titan.xml',
        entityClass: 'AEGS_Avenger_Titan',
        vehicleNameKey: 'vehicle_NameAEGS_Avenger_Titan',
        vehicleDescriptionKey: 'vehicle_DescAEGS_Avenger_Titan',
        manufacturerGuid: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
        manufacturerCode: 'AEGS',
        manufacturerNameKey: 'manufacturer_NameAEGS',
        movementClass: 'Spaceship',
        vehicleDefinition: 'scripts/entities/vehicles/implementations/xml/aegs_avenger.xml',
        modification: 'Titan',
        careerKey: 'vehicle_focus_transporter',
        careerGuid: 'd86d770d-1fc4-4525-b3b0-4f670a8a5634',
        roleKey: 'vehicle_class_lightfreight',
        roleGuid: 'ff99d78e-3a6a-4e4d-8b1c-59e87a005c11',
        crewSize: '1',
        hullDamageNormalization: '1650',
        allowSoftDestruction: '1',
        dogfightEnabled: '1',
        isGravlevVehicle: '0',
        inventoryContainerGuid: 'a623a5e1-27db-4e93-af6b-e54912b78e32',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'vehicles.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.vehicleResult.rows, 1);
  assert.equal(result.vehicleResult.csvFile, 'vehicles.datacore.csv');
  assert.match(
    csv,
    /^Entity Class,Vehicle Name Key,Vehicle Description Key,Manufacturer GUID,Manufacturer Code,Manufacturer Name Key,Movement Class,Vehicle Definition,Modification,Career Key,Career GUID,Role Key,Role GUID,Crew Size,Hull Damage Normalization,Allow Soft Destruction,Dogfight Enabled,Gravlev Vehicle,Inventory Container GUID,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /AEGS_Avenger_Titan,vehicle_NameAEGS_Avenger_Titan,vehicle_DescAEGS_Avenger_Titan/);
});

test('runDatacoreScrape writes DataCore faction CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-factions-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [],
    extractFactions: async () => [
      {
        ref: '9f89edc0-441b-4f40-a502-df12ebf3f1eb',
        path: 'libs/foundry/records/factions/faction_reputation_unlawful_headhunters.xml',
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
        factionReputationPath: 'libs/foundry/records/factions/factionreputation/factionreputation_headhunters.xml',
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
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'factions.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.factionResult.rows, 1);
  assert.equal(result.factionResult.csvFile, 'factions.datacore.csv');
  assert.match(
    csv,
    /^Faction Class,Name Key,Description Key,Default Reaction,Faction Type,Able To Arrest,Polices Lawful Trespass,Polices Criminality,No Legal Rights,Faction Reputation GUID,Faction Reputation Class,Faction Reputation Path,Reputation Display Name Key,Reputation Description Key,Reputation Headquarters Key,Reputation Founded Key,Reputation Leadership Key,Reputation Area Key,Reputation Focus Key,Reputation Lawful,Allied Faction GUIDs,Enemy Faction GUIDs,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Faction_Reputation_Unlawful_HeadHunters,HeadHunters_RepUI_Name/);
});

test('runDatacoreScrape writes DataCore manufacturer CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-manufacturers-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [],
    extractFactions: async () => [],
    extractManufacturers: async () => [
      {
        ref: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
        path: 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml',
        manufacturerClass: 'AEGS',
        code: 'AEG',
        nameKey: 'manufacturer_NameAEGS',
        shortNameKey: '',
        descriptionKey: 'manufacturer_DescAEGS',
        logo: 'UI/SharedAssets/ManufacturerLogos/Aegis_256.tif',
        logoFullColor: 'ui/textures/logos/logo_corp_aegs_square_color.tif',
        logoSimplifiedWhite: 'ui/textures/logos/logo_corp_aegs_square_white.tif',
        dashboardCanvasConfigGuid: '3db6a90f-4e32-40b5-b583-da02478b1f69',
        buildingBlocksStyleGuid: 'bcf008bc-19c3-4fc5-8629-9f18e462dbe0',
        audioManufacturerTagGuid: '3a4880d2-c4d7-4b78-a5ab-bd9a54fd3e5f',
        lightAmplificationGuid: '41883412-2a2c-47a0-b5a9-c0f40e3fed63',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'manufacturers.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.manufacturerResult.rows, 1);
  assert.equal(result.manufacturerResult.csvFile, 'manufacturers.datacore.csv');
  assert.match(
    csv,
    /^Manufacturer Class,Code,Name Key,Short Name Key,Description Key,Logo,Logo Full Color,Logo Simplified White,Dashboard Canvas Config GUID,Building Blocks Style GUID,Audio Manufacturer Tag GUID,Light Amplification GUID,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /AEGS,AEG,manufacturer_NameAEGS,,manufacturer_DescAEGS/);
});

test('runDatacoreScrape writes DataCore location label CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-location-labels-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [],
    extractFactions: async () => [],
    extractManufacturers: async () => [],
    extractLocationLabels: async () => [
      {
        ref: '407847a6-4aae-4c3c-9a36-b80108d776f0',
        path: 'libs/foundry/records/starmap/pu/pyro3_outpost.xml',
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
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'location-labels.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.locationLabelResult.rows, 1);
  assert.equal(result.locationLabelResult.csvFile, 'location-labels.datacore.csv');
  assert.match(
    csv,
    /^Location Class,Name Key,Description Key,Callout 1 Key,Callout 2 Key,Callout 3 Key,Type GUID,Parent GUID,Parent Class,Parent Path,Affiliation GUID,Affiliation Class,Affiliation Path,Affiliation Name Key,Jurisdiction GUID,Jurisdiction Class,Jurisdiction Path,Jurisdiction Name Key,Respawn Location Type,Location Hierarchy Tag,Nav Icon,Size,Hide In Starmap,Hide In World,Hide When In Adoption Radius,Only Show When Parent Selected,Override Show In All Zones,Override Permanent,Minimum Display Size,Block Travel,Is Scannable,Show Orbit Line,Use Holo Material,No Auto Body Recovery,Arrival Radius,Adoption Radius,Set Entity Location On Enter,Expose For Player Created Missions,StarMap Geom Path,StarMap Material Path,StarMap Shape Path,Location Image Path,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Pyro3_Outpost,Pyro3_Outpost,Pyro3_Outpost_desc/);
  assert.match(csv, /XenoThreat,libs\/foundry\/records\/lawsystem\/jurisdictions\/pyro\/xenothreat\.xml/);
});

test('runDatacoreScrape writes DataCore mining element CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-elements-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [
      {
        ref: 'd61d6c33-e428-4014-9326-0b06034de16a',
        path: 'libs/foundry/records/mining/mineableelements/agricium_ore.xml',
        elementClass: 'Agricium_Ore',
        elementName: 'Agricium (Ore)',
        inferredDescriptionKey: 'items_commodities_agricium_ore_desc',
        resourceTypeGuid: 'fc1ec740-3047-48d8-81f0-396f4c9a90ef',
        instability: '350',
        resistance: '0.5',
        optimalWindowMidpoint: '0.5',
        optimalWindowRandomness: '0.15',
        optimalWindowThinness: '2',
        explosionMultiplier: '4',
        clusterFactor: '0.2',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-elements.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningElementResult.rows, 1);
  assert.equal(result.miningElementResult.csvFile, 'mining-elements.datacore.csv');
  assert.match(
    csv,
    /^Element Class,Element Name,Inferred Description Key,Resource Type GUID,Instability,Resistance,Optimal Window Midpoint,Optimal Window Randomness,Optimal Window Thinness,Explosion Multiplier,Cluster Factor,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Agricium_Ore,Agricium \(Ore\),items_commodities_agricium_ore_desc/);
});

test('runDatacoreScrape writes DataCore mining composition CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-compositions-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [
      {
        ref: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        path: 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium.xml',
        compositionClass: 'Asteroid_CType_Aluminium',
        depositNameKey: 'hud_mining_asteroid_name_5',
        minimumDistinctElements: '2',
        partIndex: '0',
        mineableElementGuid: '3776294d-5689-41f2-b03d-e8fcd17ede6a',
        mineableElementClass: 'Aluminium_Ore',
        mineableElementName: 'Aluminum (Ore)',
        minPercentage: '30',
        maxPercentage: '70',
        probability: '1',
        curveExponent: '1',
        qualityScale: '1',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-compositions.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningCompositionResult.rows, 1);
  assert.equal(result.miningCompositionResult.csvFile, 'mining-compositions.datacore.csv');
  assert.match(
    csv,
    /^Composition Class,Deposit Name Key,Minimum Distinct Elements,Part Index,Mineable Element GUID,Mineable Element Class,Mineable Element Name,Min Percentage,Max Percentage,Probability,Curve Exponent,Quality Scale,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Asteroid_CType_Aluminium,hud_mining_asteroid_name_5,2,0/);
});

test('runDatacoreScrape writes DataCore mining provider preset CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-provider-presets-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMiningProviderPresets: async () => [
      {
        ref: '449763d3-5ba2-4a97-873d-cedf802b9aea',
        path: 'libs/foundry/records/harvestable/providerpresets/system/stanton/hpp_stanton1.xml',
        providerClass: 'HPP_Stanton1',
        system: 'stanton',
        location: 'hpp_stanton1',
        groupName: 'SpaceShip_Mineables',
        groupProbability: '6',
        entryIndex: '0.0',
        harvestableGuid: 'e576319a-80bf-46a6-b600-ab4d5e34c00f',
        harvestableClass: 'AgriciumRock',
        harvestablePath: 'libs/foundry/records/entities/mineable/agriciumrock.xml',
        harvestableEntityGuid: '1c949ce0-c99b-485b-b783-2ea3b49162c0',
        harvestableEntityClass: 'AgriciumRock',
        harvestableEntityPath: 'libs/foundry/records/entities/mineable/agriciumrock.xml',
        harvestableSetupGuid: '',
        harvestableSetupClass: '',
        compositionGuid: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        compositionClass: 'Asteroid_CType_Aluminium',
        globalParamsGuid: 'aa727a56-9937-4eb5-80c6-51b418d43177',
        audioParamsGuid: '5f5c1a61-6500-46a1-8a01-7ba4956751d1',
        filledFactor: '1',
        clusteringGuid: '70128b72-7c50-4315-bed8-59a1c2ef7996',
        clusteringClass: 'Asteroid_Lrg_Med_Sml',
        relativeProbability: '44',
        geometryTags: '6874072c-c021-43bc-b8d9-d06b810102c5',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-provider-presets.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningProviderPresetResult.rows, 1);
  assert.equal(result.miningProviderPresetResult.csvFile, 'mining-provider-presets.datacore.csv');
  assert.match(
    csv,
    /^Provider Class,System,Location,Group Name,Group Probability,Entry Index,Harvestable GUID,Harvestable Class,Harvestable Path,Harvestable Entity GUID,Harvestable Entity Class,Harvestable Entity Path,Harvestable Setup GUID,Harvestable Setup Class,Composition GUID,Composition Class,Global Params GUID,Audio Params GUID,Filled Factor,Clustering GUID,Clustering Class,Relative Probability,Geometry Tags,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /HPP_Stanton1,stanton,hpp_stanton1,SpaceShip_Mineables,6,0\.0/);
});

test('runDatacoreScrape writes DataCore mineable entity CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mineable-entities-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [
      {
        ref: '6b582444-50ec-47fe-8c5f-a342e38506f3',
        path: 'libs/foundry/records/entities/mineable/asteroidctypemineablerock_aluminium.xml',
        entityClass: 'AsteroidCTypeMineableRock_Aluminium',
        compositionGuid: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        compositionClass: 'Asteroid_CType_Aluminium',
        globalParamsGuid: 'aa727a56-9937-4eb5-80c6-51b418d43177',
        globalParamsClass: 'MiningGlobalParams_Ship',
        audioParamsGuid: '5f5c1a61-6500-46a1-8a01-7ba4956751d1',
        audioParamsClass: 'MiningAudioParams_Ship',
        densityClassGuid: '6e889f53-d6bc-4b3e-80c5-875376e02194',
        densityClass: 'EntityDensityClass_Mineable',
        filledFactor: '1',
        glowCurvePower: '1',
        glowLerpSpeed: '0.25',
        allowAutoRespawning: '1',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mineable-entities.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.mineableEntityResult.rows, 1);
  assert.equal(result.mineableEntityResult.csvFile, 'mineable-entities.datacore.csv');
  assert.match(
    csv,
    /^Entity Class,Composition GUID,Composition Class,Global Params GUID,Global Params Class,Audio Params GUID,Audio Params Class,Density Class GUID,Density Class,Filled Factor,Glow Curve Power,Glow Lerp Speed,Allow Auto Respawning,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /AsteroidCTypeMineableRock_Aluminium,3a6e7bb4-0f23-4c46-b822-333afe9d63ab/);
});

test('runDatacoreScrape writes DataCore mining density override CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-density-overrides-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningDensityOverrides: async () => [
      {
        ref: 'ad7b50ff-f32b-4156-a56e-f0ddfc48f76d',
        path: 'libs/foundry/records/densityclasses/overrides/stanton_hightechminingoutpost.xml',
        overrideClass: 'Stanton_HighTechMiningOutpost',
        densityClassGuid: 'b6cc39fd-7c14-4568-b261-197834e51116',
        densityClass: 'SpaceShipDensityClass',
        densityClassPath: 'libs/foundry/records/densityclasses/spaceshipdensityclass.xml',
        lifetimeDays: '0',
        lifetimeHours: '20',
        lifetimeMinutes: '0',
        lifetimeSeconds: '0',
        lifetimeTotalSeconds: '72000',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-density-overrides.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningDensityOverrideResult.rows, 1);
  assert.equal(result.miningDensityOverrideResult.csvFile, 'mining-density-overrides.datacore.csv');
  assert.match(
    csv,
    /^Override Class,Density Class GUID,Density Class,Density Class Path,Lifetime Days,Lifetime Hours,Lifetime Minutes,Lifetime Seconds,Lifetime Total Seconds,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Stanton_HighTechMiningOutpost,b6cc39fd-7c14-4568-b261-197834e51116/);
});

test('runDatacoreScrape writes DataCore mining clustering CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-clustering-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [
      {
        ref: '70128b72-7c50-4315-bed8-59a1c2ef7996',
        path: 'libs/foundry/records/harvestable/clusteringpresets/asteroid_lrg_med_sml.xml',
        clusteringClass: 'Asteroid_Lrg_Med_Sml',
        probabilityOfClustering: '10',
        paramIndex: '0',
        relativeProbability: '0.1',
        minSize: '4',
        maxSize: '5',
        minProximity: '5',
        maxProximity: '15',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-clustering.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningClusteringResult.rows, 1);
  assert.equal(result.miningClusteringResult.csvFile, 'mining-clustering.datacore.csv');
  assert.match(
    csv,
    /^Clustering Class,Probability Of Clustering,Param Index,Relative Probability,Min Size,Max Size,Min Proximity,Max Proximity,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Asteroid_Lrg_Med_Sml,10,0,0\.1,4,5,5,15/);
});

test('runDatacoreScrape writes DataCore mining harvestable preset CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-harvestable-presets-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [
      {
        ref: 'b4dbb414-4946-437a-870b-0df49007603b',
        path: 'libs/foundry/records/harvestable/harvestablepresets/fpsmining_aphorite.xml',
        harvestablePresetClass: 'FPSMining_Aphorite',
        harvestableEntityGuid: 'ac63f486-e582-473c-b08b-57e446092af0',
        harvestableEntityClass: 'AphoriteMineableRockFPS',
        harvestableEntityPath: 'libs/foundry/records/entities/mineable/aphoritemineablerockfps.xml',
        respawnInSlotTime: '3600',
        specialHarvestableString: '',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-harvestable-presets.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningHarvestablePresetResult.rows, 1);
  assert.equal(result.miningHarvestablePresetResult.csvFile, 'mining-harvestable-presets.datacore.csv');
  assert.match(
    csv,
    /^Harvestable Preset Class,Harvestable Entity GUID,Harvestable Entity Class,Harvestable Entity Path,Respawn In Slot Time,Special Harvestable String,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /FPSMining_Aphorite,ac63f486-e582-473c-b08b-57e446092af0,AphoriteMineableRockFPS/);
});

test('runDatacoreScrape writes DataCore mining harvestable setup CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-harvestable-setups-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [
      {
        ref: '0aa9921e-8de0-487e-bc87-1d457c56d74f',
        path: 'libs/foundry/records/harvestable/harvestablesetups/mineablerockharvestablesetup.xml',
        setupClass: 'MineableRockHarvestableSetup',
        respawnInSlotTime: '3600',
        specialHarvestableString: '',
        harvestConditionTypes: 'HarvestConditionHealth',
        healthRatio: '0',
        includeAttachedChildren: '',
        allInteractionsClearSpawnPoint: '',
        movementDistance: '',
        despawnTimeSeconds: '600',
        additionalWaitForNearbyPlayersSeconds: '300',
        minScale: '1',
        maxScale: '1',
        terrainNormalAlignment: '1',
        minZOffset: '0',
        maxZOffset: '0',
        minSlope: '0',
        maxSlope: '90',
        minElevation: '-10000',
        maxElevation: '10000',
        localRotationOffset: '0,0,0',
        rotationRange: '0,0,360',
        positionOffset: '0,0,0',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-harvestable-setups.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningHarvestableSetupResult.rows, 1);
  assert.equal(result.miningHarvestableSetupResult.csvFile, 'mining-harvestable-setups.datacore.csv');
  assert.match(
    csv,
    /^Setup Class,Respawn In Slot Time,Special Harvestable String,Harvest Condition Types,Health Ratio,Include Attached Children,All Interactions Clear Spawn Point,Movement Distance,Despawn Time Seconds,Additional Wait For Nearby Players Seconds,Min Scale,Max Scale,Terrain Normal Alignment,Min Z Offset,Max Z Offset,Min Slope,Max Slope,Min Elevation,Max Elevation,Local Rotation Offset,Rotation Range,Position Offset,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /MineableRockHarvestableSetup,3600,,HarvestConditionHealth,0/);
});

test('runDatacoreScrape writes DataCore mining sub-harvestable config CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-sub-harvestable-configs-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [
      {
        ref: '22222222-2222-2222-2222-222222222222',
        path: 'libs/foundry/records/harvestable/slotpresets/cave_prison_harvestables.xml',
        configClass: 'Cave_Prison_Harvestables',
        configType: 'multi-manual',
        taggedConfigName: 'FPS mineables',
        tagGuids: '4ae42675-463a-47fc-a90a-069b05796920',
        initialSlotsProbability: '0.7',
        configRespawnTimeMultiplier: '1',
        slotIndex: '0',
        harvestableGuid: 'b4dbb414-4946-437a-870b-0df49007603b',
        harvestableClass: 'FPSMining_Aphorite',
        harvestablePath: 'libs/foundry/records/harvestable/harvestablepresets/fpsmining_aphorite.xml',
        harvestableEntityGuid: 'ac63f486-e582-473c-b08b-57e446092af0',
        harvestableEntityClass: 'AphoriteMineableRockFPS',
        harvestableEntityPath: 'libs/foundry/records/entities/mineable/aphoritemineablerockfps.xml',
        harvestableSetupGuid: '0aa9921e-8de0-487e-bc87-1d457c56d74f',
        harvestableSetupClass: 'MineableRockHarvestableSetup',
        relativeProbability: '0.4',
        deepestRelativeProbability: '',
        harvestableRespawnTimeMultiplier: '1',
        geometryTags: '9c6ef328-5118-4882-9ad4-2f391322af21',
        referencedConfigGuid: '',
        referencedConfigClass: '',
        referencedConfigPath: '',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-sub-harvestable-configs.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningSubHarvestableConfigResult.rows, 1);
  assert.equal(result.miningSubHarvestableConfigResult.csvFile, 'mining-sub-harvestable-configs.datacore.csv');
  assert.match(
    csv,
    /^Config Class,Config Type,Tagged Config Name,Tag GUIDs,Initial Slots Probability,Config Respawn Time Multiplier,Slot Index,Harvestable GUID,Harvestable Class,Harvestable Path,Harvestable Entity GUID,Harvestable Entity Class,Harvestable Entity Path,Harvestable Setup GUID,Harvestable Setup Class,Relative Probability,Deepest Relative Probability,Harvestable Respawn Time Multiplier,Geometry Tags,Referenced Config GUID,Referenced Config Class,Referenced Config Path,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Cave_Prison_Harvestables,multi-manual,FPS mineables/);
});

test('runDatacoreScrape writes DataCore mining quality distribution CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-quality-distributions-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [],
    extractMiningQualityDistributions: async () => [
      {
        ref: '6b3f9232-d6f7-4ce9-8c30-f21aab55f073',
        path: 'libs/foundry/records/crafting/qualitydistribution/shipmineables/commonshipmineable_qualityoverride_pyro.xml',
        distributionClass: 'CommonShipMineable_QualityOverride_Pyro',
        distributionType: 'location-override',
        mineableFamily: 'shipmineables',
        locationGuid: '286cb603-b4ae-4279-80a1-d4505fee1916',
        locationClass: 'PyroSolarSystem',
        locationPath: 'libs/foundry/records/starmap/pu/pyrosolarsystem.xml',
        minQuality: '501',
        maxQuality: '1000',
        mean: '104',
        stddev: '214',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-quality-distributions.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningQualityDistributionResult.rows, 1);
  assert.equal(result.miningQualityDistributionResult.csvFile, 'mining-quality-distributions.datacore.csv');
  assert.match(
    csv,
    /^Distribution Class,Distribution Type,Mineable Family,Location GUID,Location Class,Location Path,Min Quality,Max Quality,Mean,Stddev,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /CommonShipMineable_QualityOverride_Pyro,location-override,shipmineables/);
});

test('runDatacoreScrape writes DataCore mining location label CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-location-labels-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [],
    extractMiningQualityDistributions: async () => [],
    extractMiningLocationLabels: async () => [
      {
        ref: '544034db-6fde-44b4-aba8-c2ea35421ccd',
        path: 'libs/foundry/records/starmap/pu/asteroidcluster_miningbase_pyro_regiona_medium_01.xml',
        locationClass: 'AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01',
        sourceReason: 'class-or-path-mining',
        nameKey: 'ab_mine_pyro_regiona_med_001',
        descriptionKey: 'ab_mine_pyro_desc',
        callout1Key: 'LOC_UNINITIALIZED',
        callout2Key: '',
        callout3Key: '',
        typeGuid: 'e60452a5-b85c-4ab1-97e7-9cefb466f87b',
        parentGuid: 'a14bec87-5801-4440-8ca8-35597487ac9a',
        parentClass: 'PyroAsteroidBelt',
        parentPath: 'libs/foundry/records/starmap/pu/pyroasteroidbelt.xml',
        locationHierarchyTag: '812520ca-5f0a-4e88-9649-91237b1e4e51',
        navIcon: 'Default',
        size: '400',
        hideInStarmap: '0',
        hideInWorld: '0',
        isScannable: '0',
        blockTravel: '0',
        arrivalRadius: '18000',
        adoptionRadius: '20000',
        setEntityLocationOnEnter: '1',
        exposeForPlayerCreatedMissions: '0',
      },
    ],
    extractMiningParams: async () => [],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-location-labels.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningLocationLabelResult.rows, 1);
  assert.equal(result.miningLocationLabelResult.csvFile, 'mining-location-labels.datacore.csv');
  assert.match(
    csv,
    /^Location Class,Source Reason,Name Key,Description Key,Callout 1 Key,Callout 2 Key,Callout 3 Key,Type GUID,Parent GUID,Parent Class,Parent Path,Location Hierarchy Tag,Nav Icon,Size,Hide In Starmap,Hide In World,Is Scannable,Block Travel,Arrival Radius,Adoption Radius,Set Entity Location On Enter,Expose For Player Created Missions,Record GUID,Record Path\r?\n/,
  );
  assert.match(
    csv,
    /AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01,class-or-path-mining,ab_mine_pyro_regiona_med_001/,
  );
});

test('runDatacoreScrape writes DataCore mining param CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-params-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningParams: async () => [
      miningParamRow({
        ref: 'aa727a56-9937-4eb5-80c6-51b418d43177',
        path: 'libs/foundry/records/mining/miningglobalparamsship.xml',
        paramType: 'MiningGlobalParams',
        paramClass: 'MiningGlobalParamsShip',
        powerCapacityPerMass: '10',
        decayPerMass: '0.2',
        optimalWindowSize: '0.1',
        mineablePowerLevelRtpc: 'Mineable_Rock_Power_Level',
        clusterDetectionRadius: '10',
      }),
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.0-live', 'mining-params.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningParamResult.rows, 1);
  assert.equal(result.miningParamResult.csvFile, 'mining-params.datacore.csv');
  assert.match(
    csv,
    /^Param Type,Param Class,Highlight Occluded Alpha,Highlight Outline Width,Highlight Distant Mineables Range,Show Child Rock Radar Icon,Scale Power Graph Min,No Progress Hint Time,No Progress Hint Power,Fracture Done Feedback Duration,Max Scan Raycast Distance,Highlight Color,Highlight Color Absorbable,Highlight Color Distant,Highlight Color Distant Scanned,Camera Shake Enabled,Camera Shake Time Period,Camera Shake Frequency Noise Factor,Camera Shake Translation Noise,Camera Shake Rotation Noise,Camera Shake Max Under Optimal Window,Camera Shake In Optimal Window,Camera Shake Min In Danger Window,Camera Shake Change Lerp Speed,Camera Shake Offset Position,Camera Shake Offset Angle,Block Throttle Change When Not Firing,Throttle Reset On Stop Fire,Throttle Change Per Action,Throttle Acc Period,Throttle Acc Factor,Throttle Hold Acc Factor,Throttle RTPC,Power Capacity Per Mass,Decay Per Mass,Optimal Window Size,Optimal Window Factor,Resistance Curve Factor,Optimal Window Thinness Curve Factor,Optimal Window Max Size,Controlled Breaking Fill Rate,Controlled Breaking Fill Rate Danger,Controlled Breaking Decay Rate,Danger Breaking Fill Rate,Danger Breaking Fill Rate Exponent,Danger Breaking Decay Rate,Absorbable Volume Threshold,Child Rock Invulnerability Time,CSCU Per Volume,Default Mass,Modifier Persistence Time,Child Rock Life Timer,Child Rock Zero G Damping,Terrain Factor Static Threshold,Show Explosion FX For Surplus Child,Child Rock Inactivity Lifetime,Gadget Detach Threshold,Gadget Destroy Threshold,Danger To Gadget Damage,Waste Resource Type,Instability Wave Period,Instability Wave Variance,Instability Curve Factor,Danger Pool Factor,Explosion Default Volume,Hit History Window,Standard Deviation Multiplier,Time Exponent,Min Deviation,Extraction Magnitude,Max Effect On Instability,Fracture Particle Effect,Explosion Particle Effect,Center Rock Destroy Particle Effect,Fully Extracted Rock Particle Effect,Mineable Power Increasing Fall Off,Mineable Power Level RTPC,Mineable Danger Breaking RTPC,Mineable Optimal Breaking RTPC,Mineable Mass RTPC,Mineable Crack Glow Strength RTPC,Mining Start Trigger,Mining Stop Trigger,Good Fractured Trigger,Bad Fractured Trigger,Extracted Trigger,Cluster Detection Radius,Cluster Upper Object Count DGS,Cluster Upper Object Count Persistence,Cluster Persistence Timeout,Reset Lifetime On Move,Entity Idle Bury Only,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /MiningGlobalParams,MiningGlobalParamsShip,+10,0\.2,0\.1/);
});

test('runDatacoreScrape reports whether force extract will clear an existing cache', async () => {
  let clearExistingValue: boolean | undefined;

  await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    forceExtract: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.0',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 7,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, true);
      return { workDcbPath: 'cache/Game.dcb', monolithicXmlPath: 'cache/Game.xml', xmlFileCount: 123 };
    },
    onCacheExtractStart: (_dcbPath, _xmlCacheDir, clearExisting) => {
      clearExistingValue = clearExisting;
    },
  });

  assert.equal(clearExistingValue, true);
});

test('runDatacoreScrape reports unknown requested types before touching local game state', async () => {
  let resolvedLiveDir = false;

  await assert.rejects(
    () =>
      runDatacoreScrape({
        repoRoot: 'repo',
        types: ['unknown'],
        loadTypes: async () => [typeEntry],
        resolveLiveDir: () => {
          resolvedLiveDir = true;
          return 'C:/Games/StarCitizen/LIVE';
        },
      }),
    /Unknown item type: "unknown"/,
  );

  assert.equal(resolvedLiveDir, false);
});

function miningParamRow(overrides: Partial<DataCoreMiningParamRecord>): DataCoreMiningParamRecord {
  return {
    ref: '',
    path: '',
    paramType: '',
    paramClass: '',
    highlightOccludedAlpha: '',
    highlightOutlineWidth: '',
    highlightDistantMineablesRange: '',
    showChildRockRadarIcon: '',
    scalePowerGraphMin: '',
    noProgressHintTime: '',
    noProgressHintPower: '',
    fractureDoneFeedbackDuration: '',
    maxScanRaycastDistance: '',
    highlightColor: '',
    highlightColorAbsorbable: '',
    highlightColorDistant: '',
    highlightColorDistantScanned: '',
    cameraShakeEnabled: '',
    cameraShakeTimePeriod: '',
    cameraShakeFrequencyNoiseFactor: '',
    cameraShakeTranslationNoise: '',
    cameraShakeRotationNoise: '',
    cameraShakeMaxUnderOptimalWindow: '',
    cameraShakeInOptimalWindow: '',
    cameraShakeMinInDangerWindow: '',
    cameraShakeChangeLerpSpeed: '',
    cameraShakeOffsetPosition: '',
    cameraShakeOffsetAngle: '',
    blockThrottleChangeWhenNotFiring: '',
    throttleResetOnStopFire: '',
    throttleChangePerAction: '',
    throttleAccPeriod: '',
    throttleAccFactor: '',
    throttleHoldAccFactor: '',
    throttleRtpc: '',
    powerCapacityPerMass: '',
    decayPerMass: '',
    optimalWindowSize: '',
    optimalWindowFactor: '',
    resistanceCurveFactor: '',
    optimalWindowThinnessCurveFactor: '',
    optimalWindowMaxSize: '',
    controlledBreakingFillRate: '',
    controlledBreakingFillRateDanger: '',
    controlledBreakingDecayRate: '',
    dangerBreakingFillRate: '',
    dangerBreakingFillRateExponent: '',
    dangerBreakingDecayRate: '',
    absorbableVolumeThreshold: '',
    childRockInvulnerabilityTime: '',
    cSCUPerVolume: '',
    defaultMass: '',
    modifierPersistenceTime: '',
    childRockLifeTimer: '',
    childRockZeroGDamping: '',
    terrainFactorStaticThreshold: '',
    showExplosionFXForSurplusChild: '',
    childRockInactivityLifetime: '',
    gadgetDetachThreshold: '',
    gadgetDestroyThreshold: '',
    dangerToGadgetDamage: '',
    wasteResourceType: '',
    instabilityWavePeriod: '',
    instabilityWaveVariance: '',
    instabilityCurveFactor: '',
    dangerPoolFactor: '',
    explosionDefaultVolume: '',
    hitHistoryWindow: '',
    standardDeviationMultiplier: '',
    timeExponent: '',
    minDeviation: '',
    extractionMagnitude: '',
    maxEffectOnInstability: '',
    fractureParticleEffect: '',
    explosionParticleEffect: '',
    centerRockDestroyParticleEffect: '',
    fullyExtractedRockParticleEffect: '',
    mineablePowerIncreasingFallOff: '',
    mineablePowerLevelRtpc: '',
    mineableDangerBreakingRtpc: '',
    mineableOptimalBreakingRtpc: '',
    mineableMassRtpc: '',
    mineableCrackGlowStrengthRtpc: '',
    miningStartTrigger: '',
    miningStopTrigger: '',
    goodFracturedTrigger: '',
    badFracturedTrigger: '',
    extractedTrigger: '',
    clusterDetectionRadius: '',
    clusterUpperObjectCountDGS: '',
    clusterUpperObjectCountPersistence: '',
    clusterPersistenceTimeout: '',
    resetLifetimeOnMove: '',
    entityIdleBuryOnly: '',
    ...overrides,
  };
}
