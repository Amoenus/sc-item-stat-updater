import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { uniqueGraphGuidReference } from './record-graph-relations';
import type { DataCoreMiningSubHarvestableConfigRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_SUB_HARVESTABLE_CONFIG_PATH_PREFIX = 'libs/foundry/records/harvestable';

export interface ExtractDataCoreMiningSubHarvestableConfigsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningSubHarvestableConfigs(
  options: ExtractDataCoreMiningSubHarvestableConfigsOptions,
): Promise<DataCoreMiningSubHarvestableConfigRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_SUB_HARVESTABLE_CONFIG_PATH_PREFIX)
    .filter(
      (record) =>
        record.rootType === 'SubHarvestableConfigRecord' || record.rootType === 'SubHarvestableMultiConfigRecord',
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: Promise<DataCoreMiningSubHarvestableConfigRecord[]>[] = [];
  const harvestableCache = new Map<string, Promise<ResolvedHarvestable>>();

  for (const record of records) {
    rows.push(readConfigRecord(options, record, harvestableCache));
  }

  return (await Promise.all(rows)).flat();
}

async function readConfigRecord(
  options: ExtractDataCoreMiningSubHarvestableConfigsOptions,
  record: DataCoreRecordNode,
  harvestableCache: Map<string, Promise<ResolvedHarvestable>>,
): Promise<DataCoreMiningSubHarvestableConfigRecord[]> {
  const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining sub-harvestable config XML path');
  const xml = await fs.readFile(xmlPath, 'utf8');
  const $ = loadXml(xml);
  const root = $(':root').first();
  if (!root.length) return [];

  if (record.rootType === 'SubHarvestableConfigRecord') {
    const subConfig = root.find('> subConfig').first();
    return readSlots($, subConfig, {
      options,
      harvestableCache,
      record,
      configType: 'single',
      taggedConfigName: '',
      tagGuids: '',
      referencedConfig: undefined,
    });
  }

  const rows: Promise<DataCoreMiningSubHarvestableConfigRecord[]>[] = [];
  root.find('> multiConfig > taggedConfigs > TaggedSubHarvestableConfig').each((_tagIndex, tagElement) => {
    const taggedConfig = $(tagElement);
    const taggedConfigName = taggedConfig.attr('name') ?? '';
    const tagGuids = taggedConfig
      .find('> tagList Reference[value]')
      .toArray()
      .map((tag) => $(tag).attr('value') ?? '')
      .filter(Boolean)
      .join(';');

    const manualSubConfig = taggedConfig
      .find('> subConfig > SubHarvestableConfigSingleManual > subConfigManual')
      .first();
    if (manualSubConfig.length) {
      rows.push(
        readSlots($, manualSubConfig, {
          options,
          harvestableCache,
          record,
          configType: 'multi-manual',
          taggedConfigName,
          tagGuids,
          referencedConfig: undefined,
        }),
      );
    }

    const refConfig = taggedConfig.find('> subConfig > SubHarvestableConfigSingleRef').first();
    const refConfigGuid = refConfig.length
      ? graphGuidReference(record, ['subConfigRef'], refConfig.attr('subConfigRef') ?? '')
      : '';
    if (refConfigGuid) {
      const referencedConfig = options.graph.getByRef(refConfigGuid);
      if (!referencedConfig) return;
      rows.push(readReferencedConfig(options, record, referencedConfig, harvestableCache, taggedConfigName, tagGuids));
    }
  });

  return (await Promise.all(rows)).flat();
}

async function readReferencedConfig(
  options: ExtractDataCoreMiningSubHarvestableConfigsOptions,
  record: DataCoreRecordNode,
  referencedConfig: DataCoreRecordNode,
  harvestableCache: Map<string, Promise<ResolvedHarvestable>>,
  taggedConfigName: string,
  tagGuids: string,
): Promise<DataCoreMiningSubHarvestableConfigRecord[]> {
  const xmlPath = resolveChildPath(
    options.xmlCacheDir,
    referencedConfig.path,
    'DataCore referenced sub-harvestable config XML path',
  );
  const xml = await fs.readFile(xmlPath, 'utf8');
  const $ = loadXml(xml);
  const subConfig = $(':root').first().find('> subConfig').first();

  return readSlots($, subConfig, {
    options,
    harvestableCache,
    record,
    configType: 'multi-ref',
    taggedConfigName,
    tagGuids,
    referencedConfig,
  });
}

async function readSlots(
  $: ReturnType<typeof loadXml>,
  subConfig: ReturnType<ReturnType<typeof loadXml>>,
  context: {
    options: ExtractDataCoreMiningSubHarvestableConfigsOptions;
    harvestableCache: Map<string, Promise<ResolvedHarvestable>>;
    record: DataCoreRecordNode;
    configType: string;
    taggedConfigName: string;
    tagGuids: string;
    referencedConfig: DataCoreRecordNode | undefined;
  },
): Promise<DataCoreMiningSubHarvestableConfigRecord[]> {
  if (!subConfig.length) return [];

  const rows: Promise<DataCoreMiningSubHarvestableConfigRecord | undefined>[] = [];
  subConfig.find('> subHarvestables > SubHarvestableSlot').each((slotIndex, slotElement) => {
    const slot = $(slotElement);
    rows.push(readSlot($, slot, slotIndex, subConfig, context));
  });

  return (await Promise.all(rows)).filter((row): row is DataCoreMiningSubHarvestableConfigRecord => Boolean(row));
}

async function readSlot(
  $: ReturnType<typeof loadXml>,
  slot: ReturnType<ReturnType<typeof loadXml>>,
  slotIndex: number,
  subConfig: ReturnType<ReturnType<typeof loadXml>>,
  context: {
    options: ExtractDataCoreMiningSubHarvestableConfigsOptions;
    harvestableCache: Map<string, Promise<ResolvedHarvestable>>;
    record: DataCoreRecordNode;
    configType: string;
    taggedConfigName: string;
    tagGuids: string;
    referencedConfig: DataCoreRecordNode | undefined;
  },
): Promise<DataCoreMiningSubHarvestableConfigRecord | undefined> {
  const harvestableGuid = slot.attr('harvestable') ?? slot.attr('harvestableEntityClass') ?? '';
  const harvestable = await resolveHarvestable(context.options, context.harvestableCache, {
    harvestableGuid: slot.attr('harvestable') ?? '',
    directEntityGuid: slot.attr('harvestableEntityClass') ?? '',
  });
  const harvestableSetupGuid = slot.attr('harvestableSetup') ?? '';
  const harvestableSetup = harvestableSetupGuid ? context.options.graph.getByRef(harvestableSetupGuid) : undefined;

  if (!isMiningSlot(context.record, context.taggedConfigName, harvestable)) return undefined;

  return {
    ref: context.record.ref,
    path: context.record.path,
    configClass: context.record.entityClass,
    configType: context.configType,
    taggedConfigName: context.taggedConfigName,
    tagGuids: context.tagGuids,
    initialSlotsProbability: subConfig.attr('initialSlotsProbability') ?? '',
    configRespawnTimeMultiplier: subConfig.attr('configRespawnTimeMultiplier') ?? '',
    slotIndex: String(slotIndex),
    harvestableGuid,
    harvestableClass: harvestable.harvestableClass,
    harvestablePath: harvestable.harvestablePath,
    harvestableEntityGuid: harvestable.entityGuid,
    harvestableEntityClass: harvestable.entityClass,
    harvestableEntityPath: harvestable.entityPath,
    harvestableSetupGuid,
    harvestableSetupClass: harvestableSetup?.entityClass ?? '',
    relativeProbability: slot.attr('relativeProbability') ?? '',
    deepestRelativeProbability:
      slot.find('> relativeProbabilityDeepest > OptionalProbability').first().attr('probability') ?? '',
    harvestableRespawnTimeMultiplier: slot.attr('harvestableRespawnTimeMultiplier') ?? '',
    geometryTags: slot
      .find('HarvestableGeometry[tag]')
      .toArray()
      .map((geometry) => $(geometry).attr('tag') ?? '')
      .filter(Boolean)
      .join(';'),
    referencedConfigGuid: context.referencedConfig?.ref ?? '',
    referencedConfigClass: context.referencedConfig?.entityClass ?? '',
    referencedConfigPath: context.referencedConfig?.path ?? '',
  };
}

interface ResolvedHarvestable {
  harvestableClass: string;
  harvestablePath: string;
  entityGuid: string;
  entityClass: string;
  entityPath: string;
}

async function resolveHarvestable(
  options: ExtractDataCoreMiningSubHarvestableConfigsOptions,
  cache: Map<string, Promise<ResolvedHarvestable>>,
  refs: { harvestableGuid: string; directEntityGuid: string },
): Promise<ResolvedHarvestable> {
  const cacheKey = refs.directEntityGuid || refs.harvestableGuid;
  if (!cacheKey) return emptyHarvestable();

  let cached = cache.get(cacheKey);
  if (!cached) {
    cached = loadHarvestable(options, refs);
    cache.set(cacheKey, cached);
  }

  return cached;
}

async function loadHarvestable(
  options: ExtractDataCoreMiningSubHarvestableConfigsOptions,
  refs: { harvestableGuid: string; directEntityGuid: string },
): Promise<ResolvedHarvestable> {
  if (refs.directEntityGuid) {
    const entity = options.graph.getByRef(refs.directEntityGuid);
    return {
      harvestableClass: entity?.entityClass ?? '',
      harvestablePath: entity?.path ?? '',
      entityGuid: refs.directEntityGuid,
      entityClass: entity?.entityClass ?? '',
      entityPath: entity?.path ?? '',
    };
  }

  const harvestable = options.graph.getByRef(refs.harvestableGuid);
  if (!harvestable) return emptyHarvestable();
  if (harvestable.path.includes('/entities/mineable/')) {
    return {
      harvestableClass: harvestable.entityClass,
      harvestablePath: harvestable.path,
      entityGuid: refs.harvestableGuid,
      entityClass: harvestable.entityClass,
      entityPath: harvestable.path,
    };
  }

  const xmlPath = resolveChildPath(options.xmlCacheDir, harvestable.path, 'DataCore harvestable preset XML path');
  const xml = await fs.readFile(xmlPath, 'utf8');
  const $ = loadXml(xml);
  const entityGuid = graphGuidReference(harvestable, ['entityClass'], $(':root').first().attr('entityClass') ?? '');
  const entity = entityGuid ? options.graph.getByRef(entityGuid) : undefined;

  return {
    harvestableClass: harvestable.entityClass,
    harvestablePath: harvestable.path,
    entityGuid,
    entityClass: entity?.entityClass ?? '',
    entityPath: entity?.path ?? '',
  };
}

function isMiningSlot(record: DataCoreRecordNode, taggedConfigName: string, harvestable: ResolvedHarvestable): boolean {
  const hasResolvedTarget = Boolean(harvestable.harvestablePath || harvestable.entityPath || harvestable.entityClass);
  if (hasResolvedTarget) {
    return (
      harvestable.entityPath.includes('/entities/mineable/') ||
      /mineable|mining/i.test(harvestable.harvestableClass) ||
      /mineable|mining/i.test(harvestable.entityClass)
    );
  }

  return /mineable|mining/i.test(record.entityClass) || /mineable|mining/i.test(taggedConfigName);
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}

function emptyHarvestable(): ResolvedHarvestable {
  return {
    harvestableClass: '',
    harvestablePath: '',
    entityGuid: '',
    entityClass: '',
    entityPath: '',
  };
}
