const UNICODE_SPACE_PATTERN = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]|\u200B|\u200C|\u200D|\u2060/g;

export function fmtNum(val: unknown): string {
  if (!val && val !== 0) return '0';
  let raw: string;
  if (val == null) {
    raw = '';
  } else if (typeof val === 'string') {
    raw = val;
  } else {
    raw = JSON.stringify(val);
  }
  const normalizedForParse = raw.replace(UNICODE_SPACE_PATTERN, '').replaceAll(',', '').trim();
  const num = Number.parseFloat(normalizedForParse);
  if (Number.isNaN(num)) return raw.replace(UNICODE_SPACE_PATTERN, ' ').trim();
  return num.toLocaleString('en-US');
}

/**
 * Strips raw newlines, control characters, and unsupported Unicode spaces from an INI value.
 * Preserves intentional \n escape sequences used by the game engine.
 */
export function sanitizeIniValue(value: unknown): string {
  return String(value)
    .replace(/[\r\n]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(UNICODE_SPACE_PATTERN, ' ');
}
