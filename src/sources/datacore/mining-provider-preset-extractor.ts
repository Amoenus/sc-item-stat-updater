import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMiningProviderPresetRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_PROVIDER_PRESET_PATH_PREFIX = 'libs/foundry/records/harvestable/providerpresets/system';

export interface ExtractDataCoreMiningProviderPresetsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningProviderPresets(
  options: ExtractDataCoreMiningProviderPresetsOptions,
): Promise<DataCoreMiningProviderPresetRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINING_PROVIDER_PRESET_PATH_PREFIX)
    .filter((record) => record.rootType === 'HarvestableProviderPreset')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: Promise<DataCoreMiningProviderPresetRecord>[] = [];
  const mineableCache = new Map<string, Promise<ResolvedMineableEntity>>();

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining provider preset XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    $('HarvestableElementGroup').each((groupIndex, groupElement) => {
      const group = $(groupElement);
      const groupName = group.attr('groupName') ?? '';
      const groupProbability = group.attr('groupProbability') ?? '';

      group.find('> harvestables > HarvestableElement').each((entryIndex, element) => {
        const entry = $(element);
        const harvestableGuid = entry.attr('harvestable') ?? entry.attr('harvestableEntityClass') ?? '';
        const harvestable = harvestableGuid ? options.graph.getByRef(harvestableGuid) : undefined;
        const harvestableSetupGuid = entry.attr('harvestableSetup') ?? '';
        const harvestableSetup = harvestableSetupGuid ? options.graph.getByRef(harvestableSetupGuid) : undefined;
        const clusteringGuid = entry.attr('clustering') ?? '';
        const clustering = clusteringGuid ? options.graph.getByRef(clusteringGuid) : undefined;

        if (!isMiningProviderEntry(groupName, harvestable)) return;

        rows.push(
          resolveMineableEntity({
            xmlCacheDir: options.xmlCacheDir,
            graph: options.graph,
            cache: mineableCache,
            harvestable,
            directEntityGuid: entry.attr('harvestableEntityClass') ?? '',
          }).then((mineable) => ({
            ref: record.ref,
            path: record.path,
            providerClass: record.entityClass,
            ...providerLocationParts(record.path),
            groupName,
            groupProbability,
            entryIndex: `${groupIndex}.${entryIndex}`,
            harvestableGuid,
            harvestableClass: harvestable?.entityClass ?? '',
            harvestablePath: harvestable?.path ?? '',
            harvestableEntityGuid: mineable.entityGuid,
            harvestableEntityClass: mineable.entityClass,
            harvestableEntityPath: mineable.entityPath,
            harvestableSetupGuid,
            harvestableSetupClass: harvestableSetup?.entityClass ?? '',
            compositionGuid: mineable.compositionGuid,
            compositionClass: mineable.compositionClass,
            globalParamsGuid: mineable.globalParamsGuid,
            audioParamsGuid: mineable.audioParamsGuid,
            filledFactor: mineable.filledFactor,
            clusteringGuid,
            clusteringClass: clustering?.entityClass ?? '',
            relativeProbability: entry.attr('relativeProbability') ?? '',
            geometryTags: entry
              .find('HarvestableGeometry[tag]')
              .toArray()
              .map((geometry) => $(geometry).attr('tag') ?? '')
              .filter(Boolean)
              .join(';'),
          })),
        );
      });
    });
  }

  return Promise.all(rows);
}

function isMiningProviderEntry(groupName: string, harvestable: DataCoreRecordNode | undefined): boolean {
  if (/mineable|mining/i.test(groupName)) return true;
  return harvestable?.path.includes('/entities/mineable/') ?? false;
}

function providerLocationParts(recordPath: string): { system: string; location: string } {
  const parts = recordPath.split('/');
  const systemIndex = parts.indexOf('system');
  const system = systemIndex === -1 ? '' : (parts[systemIndex + 1] ?? '');
  const filename = parts.at(-1)?.replace(/\.xml$/i, '') ?? '';
  const parent = parts.length > 1 ? (parts.at(-2) ?? '') : '';
  const location = parent && parent !== system ? `${parent}/${filename}` : filename;
  return { system, location };
}

interface ResolvedMineableEntity {
  entityGuid: string;
  entityClass: string;
  entityPath: string;
  compositionGuid: string;
  compositionClass: string;
  globalParamsGuid: string;
  audioParamsGuid: string;
  filledFactor: string;
}

async function resolveMineableEntity(options: {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  cache: Map<string, Promise<ResolvedMineableEntity>>;
  harvestable: DataCoreRecordNode | undefined;
  directEntityGuid: string;
}): Promise<ResolvedMineableEntity> {
  const cacheKey = options.directEntityGuid || options.harvestable?.ref || '';
  if (!cacheKey) return emptyMineableEntity();

  let cached = options.cache.get(cacheKey);
  if (!cached) {
    cached = loadMineableEntity(options);
    options.cache.set(cacheKey, cached);
  }

  return cached;
}

async function loadMineableEntity(options: {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  harvestable: DataCoreRecordNode | undefined;
  directEntityGuid: string;
}): Promise<ResolvedMineableEntity> {
  const entityGuid =
    options.directEntityGuid || (await readEntityGuidFromHarvestable(options.xmlCacheDir, options.harvestable));
  const entity = entityGuid ? options.graph.getByRef(entityGuid) : undefined;
  const mineableParams = entity ? await readMineableParams(options.xmlCacheDir, entity) : emptyMineableParams();
  const composition = mineableParams.compositionGuid
    ? options.graph.getByRef(mineableParams.compositionGuid)
    : undefined;

  return {
    entityGuid,
    entityClass: entity?.entityClass ?? '',
    entityPath: entity?.path ?? '',
    compositionGuid: mineableParams.compositionGuid,
    compositionClass: composition?.entityClass ?? '',
    globalParamsGuid: mineableParams.globalParamsGuid,
    audioParamsGuid: mineableParams.audioParamsGuid,
    filledFactor: mineableParams.filledFactor,
  };
}

async function readEntityGuidFromHarvestable(
  xmlCacheDir: string,
  harvestable: DataCoreRecordNode | undefined,
): Promise<string> {
  if (!harvestable) return '';
  const graphEntityGuid = graphGuidReference(harvestable, ['entityClass'], '');
  if (graphEntityGuid) return graphEntityGuid;

  const xmlPath = resolveChildPath(xmlCacheDir, harvestable.path, 'DataCore harvestable preset XML path');
  const xml = await fs.readFile(xmlPath, 'utf8');
  const $ = loadXml(xml);
  return $(':root').first().attr('entityClass') ?? '';
}

async function readMineableParams(
  xmlCacheDir: string,
  entity: DataCoreRecordNode,
): Promise<{
  compositionGuid: string;
  globalParamsGuid: string;
  audioParamsGuid: string;
  filledFactor: string;
}> {
  const xmlPath = resolveChildPath(xmlCacheDir, entity.path, 'DataCore mineable entity XML path');
  const xml = await fs.readFile(xmlPath, 'utf8');
  const $ = loadXml(xml);
  const mineableParams = $('MineableParams').first();

  return {
    compositionGuid: graphGuidReference(entity, ['composition'], mineableParams.attr('composition') ?? ''),
    globalParamsGuid: graphGuidReference(entity, ['globalParams'], mineableParams.attr('globalParams') ?? ''),
    audioParamsGuid: graphGuidReference(entity, ['audioParams'], mineableParams.attr('audioParams') ?? ''),
    filledFactor: mineableParams.attr('filledFactor') ?? '',
  };
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.referencedGuidAttributes?.find((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      ?.value ?? fallback
  );
}

function emptyMineableEntity(): ResolvedMineableEntity {
  return {
    entityGuid: '',
    entityClass: '',
    entityPath: '',
    compositionGuid: '',
    compositionClass: '',
    globalParamsGuid: '',
    audioParamsGuid: '',
    filledFactor: '',
  };
}

function emptyMineableParams(): {
  compositionGuid: string;
  globalParamsGuid: string;
  audioParamsGuid: string;
  filledFactor: string;
} {
  return {
    compositionGuid: '',
    globalParamsGuid: '',
    audioParamsGuid: '',
    filledFactor: '',
  };
}
