const NAME_LINE_PATTERN = /^(item_.*?)=(.*)$/i;
const AUX_NAME_KEY_SUFFIX_PATTERN = /_(desc|short|mag|ammo)$/i;

const KNOWN_VARIANT_SUFFIX_BASES = new Set([
  'acid',
  'arctic',
  'black',
  'blue',
  'brown',
  'camo',
  'cc',
  'cen',
  'chromic',
  'collector',
  'cyan',
  'fallout',
  'firerats',
  'gold',
  'gray',
  'green',
  'grey',
  'iae',
  'imp',
  'lumi',
  'luminalia',
  'orange',
  'pink',
  'purple',
  'red',
  'silver',
  'store',
  'sunset',
  'tan',
  'teal',
  'tint',
  'uee',
  'urban',
  'white',
  'yellow',
]);

function isKnownVariantSuffix(suffix: string): boolean {
  const lower = suffix.toLowerCase();
  return (
    KNOWN_VARIANT_SUFFIX_BASES.has(lower) || KNOWN_VARIANT_SUFFIX_BASES.has(lower.replace(/[0-9]+[a-z]{0,10}$/, ''))
  );
}

const BRACKET_TAG_PATTERN = /^\[[A-Z0-9| ]+\]\s+/i;
const COMPONENT_PREFIX_PATTERN = /^[^/\s]+\/[^/\s]*\/[^ ]*\s+/u;

export function normalizeSpaces(value: unknown): string {
  let str: string;
  if (value == null) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else {
    str = JSON.stringify(value);
  }
  return str
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function parseNameLine(line: string): { key: string; value: string } | null {
  const match = NAME_LINE_PATTERN.exec(line);
  if (!match) {
    return null;
  }
  return {
    key: match[1],
    value: match[2],
  };
}

function isAuxiliaryNameKey(key: string): boolean {
  return AUX_NAME_KEY_SUFFIX_PATTERN.test(key);
}

export function toVariantFamilyKey(key: string): string {
  const keyLower = String(key || '').toLowerCase();
  const parts = keyLower.split('_');
  if (parts.length < 2) {
    return keyLower;
  }

  const last = parts[parts.length - 1];
  if (last === undefined) {
    return keyLower;
  }
  if (isKnownVariantSuffix(last)) {
    return parts.slice(0, -1).join('_');
  }

  return keyLower;
}

export function buildVariantFamilyIndex(lines: string[]): Map<string, number[]> {
  const familyIndex = new Map();

  for (let idx = 0; idx < lines.length; idx++) {
    const parsed = parseNameLine(lines[idx]);
    if (!parsed) {
      continue;
    }

    if (isAuxiliaryNameKey(parsed.key)) {
      continue;
    }

    const familyKey = toVariantFamilyKey(parsed.key);
    const existing = familyIndex.get(familyKey);
    if (existing) {
      existing.push(idx);
    } else {
      familyIndex.set(familyKey, [idx]);
    }
  }

  return familyIndex;
}

function stripLeadingTitleTag(value: unknown): string {
  let clean: string;
  if (value == null) {
    clean = '';
  } else if (typeof value === 'string') {
    clean = value;
  } else {
    clean = JSON.stringify(value);
  }
  clean = clean.trimStart();
  for (let i = 0; i < 2; i++) {
    const withoutBracket = clean.replace(BRACKET_TAG_PATTERN, '');
    const withoutPrefix = withoutBracket.replace(COMPONENT_PREFIX_PATTERN, '');
    if (withoutPrefix === clean) {
      break;
    }
    clean = withoutPrefix.trimStart();
  }
  return clean;
}

export function applyTagToFamily(
  lines: string[],
  familyIndex: Map<string, number[]>,
  familyKey: string,
  buildValueFromName: (cleanName: string) => string,
): number {
  const indexes = familyIndex.get(familyKey) || [];
  let updatedCount = 0;

  for (const idx of indexes) {
    const parsed = parseNameLine(lines[idx]);
    if (!parsed) {
      continue;
    }
    if (isAuxiliaryNameKey(parsed.key)) {
      continue;
    }

    const cleanName = stripLeadingTitleTag(parsed.value);
    const newValue = buildValueFromName(cleanName);
    if (newValue === parsed.value) {
      continue;
    }

    lines[idx] = `${parsed.key}=${newValue}`;
    updatedCount++;
  }

  return updatedCount;
}
