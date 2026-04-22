import { sanitizeIniValue } from './format/formatter.js';

const CUSTOM_RAW_DISPLAY_OVERRIDES = new Map([
  ['items_commodities_hephaestanite_raw', 'Heph (Raw)'],
]);

const ILLEGAL_COMMODITY_NAME_KEYS = new Set([
  'items_commodities_widow',
  'items_commodities_slam',
  'items_commodities_neon',
  'items_commodities_maze',
  'items_commodities_etam',
  'items_commodities_revenanttreepollen',
  'items_commodities_altruciatoxin',
  'items_commodities_gaspingweevileggs',
]);

const RAW_KEY_PREFIX = 'items_commodities_raw_';
const RAW_KEY_SUFFIX = '_raw';

function normalizeIniNameKey(key) {
  const commaIndex = key.indexOf(',');
  const baseKey = commaIndex === -1 ? key : key.slice(0, commaIndex);
  return baseKey.toLowerCase().replace(/_unprocessed$/, '');
}

function titleCase(value) {
  return String(value)
    .split(/[-_\s]+/)
    .map((part) => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : ''))
    .join(' ');
}

function buildRawCommodityDisplay(nameKey) {
  const override = CUSTOM_RAW_DISPLAY_OVERRIDES.get(nameKey);
  if (override) return override;

  if (nameKey.startsWith(RAW_KEY_PREFIX)) {
    const base = nameKey.slice(RAW_KEY_PREFIX.length);
    return `${titleCase(base)} (Raw)`;
  }

  if (nameKey.endsWith(RAW_KEY_SUFFIX) && nameKey.startsWith('items_commodities_')) {
    const base = nameKey.slice('items_commodities_'.length, -RAW_KEY_SUFFIX.length);
    return `${titleCase(base)} (Raw)`;
  }

  return null;
}

function isIllegalCommodityKey(key) {
  const normalized = normalizeIniNameKey(key);
  return ILLEGAL_COMMODITY_NAME_KEYS.has(normalized);
}

function formatIllegalCommodityName(key, value) {
  if (!isIllegalCommodityKey(key)) return value;
  if (/^<EM3>\[!\]<\/EM3>\s*/.test(value)) return value;
  return `<EM3>[!]</EM3> ${value}`;
}

export function isRawCommodityKey(key) {
  const normalized = normalizeIniNameKey(key);
  if (normalized.endsWith('_desc')) return false;
  return normalized.startsWith(RAW_KEY_PREFIX) || normalized.endsWith(RAW_KEY_SUFFIX);
}

export function applyCommodityDisplayOverrides(lines, existingKeys) {
  const updated = [];

  for (const [key, idx] of Object.entries(existingKeys)) {
    const normalizedKey = normalizeIniNameKey(key);
    let desiredValue = null;

    if (isRawCommodityKey(key)) {
      desiredValue = buildRawCommodityDisplay(normalizedKey);
    } else if (isIllegalCommodityKey(key)) {
      const line = lines[idx];
      const eqIndex = line.indexOf('=');
      if (eqIndex < 0) continue;
      const currentValue = line.substring(eqIndex + 1);
      desiredValue = formatIllegalCommodityName(normalizedKey, currentValue);
    }

    if (!desiredValue) continue;

    const line = lines[idx];
    const eqIndex = line.indexOf('=');
    if (eqIndex < 0) continue;

    const currentValue = line.substring(eqIndex + 1);
    const sanitizedValue = sanitizeIniValue(desiredValue);
    if (currentValue !== sanitizedValue) {
      lines[idx] = `${key}=${sanitizedValue}`;
      updated.push({ key, from: currentValue, to: sanitizedValue });
    }
  }

  return {
    updatedCount: updated.length,
    updates: updated,
  };
}
