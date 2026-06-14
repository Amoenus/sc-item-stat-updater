import type { ItemConfig } from '../../enrichment/item-config';

export interface DataCoreFieldReferenceSelector {
  selector: string;
  attr: string;
  /**
   * DataCore graph reference attribute to prefer before reading XML. Defaults
   * to `attr` for GUID refs; entity-class refs use XML unless this is explicit.
   */
  graphAttribute?: string;
  by?: 'entityClass' | 'ref';
  fallback?: DataCoreFieldReferenceSelector | DataCoreFieldReferenceSelector[];
}

export type DataCoreFieldSelector =
  | string
  | {
      selector: string;
      attr?: string;
      attrs?: string[];
      index?: number;
      separator?: string;
      format?:
        | 'count'
        | 'number-pair'
        | 'percent'
        | 'percent-pair'
        | 'product'
        | 'scaled-number'
        | 'scaled-number-pair'
        | 'sum';
      scale?: number;
      ref?: DataCoreFieldReferenceSelector | DataCoreFieldReferenceSelector[];
    }
  | {
      derive: (row: Record<string, string>) => string;
    };

/**
 * Configuration for the DataCore scraper to know how to extract data
 * for a specific item type from DataForge XML files.
 *
 * Each `src/items/datacore/<type>.ts` file exports a `DATACORE_TYPE_CONFIG`
 * alongside the `ItemConfig` default export used by the updater.
 */
export interface DataCoreItemTypeConfig {
  /**
   * Substring matched (case-insensitively) against the full path of each XML
   * record file produced by `unforge.cli.exe`. Used to isolate entity records
   * for a specific item type.
   *
   * Expected unforge output paths follow the form:
   *   libs/foundry/records/entities/scitemvehicle/shield_generator/<name>.xml
   *
   * So for shields a filter of 'scitemvehicle/shield_generator' or
   * 'shield_generator' would both match. Use a specific enough value to
   * avoid matching unrelated types.
   *
   * ⚠️ These values are best-effort guesses based on expected naming conventions.
   * Verify against the actual unforged directory tree and update if needed.
   */
  recordFilter: string | string[];

  /**
   * Optional selector that must match within a path-matched XML record before
   * the row is emitted. Useful when multiple item types share one DataCore
   * directory but have distinct component parameter blocks.
   */
  recordSelector?: string;

  /**
   * By default, scraper discovery also scans DataCore entity records for
   * `recordSelector` matches outside `recordFilter` paths. Disable this for
   * broad selectors that would match shared helper records from unrelated item
   * families.
   */
  includeStructuralDiscovery?: boolean;

  /**
   * Prefix to strip from the entity class name before constructing the
   * INI name key suffix. E.g. 'shield_' → suffix is 'behr_s01_5sa'.
   *
   * ⚠️ These patterns are best-effort derivations. Verify against real game
   * files — the entity class naming may differ from the INI key format.
   */
  entityClassPrefix: string;

  /**
   * INI key infix inserted between 'item_Name' and the uppercase suffix.
   * E.g. 'SHLD_' → key is 'item_NameSHLD_BEHR_S01_5SA'.
   *
   * ⚠️ These patterns are best-effort derivations. Verify against real game
   * files — the INI key format may differ from the entity class prefix.
   */
  nameKeyInfix: string;

  /**
   * CSS selectors for type-specific stat fields in cheerio XML mode.
   * The scraper applies `xmlVal($, selector)` which handles both the
   * DataForge `value` attribute format and plain text content.
   *
   * Common fields (Entity Class, Size, Grade, Class, Manufacturer, Health)
   * are extracted by the scraper automatically via shared parser functions
   * and do NOT need to be listed here.
   *
   * ⚠️ XML paths are based on DataForge field names from community
   * documentation. Verify against actual unforged game files.
   */
  fieldSelectors: Record<string, DataCoreFieldSelector>;

  /**
   * Optional dynamic row exclusion after common and type-specific DataCore
   * fields have been extracted. Use this when a broad structural selector
   * intentionally finds mixed records and the extracted DataCore relationship
   * data identifies rows that belong to a more specific item family.
   */
  excludeRow?: (row: Record<string, string>) => boolean;
}

/**
 * A DataCore item type module exports both an `ItemConfig` (used by the
 * updater, as the default export) and a `DataCoreItemTypeConfig` (used by
 * the scraper, named `DATACORE_TYPE_CONFIG`).
 */
export interface DataCoreItemTypeModule {
  default: ItemConfig;
  DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig;
}

/**
 * Factory that creates a `getTargetKeys` implementation for DataCore item
 * configs where the INI key can be derived directly from the entity class name
 * using a consistent prefix/infix substitution.
 *
 * For item types where key derivation is irregular (e.g. weapons with mixed
 * prefixes), implement `getTargetKeys` directly in the item config instead.
 */
export function makeGetTargetKeys(
  entityClassPrefix: string,
  nameKeyInfix: string,
): NonNullable<ItemConfig['getTargetKeys']> {
  return (row, deriveDescKey) => {
    const rawKeys = getRawDataCoreTargetKeys(row, deriveDescKey);
    if (rawKeys.length > 0) return rawKeys;

    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    if (entityClassPrefix && !entityClass.toLowerCase().startsWith(entityClassPrefix.toLowerCase())) return [];
    const suffix = entityClass.replace(new RegExp(`^${entityClassPrefix}`, 'i'), '').toUpperCase();
    const nameKey = `item_Name${nameKeyInfix}${suffix}`;
    return [deriveDescKey(nameKey)];
  };
}

/**
 * Factory that creates a `getTargetKeys` implementation for DataCore item
 * configs where multiple entity class prefixes map to different INI key infixes.
 *
 * Each entry in `prefixMap` is a `[prefix, infix]` pair. The first matching
 * prefix is used to derive the key; unmatched entity classes return `[]`.
 */
export function makeGetTargetKeysFromPrefixMap(
  prefixMap: Array<[string, string]>,
): NonNullable<ItemConfig['getTargetKeys']> {
  return (row, deriveDescKey) => {
    const rawKeys = getRawDataCoreTargetKeys(row, deriveDescKey);
    if (rawKeys.length > 0) return rawKeys;

    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    for (const [pfx, infix] of prefixMap) {
      if (entityClass.toLowerCase().startsWith(pfx)) {
        const suffix = entityClass.slice(pfx.length).toUpperCase();
        return [deriveDescKey(`item_Name${infix}${suffix}`)];
      }
    }
    return [];
  };
}

export function getRawDataCoreTargetKeys(
  row: Record<string, string>,
  deriveDescKey: (nameKey: string) => string,
): string[] {
  const descriptionKey = getExplicitDataCoreDescriptionKey(row);
  if (descriptionKey) return [descriptionKey];

  const nameKey = usableDataCoreLocalizationKey(row['Name Key']);
  return nameKey ? [deriveDescKey(nameKey)] : [];
}

export function getExplicitDataCoreDescriptionKey(row: Record<string, string>): string {
  return usableDataCoreLocalizationKey(row['Description Key']);
}

export function addAlternateDescKeysWhenDataCoreLacksDescription(
  row: Record<string, string>,
  targetKeys: string[],
  getAlternateDescKeys: (descKey: string) => string[],
): string[] {
  if (getExplicitDataCoreDescriptionKey(row)) return targetKeys;
  return targetKeys.flatMap((key) => [key, ...getAlternateDescKeys(key)]);
}

export function makeAlternateDataCoreDescKeys(
  infix: string,
  options: { includeScItemAlias?: boolean } = {},
): (descKey: string) => string[] {
  return (descKey) => {
    const altKeys = new Set<string>();
    const candidates = [descKey];
    if (options.includeScItemAlias) {
      if (/_SCItem$/i.test(descKey)) {
        candidates.push(descKey.replace(/_SCItem$/i, ''));
      } else {
        candidates.push(`${descKey}_SCItem`);
      }
    }

    for (const candidate of candidates) {
      altKeys.add(candidate);
      const underscored = `item_Desc_${infix}_`;
      const compact = `item_Desc${infix}_`;
      if (candidate.includes(underscored)) {
        altKeys.add(candidate.replace(underscored, compact));
      }
      if (candidate.includes(compact)) {
        altKeys.add(candidate.replace(compact, underscored));
      }
    }

    altKeys.delete(descKey);
    return [...altKeys];
  };
}

export function usableDataCoreLocalizationKey(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  const normalized = trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
  return normalized && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized) ? normalized : '';
}
