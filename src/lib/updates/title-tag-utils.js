const NAME_LINE_PATTERN = /^(item_name_?.*?)=(.*)$/i;
const AUX_NAME_KEY_SUFFIX_PATTERN = /_(short|mag|ammo)$/i;

const KNOWN_VARIANT_SUFFIX_PATTERN =
  /^(?:tint\d*|store\d*|collector\d*|iae\d*|cc\d*[a-z]*|lumi(?:nalia)?[a-z0-9]*|firerats\d*|acid\d*|chromic\d*|sunset\d*|cen\d*|imp\d*|uee\d*|black\d*|blue\d*|green\d*|red\d*|white\d*|yellow\d*|orange\d*|purple\d*|pink\d*|tan\d*|gold\d*|silver\d*|grey\d*|gray\d*|teal\d*|cyan\d*|brown\d*|camo\d*|urban\d*|arctic\d*|fallout\d*)$/i;

const BRACKET_TAG_PATTERN = /^\[[A-Z0-9| ]+\]\s+/i;
const COMPONENT_PREFIX_PATTERN = /^[^/\s]+\/[^/\s]*\/[^ ]*\s+/u;

export function normalizeSpaces(value) {
  return String(value || '')
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function parseNameLine(line) {
  const match = NAME_LINE_PATTERN.exec(line);
  if (!match) {
    return null;
  }
  return {
    key: match[1],
    value: match[2],
  };
}

export function isAuxiliaryNameKey(key) {
  return AUX_NAME_KEY_SUFFIX_PATTERN.test(key);
}

export function toVariantFamilyKey(key) {
  const keyLower = String(key || '').toLowerCase();
  const parts = keyLower.split('_');
  if (parts.length < 2) {
    return keyLower;
  }

  const last = parts[parts.length - 1];
  if (KNOWN_VARIANT_SUFFIX_PATTERN.test(last)) {
    return parts.slice(0, -1).join('_');
  }

  return keyLower;
}

export function buildVariantFamilyIndex(lines) {
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

export function stripLeadingTitleTag(value) {
  let clean = String(value || '').trimStart();
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

export function resolveBaseFromCurrentValue(currentValue, lookupMap) {
  const normalized = normalizeSpaces(currentValue);
  if (!normalized) {
    return null;
  }

  const exact = lookupMap.get(normalized.toLowerCase());
  if (exact) {
    return exact;
  }

  const clean = normalizeSpaces(stripLeadingTitleTag(currentValue));
  return lookupMap.get(clean.toLowerCase()) || null;
}

export function applyTagToFamily(lines, familyIndex, familyKey, buildValueFromName) {
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
