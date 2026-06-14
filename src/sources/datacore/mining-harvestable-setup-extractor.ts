import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { uniqueGraphGuidReference } from './record-graph-relations';
import type { DataCoreMiningHarvestableSetupRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_PROVIDER_PRESET_PATH_PREFIX = 'libs/foundry/records/harvestable/providerpresets/system';
const DEFAULT_HARVESTABLE_SETUP_PATH_PREFIX = 'libs/foundry/records/harvestable/harvestablesetups';

export interface ExtractDataCoreMiningHarvestableSetupsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  providerPathPrefix?: string;
  setupPathPrefix?: string;
}

export async function extractDataCoreMiningHarvestableSetups(
  options: ExtractDataCoreMiningHarvestableSetupsOptions,
): Promise<DataCoreMiningHarvestableSetupRecord[]> {
  const miningSetupRefs = await collectMiningSetupRefs(options);
  const records = options.graph
    .getByPathPrefix(options.setupPathPrefix ?? DEFAULT_HARVESTABLE_SETUP_PATH_PREFIX)
    .filter((record) => record.rootType === 'HarvestableSetup')
    .filter((record) => isMiningSetup(record, miningSetupRefs))
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningHarvestableSetupRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining harvestable setup XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const transformParams = $('transformParams').first();
    const despawnTimer = $('despawnTimer').first();
    const healthCondition = $('HarvestConditionHealth').first();
    const interactionCondition = $('HarvestConditionInteraction').first();
    const movementCondition = $('HarvestConditionMovement').first();

    rows.push({
      ref: record.ref,
      path: record.path,
      setupClass: record.entityClass,
      respawnInSlotTime: root.attr('respawnInSlotTime') ?? '',
      specialHarvestableString: root.attr('specialHarvestableString') ?? '',
      harvestConditionTypes: $('harvestConditions')
        .first()
        .children()
        .toArray()
        .map((element) => element.tagName ?? '')
        .filter(Boolean)
        .join(';'),
      healthRatio: healthCondition.attr('healthRatio') ?? '',
      includeAttachedChildren: interactionCondition.attr('includeAttachedChildren') ?? '',
      allInteractionsClearSpawnPoint: interactionCondition.attr('allInteractionsClearSpawnPoint') ?? '',
      movementDistance: movementCondition.attr('distance') ?? '',
      despawnTimeSeconds: despawnTimer.attr('despawnTimeSeconds') ?? '',
      additionalWaitForNearbyPlayersSeconds: despawnTimer.attr('additionalWaitForNearbyPlayersSeconds') ?? '',
      minScale: transformParams.attr('minScale') ?? '',
      maxScale: transformParams.attr('maxScale') ?? '',
      terrainNormalAlignment: transformParams.attr('terrainNormalAlignment') ?? '',
      minZOffset: transformParams.attr('minZOffset') ?? '',
      maxZOffset: transformParams.attr('maxZOffset') ?? '',
      minSlope: transformParams.attr('minSlope') ?? '',
      maxSlope: transformParams.attr('maxSlope') ?? '',
      minElevation: transformParams.attr('minElevation') ?? '',
      maxElevation: transformParams.attr('maxElevation') ?? '',
      localRotationOffset: xyz(transformParams.find('> localRotationOffset').first()),
      rotationRange: xyz(transformParams.find('> rotationRange').first()),
      positionOffset: xyz(transformParams.find('> positionOffset').first()),
    });
  }

  return rows;
}

async function collectMiningSetupRefs(options: ExtractDataCoreMiningHarvestableSetupsOptions): Promise<Set<string>> {
  const setupRefs = new Set<string>();
  const providerRecords = options.graph
    .getByPathPrefix(options.providerPathPrefix ?? DEFAULT_MINING_PROVIDER_PRESET_PATH_PREFIX)
    .filter((record) => record.rootType === 'HarvestableProviderPreset');

  for (const record of providerRecords) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining provider preset XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);

    $('HarvestableElementGroup').each((_groupIndex, groupElement) => {
      const group = $(groupElement);
      const groupName = group.attr('groupName') ?? '';

      group.find('> harvestables > HarvestableElement').each((_entryIndex, element) => {
        const entry = $(element);
        const harvestableGuid = entry.attr('harvestable') ?? entry.attr('harvestableEntityClass') ?? '';
        const harvestable = harvestableGuid ? options.graph.getByRef(harvestableGuid) : undefined;
        if (!isMiningProviderEntry(groupName, harvestable)) return;

        const setupGuid = entry.attr('harvestableSetup')
          ? graphGuidReference(record, ['harvestableSetup'], entry.attr('harvestableSetup') ?? '')
          : '';
        if (setupGuid) setupRefs.add(setupGuid);
      });
    });
  }

  return setupRefs;
}

function isMiningSetup(record: DataCoreRecordNode, referencedByMiningProvider: Set<string>): boolean {
  if (/mineable|mining/i.test(record.entityClass)) return true;
  return referencedByMiningProvider.has(record.ref);
}

function isMiningProviderEntry(groupName: string, harvestable: DataCoreRecordNode | undefined): boolean {
  if (/mineable|mining/i.test(groupName)) return true;
  return harvestable?.path.includes('/entities/mineable/') ?? false;
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}

function xyz(element: { length: number; attr(name: string): string | undefined }): string {
  if (!element.length) return '';
  return [element.attr('x') ?? '', element.attr('y') ?? '', element.attr('z') ?? ''].join(',');
}
