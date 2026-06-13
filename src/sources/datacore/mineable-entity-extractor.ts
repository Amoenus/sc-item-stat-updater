import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMineableEntityRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINEABLE_ENTITY_PATH_PREFIX = 'libs/foundry/records/entities/mineable';

export interface ExtractDataCoreMineableEntitiesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMineableEntities(
  options: ExtractDataCoreMineableEntitiesOptions,
): Promise<DataCoreMineableEntityRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINEABLE_ENTITY_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMineableEntityRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mineable entity XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    const mineableParams = $('MineableParams').first();
    if (!root.length || !mineableParams.length) continue;

    const compositionGuid = graphGuidReference(record, ['composition'], mineableParams.attr('composition') ?? '');
    const composition = compositionGuid ? options.graph.getByRef(compositionGuid) : undefined;
    const globalParamsGuid = graphGuidReference(record, ['globalParams'], mineableParams.attr('globalParams') ?? '');
    const globalParams = globalParamsGuid ? options.graph.getByRef(globalParamsGuid) : undefined;
    const audioParamsGuid = graphGuidReference(record, ['audioParams'], mineableParams.attr('audioParams') ?? '');
    const audioParams = audioParamsGuid ? options.graph.getByRef(audioParamsGuid) : undefined;
    const densityClassGuid = graphGuidReference(record, ['entityDensityClass'], root.attr('entityDensityClass') ?? '');
    const densityClass = densityClassGuid ? options.graph.getByRef(densityClassGuid) : undefined;

    rows.push({
      ref: record.ref,
      path: record.path,
      entityClass: record.entityClass,
      compositionGuid,
      compositionClass: composition?.entityClass ?? '',
      globalParamsGuid,
      globalParamsClass: globalParams?.entityClass ?? '',
      audioParamsGuid,
      audioParamsClass: audioParams?.entityClass ?? '',
      densityClassGuid,
      densityClass: densityClass?.entityClass ?? '',
      filledFactor: mineableParams.attr('filledFactor') ?? '',
      glowCurvePower: mineableParams.attr('glowCurvePower') ?? '',
      glowLerpSpeed: mineableParams.attr('glowLerpSpeed') ?? '',
      allowAutoRespawning: $('HarvestableParams').first().attr('allowAutoRespawning') ?? '',
    });
  }

  return rows;
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.referencedGuidAttributes
      ?.filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      .map((reference) => reference.value.trim())
      .find((value) => value !== '') ?? fallback
  );
}
