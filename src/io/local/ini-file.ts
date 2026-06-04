/**
 * Compatibility re-export for older imports.
 * Localization-aware INI parsing and writing now lives in `src/localization/ini-file`.
 */
export {
  backupIniFile,
  findIniKey,
  readIniFile,
  writeIniFile,
  writeIniFileIfChanged,
} from '../../localization/ini-file';
