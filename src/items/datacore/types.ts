import type { ItemConfig } from '../../enrichment/item-config';

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
      ref?: {
        selector: string;
        attr: string;
      };
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
  const descriptionKey = usableLocalizationKey(row['Description Key']);
  if (descriptionKey) return [descriptionKey];

  const nameKey = usableLocalizationKey(row['Name Key']);
  return nameKey ? [deriveDescKey(nameKey)] : [];
}

function usableLocalizationKey(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed && trimmed !== 'LOC_EMPTY' && trimmed !== 'LOC_UNINITIALIZED' ? trimmed : '';
}
