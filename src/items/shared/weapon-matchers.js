/**
 * Shared weapon manufacturer prefixes and weapon type identifiers
 * used by both default weapon configs and SPViewer weapon configs.
 */

export const WEAPON_DESC_PREFIXES = [
  'desckbar_',
  'descbehr_',
  'deschrst_',
  'descklwe_',
  'descespr_',
  'descprar_',
  'descasad_',
  'descvncl_',
  'descglsn_',
  'desckrig_',
  'desc_kbar',
  'desc_behr',
  'desc_hrst',
  'desc_klwe',
  'desc_espr',
  'desc_grin',
];

export const WEAPON_TYPES = ['cannon', 'repeater', 'gatling', 'scattergun', 'massdriver', 'laser', 'distortion'];

/**
 * Matches a lowercased INI key against known weapon description patterns.
 * @param {string} keyLower
 * @returns {boolean}
 */
export function isWeaponDescKey(keyLower) {
  return WEAPON_DESC_PREFIXES.some((p) => keyLower.includes(p)) && WEAPON_TYPES.some((t) => keyLower.includes(t));
}
