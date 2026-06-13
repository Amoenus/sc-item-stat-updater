import type { DataCoreMissionLocalizationRecord, DataCoreRecordGraph } from './types';

function isMissionLikeRecord(rootType: string, path: string): boolean {
  return (
    /Mission|Contract/i.test(rootType) ||
    /libs\/foundry\/records\/(?:missionbroker|missiondata|contracts)\//i.test(path)
  );
}

function isUsableLocalizationKey(key: string): boolean {
  return key.length > 0 && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(key);
}

function localizationRole(key: string, attribute: string): string {
  if (/_title/i.test(key) || /^title$/i.test(attribute)) return 'title';
  if (/_desc|_description/i.test(key) || /description/i.test(attribute)) return 'description';
  return 'other';
}

export function extractDataCoreMissionLocalization(graph: DataCoreRecordGraph): DataCoreMissionLocalizationRecord[] {
  const rows: DataCoreMissionLocalizationRecord[] = [];
  const seen = new Set<string>();

  for (const record of graph.records) {
    if (!isMissionLikeRecord(record.rootType, record.path)) continue;

    for (const reference of record.localizationKeys) {
      if (!isUsableLocalizationKey(reference.key)) continue;
      const fingerprint = `${record.path}\0${reference.attribute}\0${reference.key}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      rows.push({
        localizationKey: reference.key,
        localizationRole: localizationRole(reference.key, reference.attribute),
        attribute: reference.attribute,
        rootType: record.rootType,
        entityClass: record.entityClass,
        ref: record.ref,
        path: record.path,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.localizationKey.localeCompare(b.localizationKey) ||
      a.path.localeCompare(b.path) ||
      a.attribute.localeCompare(b.attribute),
  );
}
