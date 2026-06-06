import type { ItemConfig } from '../../enrichment/item-config';
import { getLogger, type LogAttributes } from '../../infrastructure/logger';

const logger = getLogger('desc-key-match');

export interface DescKeyMatchConfig {
  label: string;
  descKeyMatch: ItemConfig['descKeyMatch'];
}

export interface DescKeyMatchOverlap {
  key: string;
  labels: string[];
}

export interface DescKeyMatchLogger {
  warn(message: string, attributes?: LogAttributes): void;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

export function findDescKeyMatchOverlaps(configs: DescKeyMatchConfig[], sampleKeys: string[]): DescKeyMatchOverlap[] {
  const overlaps: DescKeyMatchOverlap[] = [];

  for (const key of sampleKeys) {
    const normalizedKey = normalizeKey(key);
    const labels = configs.filter((config) => config.descKeyMatch(normalizedKey)).map((config) => config.label);
    if (labels.length > 1) {
      overlaps.push({ key, labels });
    }
  }

  return overlaps;
}

export function logDescKeyMatchOverlaps(
  configs: DescKeyMatchConfig[],
  sampleKeys: string[],
  diagnosticLogger: DescKeyMatchLogger = logger,
): DescKeyMatchOverlap[] {
  const overlaps = findDescKeyMatchOverlaps(configs, sampleKeys);

  for (const overlap of overlaps) {
    diagnosticLogger.warn('descKeyMatch overlap detected', {
      key: overlap.key,
      matches: overlap.labels.join(', '),
      matchCount: overlap.labels.length,
    });
  }

  return overlaps;
}
