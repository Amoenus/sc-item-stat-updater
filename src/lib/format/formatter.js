const UNICODE_SPACE_PATTERN = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\u200C\u200D\u2060]/g;

export function fmtNum(val) {
  if (!val && val !== 0) return '0';
  const normalizedForParse = String(val).replace(UNICODE_SPACE_PATTERN, '').replace(/,/g, '').trim();
  const num = parseFloat(normalizedForParse);
  if (Number.isNaN(num)) return String(val).replace(UNICODE_SPACE_PATTERN, ' ').trim();
  return num.toLocaleString('en-US');
}

/**
 * Strips raw newlines, control characters, and unsupported Unicode spaces from an INI value.
 * Preserves intentional \n escape sequences used by the game engine.
 */
export function sanitizeIniValue(value) {
  return String(value)
    .replace(/[\r\n]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(UNICODE_SPACE_PATTERN, ' ');
}
