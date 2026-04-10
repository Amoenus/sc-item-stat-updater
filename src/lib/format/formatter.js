export function fmtNum(val) {
  if (!val && val !== 0) return '0';
  const s = String(val).replace(/,/g, '');
  const num = parseFloat(s);
  if (Number.isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

/**
 * Strips raw newlines and control characters from an INI value.
 * Preserves intentional \\n escape sequences used by the game engine.
 */
export function sanitizeIniValue(value) {
  return String(value)
    .replace(/[\r\n]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}
