import { getLogger } from '../../infrastructure/logger';
import {
  createDataCoreRelationshipIndex,
  normalizeDataCoreRelationshipLocalizationKey,
  type DataCoreRelationshipIndex,
} from '../../sources/datacore/relationship-index';
import { loadDataCoreRecordGraph } from '../../sources/datacore/record-graph-loader';
import type { DataCoreLocalizationReference } from '../../sources/datacore/types';

const logger = getLogger('datacore-title-key-utils');

const TITLE_LOCALIZATION_ATTRIBUTES = new Set(['displayname', 'name', 'shortname']);
const PLACEHOLDER_LOCALIZATION_KEYS = new Set(['loc_empty', 'loc_placeholder']);

export async function loadOptionalDataCoreRelationshipIndex(datacoreDir: string): Promise<DataCoreRelationshipIndex> {
  try {
    return createDataCoreRelationshipIndex(await loadDataCoreRecordGraph({ versionDir: datacoreDir }));
  } catch (err) {
    logger.debug('Skipping DataCore record graph title lookup; record graph is missing or unreadable', {
      datacoreDir,
      error: err instanceof Error ? err.message : String(err),
    });
    return createDataCoreRelationshipIndex(null);
  }
}

export function getGraphTitleLocalizationKeys(
  row: Record<string, string>,
  relationships: DataCoreRelationshipIndex,
): string[] {
  const record = relationships.getRecordForEntityClass(row['Entity Class']);
  return uniqueKeys(
    (record?.localizationKeys ?? [])
      .filter(({ attribute }) => isTitleLocalizationAttribute(attribute))
      .map(({ key }) => normalizeDataCoreRelationshipLocalizationKey(key))
      .filter(isUsableLocalizationKey)
      .sort((a, b) => a.localeCompare(b)),
  );
}

function isTitleLocalizationAttribute(attribute: DataCoreLocalizationReference['attribute']): boolean {
  return TITLE_LOCALIZATION_ATTRIBUTES.has(attribute.trim().toLowerCase());
}

function isUsableLocalizationKey(key: string): boolean {
  return key !== '' && !PLACEHOLDER_LOCALIZATION_KEYS.has(key);
}

function uniqueKeys(keys: string[]): string[] {
  return [...new Set(keys)];
}
