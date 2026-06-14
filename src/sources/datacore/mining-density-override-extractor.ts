import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { graphGuidReferences } from './record-graph-relations';
import type { DataCoreMiningDensityOverrideRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_DENSITY_OVERRIDE_PATH_PREFIX = 'libs/foundry/records/densityclasses/overrides';

export interface ExtractDataCoreMiningDensityOverridesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningDensityOverrides(
  options: ExtractDataCoreMiningDensityOverridesOptions,
): Promise<DataCoreMiningDensityOverrideRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_DENSITY_OVERRIDE_PATH_PREFIX)
    .filter((record) => record.rootType === 'SEntityDensityClassOverridesRecord')
    .filter((record) => /mining|asteroidbase/i.test(record.entityClass))
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningDensityOverrideRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining density override XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);

    $('SDensityClassLifetimeOverrideEntry').each((_index, element) => {
      const entry = $(element);
      const densityClassGuid = entry.attr('densityClass')
        ? graphGuidReference(record, ['densityClass'], entry.attr('densityClass') ?? '')
        : '';
      const densityClass = densityClassGuid ? options.graph.getByRef(densityClassGuid) : undefined;
      const lifetime = entry.find('> lifetimeOverride > TimeValue_Partitioned').first();
      const lifetimeDays = lifetime.attr('days') ?? '';
      const lifetimeHours = lifetime.attr('hours') ?? '';
      const lifetimeMinutes = lifetime.attr('minutes') ?? '';
      const lifetimeSeconds = lifetime.attr('seconds') ?? '';

      rows.push({
        ref: record.ref,
        path: record.path,
        overrideClass: record.entityClass,
        densityClassGuid,
        densityClass: densityClass?.entityClass ?? '',
        densityClassPath: densityClass?.path ?? '',
        lifetimeDays,
        lifetimeHours,
        lifetimeMinutes,
        lifetimeSeconds,
        lifetimeTotalSeconds: totalSeconds(lifetimeDays, lifetimeHours, lifetimeMinutes, lifetimeSeconds),
      });
    });
  }

  return rows;
}

function totalSeconds(days: string, hours: string, minutes: string, seconds: string): string {
  const values = [days, hours, minutes, seconds].map((value) => Number(value || '0'));
  if (values.some((value) => !Number.isFinite(value))) return '';
  return String(values[0] * 86400 + values[1] * 3600 + values[2] * 60 + values[3]);
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const graphRefs = graphGuidReferences(record, attributes);
  if (graphRefs.length > 0) return graphRefs.length === 1 ? graphRefs[0] : '';
  return fallback;
}
