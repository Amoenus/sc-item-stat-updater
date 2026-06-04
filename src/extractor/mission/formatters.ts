/**
 * Flattens a value into a string.
 */
export function flattenValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function optionalValue<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function emptyValue<T>(value: T | null | undefined): T | '' {
  return value ?? '';
}

export function formatUec(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} aUEC`;
}

export function formatTimeLimit(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

/**
 * Formats a cooldown duration (in minutes) as a human-readable string.
 */
export function formatCooldownMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function formatRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}-${max}`;
}

/**
 * Normalizes a localization key.
 */
export function normalizeLocalizationKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  return key.startsWith('@') ? key.slice(1) : key;
}
