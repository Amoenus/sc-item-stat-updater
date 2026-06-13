import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';

const DATACORE_MINING_PROVIDER_PRESETS_CSV = 'mining-provider-presets.datacore.csv';
const DATACORE_MINING_COMPOSITIONS_CSV = 'mining-compositions.datacore.csv';
const DATACORE_MINING_LOCATION_LABELS_CSV = 'mining-location-labels.datacore.csv';
const DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV = 'mining-quality-distributions.datacore.csv';
const DATACORE_MINEABLE_ENTITIES_CSV = 'mineable-entities.datacore.csv';
const DATACORE_MINING_DENSITY_OVERRIDES_CSV = 'mining-density-overrides.datacore.csv';
const DATACORE_MINING_CLUSTERING_CSV = 'mining-clustering.datacore.csv';
const DATACORE_MINING_HARVESTABLE_PRESETS_CSV = 'mining-harvestable-presets.datacore.csv';
const DATACORE_MINING_HARVESTABLE_SETUPS_CSV = 'mining-harvestable-setups.datacore.csv';
const DATACORE_MINING_SUB_HARVESTABLE_CONFIGS_CSV = 'mining-sub-harvestable-configs.datacore.csv';
const DATACORE_MINING_PARAMS_CSV = 'mining-params.datacore.csv';
const POTENTIAL_SECTION_MARKER = String.raw`\n\nPotential `;
const QUALITY_NOTES_MARKER = String.raw`\n\nQuality Notes:`;
const INI_NEWLINE = String.raw`\n`;
const logger = getLogger('mining-locations-config');

const DATACORE_LOCATION_NAMES: Record<string, string> = {
  hpp_stanton1: 'Hurston',
  hpp_stanton1a: 'Arial',
  hpp_stanton1b: 'Aberdeen',
  hpp_stanton1c: 'Magda',
  hpp_stanton1d: 'Ita',
  hpp_stanton2a: 'Cellin',
  hpp_stanton2b: 'Daymar',
  hpp_stanton2c: 'Yela',
  hpp_stanton2c_belt: 'Yela Asteroid Belt',
  hpp_stanton3a: 'Lyria',
  hpp_stanton3b: 'Wala',
  hpp_stanton4: 'microTech',
  hpp_stanton4a: 'Clio',
  hpp_stanton4b: 'Euterpe',
  hpp_stanton4c: 'Calliope',
  hpp_pyro1: 'Pyro I',
  hpp_pyro2: 'Pyro II (Monox)',
  hpp_pyro3: 'Pyro III (Bloom)',
  hpp_pyro4: 'Pyro IV',
  hpp_pyro5a: 'Pyro V-a (Ignis)',
  hpp_pyro5b: 'Pyro V-b (Vatra)',
  hpp_pyro5c: 'Pyro V-c (Adir)',
  hpp_pyro5d: 'Pyro V-d (Fairo)',
  hpp_pyro5e: 'Pyro V-e (Fuego)',
  hpp_pyro5f: 'Pyro V-f (Vuur)',
  hpp_pyro6: 'Pyro VI (Terminus)',
  asteroidcluster_low_yield: 'Asteroid Cluster (Low Yield)',
  asteroidcluster_medium_yield: 'Asteroid Cluster (Medium Yield)',
  hpp_aaronhalo: 'Aaron Halo',
  hpp_lagrange_occupied: 'Lagrange (Occupied)',
  hpp_nyx_glaciemring: 'Glaciem Ring',
  hpp_nyx_keegerbelt: 'Keeger Belt',
  hpp_pyro_akirocluster: 'Akiro Cluster',
  hpp_pyro_cool01: 'Pyro Belt (Cool 1)',
  hpp_pyro_cool02: 'Pyro Belt (Cool 2)',
  hpp_pyro_deepspaceasteroids: 'Pyro Deep Space Asteroids',
  hpp_pyro_warm01: 'Pyro Belt (Warm 1)',
  hpp_pyro_warm02: 'Pyro Belt (Warm 2)',
};

// Roman numeral -> digit substitution (longest match first to avoid partial replacements)
const ROMAN_MAP: Record<string, string> = { VIII: '8', VII: '7', VI: '6', IV: '4', V: '5', III: '3', II: '2', I: '1' };
const ROMAN_RE = /\b(VIII|VII|VI|IV|V|III|II|I)\b/g;
type MiningType = 'ship' | 'hand' | 'ground';
type LocationWeights = Record<MiningType, Record<string, number>>;

const SPECIAL_DATACORE_SITE_POOLS = [
  {
    locationName: 'Breaker Stations Interior',
    miningType: 'hand' as const,
    configClass: 'V3SlotPreset_RockCracker',
    taggedConfigNames: new Set(['Aphorite minable', 'Sadaryx minable']),
    explicitElementWeights: new Map([
      ['Aphorite', 3],
      ['Sadaryx', 1],
    ]),
    qualityClassTerms: ['rockcracker'],
  },
  {
    locationName: 'Breaker Stations Large Geode',
    miningType: 'ship' as const,
    configClass: 'V3SlotPreset_Harvestable_RockCracker_Asteroid',
    entityClassPattern: /savrilium/i,
    collapsedElementName: 'Savrilium (Ore)',
    qualityClassTerms: ['rockcracker'],
  },
  {
    locationName: 'Hathor Caves',
    miningType: 'hand' as const,
    configClass: 'Loot_Caves_Unoccupied_Sand_Stanton_Orbageddon',
    taggedConfigNames: new Set(['FPS mineables']),
  },
  {
    locationName: 'Hathor Caves',
    miningType: 'ground' as const,
    configClass: 'Loot_Caves_Unoccupied_Sand_Stanton_Orbageddon',
    taggedConfigNames: new Set(['Ground mineables']),
  },
] satisfies SpecialDatacoreSitePool[];

interface SpecialDatacoreSitePool {
  locationName: string;
  miningType: MiningType;
  configClass: string;
  taggedConfigNames?: Set<string>;
  entityClassPattern?: RegExp;
  collapsedElementName?: string;
  explicitElementWeights?: Map<string, number>;
  qualityClassTerms?: string[];
}

export interface MiningLocationCoverageDiagnostics {
  datacoreLocations: number;
  scmdbLocations: number;
  datacoreLocationLabelRows: number;
  datacoreLocationsWithLabelKeys: number;
  datacoreLocationsWithQualityNotes: number;
  datacoreLocationsWithEntityFacts: number;
  datacoreLocationsWithDensityOverrideFacts: number;
  datacoreLocationsWithClusteringFacts: number;
  datacoreLocationsWithHarvestablePresetFacts: number;
  datacoreLocationsWithSetupFacts: number;
  datacoreLocationsWithSubHarvestableFacts: number;
  datacoreLocationsWithParamFacts: number;
  common: number;
  datacoreOnly: string[];
  scmdbOnly: string[];
}

export function compareMiningLocationCoverage(
  datacoreRows: Record<string, string>[],
  scmdbRows: Record<string, string>[],
): MiningLocationCoverageDiagnostics {
  const datacoreLocations = new Set(datacoreRows.map((row) => row['Location Name']).filter(Boolean));
  const scmdbLocations = new Set(scmdbRows.map((row) => row['Location Name']).filter(Boolean));
  const common = [...datacoreLocations].filter((name) => scmdbLocations.has(name));

  return {
    datacoreLocations: datacoreLocations.size,
    scmdbLocations: scmdbLocations.size,
    datacoreLocationLabelRows: datacoreRows.filter((row) => row['DataCore Location Label Source']).length,
    datacoreLocationsWithLabelKeys: datacoreRows.filter(
      (row) => row['DataCore Location Name Keys'] || row['DataCore Location Description Keys'],
    ).length,
    datacoreLocationsWithQualityNotes: datacoreRows.filter((row) => row['DataCore Quality Source']).length,
    datacoreLocationsWithEntityFacts: datacoreRows.filter((row) => row['DataCore Mineable Entity Classes']).length,
    datacoreLocationsWithDensityOverrideFacts: datacoreRows.filter((row) => row['DataCore Density Override Summary'])
      .length,
    datacoreLocationsWithClusteringFacts: datacoreRows.filter((row) => row['DataCore Clustering Summary']).length,
    datacoreLocationsWithHarvestablePresetFacts: datacoreRows.filter(
      (row) => row['DataCore Harvestable Preset Summary'],
    ).length,
    datacoreLocationsWithSetupFacts: datacoreRows.filter((row) => row['DataCore Setup Summary']).length,
    datacoreLocationsWithSubHarvestableFacts: datacoreRows.filter((row) => row['DataCore Sub-Harvestable Summary'])
      .length,
    datacoreLocationsWithParamFacts: datacoreRows.filter(
      (row) =>
        row['DataCore Global Param Summary'] ||
        row['DataCore Audio Param Summary'] ||
        row['DataCore Density Param Summary'],
    ).length,
    common: common.length,
    datacoreOnly: [...datacoreLocations].filter((name) => !scmdbLocations.has(name)).sort((a, b) => a.localeCompare(b)),
    scmdbOnly: [...scmdbLocations].filter((name) => !datacoreLocations.has(name)).sort((a, b) => a.localeCompare(b)),
  };
}

export function buildMiningLocationRowsFromSources(
  datacoreProviderRows: Record<string, string>[],
  datacoreCompositionRows: Record<string, string>[],
  datacoreLocationLabelRows: Record<string, string>[] = [],
  datacoreQualityDistributionRows: Record<string, string>[] = [],
  datacoreMineableEntityRows: Record<string, string>[] = [],
  datacoreDensityOverrideRows: Record<string, string>[] = [],
  datacoreClusteringRows: Record<string, string>[] = [],
  datacoreHarvestablePresetRows: Record<string, string>[] = [],
  datacoreHarvestableSetupRows: Record<string, string>[] = [],
  datacoreSubHarvestableConfigRows: Record<string, string>[] = [],
  datacoreParamRows: Record<string, string>[] = [],
): Record<string, string>[] {
  const datacoreRows = buildDatacoreMiningLocationRows(
    datacoreProviderRows,
    datacoreCompositionRows,
    datacoreLocationLabelRows,
    datacoreQualityDistributionRows,
    datacoreMineableEntityRows,
    datacoreDensityOverrideRows,
    datacoreClusteringRows,
    datacoreHarvestablePresetRows,
    datacoreHarvestableSetupRows,
    datacoreSubHarvestableConfigRows,
    datacoreParamRows,
  );
  const mergedRows: Record<string, string>[] = [...datacoreRows];
  return mergedRows.sort((a, b) => (a['Location Name'] || '').localeCompare(b['Location Name'] || ''));
}

async function loadMiningLocationSourceData(context: ItemSourceDataContext): Promise<Record<string, string>[]> {
  const [
    datacoreProviderRows,
    datacoreCompositionRows,
    datacoreLocationLabelRows,
    datacoreQualityDistributionRows,
    datacoreMineableEntityRows,
    datacoreDensityOverrideRows,
    datacoreClusteringRows,
    datacoreHarvestablePresetRows,
    datacoreHarvestableSetupRows,
    datacoreSubHarvestableConfigRows,
    datacoreParamRows,
  ] = await Promise.all([
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_PROVIDER_PRESETS_CSV,
      'DataCore mining provider presets',
    ),
    loadDatacoreCsv(context.sourceDirs?.datacore, DATACORE_MINING_COMPOSITIONS_CSV, 'DataCore mining compositions'),
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_LOCATION_LABELS_CSV,
      'DataCore mining location labels',
    ),
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV,
      'DataCore mining quality distributions',
    ),
    loadDatacoreCsv(context.sourceDirs?.datacore, DATACORE_MINEABLE_ENTITIES_CSV, 'DataCore mineable entities'),
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_DENSITY_OVERRIDES_CSV,
      'DataCore mining density overrides',
    ),
    loadDatacoreCsv(context.sourceDirs?.datacore, DATACORE_MINING_CLUSTERING_CSV, 'DataCore mining clustering'),
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_HARVESTABLE_PRESETS_CSV,
      'DataCore mining harvestable presets',
    ),
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_HARVESTABLE_SETUPS_CSV,
      'DataCore mining harvestable setups',
    ),
    loadDatacoreCsv(
      context.sourceDirs?.datacore,
      DATACORE_MINING_SUB_HARVESTABLE_CONFIGS_CSV,
      'DataCore mining sub-harvestable configs',
    ),
    loadDatacoreCsv(context.sourceDirs?.datacore, DATACORE_MINING_PARAMS_CSV, 'DataCore mining params'),
  ]);
  const rows = buildMiningLocationRowsFromSources(
    datacoreProviderRows,
    datacoreCompositionRows,
    datacoreLocationLabelRows,
    datacoreQualityDistributionRows,
    datacoreMineableEntityRows,
    datacoreDensityOverrideRows,
    datacoreClusteringRows,
    datacoreHarvestablePresetRows,
    datacoreHarvestableSetupRows,
    datacoreSubHarvestableConfigRows,
    datacoreParamRows,
  );

  logger.info('Mining location source coverage', {
    datacoreLocations: rows.length,
    datacoreLocationLabelRows: rows.filter((row) => row['DataCore Location Label Source']).length,
    datacoreLocationsWithLabelKeys: rows.filter(
      (row) => row['DataCore Location Name Keys'] || row['DataCore Location Description Keys'],
    ).length,
    datacoreLocationsWithQualityNotes: rows.filter((row) => row['DataCore Quality Source']).length,
    datacoreLocationsWithEntityFacts: rows.filter((row) => row['DataCore Mineable Entity Classes']).length,
    datacoreLocationsWithDensityOverrideFacts: rows.filter((row) => row['DataCore Density Override Summary']).length,
    datacoreLocationsWithClusteringFacts: rows.filter((row) => row['DataCore Clustering Summary']).length,
    datacoreLocationsWithHarvestablePresetFacts: rows.filter((row) => row['DataCore Harvestable Preset Summary'])
      .length,
    datacoreLocationsWithSetupFacts: rows.filter((row) => row['DataCore Setup Summary']).length,
    datacoreLocationsWithSubHarvestableFacts: rows.filter((row) => row['DataCore Sub-Harvestable Summary']).length,
    datacoreLocationsWithParamFacts: rows.filter(
      (row) =>
        row['DataCore Global Param Summary'] ||
        row['DataCore Audio Param Summary'] ||
        row['DataCore Density Param Summary'],
    ).length,
  });

  return rows;
}

async function loadDatacoreCsv(
  datacoreDir: string | undefined,
  csvFile: string,
  label: string,
): Promise<Record<string, string>[]> {
  if (!datacoreDir) return [];

  try {
    return await readCsvFile(resolveChildPath(datacoreDir, csvFile, `${label} CSV filename`));
  } catch (err) {
    if (isFileNotFound(err)) {
      logger.warn(`${label} CSV missing; mining location rows may omit related DataCore facts`, {
        datacoreDir,
        csvFile,
      });
      return [];
    }
    throw err;
  }
}

function buildDatacoreMiningLocationRows(
  providerRows: Record<string, string>[],
  compositionRows: Record<string, string>[],
  locationLabelRows: Record<string, string>[],
  qualityDistributionRows: Record<string, string>[],
  mineableEntityRows: Record<string, string>[],
  densityOverrideRows: Record<string, string>[],
  clusteringRows: Record<string, string>[],
  harvestablePresetRows: Record<string, string>[],
  harvestableSetupRows: Record<string, string>[],
  subHarvestableConfigRows: Record<string, string>[],
  paramRows: Record<string, string>[],
): Record<string, string>[] {
  const compositionNames = buildCompositionNameLookup(compositionRows);
  const mineableEntitiesByGuid = new Map(
    mineableEntityRows.flatMap((row) => (row['Record GUID'] ? [[row['Record GUID'], row]] : [])),
  );
  const mineableEntitiesByClass = new Map(mineableEntityRows.map((row) => [row['Entity Class'], row]));
  const densityOverrideSummaries = buildDensityOverrideSummaryMap(densityOverrideRows);
  const clusteringSummaries = buildClusteringSummaryMap(clusteringRows);
  const harvestablePresetSummaries = buildHarvestablePresetSummaryMap(harvestablePresetRows);
  const setupSummaries = buildSetupSummaryMap(harvestableSetupRows);
  const subHarvestableSummaries = buildSubHarvestableSummaryMap(subHarvestableConfigRows);
  const paramSummaries = buildParamSummaryMaps(paramRows);
  const factsByLocation = new Map<
    string,
    {
      weights: LocationWeights;
      locationNameKeys: Set<string>;
      locationDescriptionKeys: Set<string>;
      locationSlugs: Set<string>;
      labelSources: Set<string>;
      qualityRows: Map<string, Record<string, string>>;
      mineableEntityClasses: Set<string>;
      densityClasses: Set<string>;
      densityOverrideSummaries: Map<string, string>;
      filledFactors: Set<string>;
      clusteringSummaries: Map<string, string>;
      harvestablePresetSummaries: Map<string, string>;
      setupSummaries: Map<string, string>;
      subHarvestableSummaries: Map<string, string>;
      globalParamSummaries: Map<string, string>;
      audioParamSummaries: Map<string, string>;
      densityParamSummaries: Map<string, string>;
    }
  >();
  const getFacts = (locationName: string) => {
    let facts = factsByLocation.get(locationName);
    if (!facts) {
      facts = {
        weights: { ship: {}, hand: {}, ground: {} },
        locationNameKeys: new Set(),
        locationDescriptionKeys: new Set(),
        locationSlugs: new Set(),
        labelSources: new Set(),
        qualityRows: new Map(),
        mineableEntityClasses: new Set(),
        densityClasses: new Set(),
        densityOverrideSummaries: new Map(),
        filledFactors: new Set(),
        clusteringSummaries: new Map(),
        harvestablePresetSummaries: new Map(),
        setupSummaries: new Map(),
        subHarvestableSummaries: new Map(),
        globalParamSummaries: new Map(),
        audioParamSummaries: new Map(),
        densityParamSummaries: new Map(),
      };
      factsByLocation.set(locationName, facts);
    }
    return facts;
  };

  for (const row of providerRows) {
    const locationName = toDisplayLocationName(row);
    const locationSlug = toProviderLocationSlug(row);
    const miningType = classifyMiningGroup(row['Group Name'] || '');
    const compositionName =
      compositionNames.byGuid.get(row['Composition GUID']) ??
      compositionNames.byClass.get(row['Composition Class']) ??
      cleanCompositionClass(row['Composition Class']);
    if (!locationName || !miningType || !compositionName) continue;

    const facts = getFacts(locationName);
    addIfPresent(facts.locationSlugs, locationSlug);
    facts.weights[miningType][compositionName] =
      (facts.weights[miningType][compositionName] ?? 0) +
      parseWeight(row['Group Probability'], 1) * parseWeight(row['Relative Probability'], 1);

    for (const labelRow of relatedLocationLabelRows(row, locationLabelRows)) {
      if (labelRow['Name Key']) facts.locationNameKeys.add(labelRow['Name Key']);
      if (labelRow['Description Key'] && labelRow['Description Key'] !== 'LOC_UNINITIALIZED') {
        facts.locationDescriptionKeys.add(labelRow['Description Key']);
      }
      for (const sourceReason of (labelRow['Source Reason'] || '').split(';')) {
        if (sourceReason) facts.labelSources.add(sourceReason);
      }
    }

    for (const qualityRow of relatedQualityDistributionRows(row, qualityDistributionRows)) {
      const family = qualityRow['Mineable Family'] || qualityRow.mineableFamily;
      if (family) facts.qualityRows.set(family, qualityRow);
    }

    const mineableEntity =
      mineableEntitiesByGuid.get(row['Harvestable Entity GUID']) ??
      mineableEntitiesByClass.get(row['Harvestable Entity Class']);
    addIfPresent(facts.filledFactors, row['Filled Factor']);
    addIfPresent(facts.mineableEntityClasses, mineableEntity?.['Entity Class'] ?? row['Harvestable Entity Class']);

    const densityClassGuid = mineableEntity?.['Density Class GUID'];
    const densityClass = mineableEntity?.['Density Class'];
    addIfPresent(facts.densityClasses, densityClass);

    const globalParamSummary = paramSummaries.byGuid.get(row['Global Params GUID']);
    if (row['Global Params GUID'] && globalParamSummary) {
      facts.globalParamSummaries.set(row['Global Params GUID'], globalParamSummary);
    }

    const audioParamSummary = paramSummaries.byGuid.get(row['Audio Params GUID']);
    if (row['Audio Params GUID'] && audioParamSummary) {
      facts.audioParamSummaries.set(row['Audio Params GUID'], audioParamSummary);
    }

    const densityParamSummary =
      (densityClassGuid ? paramSummaries.byGuid.get(densityClassGuid) : undefined) ??
      (densityClass ? paramSummaries.byClass.get(densityClass) : undefined);
    if ((densityClassGuid || densityClass) && densityParamSummary) {
      facts.densityParamSummaries.set(densityClassGuid || densityClass || '', densityParamSummary);
    }

    const densityOverrideSummary =
      (densityClassGuid ? densityOverrideSummaries.byGuid.get(densityClassGuid) : undefined) ??
      (densityClass ? densityOverrideSummaries.byClass.get(densityClass) : undefined);
    if ((densityClassGuid || densityClass) && densityOverrideSummary) {
      facts.densityOverrideSummaries.set(densityClassGuid || densityClass || '', densityOverrideSummary);
    }

    const clusteringClass = row['Clustering Class'];
    const clusteringSummary = clusteringSummaries.get(clusteringClass);
    if (clusteringClass && clusteringSummary) facts.clusteringSummaries.set(clusteringClass, clusteringSummary);

    for (const harvestableKey of [row['Harvestable Class'], row['Harvestable Entity Class']]) {
      const harvestablePresetSummary = harvestablePresetSummaries.get(harvestableKey);
      if (harvestableKey && harvestablePresetSummary) {
        facts.harvestablePresetSummaries.set(harvestableKey, harvestablePresetSummary);
      }
    }

    const setupClass = row['Harvestable Setup Class'];
    const setupSummary = setupSummaries.get(setupClass);
    if (setupClass && setupSummary) facts.setupSummaries.set(setupClass, setupSummary);

    for (const subHarvestableKey of [
      row['Harvestable Class'],
      row['Harvestable Entity Class'],
      row['Harvestable Setup Class'],
    ]) {
      const subHarvestableSummary = subHarvestableSummaries.get(subHarvestableKey);
      if (subHarvestableKey && subHarvestableSummary) {
        facts.subHarvestableSummaries.set(subHarvestableKey, subHarvestableSummary);
      }
    }
  }

  addSpecialDatacoreSitePools({
    compositionNames,
    getFacts,
    mineableEntitiesByGuid,
    mineableEntitiesByClass,
    qualityDistributionRows,
    subHarvestableConfigRows,
  });

  return [...factsByLocation.entries()]
    .map(([locationName, facts]) => {
      const datacoreQualityNote = toQualityNote(facts.qualityRows);
      return {
        'Location Name': locationName,
        'Ship Mineables': toWeightedMineableList(facts.weights.ship),
        'Hand Mineables': toWeightedMineableList(facts.weights.hand),
        'Ground Vehicle Mineables': toWeightedMineableList(facts.weights.ground),
        'Quality Note': datacoreQualityNote,
        'DataCore Location Slugs': sortedJoined(facts.locationSlugs),
        'DataCore Location Name Keys': sortedJoined(facts.locationNameKeys),
        'DataCore Location Description Keys': sortedJoined(facts.locationDescriptionKeys),
        'DataCore Location Label Source': sortedJoined(facts.labelSources),
        'DataCore Quality Source': datacoreQualityNote ? sortedJoined(new Set([...facts.qualityRows.keys()])) : '',
        'DataCore Mineable Entity Classes': sortedJoined(facts.mineableEntityClasses),
        'DataCore Density Classes': sortedJoined(facts.densityClasses),
        'DataCore Density Override Summary': sortedJoined(new Set(facts.densityOverrideSummaries.values())),
        'DataCore Filled Factors': sortedJoined(facts.filledFactors),
        'DataCore Clustering Summary': sortedJoined(new Set(facts.clusteringSummaries.values())),
        'DataCore Harvestable Preset Summary': sortedJoined(new Set(facts.harvestablePresetSummaries.values())),
        'DataCore Setup Summary': sortedJoined(new Set(facts.setupSummaries.values())),
        'DataCore Sub-Harvestable Summary': sortedJoined(new Set(facts.subHarvestableSummaries.values())),
        'DataCore Global Param Summary': sortedJoined(new Set(facts.globalParamSummaries.values())),
        'DataCore Audio Param Summary': sortedJoined(new Set(facts.audioParamSummaries.values())),
        'DataCore Density Param Summary': sortedJoined(new Set(facts.densityParamSummaries.values())),
        Source: 'DataCore',
      };
    })
    .filter((row) => row['Ship Mineables'] || row['Hand Mineables'] || row['Ground Vehicle Mineables'])
    .sort((a, b) => a['Location Name'].localeCompare(b['Location Name']));
}

function relatedLocationLabelRows(
  providerRow: Record<string, string>,
  labelRows: Record<string, string>[],
): Record<string, string>[] {
  if (labelRows.length === 0) return [];

  const providerSlug = (providerRow.Location || providerRow['Provider Class'] || '').split('/').at(-1) ?? '';
  const terms = new Set(locationLabelMatchTerms(providerSlug));
  const trimmedProviderSlug = providerSlug.replace(/^hpp[_-]/i, '');
  for (const term of locationLabelMatchTerms(trimmedProviderSlug)) terms.add(term);

  return labelRows.filter((labelRow) => {
    const haystack = [
      labelRow['Location Class'],
      labelRow['Name Key'],
      labelRow['Description Key'],
      labelRow['Parent Class'],
      labelRow['Record Path'],
    ]
      .join(' ')
      .toLowerCase();
    return [...terms].some((term) => term.length >= 4 && hasLabelToken(haystack, term));
  });
}

function addSpecialDatacoreSitePools(context: {
  compositionNames: CompositionNameLookup;
  getFacts: (locationName: string) => {
    weights: LocationWeights;
    qualityRows: Map<string, Record<string, string>>;
    mineableEntityClasses: Set<string>;
    subHarvestableSummaries: Map<string, string>;
  };
  mineableEntitiesByGuid: Map<string, Record<string, string>>;
  mineableEntitiesByClass: Map<string, Record<string, string>>;
  qualityDistributionRows: Record<string, string>[];
  subHarvestableConfigRows: Record<string, string>[];
}): void {
  const rowsByConfigClass = new Map<string, Record<string, string>[]>();
  for (const row of context.subHarvestableConfigRows) {
    const configClass = row['Config Class'];
    if (!configClass) continue;
    const rows = rowsByConfigClass.get(configClass) ?? [];
    rows.push(row);
    rowsByConfigClass.set(configClass, rows);
  }

  for (const pool of SPECIAL_DATACORE_SITE_POOLS) {
    const rows = (rowsByConfigClass.get(pool.configClass) ?? []).filter(
      (row) =>
        (!pool.taggedConfigNames || pool.taggedConfigNames.has(row['Tagged Config Name'])) &&
        (!pool.entityClassPattern ||
          pool.entityClassPattern.test(row['Harvestable Entity Class'] || row['Harvestable Class'])),
    );
    if (rows.length === 0) continue;

    const facts = context.getFacts(pool.locationName);
    const sourceClasses = new Set<string>();
    for (const row of rows) {
      const entityClass = row['Harvestable Entity Class'] || row['Harvestable Class'];
      const mineableEntity =
        context.mineableEntitiesByGuid.get(row['Harvestable Entity GUID']) ??
        context.mineableEntitiesByClass.get(entityClass);
      const compositionClass = mineableEntity?.['Composition Class'] || '';
      const elementName = normalizeSpecialMineableName(
        pool.collapsedElementName ||
          context.compositionNames.byGuid.get(mineableEntity?.['Composition GUID'] ?? '') ||
          context.compositionNames.byClass.get(compositionClass) ||
          cleanCompositionClass(compositionClass),
      );
      if (!elementName) continue;

      const weight =
        pool.explicitElementWeights?.get(elementName) ??
        parseWeight(row['Initial Slots Probability'], 1) * parseWeight(row['Relative Probability'], 1);
      facts.weights[pool.miningType][elementName] = (facts.weights[pool.miningType][elementName] ?? 0) + weight;
      addIfPresent(facts.mineableEntityClasses, mineableEntity?.['Entity Class'] ?? entityClass);
      addIfPresent(sourceClasses, row['Config Class']);
    }

    if (sourceClasses.size > 0) {
      facts.subHarvestableSummaries.set(pool.configClass, `${pool.configClass} (${[...sourceClasses].join(';')})`);
    }

    if (pool.qualityClassTerms) {
      const qualityNote = toSpecialQualityNote(context.qualityDistributionRows, pool.qualityClassTerms);
      if (qualityNote) {
        facts.qualityRows.set(`special:${pool.locationName}`, {
          'Special Quality Note': qualityNote,
        });
      }
    }
  }
}

function relatedQualityDistributionRows(
  providerRow: Record<string, string>,
  qualityRows: Record<string, string>[],
): Record<string, string>[] {
  if (qualityRows.length === 0) return [];

  const terms = new Set(locationQualityMatchTerms(providerRow));
  return qualityRows.filter((qualityRow) => {
    const distributionType = qualityRow['Distribution Type'] || qualityRow.distributionType;
    if (distributionType && distributionType !== 'location-override') return false;

    const haystack = [
      qualityRow['Location Class'],
      qualityRow.locationClass,
      qualityRow['Location Path'],
      qualityRow.locationPath,
      qualityRow['Distribution Class'],
      qualityRow.distributionClass,
    ]
      .join(' ')
      .toLowerCase();
    return [...terms].some((term) => term.length >= 4 && hasLabelToken(haystack, term));
  });
}

function locationLabelMatchTerms(providerSlug: string): string[] {
  const terms = [providerSlug.replace(/^hpp[_-]/i, '').toLowerCase()].filter(Boolean);
  const expanded = new Set(terms);

  for (const term of terms) {
    const stanton = /^stanton([1-4])([a-z])?$/i.exec(term);
    if (stanton && !stanton[2]) expanded.add(`stanton0${stanton[1]}`);
  }

  return [...expanded];
}

function locationQualityMatchTerms(providerRow: Record<string, string>): string[] {
  const providerSlug = (providerRow.Location || providerRow['Provider Class'] || '').split('/').at(-1) ?? '';
  const baseTerms = locationLabelMatchTerms(providerSlug.replace(/^hpp[_-]/i, ''));
  const expanded = new Set(baseTerms);

  for (const term of baseTerms) {
    if (term.startsWith('pyro')) expanded.add('pyro');
    if (term.startsWith('stanton')) expanded.add('stanton');
    if (term.startsWith('nyx')) expanded.add('nyx');
  }

  return [...expanded];
}

function hasLabelToken(haystack: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, 'i').test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortedJoined(values: Set<string>): string {
  return [...values].sort((a, b) => a.localeCompare(b)).join(';');
}

function addIfPresent(values: Set<string>, value: string | undefined): void {
  if (value?.trim()) values.add(value.trim());
}

function buildDensityOverrideSummaryMap(rows: Record<string, string>[]): {
  byGuid: Map<string, string>;
  byClass: Map<string, string>;
} {
  const summariesByGuid = new Map<string, string[]>();
  const summariesByClass = new Map<string, string[]>();
  for (const row of rows) {
    const densityClassGuid = row['Density Class GUID'];
    const densityClass = row['Density Class'];
    if (!densityClassGuid && !densityClass) continue;

    const lifetime = row['Lifetime Total Seconds'];
    const overrideClass = row['Override Class'];
    const label = overrideClass || densityClass || densityClassGuid;
    const normalized = lifetime ? `${label} (lifetime ${lifetime}s)` : label;
    addSummary(summariesByGuid, densityClassGuid, normalized);
    addSummary(summariesByClass, densityClass, normalized);
  }

  return {
    byGuid: flattenSummaryMap(summariesByGuid),
    byClass: flattenSummaryMap(summariesByClass),
  };
}

function addSummary(summaries: Map<string, string[]>, key: string | undefined, value: string): void {
  if (!key) return;
  const values = summaries.get(key) ?? [];
  values.push(value);
  summaries.set(key, values);
}

function flattenSummaryMap(summaries: Map<string, string[]>): Map<string, string> {
  return new Map(
    [...summaries.entries()].map(([key, values]) => [
      key,
      values.toSorted((a, b) => a.localeCompare(b)).join(' | '),
    ]),
  );
}

function buildClusteringSummaryMap(rows: Record<string, string>[]): Map<string, string> {
  const partsByClass = new Map<string, string[]>();
  for (const row of rows) {
    const clusteringClass = row['Clustering Class'];
    if (!clusteringClass) continue;

    const size = rangeLabel(row['Min Size'], row['Max Size']);
    const proximity = rangeLabel(row['Min Proximity'], row['Max Proximity']);
    const details = [
      row['Probability Of Clustering'] ? `prob ${row['Probability Of Clustering']}` : '',
      row['Relative Probability'] ? `rel ${row['Relative Probability']}` : '',
      size ? `size ${size}` : '',
      proximity ? `prox ${proximity}` : '',
    ].filter(Boolean);
    const part = details.length ? `${clusteringClass} (${details.join(', ')})` : clusteringClass;

    const parts = partsByClass.get(clusteringClass) ?? [];
    parts.push(part);
    partsByClass.set(clusteringClass, parts);
  }

  return new Map(
    [...partsByClass.entries()].map(([clusteringClass, parts]) => [
      clusteringClass,
      parts.toSorted((a, b) => a.localeCompare(b)).join(' | '),
    ]),
  );
}

function buildHarvestablePresetSummaryMap(rows: Record<string, string>[]): Map<string, string> {
  const summaries = new Map<string, string[]>();
  for (const row of rows) {
    const keys = [row['Harvestable Preset Class'], row['Harvestable Entity Class']].filter(Boolean);
    if (keys.length === 0) continue;

    const details = [
      row['Respawn In Slot Time'] ? `respawn ${row['Respawn In Slot Time']}` : '',
      row['Special Harvestable String'] ? `special ${row['Special Harvestable String']}` : '',
    ].filter(Boolean);
    const summary = details.length
      ? `${row['Harvestable Preset Class']} (${details.join(', ')})`
      : row['Harvestable Preset Class'];

    for (const key of keys) {
      const values = summaries.get(key) ?? [];
      values.push(summary);
      summaries.set(key, values);
    }
  }

  return new Map(
    [...summaries.entries()].map(([key, values]) => [
      key,
      [...new Set(values)].toSorted((a, b) => a.localeCompare(b)).join(' | '),
    ]),
  );
}

function buildSetupSummaryMap(rows: Record<string, string>[]): Map<string, string> {
  const summaries = new Map<string, string>();
  for (const row of rows) {
    const setupClass = row['Setup Class'];
    if (!setupClass) continue;

    const scale = rangeLabel(row['Min Scale'], row['Max Scale']);
    const slope = rangeLabel(row['Min Slope'], row['Max Slope']);
    const elevation = rangeLabel(row['Min Elevation'], row['Max Elevation']);
    const details = [
      row['Respawn In Slot Time'] ? `respawn ${row['Respawn In Slot Time']}` : '',
      row['Despawn Time Seconds'] ? `despawn ${row['Despawn Time Seconds']}s` : '',
      scale ? `scale ${scale}` : '',
      slope ? `slope ${slope}` : '',
      elevation ? `elevation ${elevation}` : '',
    ].filter(Boolean);

    summaries.set(setupClass, details.length ? `${setupClass} (${details.join(', ')})` : setupClass);
  }
  return summaries;
}

function buildSubHarvestableSummaryMap(rows: Record<string, string>[]): Map<string, string> {
  const summaries = new Map<string, string[]>();
  for (const row of rows) {
    const keys = [row['Harvestable Class'], row['Harvestable Entity Class'], row['Harvestable Setup Class']].filter(
      Boolean,
    );
    if (keys.length === 0) continue;

    const configLabel = [row['Config Class'], row['Tagged Config Name']].filter(Boolean).join('/');
    const details = [
      row['Config Type'] || '',
      row['Relative Probability'] ? `rel ${row['Relative Probability']}` : '',
      row['Deepest Relative Probability'] ? `deep ${row['Deepest Relative Probability']}` : '',
      row['Initial Slots Probability'] ? `slots ${row['Initial Slots Probability']}` : '',
      row['Config Respawn Time Multiplier'] ? `config respawn x${row['Config Respawn Time Multiplier']}` : '',
      row['Harvestable Respawn Time Multiplier']
        ? `harvest respawn x${row['Harvestable Respawn Time Multiplier']}`
        : '',
      row['Geometry Tags'] ? `geometry ${row['Geometry Tags']}` : '',
    ].filter(Boolean);
    const summary = details.length ? `${configLabel} (${details.join(', ')})` : configLabel;

    for (const key of keys) {
      const values = summaries.get(key) ?? [];
      values.push(summary);
      summaries.set(key, values);
    }
  }

  return new Map(
    [...summaries.entries()].map(([key, values]) => [
      key,
      [...new Set(values)].toSorted((a, b) => a.localeCompare(b)).join(' | '),
    ]),
  );
}

function buildParamSummaryMaps(rows: Record<string, string>[]): {
  byGuid: Map<string, string>;
  byClass: Map<string, string>;
} {
  const byGuid = new Map<string, string>();
  const byClass = new Map<string, string>();

  for (const row of rows) {
    const summary = toParamSummary(row);
    if (!summary) continue;

    if (row['Record GUID']) byGuid.set(row['Record GUID'], summary);
    if (row['Param Class']) byClass.set(row['Param Class'], summary);
  }

  return { byGuid, byClass };
}

function toParamSummary(row: Record<string, string>): string {
  const paramType = row['Param Type'];
  const paramClass = row['Param Class'];
  if (!paramClass) return '';

  if (paramType === 'MiningGlobalParams') {
    const details = [
      row['Power Capacity Per Mass'] ? `power/mass ${row['Power Capacity Per Mass']}` : '',
      row['Decay Per Mass'] ? `decay/mass ${row['Decay Per Mass']}` : '',
      row['Optimal Window Size'] ? `window ${row['Optimal Window Size']}` : '',
      row['CSCU Per Volume'] ? `cSCU/vol ${row['CSCU Per Volume']}` : '',
      row['Default Mass'] ? `mass ${row['Default Mass']}` : '',
    ].filter(Boolean);
    return details.length ? `${paramClass} (${details.join(', ')})` : paramClass;
  }

  if (paramType === 'MiningAudioParams') {
    const details = [
      row['Mineable Power Increasing Fall Off'] ? `falloff ${row['Mineable Power Increasing Fall Off']}` : '',
      row['Mining Start Trigger'] ? `start ${row['Mining Start Trigger']}` : '',
      row['Mining Stop Trigger'] ? `stop ${row['Mining Stop Trigger']}` : '',
      row['Extracted Trigger'] ? `extracted ${row['Extracted Trigger']}` : '',
    ].filter(Boolean);
    return details.length ? `${paramClass} (${details.join(', ')})` : paramClass;
  }

  if (paramType === 'SEntityDensityClass') {
    const details = [
      row['Cluster Detection Radius'] ? `cluster radius ${row['Cluster Detection Radius']}` : '',
      row['Cluster Upper Object Count DGS'] ? `DGS max ${row['Cluster Upper Object Count DGS']}` : '',
      row['Cluster Upper Object Count Persistence']
        ? `persistent max ${row['Cluster Upper Object Count Persistence']}`
        : '',
      row['Cluster Persistence Timeout'] ? `timeout ${row['Cluster Persistence Timeout']}` : '',
      row['Reset Lifetime On Move'] ? `resetOnMove ${row['Reset Lifetime On Move']}` : '',
    ].filter(Boolean);
    return details.length ? `${paramClass} (${details.join(', ')})` : paramClass;
  }

  return paramClass;
}

function rangeLabel(min: string | undefined, max: string | undefined): string {
  const trimmedMin = min?.trim() ?? '';
  const trimmedMax = max?.trim() ?? '';
  if (!trimmedMin && !trimmedMax) return '';
  if (trimmedMin && trimmedMax && trimmedMin !== trimmedMax) return `${trimmedMin}-${trimmedMax}`;
  return trimmedMin || trimmedMax;
}

function toQualityNote(qualityRows: Map<string, Record<string, string>>): string {
  const specialNotes = [...qualityRows.values()].map((row) => row['Special Quality Note']).filter(Boolean);
  if (specialNotes.length > 0) return [...new Set(specialNotes)].join('\n');

  const lines = [...qualityRows.entries()]
    .toSorted((a, b) => familyLabel(a[0]).localeCompare(familyLabel(b[0])))
    .map(([family, row]) => {
      const min = qualityPercent(row['Min Quality'] || row.minQuality);
      const max = qualityPercent(row['Max Quality'] || row.maxQuality);
      const mean = qualityPercent(row.Mean || row.mean);
      const stddev = qualityPercent(row.Stddev || row.stddev);
      const spread = min && max ? `${min}-${max}` : '';
      const details = [mean ? `mean ${mean}` : '', stddev ? `stddev ${stddev}` : ''].filter(Boolean).join(', ');
      return [familyLabel(family), spread, details ? `(${details})` : ''].filter(Boolean).join(' ');
    })
    .filter(Boolean);
  return lines.join('\n');
}

function toSpecialQualityNote(rows: Record<string, string>[], classTerms: string[]): string {
  const defaultsByRarity = new Map<string, Record<string, string>>();
  const overridesByRarity = new Map<string, Record<string, string>>();

  for (const row of rows) {
    const distributionClass = row['Distribution Class'] || '';
    const rarity = distributionClass.match(/^(Legendary|Uncommon)ShipMineable_/i)?.[1]?.toLowerCase();
    if (!rarity || (row['Mineable Family'] || '').toLowerCase() !== 'shipmineables') continue;

    const distributionType = row['Distribution Type'] || '';
    if (distributionType === 'default') {
      defaultsByRarity.set(rarity, row);
      continue;
    }

    const haystack = [distributionClass, row['Location Class'], row['Location Path']].join(' ').toLowerCase();
    if (distributionType === 'location-override' && classTerms.some((term) => haystack.includes(term.toLowerCase()))) {
      overridesByRarity.set(rarity, row);
    }
  }

  const labels: Record<string, string> = {
    uncommon: 'Uncommon ship rocks',
    legendary: 'Legendary ship rocks',
  };

  return ['uncommon', 'legendary']
    .map((rarity) => {
      const override = overridesByRarity.get(rarity);
      if (!override) return '';
      const floor = qualityPercent(override['Min Quality']);
      const standard = qualityPercent(defaultsByRarity.get(rarity)?.['Min Quality']);
      return standard
        ? `${labels[rarity]}: quality floor ${floor} (standard ${standard})`
        : `${labels[rarity]}: quality floor ${floor}`;
    })
    .filter(Boolean)
    .join('\n');
}

function qualityPercent(value: string | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return `${Math.round((numeric / 10) * 10) / 10}%`;
}

function familyLabel(family: string): string {
  const normalized = family.toLowerCase();
  if (normalized === 'shipmineables') return 'Ship quality';
  if (normalized === 'fpsmineables') return 'Hand quality';
  if (normalized === 'groundmineables') return 'Ground vehicle quality';
  return family;
}

function normalizeSpecialMineableName(value: string): string {
  const normalized = value.trim();
  if (normalized === 'Carinitepure') return 'Carinite (Pure)';
  if (normalized === 'Jaclium') return 'Jaclium (Ore)';
  if (normalized === 'Saldynium') return 'Saldynium (Ore)';
  return normalized;
}

interface CompositionNameLookup {
  byGuid: Map<string, string>;
  byClass: Map<string, string>;
}

function buildCompositionNameLookup(compositionRows: Record<string, string>[]): CompositionNameLookup {
  const scoresByGuid = new Map<string, Map<string, number>>();
  const scoresByClass = new Map<string, Map<string, number>>();
  for (const row of compositionRows) {
    const compositionGuid = row['Record GUID'];
    const compositionClass = row['Composition Class'];
    const elementName = row['Mineable Element Name'];
    if (!compositionClass || !elementName) continue;

    const min = parseWeight(row['Min Percentage'], 0);
    const max = parseWeight(row['Max Percentage'], min);
    const probability = parseWeight(row.Probability, 1);
    const score = ((min + max) / 2) * probability;
    addElementScore(scoresByGuid, compositionGuid, elementName, score);
    addElementScore(scoresByClass, compositionClass, elementName, score);
  }

  return {
    byGuid: bestElementNames(scoresByGuid),
    byClass: bestElementNames(scoresByClass),
  };
}

function addElementScore(
  scores: Map<string, Map<string, number>>,
  key: string | undefined,
  elementName: string,
  score: number,
): void {
  if (!key) return;
  const byElement = scores.get(key) ?? new Map<string, number>();
  byElement.set(elementName, (byElement.get(elementName) ?? 0) + score);
  scores.set(key, byElement);
}

function bestElementNames(scores: Map<string, Map<string, number>>): Map<string, string> {
  const names = new Map<string, string>();
  for (const [key, byElement] of scores) {
    const best = [...byElement.entries()].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) names.set(key, best[0]);
  }
  return names;
}

function toDisplayLocationName(row: Record<string, string>): string {
  const slug = toProviderLocationSlug(row);
  return DATACORE_LOCATION_NAMES[slug] ?? cleanProviderLocation(row.Location || row['Provider Class'] || '');
}

function toProviderLocationSlug(row: Record<string, string>): string {
  return (row.Location || row['Provider Class'] || '').split('/').at(-1)?.toLowerCase() ?? '';
}

function classifyMiningGroup(groupName: string): MiningType | null {
  if (/FPS/i.test(groupName)) return 'hand';
  if (/GroundVehicle/i.test(groupName)) return 'ground';
  if (/SpaceShip|Ship/i.test(groupName)) return 'ship';
  return null;
}

function toWeightedMineableList(weightMap: Record<string, number>): string {
  const entries = Object.entries(weightMap);
  if (entries.length === 0) return '';
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return entries
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, weight]) => `${name} - ${Math.round((weight / total) * 1000) / 10}%`)
    .join('\n');
}

function cleanCompositionClass(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/^CommonShipMineablesAsteroid_/i, '')
    .replace(/^Asteroid_[A-Z]Type_/i, '')
    .replace(/^FPS_/i, '')
    .replace(/^GroundVehicle_/i, '')
    .replace(/_/g, ' ')
    .trim();
}

function cleanProviderLocation(value: string): string {
  const base = value.split('/').at(-1) || value;
  return base
    .replace(/^HPP[_-]/i, '')
    .replace(/^hpp[_-]/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function parseWeight(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

/**
 * Normalises a Location Name to a lowercase slug for INI key matching.
 * e.g. "Pyro I" -> "pyro1", "Aaron Halo" -> "aaronhalo"
 */
function toLocationSlug(name: string): string {
  return name
    .replaceAll(ROMAN_RE, (m: string) => ROMAN_MAP[m])
    .replaceAll(/[\s\-_]+/g, '')
    .toLowerCase();
}

function toLocationDescKeyCandidates(row: Record<string, string>): string[] {
  const graphKeys = String(row['DataCore Location Description Keys'] ?? '')
    .split(';')
    .map((key) => key.trim())
    .filter(Boolean);
  if (graphKeys.length > 0) return graphKeys;

  const slugs = String(row['DataCore Location Slugs'] ?? '')
    .split(';')
    .map((slug) => slug.trim())
    .filter(Boolean);
  const keys = slugs.flatMap((slug) => descKeysFromProviderSlug(slug, row['Location Name'] ?? ''));
  if (keys.length > 0) return keys;

  const name = row['Location Name'];
  return name ? [`${toLocationSlug(name)}_desc`] : [];
}

function descKeysFromProviderSlug(slug: string, displayName: string): string[] {
  const normalized = slug.replace(/^hpp[_-]/i, '').toLowerCase();
  const stanton = /^stanton([1-4][a-z]?)(?:_belt)?$/i.exec(normalized);
  if (stanton) return [`Stanton${stanton[1]}_Desc`];

  const pyroBody = /^pyro(\d[a-z]?)$/i.exec(normalized);
  if (pyroBody) {
    const baseKey = `Pyro${pyroBody[1]}_desc`;
    const parenthetical = displayName.match(/\(([^)]+)\)/)?.[1]?.trim();
    return parenthetical ? [`Pyro${pyroBody[1]}_${toKeyToken(parenthetical)}_desc`, baseKey] : [baseKey];
  }

  return [`${toLocationSlug(displayName)}_desc`];
}

function toKeyToken(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9]+/g, '_').replaceAll(/^_+|_+$/g, '');
}

export default {
  csvFile: 'mining-locations.csv',
  sourceFiles: [
    { sourceDir: 'datacore', file: DATACORE_MINING_PROVIDER_PRESETS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_COMPOSITIONS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_LOCATION_LABELS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINEABLE_ENTITIES_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_DENSITY_OVERRIDES_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_CLUSTERING_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_HARVESTABLE_PRESETS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_HARVESTABLE_SETUPS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_SUB_HARVESTABLE_CONFIGS_CSV },
    { sourceDir: 'datacore', file: DATACORE_MINING_PARAMS_CSV },
  ],
  loadSourceData: loadMiningLocationSourceData,
  label: 'Mining locations',
  requiredColumns: ['Location Name', 'Ship Mineables', 'Hand Mineables'],
  // Optional columns (added by enriched scraper): 'Ground Vehicle Mineables', 'Quality Note'
  // Only update keys that already exist in the INI (planet/moon descs don't get new entries)
  noInsert: true,
  descKeyMatch: (kl: string) => /_desc$/i.test(kl) && !kl.startsWith('items_') && !kl.startsWith('journal_'),

  /**
   * Derives the target INI key(s) for a location row.
   * Priority: DataCore location description keys, then provider location slug,
   * then display-name slug fallback.
   */
  getTargetKeys(row) {
    const withPVariants = (keys: string[]): string[] => {
      const out = [];
      const seen = new Set();
      for (const key of keys) {
        if (!key) continue;
        if (!seen.has(key)) {
          out.push(key);
          seen.add(key);
        }
        const pVariant = key.endsWith(',P') ? key : `${key},P`;
        if (!seen.has(pVariant)) {
          out.push(pVariant);
          seen.add(pVariant);
        }
      }
      return out;
    };

    return withPVariants(toLocationDescKeyCandidates(row));
  },

  /** Builds the new INI value for a location description. */
  buildValue(row, _flavorText, oldValue, targetKey) {
    // If we don't have a target key (not in our map), skip the update
    if (!targetKey) {
      return oldValue;
    }

    // Extract flavor text: everything before the first "Potential " or "Quality Notes:" section
    const firstSectionIdx = Math.min(
      ...[oldValue.indexOf(POTENTIAL_SECTION_MARKER), oldValue.indexOf(QUALITY_NOTES_MARKER)]
        .filter((i) => i !== -1)
        .concat([Infinity]),
    );
    const cleanFlavorText = firstSectionIdx === Infinity ? oldValue : oldValue.substring(0, firstSectionIdx);

    // Parse existing "Potential X:" sections into a dict
    const sections: Record<string, string> = {};
    const potentialRegex = /\\n\\nPotential ([^:]+):\\n([\s\S]*?)(?=\\n\\nPotential |\\n\\nQuality Notes:|$)/g;
    for (let match = potentialRegex.exec(oldValue); match !== null; match = potentialRegex.exec(oldValue)) {
      const sectionName = match[1]; // e.g., "Ship Mineables"
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }

    // Helper: parse a CSV cell (real newlines) into an INI-escaped line string
    const toIniLines = (csvCell: string): string =>
      csvCell
        .split(/\r?\n/)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0)
        .join(INI_NEWLINE);

    // Update Ship Mineables from CSV (now weighted: "Mineral — XX.X%")
    const shipMineables = row['Ship Mineables'] || '';
    if (shipMineables.trim()) {
      sections['Ship Mineables'] = toIniLines(shipMineables);
    } else {
      delete sections['Ship Mineables'];
    }

    // Update Hand Mineables from CSV (now weighted: "Mineral — XX.X%")
    const handMineables = row['Hand Mineables'] || '';
    if (handMineables.trim()) {
      sections['Hand Mineables'] = toIniLines(handMineables);
    } else {
      delete sections['Hand Mineables'];
    }

    // Update Ground Vehicle Mineables from CSV if the column is present
    const groundMineables = row['Ground Vehicle Mineables'] || '';
    if (groundMineables.trim()) {
      sections['Ground Vehicle Mineables'] = toIniLines(groundMineables);
    }
    // If the CSV column is absent or empty, preserve whatever was already in the INI (do nothing)

    // Define canonical section order
    const sectionOrder = ['Ship Mineables', 'Ground Vehicle Mineables', 'Hand Mineables', 'Harvestables', 'Creatures'];

    // Re-assemble Potential sections
    let result = cleanFlavorText;
    for (const sectionName of sectionOrder) {
      if (sections[sectionName] !== undefined && sections[sectionName].trim() !== '') {
        result += String.raw`\n\nPotential ${sectionName}:\n${sections[sectionName]}`;
      }
    }

    // Append Quality Notes section if the CSV provides one (idempotent: old value already stripped above)
    const qualityNote = row['Quality Note'] || '';
    if (qualityNote.trim() !== '') {
      const noteLines = toIniLines(qualityNote);
      result += String.raw`\n\nQuality Notes:\n${noteLines}`;
    }

    return result;
  },
} satisfies ItemConfig;
