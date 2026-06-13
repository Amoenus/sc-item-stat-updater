import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import type { DataCoreMaterialLocalizationRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

export interface ExtractDataCoreMaterialLocalizationsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreMaterialLocalizations(
  options: ExtractDataCoreMaterialLocalizationsOptions,
): Promise<DataCoreMaterialLocalizationRecord[]> {
  const records = options.graph.getByRootType('EntityClassDefinition');
  const rows: DataCoreMaterialLocalizationRecord[] = [];

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const chunkRows: DataCoreMaterialLocalizationRecord[] = [];
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore EntityClassDefinition XML path');
      const xml = await fs.readFile(xmlPath, 'utf8').catch(() => null);
      if (!xml) {
        completed++;
        return chunkRows;
      }
      const $ = loadXml(xml);

      $('ResourceContainerDefaultCompositionEntry').each((_, element) => {
        const el = $(element);
        const resourceGuid = el.attr('entry');
        if (resourceGuid) {
          const locName =
            graphLocalizationKey(record, ['Name', 'name', 'displayName', 'ShortName']) ||
            normalizeLocalizationKey($('Localization').first().attr('Name') ?? '');
          if (locName) {
            chunkRows.push({
              resourceGuid,
              localizationKey: locName,
            });
          }
        }
      });

      completed++;
      options.onProgress?.(completed, records.length);
      return chunkRows;
    },
    50,
  );

  const flat = mapped.flat();
  // Deduplicate
  const seen = new Set<string>();
  for (const row of flat) {
    if (!seen.has(row.resourceGuid)) {
      seen.add(row.resourceGuid);
      rows.push(row);
    }
  }

  options.onProgress?.(records.length, records.length);
  return rows;
}

function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  const key = record.localizationKeys.find((reference) =>
    expectedAttributes.has(reference.attribute.toLowerCase()),
  )?.key;
  return isUsableLocalizationKey(key) ? (key ?? '') : '';
}

function isUsableLocalizationKey(value: string | undefined): boolean {
  const normalized = normalizeLocalizationKey(value ?? '');
  return normalized !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized);
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}
