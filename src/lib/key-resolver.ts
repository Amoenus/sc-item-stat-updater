/**
 * Compatibility re-export for older imports.
 * Localization key resolution now lives in `src/localization/key-resolver`.
 */
export { buildReverseNameIndex, resolveLocalizationKeys } from '../localization/key-resolver';
export type { ResolvedRow } from '../localization/key-resolver';
